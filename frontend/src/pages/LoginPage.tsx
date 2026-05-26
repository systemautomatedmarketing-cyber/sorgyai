// ============================================================
// SorgyAI — LoginPage.tsx
// Public page at /login.
// Two modes toggled in-place:
//   'login'  → email + password → signIn()
//   'signup' → displayName + email + password + whatsapp → signUp()
//   'reset'  → email → resetPassword()
//
// After successful login/signup: navigate to /dashboard
// (or to the original URL if redirected by ProtectedRoute).
// ============================================================
import { useState, useCallback } from 'react'
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom'
import { useAuth, type SignUpPayload } from '@/context/AuthContext'

type Mode = 'login' | 'signup' | 'reset'

export default function LoginPage() {
  const { firebaseUser, loading: authLoading, signIn, signUp, resetPassword, error, clearError } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  // Where to go after login (from ProtectedRoute state or default dashboard)
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  // ── If already logged in, skip this page ────────────────
  if (!authLoading && firebaseUser) return <Navigate to={from} replace />

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* ── Background decorations ─────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)',
        }}/>
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 70%)',
        }}/>
      </div>

      {/* ── Card ────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-md animate-fade-up"
        style={{
          background: 'rgba(6,19,42,0.80)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(0,212,255,0.14)',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(0,212,255,0.06), inset 0 1px 0 rgba(255,255,255,0.07)',
          padding: '40px 36px',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, #00D4FF, #0066FF)',
              boxShadow: '0 0 32px rgba(0,212,255,0.40)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill="#030c1a"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                stroke="#030c1a" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 22, fontWeight: 700, letterSpacing: '0.12em', color: '#E8F4FD',
            }}
          >
            SORGY<span style={{ color: '#00D4FF' }}>AI</span>
          </h1>
          <p style={{ fontSize: 12, color: '#6b889e', marginTop: 4 }}>
            Network Marketing · AI Powered
          </p>
        </div>

        {/* Form router */}
        <AuthForm
          from={from}
          onNavigate={navigate}
          clearError={clearError}
          globalError={error}
          signIn={signIn}
          signUp={signUp}
          resetPassword={resetPassword}
        />
      </div>
    </div>
  )
}

