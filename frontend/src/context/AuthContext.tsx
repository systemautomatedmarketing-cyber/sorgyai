// ============================================================
// SorgyAI — AuthContext.tsx
// Firebase Authentication + agent profile hydration.
//
// Flow:
//   1. Firebase Auth monitors the session (onAuthStateChanged)
//   2. On login, fetch the agent row from D1 via Worker API
//   3. Expose { agent, firebaseUser, loading, signIn,
//               signUp, signOut, updateProfile } to the tree
//
// Phase 1 (MVP Interno):
//   Auth is still Firebase — simplest path to secure a
//   restricted alpha group. D1 agent row is created manually
//   via the setup script (see scripts/seed-agent.ts).
//
// Phase 3 (Automated Onboarding):
//   signUp() calls POST /api/auth/onboard which auto-creates
//   the OpenAI assistant + embed token and inserts the D1 row.
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  sendPasswordResetEmail,
  type User as FirebaseUser,
  type AuthError,
} from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import type { Agent } from '@/types'

// ============================================================
// Firebase initialisation
// ============================================================
// Vite exposes env vars prefixed with VITE_ at build time.
// Create a .env.local in /frontend with these values:
//
//   VITE_FIREBASE_API_KEY=...
//   VITE_FIREBASE_AUTH_DOMAIN=...
//   VITE_FIREBASE_PROJECT_ID=...
//   VITE_FIREBASE_APP_ID=...
// ============================================================
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? '',
}

// Avoid re-initialising on HMR in dev
const firebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0]!

const auth = getAuth(firebaseApp)

// ============================================================
// Sign-up payload (Phase 3 onboarding)
// ============================================================
export interface SignUpPayload {
  email:         string
  password:      string
  displayName:   string
  whatsappPhone: string   // "393471234567" — no + prefix
  chatbotName?:  string
  welcomeMsg?:   string
}

// ============================================================
// Update profile payload
// ============================================================
export interface UpdateProfilePayload {
  displayName?:   string
  whatsappPhone?: string
  chatbotName?:   string
  welcomeMsg?:    string
}

// ============================================================
// Context shape
// ============================================================
interface AuthContextValue {
  // State
  agent:        Agent | null
  firebaseUser: FirebaseUser | null
  loading:      boolean
  error:        string | null

  // Actions
  signIn:          (email: string, password: string) => Promise<void>
  signUp:          (payload: SignUpPayload) => Promise<void>
  signOut:         () => Promise<void>
  resetPassword:   (email: string) => Promise<void>
  updateAgentProfile: (payload: UpdateProfilePayload) => Promise<void>
  clearError:      () => void
}

// ============================================================
// Context + hook
// ============================================================
const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// ============================================================
// Firebase error → Italian message map
// ============================================================
function mapFirebaseError(err: unknown): string {
  const code = (err as AuthError)?.code ?? ''
  const map: Record<string, string> = {
    'auth/user-not-found':      'Nessun account trovato con questa email.',
    'auth/wrong-password':      'Password errata. Riprova.',
    'auth/invalid-email':       'Indirizzo email non valido.',
    'auth/email-already-in-use':'Questa email è già registrata.',
    'auth/weak-password':       'Password troppo debole (min. 6 caratteri).',
    'auth/too-many-requests':   'Troppi tentativi. Attendi qualche minuto.',
    'auth/network-request-failed': 'Errore di rete. Controlla la connessione.',
    'auth/invalid-credential':  'Credenziali non valide. Controlla email e password.',
    'auth/user-disabled':       'Account disabilitato. Contatta il supporto.',
  }
  return map[code] ?? `Errore di autenticazione (${code || 'sconosciuto'}).`
}

