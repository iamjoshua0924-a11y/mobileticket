import type { Ticket } from '../lib/types'

const HERO_IMAGE = 'https://i.ibb.co/wZyLCS57/20260625-142223.png'

export default function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="ticket-print-in ui-card hover-glow ticket-card-shell mx-auto w-full max-w-sm overflow-hidden border-sky-400/35 p-5 ring-2 ring-sky-500/35">
      <div className="ticket-print-sheen" />
      <div className="hero-frame mb-4">
        <img
          src={HERO_IMAGE}
          alt="Summer Splash 비주얼"
          className="hero-image max-h-[180px] w-full object-contain bg-slate-950/70 p-2"
          loading="eager"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-extrabold tracking-widest text-sky-300">Summer Splash!</div>
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

      <div className="mt-4 text-center text-xs leading-5 text-zinc-400">
        <div>캡처해서 현장에 보여주세요</div>
        <div className="text-zinc-500">입금 확인된 티켓만 입장을 도와드립니다</div>
      </div>
    </div>
  )
}
