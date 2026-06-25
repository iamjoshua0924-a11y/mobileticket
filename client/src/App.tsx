import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import IntroOverlay from './components/IntroOverlay'
import ReservePage from './pages/ReservePage'
import ReserveSuccessPage from './pages/ReserveSuccessPage'
import ReserveLookupPage from './pages/ReserveLookupPage'
import StaffPage from './pages/StaffPage'

export default function App() {
  const location = useLocation()
  const isStaffRoute = location.pathname.startsWith('/staff')
  const [showIntro, setShowIntro] = useState(() => !isStaffRoute)

  useEffect(() => {
    if (isStaffRoute) {
      setShowIntro(false)
      return
    }

    if (!showIntro) return

    const timer = window.setTimeout(() => setShowIntro(false), 2200)
    return () => window.clearTimeout(timer)
  }, [isStaffRoute, showIntro])

  return (
    <>
      {showIntro ? <IntroOverlay /> : null}

      <div className={showIntro ? 'pointer-events-none opacity-0' : 'animate-site-reveal'}>
        <Routes>
          <Route path="/" element={<Navigate to={`/reserve${location.search || ''}`} replace />} />
          <Route path="/reserve" element={<ReservePage />} />
          <Route path="/reserve/lookup" element={<ReserveLookupPage />} />
          <Route path="/reserve/success" element={<ReserveSuccessPage />} />
          <Route path="/ticket" element={<ReserveSuccessPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="*" element={<div className="p-6 text-zinc-300">Not Found</div>} />
        </Routes>
      </div>
    </>
  )
}
