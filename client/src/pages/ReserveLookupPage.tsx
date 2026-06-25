import { useMemo, useState } from 'react'
import TicketCard from '../components/TicketCard'
import { fetchTicketByBooking } from '../lib/api'
import type { Ticket } from '../lib/types'

function normalizeBookingNo(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, '')
}

export default function ReserveLookupPage() {
  const [bookingNo, setBookingNo] = useState('')
  const normalized = useMemo(() => normalizeBookingNo(bookingNo), [bookingNo])

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onLookup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setTicket(null)
    setLoading(true)
    try {
      const t = await fetchTicketByBooking(normalized)
      setTicket(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-xl font-bold text-zinc-50">예매번호로 조회</h1>
      <p className="mt-2 text-sm text-zinc-400">예매 완료 화면을 놓쳤다면, 예매번호로 다시 확인할 수 있어요.</p>

      <form onSubmit={onLookup} className="mt-6 space-y-3">
        <div>
          <label className="text-sm text-zinc-300">예매번호</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 font-mono text-zinc-100 outline-none focus:border-violet-500"
            value={bookingNo}
            onChange={(e) => setBookingNo(e.target.value)}
            placeholder="GT-20260625-4K7Q2M"
            required
          />
          <div className="mt-1 text-xs text-zinc-500">입력값: {normalized || '-'}</div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-violet-400 disabled:opacity-60"
        >
          {loading ? '조회 중…' : '조회하기'}
        </button>
      </form>

      <div className="mt-6">{ticket ? <TicketCard ticket={ticket} /> : null}</div>
    </div>
  )
}

