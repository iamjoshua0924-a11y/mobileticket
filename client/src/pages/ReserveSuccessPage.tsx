import { Link, useLocation, useNavigate } from 'react-router-dom'
import TicketCard from '../components/TicketCard'
import type { Ticket } from '../lib/types'

export default function ReserveSuccessPage() {
  const nav = useNavigate()
  const loc = useLocation()
  const ticket = (loc.state as { ticket?: Ticket } | null)?.ticket

  return (
    <div className="mx-auto max-w-md px-5 py-10 animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-50">예매 완료</h1>
        <button
          className="ui-btn-ghost px-3 py-2 text-xs"
          onClick={() => nav('/reserve')}
        >
          새 예매
        </button>
      </div>

      <p className="mt-2 text-sm text-zinc-400">아래 티켓 카드를 캡처해서 현장에서 보여주세요.</p>

      <div className="mt-6">{ticket ? <TicketCard ticket={ticket} /> : <EmptyState />}</div>

      <div className="mt-6 text-xs text-zinc-500">
        예매 완료 화면을 놓쳤다면{" "}
        <Link className="ui-link" to="/reserve/lookup">
          예매번호로 조회
        </Link>
        할 수 있어요.
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 text-sm text-zinc-300">
      이 페이지는 예매 직후에만 바로 볼 수 있어요.
      <div className="mt-2 text-xs text-zinc-500">예매번호로 조회 기능은 다음 단계에서 추가합니다.</div>
    </div>
  )
}
