// ============================================================
// SorgyAI — App.tsx
// Root router. Three route families:
//
//   /               → redirect logic (logged in → /dashboard, else → /login)
//   /login          → LoginPage  (public)
//   /dashboard/*    → DashboardPage (ProtectedRoute)
//     /dashboard              → tab leads (default)
//     /dashboard/leads        → Lead Hub
//     /dashboard/scripts      → Objection AI
//     /dashboard/settings     → Agent settings
//   /chat/:token    → ChatPage  (public — customer-facing widget)
// ============================================================
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, ProtectedRoute } from '@/context/AuthContext'
import LoginPage     from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ChatPage      from '@/pages/ChatPage'
import RootRedirect  from '@/pages/RootRedirect'

export default function App() {
  return (
    <AuthProvider>
      {/* app-bg adds the deep-space gradient + grid overlay from index.css */}
      <div className="app-bg min-h-screen">
        <Routes>

          {/* ── Root: smart redirect ─────────────────────── */}
          <Route path="/" element={<RootRedirect />} />

          {/* ── Auth ────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Protected dashboard ─────────────────────── */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* ── Public chatbot widget (Phase 3) ─────────── */}
          {/* URL format: /chat/:token  where token = agent.embedToken */}
          <Route path="/chat/:token" element={<ChatPage />} />

          {/* ── Catch-all ───────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </div>
    </AuthProvider>
  )
}
