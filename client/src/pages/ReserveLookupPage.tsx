import { useState } from 'react'
import TicketCard from '../components/TicketCard'
import { lookupTicket, requestRefund } from '../lib/api'
import { DEPOSIT_ACCOUNT_HOLDER, DEPOSIT_ACCOUNT_NUMBER, DEPOSIT_BANK, PRICE_PER_PERSON } from '../lib/deposit'
import type { Ticket } from '../lib/types'

type LookupMode = 'person' | 'booking'

export default function ReserveLookupPage() {
  const [mode, setMode] = useState<LookupMode>('person')
  const [form, setForm] = useState({ name: '', phone: '', bookingNo: '' })
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundForm, setRefundForm] = useState({ accountHolder: '', bankName: '', accountNumber: '' })
  const [refundMessage, setRefundMessage] = useState<string | null>(null)
  const [showPaidNotice, setShowPaidNotice] = useState(false)

  async function onLookup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setRefundMessage(null)
    setTicket(null)
    setLoading(true)
    try {
      const normalizedPhone = form.phone.replace(/\D/g, '')
      const t =
        mode === 'booking'
          ? await lookupTicket({ mode: 'booking', bookingNo: form.bookingNo.trim().toUpperCase() })
          : await lookupTicket({ mode: 'person', name: form.name.trim(), phone: normalizedPhone })
      setTicket(t)
      setShowPaidNotice(Boolean(t.isPaid))
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회 실패')
    } finally {
      setLoading(false)
    }
  }

  async function onRefundSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ticket) return
    setError(null)
    try {
      const result = await requestRefund(ticket._id, refundForm)
      setTicket(result.ticket)
      setRefundMessage(result.message)
      setRefundOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '환불신청 실패')
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10 animate-fade-up">
      <h1 className="text-xl font-bold text-zinc-50">예약 확인</h1>

      <form onSubmit={onLookup} className="ui-card mt-6 space-y-4 p-5">
        <div className="flex gap-3 text-sm text-zinc-200">
          <label className="inline-flex items-center gap-2">
            <input type="radio" checked={mode === 'person'} onChange={() => setMode('person')} />
            이름+전화번호로 찾기
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" checked={mode === 'booking'} onChange={() => setMode('booking')} />
            예매번호로 조회하기
          </label>
        </div>

        {mode === 'person' ? (
          <div className="grid gap-3">
            <div>
              <label className="text-sm text-zinc-300">예약자명</label>
              <input className="ui-input mt-1" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <label className="text-sm text-zinc-300">연락처</label>
              <input
                className="ui-input mt-1"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-sm text-zinc-300">예매번호</label>
            <input
              className="ui-input mt-1 font-mono"
              value={form.bookingNo}
              onChange={(e) => setForm((p) => ({ ...p, bookingNo: e.target.value }))}
              placeholder="GT-20260625-ABC"
              required
            />
          </div>
        )}

        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        <button type="submit" disabled={loading} className="ui-btn-primary w-full">
          {loading ? '조회 중…' : '조회하기'}
        </button>
      </form>

      {ticket && !ticket.isPaid ? (
        <div className="mt-4 ui-card p-4 text-sm text-zinc-200">
          <div className="font-semibold text-zinc-50">입금 안내</div>
          <div className="mt-2 text-zinc-300">
            지정계좌로{' '}
            <span className="font-bold text-sky-200">{(ticket.headcount * PRICE_PER_PERSON).toLocaleString()}원</span>
            을 입금해주시면 예약을 확정해드리겠습니다.
          </div>
          <div className="mt-2 text-amber-300">예약후 1시간이내 입금확인이 안될시 예매가 취소됩니다.</div>
          <div className="mt-2 text-zinc-300">
            <span className="font-bold text-sky-200">지정계좌</span> :{' '}
            <span className="font-semibold text-zinc-50">
              {DEPOSIT_BANK} {DEPOSIT_ACCOUNT_NUMBER}
            </span>{' '}
            <span className="text-zinc-400">예금주 {DEPOSIT_ACCOUNT_HOLDER}</span>
          </div>
          <button
            type="button"
            className="ui-btn-primary mt-3 w-full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(DEPOSIT_ACCOUNT_NUMBER)
              } catch {
                // ignore
              }
            }}
          >
            계좌번호 복사하기
          </button>
        </div>
      ) : null}

      <div className="mt-6">{ticket ? <TicketCard ticket={ticket} /> : null}</div>

      {ticket ? (
        <div className="mt-5">
          <button className="ui-btn-ghost w-full" onClick={() => setRefundOpen((v) => !v)}>
            예약취소 / 환불신청
          </button>
        </div>
      ) : null}

      {refundOpen && ticket ? (
        <form onSubmit={onRefundSubmit} className="ui-card mt-4 space-y-3 p-4">
          <div className="text-sm font-semibold text-zinc-100">환불계좌를 입력해주세요</div>
          <input
            className="ui-input"
            placeholder="예금주명"
            value={refundForm.accountHolder}
            onChange={(e) => setRefundForm((p) => ({ ...p, accountHolder: e.target.value }))}
            required
          />
          <input
            className="ui-input"
            placeholder="은행"
            value={refundForm.bankName}
            onChange={(e) => setRefundForm((p) => ({ ...p, bankName: e.target.value }))}
            required
          />
          <input
            className="ui-input"
            placeholder="환불계좌"
            value={refundForm.accountNumber}
            onChange={(e) => setRefundForm((p) => ({ ...p, accountNumber: e.target.value }))}
            required
          />
          <button className="ui-btn-primary w-full" type="submit">
            제출
          </button>
        </form>
      ) : null}

      {refundMessage ? <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-3 text-sm text-sky-100">{refundMessage}</div> : null}

      {showPaidNotice && ticket ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
          <div className="ui-card w-full max-w-md p-5">
            <div className="text-base font-semibold text-zinc-50">입금 완료 티켓입니다! 감사합니다.</div>
            <div className="mt-3 space-y-1 text-sm leading-6 text-zinc-200">
              <div>공연일시: 7/18(토)</div>
              <div>공연장소: 상수 플렉스3호점</div>
              <div>입장: 17:00~</div>
              <div>공연: 18:00~</div>
            </div>
            <button className="ui-btn-primary mt-4 w-full" onClick={() => setShowPaidNotice(false)}>
              확인
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