// ============================================================
// Agent row fetcher — called after Firebase login
// Hits the Cloudflare Worker via Vite proxy in dev,
// directly in production.
// ============================================================
async function fetchAgentProfile(uid: string, idToken: string): Promise<Agent | null> {
  try {
    const res = await fetch(`/api/agents/${uid}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (res.status === 404) return null   // Phase 1: agent not yet in D1
    if (!res.ok) throw new Error(`Agent fetch failed: ${res.status}`)
    const data = await res.json() as { agent: Agent }
    return data.agent
  } catch (e) {
    console.error('[AuthContext] fetchAgentProfile:', e)
    return null
  }
}

// ============================================================
// AuthProvider
// ============================================================
export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [agent, setAgent]               = useState<Agent | null>(null)
  const [loading, setLoading]           = useState(true)   // True until first auth check
  const [error, setError]               = useState<string | null>(null)

  // ── Hydrate agent profile from D1 ─────────────────────────
  const hydrateAgent = useCallback(async (user: FirebaseUser) => {
    try {
      const idToken = await user.getIdToken()
      const profile = await fetchAgentProfile(user.uid, idToken)
      setAgent(profile)
    } catch (e) {
      console.error('[AuthContext] hydrateAgent:', e)
      setAgent(null)
    }
  }, [])

  // ── Firebase auth state listener ───────────────────────────
  // Runs once on mount. On sign-in: hydrate agent. On sign-out: clear.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      if (user) {
        await hydrateAgent(user)
      } else {
        setAgent(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [hydrateAgent])

  // ── Token refresh: re-hydrate agent every hour ─────────────
  // Firebase tokens expire after 1h; this keeps the profile fresh.
  useEffect(() => {
    if (!firebaseUser) return
    const interval = setInterval(() => hydrateAgent(firebaseUser), 55 * 60 * 1000)
    return () => clearInterval(interval)
  }, [firebaseUser, hydrateAgent])

  // ============================================================
  // signIn
  // ============================================================
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      // onAuthStateChanged will fire and hydrate agent
      await hydrateAgent(cred.user)
    } catch (e) {
      setError(mapFirebaseError(e))
      throw e   // Let the form know to stop its loading state
    } finally {
      setLoading(false)
    }
  }, [hydrateAgent])

  // ============================================================
  // signUp — Phase 3 automated onboarding
  // ============================================================
  // Flow:
  //   1. Create Firebase Auth account
  //   2. Set displayName on Firebase profile
  //   3. Call POST /api/auth/onboard → creates OpenAI assistant
  //      + vector store + D1 agent row + embed token
  //   4. Hydrate agent from D1
  // ============================================================
  const signUp = useCallback(async (payload: SignUpPayload) => {
    setError(null)
    setLoading(true)
    try {
      // 1. Firebase account
      const cred = await createUserWithEmailAndPassword(auth, payload.email.trim(), payload.password)

      // 2. Set display name on Firebase
      await firebaseUpdateProfile(cred.user, { displayName: payload.displayName.trim() })

      // 3. Onboard agent via Worker (creates assistant + D1 row)
      const idToken = await cred.user.getIdToken()
      const res = await fetch('/api/auth/onboard', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid:           cred.user.uid,
          email:         payload.email.trim(),
          displayName:   payload.displayName.trim(),
          whatsappPhone: payload.whatsappPhone.replace(/[\s\-+()]/g, ''),
          chatbotName:   payload.chatbotName,
          welcomeMsg:    payload.welcomeMsg,
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `Onboarding failed: ${res.status}`)
      }

      // 4. Hydrate agent state
      await hydrateAgent(cred.user)

    } catch (e) {
      // If Firebase account was created but onboarding failed,
      // the user can still log in — onboarding can be retried.
      const msg = e instanceof Error ? e.message : mapFirebaseError(e)
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [hydrateAgent])

  // ============================================================
  // signOut
  // ============================================================
  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth)
      setAgent(null)
      setFirebaseUser(null)
    } catch (e) {
      setError(mapFirebaseError(e))
    }
  }, [])

  // ============================================================
  // resetPassword
  // ============================================================
  const resetPassword = useCallback(async (email: string) => {
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email.trim())
    } catch (e) {
      setError(mapFirebaseError(e))
      throw e
    }
  }, [])

  // ============================================================
  // updateAgentProfile
  // ============================================================
  // Updates mutable agent fields in D1 via PATCH /api/agents/:id.
  // Also updates Firebase displayName if provided.
  // ============================================================
  const updateAgentProfile = useCallback(async (payload: UpdateProfilePayload) => {
    if (!firebaseUser || !agent) throw new Error('Not authenticated')
    setError(null)

    try {
      const idToken = await firebaseUser.getIdToken()

      // Update Firebase display name if changed
      if (payload.displayName && payload.displayName !== firebaseUser.displayName) {
        await firebaseUpdateProfile(firebaseUser, { displayName: payload.displayName })
      }

      // Update D1 agent row
      const res = await fetch(`/api/agents/${agent.id}`, {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `Update failed: ${res.status}`)
      }

      // Optimistically update local agent state
      setAgent(prev => prev ? {
        ...prev,
        displayName:     payload.displayName   ?? prev.displayName,
        whatsappPhone:   payload.whatsappPhone  ?? prev.whatsappPhone,
        chatbotName:     payload.chatbotName    ?? prev.chatbotName,
        chatbotWelcomeMsg: payload.welcomeMsg   ?? prev.chatbotWelcomeMsg,
        updatedAt:       Date.now(),
      } : null)

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore aggiornamento profilo'
      setError(msg)
      throw e
    }
  }, [firebaseUser, agent])

  // ============================================================
  // clearError
  // ============================================================
  const clearError = useCallback(() => setError(null), [])

  // ============================================================
  // Context value — memoised to avoid unnecessary re-renders
  // ============================================================
  const value: AuthContextValue = {
    agent,
    firebaseUser,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateAgentProfile,
    clearError,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ============================================================
// ProtectedRoute helper
// ============================================================
// Usage in App.tsx:
//   <Route path="/dashboard/*" element={
//     <ProtectedRoute><DashboardPage /></ProtectedRoute>
//   } />
// ============================================================
import { Navigate, useLocation } from 'react-router-dom'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, loading } = useAuth()
  const location = useLocation()

  // Show nothing while Firebase resolves the session
  if (loading) {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: '#00D4FF', boxShadow: '0 0 20px rgba(0,212,255,0.25)' }}
          />
          <p style={{ color: '#4d6880', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
            Verifica sessione…
          </p>
        </div>
      </div>
    )
  }

  if (!firebaseUser) {
    // Redirect to login, preserving the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// Re-export Firebase app for use elsewhere (e.g. Firestore if added later)
export { firebaseApp, auth }
