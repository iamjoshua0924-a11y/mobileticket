import { useEffect, useMemo, useRef, useState } from 'react'
import { applyAction, fetchTickets } from '../lib/api'
import { getStaffSecretFromSession, loadPendingActions, loadTicketCache, savePendingActions, saveTicketCache, setStaffSecretToSession } from '../lib/storage'
import type { PendingAction, Ticket } from '../lib/types'

function nowId() {
  return (globalThis.crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random()}`).toString()
}

function contains(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase())
}

export default function StaffPage() {
  const [staffSecret, setStaffSecret] = useState<string | null>(() => getStaffSecretFromSession())
  const [secretInput, setSecretInput] = useState('')

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction[]>(() => loadPendingActions())

  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const flushingRef = useRef(false)

  // 초기 캐시 로드(오프라인 대비)
  useEffect(() => {
    const cache = loadTicketCache()
    if (cache?.tickets?.length) {
      setTickets(cache.tickets)
      setSyncedAt(cache.syncedAt)
    }
  }, [])

  // pending 저장
  useEffect(() => {
    savePendingActions(pending)
  }, [pending])

  async function refresh() {
    if (!staffSecret) return
    setError(null)
    setLoading(true)
    try {
      const data = await fetchTickets(staffSecret)
      setTickets(data.tickets)
      setSyncedAt(data.syncedAt)
      saveTicketCache(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '명단 불러오기 실패')
    } finally {
      setLoading(false)
    }
  }

  async function flushPending() {
    if (!staffSecret) return
    if (flushingRef.current) return
    if (pending.length === 0) return
    flushingRef.current = true
    try {
      let next = [...pending]
      for (const action of pending) {
        try {
          const updated = await applyAction(staffSecret, action)
          setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)))
          next = next.filter((a) => a.id !== action.id)
          setPending(next)
        } catch {
          // 실패한 액션은 tryCount만 증가시키고 유지
          next = next.map((a) =>
            a.id === action.id ? { ...a, tryCount: (a.tryCount || 0) + 1, lastError: '동기화 실패(재시도 대기)' } : a
          )
          setPending(next)
        }
      }
    } finally {
      flushingRef.current = false
    }
  }

  useEffect(() => {
    // 온라인 복구 시 자동 동기화
    const onOnline = () => {
      void flushPending()
      void refresh()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffSecret, pending.length])

  // staffSecret가 생기면 즉시 서버에서 당겨오기
  useEffect(() => {
    if (!staffSecret) return
    void refresh()
    void flushPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffSecret])

  const filtered = useMemo(() => {
    const term = q.trim()
    if (!term) return tickets
    return tickets.filter((t) => {
      const hay = `${t.bookingNo} ${t.name} ${t.phoneLast4} ${t.depositorName}`
      return contains(hay, term)
    })
  }, [tickets, q])

  const pendingByTicket = useMemo(() => {
    const map = new Map<string, PendingAction[]>()
    for (const a of pending) {
      const arr = map.get(a.ticketId) || []
      arr.push(a)
      map.set(a.ticketId, arr)
    }
    return map
  }, [pending])

  function upsertTicketLocal(updated: Ticket) {
    setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)))
    const cache = loadTicketCache()
    if (cache?.tickets) {
      saveTicketCache({ tickets: cache.tickets.map((t) => (t._id === updated._id ? updated : t)), syncedAt: cache.syncedAt })
    }
  }

  function mergePending(prev: PendingAction[], action: PendingAction) {
    // 같은 ticketId + type 액션은 하나로 합쳐서 중복 큐를 방지
    const kept = prev.filter((a) => !(a.ticketId === action.ticketId && a.type === action.type))
    return [...kept, action]
  }

  async function enqueueAndTry(action: PendingAction, optimistic: (t: Ticket) => Ticket) {
    setPending((prev) => mergePending(prev, action))
    // optimistic update
    setTickets((prev) => prev.map((t) => (t._id === action.ticketId ? optimistic(t) : t)))

    if (!staffSecret) return
    try {
      const updated = await applyAction(staffSecret, action)
      upsertTicketLocal(updated)
      setPending((prev) => prev.filter((a) => a.id !== action.id))
    } catch {
      // 실패하면 큐에 남김(오프라인/불안정 대비)
      setPending((prev) =>
        prev.map((a) =>
          a.id === action.id ? { ...a, tryCount: (a.tryCount || 0) + 1, lastError: '동기화 실패(재시도 대기)' } : a
        )
      )
    }
  }

  if (!staffSecret) {
    return (
      <div className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-xl font-bold text-zinc-50">스태프 체크인</h1>
        <p className="mt-2 text-sm text-zinc-400">passcode(환경변수 STAFF_SECRET)를 입력하세요.</p>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <label className="text-sm text-zinc-300">passcode</label>
          <input
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            type="password"
            autoComplete="off"
          />
          <button
            className="mt-3 w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-violet-400"
            onClick={() => {
              setStaffSecretToSession(secretInput)
              setStaffSecret(secretInput)
            }}
          >
            시작
          </button>
          <p className="mt-2 text-xs text-zinc-500">passcode는 sessionStorage에만 저장됩니다(브라우저 종료 시 삭제).</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">입장 확인</h1>
          <div className="mt-1 text-xs text-zinc-500">
            {syncedAt ? `마지막 동기화: ${new Date(syncedAt).toLocaleString()}` : '캐시/오프라인 모드'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-300">
            pending {pending.length}
          </div>
          <button
            onClick={() => void flushPending()}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            큐 동기화
          </button>
          <button
            onClick={() => void refresh()}
            className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-white"
          >
            {loading ? '불러오는 중…' : '새로고침'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
          placeholder="이름 / 예매번호 / 연락처4자리 / 입금자명"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="text-xs text-zinc-500">총 {filtered.length}명</div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {filtered.map((t) => {
          const actions = pendingByTicket.get(t._id) || []
          const isPending = actions.length > 0
          const maxTry = actions.reduce((m, a) => Math.max(m, a.tryCount || 0), 0)
          const lastErr = actions.find((a) => a.lastError)?.lastError
          return (
            <div key={t._id} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-zinc-50">{t.name}</div>
                    <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-xs text-zinc-300">
                      {t.phoneLast4}
                    </span>
                    <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-xs text-zinc-300">
                      {t.headcount}명
                    </span>
                    {t.isPaid ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">입금</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">미입금</span>
                    )}
                    {t.isCheckedIn ? (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-200">입장</span>
                    ) : (
                      <span className="rounded-full bg-zinc-700/30 px-2 py-0.5 text-xs text-zinc-200">미입장</span>
                    )}
                    {isPending ? (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-200">
                        동기화 대기{maxTry ? ` · 재시도 ${maxTry}` : ''}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 break-all font-mono text-xs text-zinc-400">{t.bookingNo}</div>
                  <div className="mt-1 text-xs text-zinc-500">입금자명: {t.depositorName}</div>
                  {lastErr ? <div className="mt-1 text-xs text-sky-200/90">{lastErr}</div> : null}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    disabled={isPending}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-950"
                    style={isPending ? { opacity: 0.55 } : undefined}
                    onClick={() => {
                      const action: PendingAction = {
                        id: nowId(),
                        type: 'PAYMENT',
                        ticketId: t._id,
                        payload: { isPaid: !t.isPaid },
                        createdAt: Date.now(),
                        tryCount: 0
                      }
                      void enqueueAndTry(action, (x) => ({ ...x, isPaid: !x.isPaid }))
                    }}
                  >
                    입금 토글
                  </button>
                  <button
                    disabled={isPending}
                    className="rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-violet-400"
                    style={isPending ? { opacity: 0.55 } : undefined}
                    onClick={() => {
                      const action: PendingAction = {
                        id: nowId(),
                        type: 'CHECKIN',
                        ticketId: t._id,
                        payload: { isCheckedIn: !t.isCheckedIn },
                        createdAt: Date.now(),
                        tryCount: 0
                      }
                      void enqueueAndTry(action, (x) => ({ ...x, isCheckedIn: !x.isCheckedIn }))
                    }}
                  >
                    입장 토글
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
