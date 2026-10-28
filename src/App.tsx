import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Review from './pages/Review'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/p/:id" element={<Practice />} />
      <Route path="/review" element={<Review />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