// ============================================================
// AuthForm — handles all three modes internally
// ============================================================
function AuthForm({
  from, onNavigate, clearError, globalError, signIn, signUp, resetPassword,
}: {
  from: string
  onNavigate: (path: string) => void
  clearError: () => void
  globalError: string | null
  signIn: (e: string, p: string) => Promise<void>
  signUp: (p: SignUpPayload) => Promise<void>
  resetPassword: (e: string) => Promise<void>
}) {
  const [mode, setMode]           = useState<Mode>('login')
  const [loading, setLoading]     = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Form fields
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [displayName, setName]    = useState('')
  const [whatsapp, setWhatsapp]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [fieldError, setFieldError] = useState('')

  const switchMode = (m: Mode) => {
    setMode(m); clearError(); setFieldError(''); setResetSent(false)
  }

  // ── Validate ─────────────────────────────────────────────
  const validate = (): string => {
    if (!email.trim())              return 'Inserisci la tua email'
    if (!/\S+@\S+\.\S+/.test(email)) return 'Email non valida'
    if (mode === 'reset')           return ''
    if (!password)                  return 'Inserisci la password'
    if (password.length < 6)        return 'La password deve avere almeno 6 caratteri'
    if (mode === 'signup') {
      if (!displayName.trim())      return 'Inserisci il tuo nome'
      if (password !== confirm)     return 'Le password non coincidono'
      if (!whatsapp.trim())         return 'Inserisci il numero WhatsApp'
      if (!/^\+?[\d\s\-]{8,}$/.test(whatsapp)) return 'Numero WhatsApp non valido'
    }
    return ''
  }

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const err = validate()
    if (err) { setFieldError(err); return }
    setFieldError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
        onNavigate(from)

      } else if (mode === 'signup') {
        await signUp({
          email, password,
          displayName: displayName.trim(),
          whatsappPhone: whatsapp.replace(/[\s\-+()]/g, ''),
        })
        onNavigate('/dashboard')

      } else {
        await resetPassword(email)
        setResetSent(true)
      }
    } catch {
      // error already set in context
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, email, password, confirm, displayName, whatsapp])

  const displayedError = fieldError || globalError

  // ── Reset sent screen ─────────────────────────────────────
  if (resetSent) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 animate-fade-up">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,255,136,0.10)', border: '1px solid rgba(0,255,136,0.25)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h3 style={{ color: '#E8F4FD', fontFamily: "'DM Sans'", fontSize: 16, fontWeight: 600 }}>
          Email inviata!
        </h3>
        <p className="text-center text-sm" style={{ color: '#94a8ba' }}>
          Controlla la tua casella di posta e segui il link per reimpostare la password.
        </p>
        <button
          onClick={() => switchMode('login')}
          className="btn-glass px-6 py-2.5 text-sm mt-2"
        >
          ← Torna al login
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* ── Mode tabs ───────────────────────────────────── */}
      {mode !== 'reset' && (
        <div
          className="flex gap-1 p-1 rounded-xl mb-2"
          style={{ background: 'rgba(3,12,26,0.60)', border: '1px solid rgba(0,212,255,0.10)' }}
        >
          {(['login', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: mode === m
                  ? 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,102,255,0.08))'
                  : 'transparent',
                color:  mode === m ? '#E8F4FD' : '#6b889e',
                border: mode === m ? '1px solid rgba(0,212,255,0.22)' : '1px solid transparent',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {m === 'login' ? 'Accedi' : 'Registrati'}
            </button>
          ))}
        </div>
      )}

      {/* ── Reset mode header ───────────────────────────── */}
      {mode === 'reset' && (
        <div className="mb-2">
          <h3 style={{ color: '#E8F4FD', fontSize: 16, fontWeight: 600, fontFamily: "'DM Sans'" }}>
            Recupera password
          </h3>
          <p style={{ color: '#6b889e', fontSize: 13, marginTop: 4 }}>
            Inserisci la tua email e ti mandiamo il link di reset.
          </p>
        </div>
      )}

      {/* ── Signup extra fields ──────────────────────────── */}
      {mode === 'signup' && (
        <>
          <Field
            label="Il tuo nome completo"
            type="text"
            value={displayName}
            onChange={setName}
            placeholder="Es. Marco Rossi"
            autoComplete="name"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            }
          />
          <Field
            label="Numero WhatsApp"
            type="tel"
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder="+39 347 123 4567"
            autoComplete="tel"
            hint="Il tuo numero WhatsApp dove riceverai i lead"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
            }
          />
        </>
      )}

      {/* ── Email ────────────────────────────────────────── */}
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="nome@esempio.com"
        autoComplete="email"
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        }
      />

      {/* ── Password ─────────────────────────────────────── */}
      {mode !== 'reset' && (
        <div>
          <label className="text-[11px] uppercase tracking-widest font-semibold mb-1.5 block" style={{ color: '#4d6880' }}>
            Password
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(0,212,255,0.55)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimo 6 caratteri"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="glass-input w-full pl-9 pr-10 py-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
              style={{ color: showPwd ? '#00D4FF' : '#4d6880' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {showPwd
                  ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                  : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                }
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm password (signup) ────────────────────── */}
      {mode === 'signup' && (
        <Field
          label="Conferma password"
          type={showPwd ? 'text' : 'password'}
          value={confirm}
          onChange={setConfirm}
          placeholder="Ripeti la password"
          autoComplete="new-password"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        />
      )}

      {/* ── Error ────────────────────────────────────────── */}
      {displayedError && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm animate-fade-up"
          style={{
            background: 'rgba(255,107,107,0.08)',
            border: '1px solid rgba(255,107,107,0.22)',
            color: '#FF6B6B',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {displayedError}
        </div>
      )}

      {/* ── CTA ──────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={loading}
        className="btn-electric w-full py-3.5 mt-1 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#030c1a' }} />
            {mode === 'login' ? 'Accesso…' : mode === 'signup' ? 'Creazione account…' : 'Invio email…'}
          </>
        ) : (
          <>
            {mode === 'login'  && '→ Accedi alla Dashboard'}
            {mode === 'signup' && '→ Crea il tuo SorgyAI'}
            {mode === 'reset'  && '→ Invia link di reset'}
          </>
        )}
      </button>

      {/* ── Bottom links ─────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2 pt-1">
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => switchMode('reset')}
            className="text-xs transition-colors duration-150"
            style={{ color: '#4d6880' }}
            onMouseEnter={e => e.currentTarget.style.color = '#00D4FF'}
            onMouseLeave={e => e.currentTarget.style.color = '#4d6880'}
          >
            Password dimenticata?
          </button>
        )}
        {mode === 'reset' && (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-xs transition-colors duration-150"
            style={{ color: '#4d6880' }}
            onMouseEnter={e => e.currentTarget.style.color = '#94a8ba'}
            onMouseLeave={e => e.currentTarget.style.color = '#4d6880'}
          >
            ← Torna al login
          </button>
        )}
        <p className="text-[10px] text-center mt-1" style={{ color: '#35506a' }}>
          Accedendo accetti i{' '}
          <span style={{ color: '#4d6880', cursor: 'pointer' }}>Termini di servizio</span>
          {' '}e la{' '}
          <span style={{ color: '#4d6880', cursor: 'pointer' }}>Privacy Policy</span>
        </p>
      </div>
    </form>
  )
}

// ── Reusable field ────────────────────────────────────────────
function Field({
  label, type, value, onChange, placeholder, autoComplete, hint, icon,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoComplete?: string
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest font-semibold mb-1.5 block" style={{ color: '#4d6880' }}>
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(0,212,255,0.55)' }}>
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`glass-input w-full py-3 text-sm ${icon ? 'pl-9 pr-4' : 'px-4'}`}
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        />
      </div>
      {hint && <p className="text-[10px] mt-1.5 ml-1" style={{ color: '#4d6880' }}>{hint}</p>}
    </div>
  )
}
