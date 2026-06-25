import type { PendingAction, Ticket } from './types'

const KEY_CACHE = 'gt_cache_tickets'
const KEY_PENDING = 'gt_pending_actions'
const KEY_STAFF_SECRET = 'gt_staff_secret' // sessionStorage에만 저장할 예정(문서화 목적)

export function loadTicketCache(): { tickets: Ticket[]; syncedAt: string } | null {
  try {
    const raw = localStorage.getItem(KEY_CACHE)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveTicketCache(payload: { tickets: Ticket[]; syncedAt: string }) {
  localStorage.setItem(KEY_CACHE, JSON.stringify(payload))
}

export function loadPendingActions(): PendingAction[] {
  try {
    const raw = localStorage.getItem(KEY_PENDING)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingAction[]) : []
  } catch {
    return []
  }
}

export function savePendingActions(actions: PendingAction[]) {
  localStorage.setItem(KEY_PENDING, JSON.stringify(actions))
}

export function getStaffSecretFromSession(): string | null {
  return sessionStorage.getItem(KEY_STAFF_SECRET) || null
}

export function setStaffSecretToSession(secret: string) {
  sessionStorage.setItem(KEY_STAFF_SECRET, secret)
}

