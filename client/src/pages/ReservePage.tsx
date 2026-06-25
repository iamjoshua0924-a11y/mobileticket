import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkDuplicate, createTicket } from '../lib/api'
import type { Ticket } from '../lib/types'

const HERO_IMAGE = 'https://i.ibb.co/wZyLCS57/20260625-142223.png'

type DuplicateFlow = 'none' | 'choose' | 'edit'

export default function ReservePage() {
  const nav = useNavigate()

  const [form, setForm] = useState({
    name: '',
    phone: '',
    headcount: 1,
    depositorName: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateTicket, setDuplicateTicket] = useState<Ticket | null>(null)
  const [duplicateFlow, setDuplicateFlow] = useState<DuplicateFlow>('none')
  const [reason, setReason] = useState('')

  const normalizedPhone = useMemo(() => form.phone.trim(), [form.phone])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submitReservation(mode: 'create' | 'replace' | 'edit') {
    setError(null)
    setLoading(true)
    try {
      const result = await createTicket({
        ...form,
        mode,
        reason: reason.trim() || undefined
      })
      setDuplicateFlow('none')
      setDuplicateTicket(null)
      setReason('')
      nav('/reserve/success', { state: { ticket: result.ticket } })
    } catch (err) {
      const e = err as Error & { code?: string; payload?: { existingTicket?: Ticket; message?: string } }

      if (e.code === 'DUPLICATE_EXISTS') {
        setDuplicateTicket(e.payload?.existingTicket || null)
        setDuplicateFlow('choose')
        setLoading(false)
        return
      }

      if (e.code === 'REASON_REQUIRED') {
        setDuplicateTicket(e.payload?.existingTicket || null)
        setDuplicateFlow('edit')
        setError('입금정보가 확정된 티켓은 수정사유가 필요합니다.')
        setLoading(false)
        return
      }

      setError(e.message || '에러가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    try {
      const duplicate = await checkDuplicate(form.name, normalizedPhone)
      if (duplicate.exists && duplicate.ticket) {
        setDuplicateTicket(duplicate.ticket)
        setDuplicateFlow('choose')
        return
      }
    } catch {
      // duplicate check 실패 시 생성 요청으로 진행
    }

    void submitReservation('create')
  }

  function applyExistingToForm() {
    if (!duplicateTicket) return
    setForm({
      name: duplicateTicket.name,
      phone: duplicateTicket.phone,
      headcount: duplicateTicket.headcount,
      depositorName: duplicateTicket.depositorName
    })
    setDuplicateFlow('edit')
  }

  const needsReason = Boolean(duplicateTicket?.isPaid)

  return (
    <div className="mx-auto max-w-md px-5 py-10 animate-fade-up">
      <div className="hero-frame animate-pulse-glow mb-6">
        <img
          src={HERO_IMAGE}
          alt="Midsummer Splash 메인 비주얼"
          className="hero-image max-h-[300px] w-full object-contain bg-slate-950/70 p-2"
          loading="eager"
        />
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-sky-300">Midsummer Splash!</h1>
      <p className="mt-2 text-sm text-zinc-400">사전 예매 후 예매 번호로 빠른 입장을 도와드립니다.</p>

      <form onSubmit={onSubmit} className="ui-card mt-8 space-y-4 p-5 hover-glow">
        <div>
          <label className="text-sm text-zinc-300">예약자명</label>
          <input className="ui-input mt-1" value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </div>

        <div>
          <label className="text-sm text-zinc-300">연락처</label>
          <input
            className="ui-input mt-1"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            inputMode="tel"
            placeholder="010-1234-5678"
            required
          />
          <p className="mt-1 text-xs text-zinc-500">동명이인 구분을 위해 끝 4자리를 사용합니다.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-zinc-300">인원수</label>
            <input
              className="ui-input mt-1"
              value={form.headcount}
              onChange={(e) => update('headcount', Number(e.target.value))}
              inputMode="numeric"
              type="number"
              min={1}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-300">입금자명</label>
            <input className="ui-input mt-1" value={form.depositorName} onChange={(e) => update('depositorName', e.target.value)} required />
          </div>
        </div>

        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

        <button type="submit" disabled={loading} className="ui-btn-primary w-full">
          {loading ? '예매 처리 중…' : '예매하기'}
        </button>
      </form>

      {duplicateFlow !== 'none' && duplicateTicket ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5">
          <div className="ui-card w-full max-w-lg overflow-hidden p-0">
            <div className="border-b border-sky-500/10 bg-slate-950/40 px-5 py-4">
              <div className="text-sm font-semibold text-zinc-50">
                {duplicateFlow === 'choose' ? '기존 예약내역이 있습니다' : '기존 예약 수정'}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                예매번호 <span className="font-mono text-zinc-200">{duplicateTicket.bookingNo}</span> · {duplicateTicket.headcount}명 ·{' '}
                <span className={duplicateTicket.isPaid ? 'text-sky-200' : 'text-amber-200'}>
                  {duplicateTicket.isPaid ? '입금됨' : '미입금'}
                </span>
              </div>
            </div>

            <div className="px-5 py-4 text-sm text-zinc-200">
              {duplicateFlow === 'choose' ? (
                <div className="grid gap-2">
                  <button type="button" className="ui-btn-primary" onClick={() => void submitReservation('replace')}>
                    새 정보로 갱신하기
                  </button>
                  <button type="button" className="ui-btn-ghost" onClick={applyExistingToForm}>
                    예약내용 수정하기
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-zinc-400">
                    현재 입력된 정보로 기존 예약을 갱신합니다. {needsReason ? '입금된 티켓이라 수정사유가 필요합니다.' : ''}
                  </div>
                  {needsReason ? (
                    <div>
                      <label className="text-xs text-zinc-300">수정사유</label>
                      <textarea
                        className="ui-input mt-1 min-h-[92px] resize-none"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="수정 이유를 적어주세요"
                        required
                      />
                    </div>
                  ) : null}
                  <button type="button" className="ui-btn-primary w-full" onClick={() => void submitReservation('edit')}>
                    기존 예약 수정하기
                  </button>
                </div>
              )}

              <button
                type="button"
                className="ui-btn-ghost mt-3 w-full"
                onClick={() => {
                  setDuplicateFlow('none')
                  setDuplicateTicket(null)
                  setReason('')
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-2 text-xs text-zinc-500">
        <div>
          예매번호로 다시 확인: <Link className="ui-link" to="/reserve/lookup">/reserve/lookup</Link>
        </div>
      </div>
    </div>
  )
}
