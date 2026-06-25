import type { Ticket } from '../lib/types'

export default function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold tracking-widest text-violet-300">SUMMER SPLASH</div>
        <div className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
          {ticket.headcount}명
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs text-zinc-400">예매번호</div>
        <div className="mt-1 break-all font-mono text-2xl font-bold text-zinc-50">{ticket.bookingNo}</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="text-xs text-zinc-400">예약자</div>
          <div className="mt-1 font-semibold text-zinc-100">{ticket.name}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="text-xs text-zinc-400">연락처(끝 4자리)</div>
          <div className="mt-1 font-mono font-semibold text-zinc-100">{ticket.phoneLast4}</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="text-xs text-zinc-400">입금자명</div>
        <div className="mt-1 font-semibold text-zinc-100">{ticket.depositorName}</div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
        <span>캡처해서 현장에 보여주세요</span>
        <span className="rounded-full bg-violet-500/10 px-2 py-1 text-violet-300">NO LOGIN</span>
      </div>
    </div>
  )
}
