import type { PendingAction, Ticket } from './types'

function jsonHeaders(extra?: Record<string, string>) {
  return { 'Content-Type': 'application/json', ...(extra || {}) }
}

export async function createTicket(payload: {
  name: string
  phone: string
  headcount: number
  depositorName: string
}): Promise<Ticket> {
  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('예매 생성 실패')
  const data = (await res.json()) as { ticket: Ticket }
  return data.ticket
}

export async function fetchTicketByBooking(bookingNo: string): Promise<Ticket> {
  const res = await fetch(`/api/tickets/by-booking/${encodeURIComponent(bookingNo)}`)
  if (!res.ok) throw new Error('예매번호를 찾을 수 없습니다')
  const data = (await res.json()) as { ticket: Ticket }
  return data.ticket
}

export async function fetchTickets(staffSecret: string): Promise<{ tickets: Ticket[]; syncedAt: string }> {
  const res = await fetch('/api/tickets', {
    headers: { 'x-staff-secret': staffSecret }
  })
  if (!res.ok) throw new Error('명단 조회 실패')
  return (await res.json()) as { tickets: Ticket[]; syncedAt: string }
}

export async function applyAction(staffSecret: string, action: PendingAction): Promise<Ticket> {
  if (action.type === 'CHECKIN') {
    const res = await fetch(`/api/tickets/${action.ticketId}/checkin`, {
      method: 'PATCH',
      headers: jsonHeaders({ 'x-staff-secret': staffSecret }),
      body: JSON.stringify(action.payload)
    })
    if (!res.ok) throw new Error('체크인 동기화 실패')
    const data = (await res.json()) as { ticket: Ticket }
    return data.ticket
  }

  const res = await fetch(`/api/tickets/${action.ticketId}/payment`, {
    method: 'PATCH',
    headers: jsonHeaders({ 'x-staff-secret': staffSecret }),
    body: JSON.stringify(action.payload)
  })
  if (!res.ok) throw new Error('입금 동기화 실패')
  const data = (await res.json()) as { ticket: Ticket }
  return data.ticket
}
