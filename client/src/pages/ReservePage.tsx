import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTicket } from '../lib/api'

export default function ReservePage() {
  const nav = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [headcount, setHeadcount] = useState(1)
  const [depositorName, setDepositorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const ticket = await createTicket({ name, phone, headcount, depositorName })
      nav('/reserve/success', { state: { ticket } })
    } catch (err) {
      setError(err instanceof Error ? err.message : '에러가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Summer Splash 사전예약</h1>
      <p className="mt-2 text-sm text-zinc-400">사전 예매 후 예매 번호로 빠른 입장을 도와드립니다.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm text-zinc-300">예약자명</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm text-zinc-300">연락처</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
              inputMode="numeric"
              type="number"
              min={1}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-300">입금자명</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              required
            />
          </div>
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
          {loading ? '예매 생성 중…' : '예매하기'}
        </button>
      </form>

      <div className="mt-8 flex flex-col gap-2 text-xs text-zinc-500">
        <div>
          예매번호로 다시 확인:{" "}
          <Link className="text-violet-300 underline underline-offset-2" to="/reserve/lookup">
            /reserve/lookup
          </Link>
        </div>
      </div>
    </div>
  )
}
