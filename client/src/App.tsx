import { Navigate, Route, Routes } from 'react-router-dom'
import ReservePage from './pages/ReservePage'
import ReserveSuccessPage from './pages/ReserveSuccessPage'
import ReserveLookupPage from './pages/ReserveLookupPage'
import StaffPage from './pages/StaffPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/reserve" replace />} />
      <Route path="/reserve" element={<ReservePage />} />
      <Route path="/reserve/lookup" element={<ReserveLookupPage />} />
      <Route path="/reserve/success" element={<ReserveSuccessPage />} />
      <Route path="/ticket" element={<ReserveSuccessPage />} />
      <Route path="/staff" element={<StaffPage />} />
      <Route path="*" element={<div className="p-6 text-zinc-300">Not Found</div>} />
    </Routes>
  )
}
