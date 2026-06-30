import { useEffect, useMemo, useRef, useState } from 'react'
import {
  applyAction,
  createOnsiteTicket,
  deleteTicket,
  fetchSettlement,
  fetchTickets,
  restoreDeletedTicket,
  updateRefundStatus
} from '../lib/api'
import { getStaffSecretFromSession, loadPendingActions, loadTicketCache, savePendingActions, saveTicketCache, setStaffSecretToSession } from '../lib/storage'
import type { DeletedLog, PendingAction, Ticket } from '../lib/types'

type StaffTab = 'tickets' | 'deleted' | 'refunds'
type TicketFilter = 'all' | 'checkedin' | 'paid-unchecked' | 'unpaid'
type RefFilter = 'all' | 'k' | 'b' | '3' | 'n' | 'none'
type TicketSort = 'recent' | 'name-asc' | 'name-desc'
type StaffPermissions = {
  createOnsite: boolean
  checkin: boolean
  payment: boolean
  refund: boolean
  deleteTicket: boolean
  viewDeleted: boolean
  restoreDeleted: boolean
  exportCsv: boolean
  settlement: boolean
}

function nowId() {
  return (globalThis.crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random()}`).toString()
}

function contains(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase())
}

function refLabel(refCode?: Ticket['refCode']) {
  if (refCode === 'k' || refCode === 'b' || refCode === '3' || refCode === 'n') return `ref:${refCode}`
  return 'ref:없음'
}

const REF_OPTIONS: Array<{ value: 'k' | 'b' | '3' | 'n' | ''; label: string }> = [
  { value: '', label: '응원팀 선택' },
  { value: 'k', label: 'k' },
  { value: 'b', label: 'b' },
  { value: '3', label: '3' },
  { value: 'n', label: 'n' }
]

function getStaffPermissions(secret: string | null): StaffPermissions {
  if (secret === '4231') {
    return {
      createOnsite: true,
      checkin: true,
      payment: false,
      refund: false,
      deleteTicket: false,
      viewDeleted: false,
      restoreDeleted: false,
      exportCsv: false,
      settlement: true
    }
  }

  return {
    createOnsite: true,
    checkin: true,
    payment: true,
    refund: true,
    deleteTicket: true,
    viewDeleted: true,
    restoreDeleted: true,
    exportCsv: true,
    settlement: true
  }
}

function fmt(dt?: string | null) {
  if (!dt) return '-'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

function relativeFrom(dt?: string | null) {
  if (!dt) return ''
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  return `${day}일 전`
}

export default function StaffPage() {
  const [staffSecret, setStaffSecret] = useState<string | null>(() => getStaffSecretFromSession())
  const [secretInput, setSecretInput] = useState('')

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [deletedLogs, setDeletedLogs] = useState<DeletedLog[]>([])
  const [pending, setPending] = useState<PendingAction[]>(() => loadPendingActions())

  const [tab, setTab] = useState<StaffTab>('tickets')
  const [filter, setFilter] = useState<TicketFilter>('all')
  const [refFilter, setRefFilter] = useState<RefFilter>('all')
  const [sort, setSort] = useState<TicketSort>('recent')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [restorePreview, setRestorePreview] = useState<DeletedLog | null>(null)
  const [onsiteOpen, setOnsiteOpen] = useState(false)
  const [onsiteForm, setOnsiteForm] = useState<{ name: string; headcount: number; refCode: 'k' | 'b' | '3' | 'n' | '' }>({
    name: '',
    headcount: 1,
    refCode: ''
  })
  const [settlement, setSettlement] = useState<{ totalHeadcount: number; revenue: number; referralCountsOrder?: number[] } | null>(null)
  const [showSettlement, setShowSettlement] = useState(false)

  const flushingRef = useRef(false)
  const permissions = useMemo(() => getStaffPermissions(staffSecret), [staffSecret])

  useEffect(() => {
    const cache = loadTicketCache()
    if (cache?.tickets?.length) {
      setTickets(cache.tickets)
    }
  }, [])

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
      setDeletedLogs(data.deletedLogs || [])
      saveTicketCache({ tickets: data.tickets, syncedAt: data.syncedAt })
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오기 실패')
    } finally {
      setLoading(false)
    }
  }

  async function flushPending() {
    if (!staffSecret || flushingRef.current || pending.length === 0) return
    flushingRef.current = true
    try {
      let next = [...pending]
      const executable = pending.filter((action) => action.type === 'CHECKIN' || permissions.payment)
      for (const action of executable) {
        try {
          const updated = await applyAction(staffSecret, action)
          setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)))
          next = next.filter((a) => a.id !== action.id)
          setPending(next)
        } catch {
          next = next.map((a) => (a.id === action.id ? { ...a, tryCount: (a.tryCount || 0) + 1, lastError: '동기화 실패(재시도 대기)' } : a))
          setPending(next)
        }
      }
    } finally {
      flushingRef.current = false
    }
  }

  useEffect(() => {
    const onOnline = () => {
      void flushPending()
      void refresh()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [staffSecret, pending.length])

  useEffect(() => {
    if (!staffSecret) return
    void refresh()
    void flushPending()
  }, [staffSecret])

  useEffect(() => {
    if (permissions.payment) return
    setPending((prev) => prev.filter((action) => action.type !== 'PAYMENT'))
  }, [permissions.payment])

  useEffect(() => {
    if ((tab === 'deleted' && !permissions.viewDeleted) || (tab === 'refunds' && !permissions.refund)) {
      setTab('tickets')
    }
  }, [tab, permissions.viewDeleted, permissions.refund])

  const pendingByTicket = useMemo(() => {
    const map = new Map<string, PendingAction[]>()
    for (const a of pending) {
      const arr = map.get(a.ticketId) || []
      arr.push(a)
      map.set(a.ticketId, arr)
    }
    return map
  }, [pending])

  const filteredTickets = useMemo(() => {
    let list = [...tickets]
    if (filter === 'checkedin') list = list.filter((t) => t.isCheckedIn)
    if (filter === 'paid-unchecked') list = list.filter((t) => t.isPaid && !t.isCheckedIn)
    if (filter === 'unpaid') list = list.filter((t) => !t.isPaid)
    if (refFilter === 'none') list = list.filter((t) => !t.refCode)
    if (refFilter === 'k' || refFilter === 'b' || refFilter === '3' || refFilter === 'n') {
      list = list.filter((t) => t.refCode === refFilter)
    }

    const term = q.trim()
    if (term) {
      list = list.filter((t) => contains(`${t.bookingNo} ${t.name} ${t.phoneLast4} ${t.depositorName} ${t.refCode || ''}`, term))
    }

    if (sort === 'name-asc') {
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'))
    } else if (sort === 'name-desc') {
      list.sort((a, b) => String(b.name || '').localeCompare(String(a.name || ''), 'ko'))
    } else {
      // 기본: 최신순(서버에서 createdAt desc로 내려오지만, 안전하게 한번 더 정렬)
      list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    }

    return list
  }, [tickets, q, filter, refFilter, sort])

  const refundTickets = useMemo(() => tickets.filter((t) => t.refundRequest), [tickets])

  function refundBadge(t: Ticket) {
    const status = t.refundRequest?.status
    if (!status) return null
    if (status === 'completed') return { text: '환불됨', cls: 'bg-rose-500/15 text-rose-200' }
    if (status === 'processing') return { text: '환불처리중', cls: 'bg-amber-500/15 text-amber-200' }
    if (status === 'rejected') return { text: '환불반려', cls: 'bg-zinc-700/30 text-zinc-200' }
    return { text: '환불요청', cls: 'bg-sky-500/15 text-sky-200' }
  }

  function removeTicketLocal(ticketId: string) {
    setTickets((prev) => prev.filter((t) => t._id !== ticketId))
    const cache = loadTicketCache()
    if (cache?.tickets) saveTicketCache({ tickets: cache.tickets.filter((t) => t._id !== ticketId), syncedAt: cache.syncedAt })
  }

  function mergePending(prev: PendingAction[], action: PendingAction) {
    return [...prev.filter((a) => !(a.ticketId === action.ticketId && a.type === action.type)), action]
  }

  async function enqueueAndTry(action: PendingAction, optimistic: (t: Ticket) => Ticket) {
    setPending((prev) => mergePending(prev, action))
    setTickets((prev) => prev.map((t) => (t._id === action.ticketId ? optimistic(t) : t)))

    if (!staffSecret) return
    try {
      const updated = await applyAction(staffSecret, action)
      setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)))
      setPending((prev) => prev.filter((a) => a.id !== action.id))
    } catch {
      setPending((prev) => prev.map((a) => (a.id === action.id ? { ...a, tryCount: (a.tryCount || 0) + 1, lastError: '동기화 실패(재시도 대기)' } : a)))
    }
  }

  async function onDeleteTicket(ticketId: string, name: string) {
    if (!staffSecret) return
    if (!window.confirm(`'${name}' 예약을 삭제로그로 이동할까요?`)) return
    setDeletingId(ticketId)
    try {
      await deleteTicket(staffSecret, ticketId)
      setPending((prev) => prev.filter((a) => a.ticketId !== ticketId))
      removeTicketLocal(ticketId)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '예약 삭제 실패')
    } finally {
      setDeletingId(null)
    }
  }

  async function onRestore(logId: string) {
    if (!staffSecret) return
    setRestoreId(logId)
    try {
      await restoreDeletedTicket(staffSecret, logId)
      await refresh()
      setTab('tickets')
    } catch (err) {
      setError(err instanceof Error ? err.message : '복구 실패')
    } finally {
      setRestoreId(null)
    }
  }

  async function onDownloadCsv() {
    if (!staffSecret) return
    setError(null)
    try {
      const res = await fetch('/api/tickets/export.csv', {
        headers: { 'x-staff-secret': staffSecret }
      })
      if (!res.ok) throw new Error('CSV 다운로드 실패')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'midsummer-splash.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV 다운로드 실패')
    }
  }

  async function onCreateOnsite(e: React.FormEvent) {
    e.preventDefault()
    if (!staffSecret) return
    try {
      const ticket = await createOnsiteTicket(staffSecret, {
        ...onsiteForm,
        refCode: onsiteForm.refCode || null
      })
      setTickets((prev) => [ticket, ...prev])
      setOnsiteForm({ name: '', headcount: 1, refCode: '' })
      setOnsiteOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '현장예매 입력 실패')
    }
  }

  async function onSettlement() {
    if (!staffSecret) return
    try {
      const data = await fetchSettlement(staffSecret)
      setSettlement(data)
      setShowSettlement(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '정산 실패')
    }
  }

  async function onRefundStatus(ticketId: string, status: 'processing' | 'completed' | 'rejected') {
    if (!staffSecret) return
    try {
      const updated = await updateRefundStatus(staffSecret, ticketId, status)
      setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '환불 상태 변경 실패')
    }
  }

  if (!staffSecret) {
    return (
      <div className="mx-auto max-w-md px-5 py-10">
        <div className="ui-card mt-6 p-4">
          <label className="text-sm text-zinc-300">passcode</label>
          <input className="ui-input mt-2" value={secretInput} onChange={(e) => setSecretInput(e.target.value)} type="password" autoComplete="off" />
          <button className="ui-btn-primary mt-3 w-full" onClick={() => { setStaffSecretToSession(secretInput); setStaffSecret(secretInput) }}>
            시작
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <button className={tab === 'tickets' ? 'ui-btn-primary px-3 py-2 text-xs' : 'ui-btn-ghost px-3 py-2 text-xs'} onClick={() => setTab('tickets')}>예약목록</button>
        {permissions.viewDeleted ? <button className={tab === 'deleted' ? 'ui-btn-primary px-3 py-2 text-xs' : 'ui-btn-ghost px-3 py-2 text-xs'} onClick={() => setTab('deleted')}>삭제로그</button> : null}
        {permissions.refund ? <button className={tab === 'refunds' ? 'ui-btn-primary px-3 py-2 text-xs' : 'ui-btn-ghost px-3 py-2 text-xs'} onClick={() => setTab('refunds')}>환불내역</button> : null}
        {permissions.createOnsite ? <button className="ui-btn-ghost px-3 py-2 text-xs" onClick={() => setOnsiteOpen((v) => !v)}>현장예매 입력</button> : null}
        {permissions.exportCsv ? <button className="ui-btn-ghost px-3 py-2 text-xs" onClick={() => void onDownloadCsv()}>CSV 다운로드</button> : null}
        {permissions.settlement ? <button className="ui-btn-ghost px-3 py-2 text-xs" onClick={() => void onSettlement()}>정산하기</button> : null}
        <button className="ui-btn-primary px-3 py-2 text-xs" onClick={() => void refresh()}>{loading ? '불러오는 중…' : '새로고침'}</button>
      </div>

      {showSettlement && settlement ? (
        <div className="ui-card mt-4 p-4 text-sm text-zinc-100">
          입장수익 : <span className="text-sky-300">{settlement.revenue.toLocaleString()}원</span>
          <span className="ml-3 text-zinc-400">총 인원 {settlement.totalHeadcount}명</span>
          {settlement.referralCountsOrder ? (
            <span className="ml-2 text-zinc-400">
              ({settlement.referralCountsOrder.join('/')})
            </span>
          ) : null}
        </div>
      ) : null}

      {permissions.createOnsite && onsiteOpen ? (
        <form onSubmit={onCreateOnsite} className="ui-card mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_140px_160px_120px]">
          <input className="ui-input" placeholder="예매자명" value={onsiteForm.name} onChange={(e) => setOnsiteForm((p) => ({ ...p, name: e.target.value }))} required />
          <input className="ui-input" type="number" min={1} placeholder="입장인원" value={onsiteForm.headcount} onChange={(e) => setOnsiteForm((p) => ({ ...p, headcount: Number(e.target.value) }))} required />
          <select className="ui-input" value={onsiteForm.refCode} onChange={(e) => setOnsiteForm((p) => ({ ...p, refCode: e.target.value as 'k' | 'b' | '3' | 'n' | '' }))}>
            {REF_OPTIONS.map((option) => (
              <option key={option.value || 'none'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="ui-btn-primary" type="submit">확인</button>
        </form>
      ) : null}

      {tab === 'tickets' ? (
        <>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input className="ui-input" placeholder="이름 / 예매번호 / 연락처4자리 / 입금자명" value={q} onChange={(e) => setQ(e.target.value)} />
            <select
              className="ui-input sm:max-w-[220px]"
              value={sort}
              onChange={(e) => setSort(e.target.value as TicketSort)}
              aria-label="정렬 기준"
            >
              <option value="recent">정렬: 최신순</option>
              <option value="name-asc">정렬: 이름 가나다순(오름차)</option>
              <option value="name-desc">정렬: 이름 가나다순(내림차)</option>
            </select>
            <select
              className="ui-input sm:max-w-[180px]"
              value={refFilter}
              onChange={(e) => setRefFilter(e.target.value as RefFilter)}
              aria-label="ref 필터"
            >
              <option value="all">ref: 전체</option>
              <option value="k">ref: k</option>
              <option value="b">ref: b</option>
              <option value="3">ref: 3</option>
              <option value="n">ref: n</option>
              <option value="none">ref: 없음</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={filter === 'all' ? 'ui-btn-primary px-3 py-2 text-xs' : 'ui-btn-ghost px-3 py-2 text-xs'} onClick={() => setFilter('all')}>전체</button>
            <button className={filter === 'checkedin' ? 'ui-btn-primary px-3 py-2 text-xs' : 'ui-btn-ghost px-3 py-2 text-xs'} onClick={() => setFilter('checkedin')}>입장인원만 모아보기</button>
            <button className={filter === 'paid-unchecked' ? 'ui-btn-primary px-3 py-2 text-xs' : 'ui-btn-ghost px-3 py-2 text-xs'} onClick={() => setFilter('paid-unchecked')}>입금후 미입장 모아보기</button>
            <button className={filter === 'unpaid' ? 'ui-btn-primary px-3 py-2 text-xs' : 'ui-btn-ghost px-3 py-2 text-xs'} onClick={() => setFilter('unpaid')}>미입금 모아보기</button>
          </div>

          {error ? <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

          <div className="mt-4 space-y-2">
            {filteredTickets.map((t) => {
              const actions = pendingByTicket.get(t._id) || []
              const isPending = actions.length > 0
              const isDeleting = deletingId === t._id
              const maxTry = actions.reduce((m, a) => Math.max(m, a.tryCount || 0), 0)
              const lastErr = actions.find((a) => a.lastError)?.lastError
              return (
                <div key={t._id} className="ui-card hover-glow p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-zinc-50">{t.name}</div>
                        {t.phoneLast4 ? <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-xs text-zinc-300">{t.phoneLast4}</span> : null}
                        <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-xs text-zinc-300">{t.headcount}명</span>
                        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200">{refLabel(t.refCode)}</span>
                        {t.source === 'onsite' ? <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-xs text-fuchsia-200">현장예매</span> : null}
                        {refundBadge(t) ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${refundBadge(t)!.cls}`}>{refundBadge(t)!.text}</span>
                        ) : null}
                        {t.isPaid ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">입금</span> : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">미입금</span>}
                        {t.isCheckedIn ? <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-200">입장</span> : <span className="rounded-full bg-zinc-700/30 px-2 py-0.5 text-xs text-zinc-200">미입장</span>}
                        {isPending ? <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-200">동기화 대기 · {maxTry || 0}</span> : null}
                      </div>

                      <div className="mt-1 break-all font-mono text-xs text-zinc-400">{t.bookingNo}</div>
                      <div className="mt-1 text-xs text-zinc-500">{t.depositorName}</div>
                      <div className="mt-2 grid gap-1 text-xs text-zinc-400">
                        <div>예약: <span className="text-zinc-200">{fmt(t.createdAt)}</span> <span className="ml-2 text-zinc-500">{relativeFrom(t.createdAt)}</span></div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span>입금: <span className="text-zinc-200">{fmt(t.paidAt)}</span></span>
                          <span>입장: <span className="text-zinc-200">{fmt(t.checkedInAt)}</span></span>
                        </div>
                      </div>
                      {t.history?.length ? (
                        <details className="mt-3 text-xs text-zinc-400">
                          <summary className="cursor-pointer text-sky-300">수정 전 티켓 보기 ({t.history.length})</summary>
                          <div className="mt-2 space-y-2">
                            {t.history.map((h, idx) => (
                              <div key={idx} className="rounded-xl border border-sky-500/10 bg-slate-950/40 p-2">
                                <div>{fmt(h.changedAt)} · {h.action} · {h.reason || '-'}</div>
                                <div className="mt-1 text-zinc-500">
                                  {h.snapshot.name || '-'} / {h.snapshot.phone || '-'} / {h.snapshot.headcount || '-'}명 / {h.snapshot.depositorName || '-'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                      {lastErr ? <div className="mt-1 text-xs text-sky-200/90">{lastErr}</div> : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {permissions.payment ? <button disabled={isPending || isDeleting} className="ui-btn-ghost px-3 py-2 text-xs" style={isPending || isDeleting ? { opacity: 0.55 } : undefined} onClick={() => void enqueueAndTry({ id: nowId(), type: 'PAYMENT', ticketId: t._id, payload: { isPaid: !t.isPaid }, createdAt: Date.now(), tryCount: 0 }, (x) => ({ ...x, isPaid: !x.isPaid }))}>입금 토글</button> : null}
                      {permissions.checkin ? <button disabled={isPending || isDeleting} className="ui-btn-primary px-3 py-2 text-xs whitespace-nowrap" style={isPending || isDeleting ? { opacity: 0.55 } : undefined} onClick={() => void enqueueAndTry({ id: nowId(), type: 'CHECKIN', ticketId: t._id, payload: { isCheckedIn: !t.isCheckedIn }, createdAt: Date.now(), tryCount: 0 }, (x) => ({ ...x, isCheckedIn: !x.isCheckedIn }))}>입장 토글</button> : null}
                      {permissions.deleteTicket ? <button disabled={isPending || isDeleting} className="ui-btn-ghost border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/15" style={isPending || isDeleting ? { opacity: 0.55 } : undefined} onClick={() => void onDeleteTicket(t._id, t.name)}>{isDeleting ? '삭제 중…' : '예약 삭제'}</button> : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : null}

      {permissions.viewDeleted && tab === 'deleted' ? (
        <div className="mt-4 space-y-2">
          {deletedLogs.map((log) => (
            <div key={log._id} className="ui-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-zinc-100">{log.ticket.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">{log.ticket.bookingNo} · {fmt(log.deletedAt)}</div>
                  <div className="mt-1 text-xs text-zinc-500">{log.ticket.headcount}명 / {log.ticket.depositorName}</div>
                </div>
                <button className="ui-btn-primary px-3 py-2 text-xs" onClick={() => setRestorePreview(log)}>
                  복구
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {permissions.refund && tab === 'refunds' ? (
        <div className="mt-4 space-y-2">
          {refundTickets.map((t) => (
            <div key={t._id} className="ui-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-semibold text-zinc-100">{t.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">{t.bookingNo}</div>
                  <div className="mt-2 text-xs text-zinc-300">
                    {t.refundRequest?.accountHolder} / {t.refundRequest?.bankName} / {t.refundRequest?.accountNumber}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-sky-500/15 bg-sky-500/10 px-2 py-1 text-xs text-sky-100">
                        상태: {t.refundRequest?.status}
                      </span>
                      <span className="text-xs text-zinc-500">신청: {fmt(t.refundRequest?.requestedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={t.refundRequest?.status === 'processing' ? 'ui-btn-primary px-3 py-2 text-xs' : 'ui-btn-ghost px-3 py-2 text-xs'}
                    disabled={t.refundRequest?.status === 'processing'}
                    onClick={() => void onRefundStatus(t._id, 'processing')}
                  >
                    처리중
                  </button>
                  <button
                    className={t.refundRequest?.status === 'completed' ? 'ui-btn-primary px-3 py-2 text-xs' : 'ui-btn-ghost px-3 py-2 text-xs'}
                    disabled={t.refundRequest?.status === 'completed'}
                    onClick={() => void onRefundStatus(t._id, 'completed')}
                  >
                    환불완료
                  </button>
                  <button
                    className={t.refundRequest?.status === 'rejected' ? 'ui-btn-ghost border-rose-500/20 bg-rose-500/15 px-3 py-2 text-xs text-rose-200' : 'ui-btn-ghost border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/15'}
                    disabled={t.refundRequest?.status === 'rejected'}
                    onClick={() => void onRefundStatus(t._id, 'rejected')}
                  >
                    반려
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {restorePreview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5">
          <div className="ui-card w-full max-w-lg p-5">
            <div className="text-sm font-semibold text-zinc-50">삭제 로그 복구 미리보기</div>
            <div className="mt-3 space-y-2 text-sm text-zinc-200">
              <div className="rounded-xl border border-sky-500/10 bg-slate-950/40 p-3">
                <div className="font-semibold">{restorePreview.ticket.name}</div>
                <div className="mt-1 text-xs text-zinc-400">{restorePreview.ticket.bookingNo}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {restorePreview.ticket.headcount}명 · {restorePreview.ticket.depositorName} · 삭제시각 {fmt(restorePreview.deletedAt)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="ui-btn-primary flex-1"
                disabled={restoreId === restorePreview._id}
                onClick={() => void onRestore(restorePreview._id)}
              >
                {restoreId === restorePreview._id ? '복구 중…' : '복구 실행'}
              </button>
              <button className="ui-btn-ghost" onClick={() => setRestorePreview(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
