import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import TicketCard from '../components/TicketCard'
import { requestRefund } from '../lib/api'
import { DEPOSIT_ACCOUNT_HOLDER, DEPOSIT_ACCOUNT_NUMBER, DEPOSIT_BANK, PRICE_PER_PERSON } from '../lib/deposit'
import type { Ticket } from '../lib/types'

export default function ReserveSuccessPage() {
  const nav = useNavigate()
  const loc = useLocation()
  const ticket = (loc.state as { ticket?: Ticket } | null)?.ticket

  const [showPaymentNotice, setShowPaymentNotice] = useState(Boolean(ticket && !ticket.isPaid))
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundForm, setRefundForm] = useState({ accountHolder: '', bankName: '', accountNumber: '' })
  const [refundMessage, setRefundMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onRefundSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ticket) return
    setError(null)
    try {
      const result = await requestRefund(ticket._id, refundForm)
      setRefundMessage(result.message)
      setRefundOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '환불신청 실패')
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10 animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-50">예매 완료</h1>
        <button className="ui-btn-ghost px-3 py-2 text-xs" onClick={() => nav('/reserve')}>
          새 예매
        </button>
      </div>

      {ticket && !ticket.isPaid ? (
        <div className="mt-3 ui-card p-4 text-sm text-zinc-200">
          <div className="font-semibold text-zinc-50">예약이 완료되었습니다.</div>
          <div className="mt-2 text-zinc-300">
            지정계좌로{' '}
            <span className="font-bold text-sky-200">
              {(ticket.headcount * PRICE_PER_PERSON).toLocaleString()}원
            </span>
            을 입금해주시면 예약을 확정해드리겠습니다.
          </div>
          <div className="mt-2 text-amber-300">
            예약후 1시간이내 입금확인이 안될시 예매가 취소됩니다.
          </div>
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

      <div className="mt-6">{ticket ? <TicketCard ticket={ticket} /> : <EmptyState />}</div>

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
          <input className="ui-input" placeholder="예금주명" value={refundForm.accountHolder} onChange={(e) => setRefundForm((p) => ({ ...p, accountHolder: e.target.value }))} required />
          <input className="ui-input" placeholder="은행" value={refundForm.bankName} onChange={(e) => setRefundForm((p) => ({ ...p, bankName: e.target.value }))} required />
          <input className="ui-input" placeholder="환불계좌" value={refundForm.accountNumber} onChange={(e) => setRefundForm((p) => ({ ...p, accountNumber: e.target.value }))} required />
          <button className="ui-btn-primary w-full" type="submit">
            제출
          </button>
        </form>
      ) : null}

      {error ? <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
      {refundMessage ? <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-3 text-sm text-sky-100">{refundMessage}</div> : null}

      <div className="mt-6 text-xs text-zinc-500">
        예매 완료 화면을 놓쳤다면 <Link className="ui-link" to="/reserve/lookup">예매번호로 조회</Link> 할 수 있어요.
      </div>

      {showPaymentNotice && ticket ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
          <div className="ui-card w-full max-w-md p-5">
            <div className="text-base font-semibold text-zinc-50">입금 안내</div>
            <div className="mt-3 text-sm leading-6 text-zinc-200">
              입금 완료까지 확인되어야 티켓이 '입금완료'티켓으로 변경되며 입장용 티켓으로 인정받으실 수 있습니다. 예약후 1시간 이내 입금을 완료해주세요!
            </div>
            <button className="ui-btn-primary mt-4 w-full" onClick={() => setShowPaymentNotice(false)}>
              확인
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EmptyState() {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 text-sm text-zinc-300">이 페이지는 예매 직후에만 바로 볼 수 있어요.</div>
}
