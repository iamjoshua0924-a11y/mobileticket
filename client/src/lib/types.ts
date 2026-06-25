export type TicketHistory = {
  action: 'created' | 'updated' | 'deleted' | 'refund_requested' | 'restored'
  reason?: string
  snapshot: Partial<Ticket>
  changedAt: string
}

export type RefundRequest = {
  status: 'requested' | 'processing' | 'completed' | 'rejected'
  accountHolder?: string
  bankName?: string
  accountNumber?: string
  requestedAt?: string | null
  processedAt?: string | null
  note?: string
}

export type Ticket = {
  _id: string
  bookingNo: string
  name: string
  phone: string
  phoneLast4: string
  headcount: number
  depositorName: string
  isPaid: boolean
  paidAt?: string | null
  isCheckedIn: boolean
  checkedInAt?: string | null
  source?: 'online' | 'onsite'
  refundRequest?: RefundRequest
  history?: TicketHistory[]
  createdAt: string
  updatedAt: string
}

export type DeletedLog = {
  _id: string
  originalId: string
  deletedAt: string
  deletedBy: string
  ticket: Ticket
}

export type PendingAction =
  | {
      id: string
      type: 'CHECKIN'
      ticketId: string
      payload: { isCheckedIn: boolean }
      createdAt: number
      tryCount: number
      lastError?: string
    }
  | {
      id: string
      type: 'PAYMENT'
      ticketId: string
      payload: { isPaid: boolean }
      createdAt: number
      tryCount: number
      lastError?: string
    }
