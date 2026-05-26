// ============================================================
// SorgyAI — RootRedirect.tsx
// Accessed at "/". Reads auth state and redirects:
//   - Loading   → spinner (waits for Firebase onAuthStateChanged)
//   - Logged in → /dashboard
//   - Guest     → /login
// This avoids a flash-of-wrong-page on first load.
// ============================================================
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function RootRedirect() {
  const { firebaseUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Logo mark */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center animate-led-pulse"
            style={{
              background: 'linear-gradient(135deg, #00D4FF22, #0066FF11)',
              border: '1px solid rgba(0,212,255,0.30)',
              boxShadow: '0 0 30px rgba(0,212,255,0.15)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill="#00D4FF"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          {/* Spinner */}
          <div
            className="w-6 h-6 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: '#00D4FF', opacity: 0.7 }}
          />
          <p style={{ color: '#4d6880', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>
            Caricamento…
          </p>
        </div>
      </div>
    )
  }

  return <Navigate to={firebaseUser ? '/dashboard' : '/login'} replace />
}
