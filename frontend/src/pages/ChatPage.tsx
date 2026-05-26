// ============================================================
// SorgyAI — ChatPage.tsx
// Public customer-facing page at /chat/:token
//
// This is what the end customer sees when they click the
// agent's link (from bio link, Linktree, Instagram story, etc.)
//
// Flow:
//   1. Extract :token from URL params
//   2. Fetch agent config from /api/agents/by-token/:token
//      → gets chatbotName, welcomeMsg, accentColor
//   3. Render full-page ChatWidget (no FAB launcher — always open)
//   4. Fallback error screen if token is invalid
//
// SEO: each agent's page gets their chatbotName in <title>.
// (title is set via document.title since this is a SPA)
// ============================================================
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ChatWidget from '@/components/ChatWidget'

// ── Minimal agent config needed by the public widget ─────────
interface PublicAgentConfig {
  agentId:     string
  chatbotName: string
  welcomeMsg:  string
  accentColor: string   // Future: per-agent brand color
}

type LoadState = 'loading' | 'ready' | 'error'

export default function ChatPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState]   = useState<LoadState>('loading')
  const [config, setConfig] = useState<PublicAgentConfig | null>(null)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); setErrMsg('Link non valido.'); return }

    fetch(`/api/agents/by-token/${token}`)
      .then(async res => {
        if (res.status === 404) throw new Error('Chatbot non trovato. Il link potrebbe essere scaduto.')
        if (!res.ok)            throw new Error(`Errore caricamento (${res.status})`)
        const data = await res.json() as { agent: PublicAgentConfig }
        setConfig(data.agent)

        // Update page title dynamically
        document.title = `${data.agent.chatbotName} · SorgyAI`
        setState('ready')
      })
      .catch((e: Error) => {
        setErrMsg(e.message)
        setState('error')
      })
  }, [token])

  // ── Loading ───────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center animate-led-pulse"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,102,255,0.10))',
              border: '1px solid rgba(0,212,255,0.28)',
              boxShadow: '0 0 32px rgba(0,212,255,0.15)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill="#00D4FF"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full" style={{
                background: '#00D4FF',
                animation: `dot-bounce 1.4s ease-in-out ${i*0.2}s infinite`,
              }}/>
            ))}
          </div>
          <p style={{ color: '#4d6880', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
            Caricamento assistente…
          </p>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────
  if (state === 'error' || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div
          className="w-full max-w-sm text-center rounded-glass p-8 animate-fade-up"
          style={{
            background: 'rgba(6,19,42,0.80)',
            border: '1px solid rgba(255,107,107,0.18)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(255,107,107,0.10)', border: '1px solid rgba(255,107,107,0.22)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 16, color: '#E8F4FD', marginBottom: 8 }}>
            Link non valido
          </h2>
          <p style={{ color: '#94a8ba', fontSize: 14, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
            {errMsg || 'Questo link non è più attivo o non esiste.'}
          </p>
          <p className="text-xs mt-4" style={{ color: '#4d6880' }}>
            Contatta chi ti ha condiviso questo link per ottenerne uno aggiornato.
          </p>
        </div>
      </div>
    )
  }

  // ── Ready — full-page chat ────────────────────────────────
  // On the public ChatPage the widget is always visible (no FAB toggle).
  // We render it as a full-page layout rather than a floating panel.
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Mesh background accents */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 20% 30%, ${config.accentColor}10 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, rgba(0,102,255,0.07) 0%, transparent 50%)
        `
      }}/>

      {/* Centered chat panel */}
      <div className="relative w-full max-w-md">

        {/* Powered by header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-led-pulse"
              style={{ background: '#00FF88', boxShadow: '0 0 6px #00FF88' }}/>
            <span className="text-xs font-semibold" style={{ color: '#6b889e' }}>
              {config.chatbotName}
            </span>
          </div>
          <span className="text-[10px]" style={{ color: '#35506a' }}>
            Powered by <span style={{ color: config.accentColor, opacity: 0.7 }}>SorgyAI</span>
          </span>
        </div>

        {/* Chat panel — always open, full height */}
        <div
          style={{
            height: 'min(680px, calc(100vh - 120px))',
            background: 'rgba(6,19,42,0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1px solid ${config.accentColor}20`,
            borderRadius: 24,
            boxShadow: `0 32px 80px rgba(0,0,0,0.60), 0 0 60px ${config.accentColor}08`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/*
            ChatWidget in embedded mode:
            - isOpen is always true (no FAB)
            - Pass forceOpen prop to skip the launcher
            The widget renders its inner panel content directly.
            For Phase 3 production, ChatWidget would accept a
            `mode="embedded"` prop that skips the FAB entirely.
            For now we use a wrapper that shows only the inner panel.
          */}
          <EmbeddedChat config={config} />
        </div>
      </div>
    </div>
  )
}

// ── EmbeddedChat ──────────────────────────────────────────────
// Renders the ChatWidget content directly without the FAB.
// Re-uses all the same logic — just auto-opens.
function EmbeddedChat({ config }: { config: PublicAgentConfig }) {
  // The ChatWidget already has internal open state.
  // For the embedded page we set defaultOpen and hide the FAB via CSS.
  return (
    <div className="flex-1 overflow-hidden relative">
      {/*
        Mount ChatWidget inside this container.
        The FAB button will be hidden via a wrapper style since it uses
        `fixed` positioning — on the ChatPage we reposition/hide it.
      */}
      <style>{`
        /* On ChatPage: hide the FAB (fixed bottom-right button) 
           and make the panel fill its container instead of using fixed positioning */
        .chat-embedded-wrapper > .chat-panel-fixed {
          position: relative !important;
          bottom: auto !important;
          right: auto !important;
          width: 100% !important;
          height: 100% !important;
          opacity: 1 !important;
          transform: none !important;
          pointer-events: auto !important;
        }
        .chat-embedded-wrapper > .chat-fab { display: none !important; }
      `}</style>
      <div className="chat-embedded-wrapper h-full">
        <ChatWidget
          agentId={config.agentId}
          chatbotName={config.chatbotName}
          welcomeMsg={config.welcomeMsg}
          accentColor={config.accentColor}
        />
      </div>
    </div>
  )
}
