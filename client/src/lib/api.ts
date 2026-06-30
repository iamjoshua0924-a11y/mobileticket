import type { DeletedLog, PendingAction, Ticket } from './types'

function jsonHeaders(extra?: Record<string, string>) {
  return { 'Content-Type': 'application/json', ...(extra || {}) }
}

async function unwrap<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message || '요청 실패') as Error & {
      code?: string
      payload?: unknown
    }
    err.code = (data as { code?: string }).code
    err.payload = data
    throw err
  }
  return data as T
}

export async function createTicket(payload: {
  name: string
  phone: string
  headcount: number
  depositorName: string
  mode?: 'create' | 'replace' | 'edit'
  reason?: string
  refCode?: 'k' | 'b' | '3' | 'n'
}): Promise<{ ticket: Ticket; action: 'created' | 'updated' }> {
  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  })
  return unwrap<{ ticket: Ticket; action: 'created' | 'updated' }>(res)
}

export async function checkDuplicate(name: string, phone: string) {
  const res = await fetch('/api/tickets/duplicate-check', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ name, phone })
  })
  return unwrap<{ exists: boolean; ticket: Ticket | null }>(res)
}

export async function fetchTicketByBooking(bookingNo: string): Promise<Ticket> {
  const res = await fetch(`/api/tickets/by-booking/${encodeURIComponent(bookingNo)}`)
  const data = await unwrap<{ ticket: Ticket }>(res)
  return data.ticket
}

export async function lookupTicket(payload: { mode: 'booking'; bookingNo: string } | { mode: 'person'; name: string; phone: string }) {
  const res = await fetch('/api/tickets/lookup', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  })
  const data = await unwrap<{ ticket: Ticket }>(res)
  return data.ticket
}

export async function requestRefund(
  ticketId: string,
  payload: { accountHolder: string; bankName: string; accountNumber: string }
): Promise<{ message: string; ticket: Ticket }> {
  const res = await fetch(`/api/tickets/${ticketId}/refund-request`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  })
  return unwrap<{ message: string; ticket: Ticket }>(res)
}

export async function fetchTickets(
  staffSecret: string
): Promise<{ tickets: Ticket[]; deletedLogs: DeletedLog[]; syncedAt: string }> {
  const res = await fetch('/api/tickets', {
    headers: { 'x-staff-secret': staffSecret }
  })
  return unwrap<{ tickets: Ticket[]; deletedLogs: DeletedLog[]; syncedAt: string }>(res)
}

export async function fetchSettlement(staffSecret: string) {
  const res = await fetch('/api/tickets/settlement', {
    headers: { 'x-staff-secret': staffSecret }
  })
  return unwrap<{ totalHeadcount: number; revenue: number; referralCountsOrder?: number[] }>(res)
}

export async function createOnsiteTicket(
  staffSecret: string,
  payload: { name: string; headcount: number; refCode?: 'k' | 'b' | '3' | 'n' | null }
): Promise<Ticket> {
  const res = await fetch('/api/tickets/onsite', {
    method: 'POST',
    headers: jsonHeaders({ 'x-staff-secret': staffSecret }),
    body: JSON.stringify(payload)
  })
  const data = await unwrap<{ ticket: Ticket }>(res)
  return data.ticket
}

export async function applyAction(staffSecret: string, action: PendingAction): Promise<Ticket> {
  if (action.type === 'CHECKIN') {
    const res = await fetch(`/api/tickets/${action.ticketId}/checkin`, {
      method: 'PATCH',
      headers: jsonHeaders({ 'x-staff-secret': staffSecret }),
      body: JSON.stringify(action.payload)
    })
    const data = await unwrap<{ ticket: Ticket }>(res)
    return data.ticket
  }

  const res = await fetch(`/api/tickets/${action.ticketId}/payment`, {
    method: 'PATCH',
    headers: jsonHeaders({ 'x-staff-secret': staffSecret }),
    body: JSON.stringify(action.payload)
  })
  const data = await unwrap<{ ticket: Ticket }>(res)
  return data.ticket
}

export async function deleteTicket(staffSecret: string, ticketId: string): Promise<string> {
  const res = await fetch(`/api/tickets/${ticketId}`, {
    method: 'DELETE',
    headers: { 'x-staff-secret': staffSecret }
  })
  const data = await unwrap<{ deletedId: string }>(res)
  return data.deletedId
}

export async function restoreDeletedTicket(staffSecret: string, deletedLogId: string): Promise<Ticket> {
  const res = await fetch(`/api/tickets/deleted/${deletedLogId}/restore`, {
    method: 'POST',
    headers: { 'x-staff-secret': staffSecret }
  })
  const data = await unwrap<{ ticket: Ticket }>(res)
  return data.ticket
}

export async function updateRefundStatus(
  staffSecret: string,
  ticketId: string,
  status: 'requested' | 'processing' | 'completed' | 'rejected'
): Promise<Ticket> {
  const res = await fetch(`/api/tickets/${ticketId}/refund-status`, {
    method: 'PATCH',
    headers: jsonHeaders({ 'x-staff-secret': staffSecret }),
    body: JSON.stringify({ status })
  })
  const data = await unwrap<{ ticket: Ticket }>(res)
  return data.ticket
}

export async function assignTicketRefCode(
  staffSecret: string,
  ticketId: string,
  refCode: 'k' | 'b' | '3' | 'n'
): Promise<Ticket> {
  const res = await fetch(`/api/tickets/${ticketId}/ref-code`, {
    method: 'PATCH',
    headers: jsonHeaders({ 'x-staff-secret': staffSecret }),
    body: JSON.stringify({ refCode })
  })
  const data = await unwrap<{ ticket: Ticket }>(res)
  return data.ticket
}
