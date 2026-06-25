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
  createdAt: string
  updatedAt: string
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
