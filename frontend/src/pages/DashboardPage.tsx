// ============================================================
// SorgyAI — DashboardPage.tsx
// Authenticated shell at /dashboard/*.
// Wraps the Dashboard component and provides:
//   • Sidebar navigation (desktop) / Bottom tab bar (mobile)
//   • Sub-route switching: /leads · /scripts · /settings
//   • Agent profile panel (logout, embed link, WhatsApp #)
// ============================================================
import { useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import LeadTable, { type LeadRow } from '@/components/LeadTable'
import ScriptGenerator from '@/components/ScriptGenerator'

// ── Nav items ─────────────────────────────────────────────────
const NAV = [
  {
    id:    'leads',
    path:  '/dashboard/leads',
    label: 'Lead Hub',
    badge: 'Live',
    badgeColor: '#00FF88',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#00D4FF' : '#6b889e'} strokeWidth="1.8" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id:    'scripts',
    path:  '/dashboard/scripts',
    label: 'Objection AI',
    badge: 'AI',
    badgeColor: '#00D4FF',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#00D4FF' : '#6b889e'} strokeWidth="1.8" strokeLinecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id:    'settings',
    path:  '/dashboard/settings',
    label: 'Impostazioni',
    badge: null,
    badgeColor: '',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#00D4FF' : '#6b889e'} strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

// ============================================================
// DashboardPage
// ============================================================
export default function DashboardPage() {
  const { agent, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const currentNav = NAV.find(n => location.pathname.startsWith(n.path)) ?? NAV[0]!

  return (
    <div className="flex min-h-screen" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Sidebar (desktop) ────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen"
        style={{
          background: 'rgba(3,12,26,0.92)',
          borderRight: '1px solid rgba(0,212,255,0.10)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #0066FF)', boxShadow: '0 0 16px rgba(0,212,255,0.40)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill="#030c1a"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#030c1a" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 16, fontWeight: 700, color: '#E8F4FD', letterSpacing: '0.10em' }}>
            SORGY<span style={{ color: '#00D4FF' }}>AI</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {NAV.map(item => {
            const active = location.pathname.startsWith(item.path)
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 w-full text-left"
                style={{
                  background: active ? 'rgba(0,212,255,0.10)' : 'transparent',
                  color:      active ? '#E8F4FD' : '#6b889e',
                  border:     active ? '1px solid rgba(0,212,255,0.20)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,212,255,0.05)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {item.icon(active)}
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-widest"
                    style={{
                      background: `${item.badgeColor}18`,
                      border: `1px solid ${item.badgeColor}30`,
                      color: item.badgeColor,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Agent card */}
        <div className="px-3 pb-4" style={{ borderTop: '1px solid rgba(0,212,255,0.08)', paddingTop: 12 }}>
          {agent && (
            <div
              className="rounded-xl px-3 py-3 mb-2"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2.5 mb-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: 'rgba(0,212,255,0.15)',
                    border: '1px solid rgba(0,212,255,0.25)',
                    color: '#00D4FF',
                    fontFamily: "'Orbitron', sans-serif",
                  }}
                >
                  {agent.displayName.slice(0,2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#E8F4FD' }}>{agent.displayName}</p>
                  <p className="text-[10px] truncate" style={{ color: '#4d6880' }}>{agent.email}</p>
                </div>
              </div>

              {/* Embed link */}
              <button
                onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/chat/${agent.embedToken}`)}
                className="w-full flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg transition-colors duration-150 mb-2"
                style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)', color: '#6b889e' }}
                title="Copia link chatbot"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00FF88', boxShadow: '0 0 4px #00FF88' }} />
                <span className="font-mono truncate" style={{ color: '#4d6880' }}>
                  /chat/<span style={{ color: '#00D4FF' }}>{agent.embedToken.slice(0,8)}…</span>
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto flex-shrink-0">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>

              {/* Plan badge */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase"
                  style={{
                    background: agent.plan === 'pro' ? 'rgba(157,0,255,0.15)' : 'rgba(0,212,255,0.10)',
                    border:     agent.plan === 'pro' ? '1px solid rgba(157,0,255,0.30)' : '1px solid rgba(0,212,255,0.20)',
                    color:      agent.plan === 'pro' ? '#9D00FF' : '#00D4FF',
                  }}
                >
                  {agent.plan}
                </span>
                <button
                  onClick={signOut}
                  className="text-[10px] transition-colors duration-150"
                  style={{ color: '#4d6880' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#FF6B6B'}
                  onMouseLeave={e => e.currentTarget.style.color = '#4d6880'}
                >
                  Esci →
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header
          className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40"
          style={{
            background: 'rgba(3,12,26,0.92)',
            borderBottom: '1px solid rgba(0,212,255,0.10)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 700, color: '#E8F4FD', letterSpacing: '0.10em' }}>
            SORGY<span style={{ color: '#00D4FF' }}>AI</span>
          </span>
          <span className="text-sm font-semibold" style={{ color: '#00D4FF' }}>
            {currentNav?.label}
          </span>
          <button onClick={signOut} style={{ color: '#4d6880', fontSize: 12 }}>Esci</button>
        </header>

        {/* Page content */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route index                element={<Navigate to="leads" replace />} />
            <Route path="leads"         element={<LeadsTab   agentId={agent?.id ?? ''} />} />
            <Route path="scripts"       element={<ScriptsTab agentId={agent?.id ?? ''} />} />
            <Route path="settings"      element={<SettingsTab />} />
            <Route path="*"             element={<Navigate to="leads" replace />} />
          </Routes>
        </div>

        {/* Mobile bottom tab bar */}
        <nav
          className="lg:hidden flex items-center sticky bottom-0 z-40"
          style={{
            background: 'rgba(3,12,26,0.95)',
            borderTop: '1px solid rgba(0,212,255,0.10)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {NAV.map(item => {
            const active = location.pathname.startsWith(item.path)
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors duration-150"
                style={{ color: active ? '#00D4FF' : '#4d6880' }}
              >
                {item.icon(active)}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </main>
    </div>
  )
}

// ============================================================
// Tab content components
// ============================================================

// ── Leads Tab ─────────────────────────────────────────────────
function LeadsTab({ agentId }: { agentId: string }) {
  const [leads, setLeads]     = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<Set<string>>(new Set())

  const fetchLeads = async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/leads?agentId=${agentId}&limit=200`)
      const data = await res.json() as { leads: LeadRow[] }
      setLeads(data.leads ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  // Initial fetch
  useState(() => { fetchLeads() })

  const handleStatusChange = async (leadId: string, status: import('@/types').LeadStatus) => {
    setUpdating(prev => new Set(prev).add(leadId))
    try {
      await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l))
    } finally {
      setUpdating(prev => { const n = new Set(prev); n.delete(leadId); return n })
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Lead Hub"
        subtitle="Tutti i contatti raccolti dal tuo chatbot in tempo reale"
        badge={{ label: 'Live', color: '#00FF88' }}
      />
      <LeadTable
        leads={leads}
        loading={loading}
        onStatusChange={handleStatusChange}
        onRefresh={fetchLeads}
        updatingIds={updating}
      />
    </div>
  )
}

// ── Scripts Tab ───────────────────────────────────────────────
function ScriptsTab({ agentId }: { agentId: string }) {
  return (
    <div className="animate-fade-up max-w-3xl">
      <PageHeader
        title="Objection AI"
        subtitle="Genera 3 script WhatsApp pronti da un'obiezione del cliente"
        badge={{ label: 'AI · GPT-4o-mini', color: '#00D4FF' }}
      />
      <ScriptGenerator agentId={agentId} />
    </div>
  )
}

// ── Settings Tab ──────────────────────────────────────────────
function SettingsTab() {
  const { agent, updateAgentProfile, firebaseUser } = useAuth()
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [whatsapp, setWhatsapp] = useState(agent?.whatsappPhone ?? '')
  const [botName, setBotName]   = useState(agent?.chatbotName ?? '')
  const [welcome, setWelcome]   = useState(agent?.chatbotWelcomeMsg ?? '')

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateAgentProfile({
        whatsappPhone: whatsapp,
        chatbotName: botName,
        welcomeMsg: welcome,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* error shown by context */ }
    finally { setSaving(false) }
  }

  const embedUrl    = `${window.location.origin}/chat/${agent?.embedToken ?? ''}`
  const scriptTag   = `<script src="${window.location.origin}/embed.js" data-token="${agent?.embedToken ?? ''}" async></script>`

  return (
    <div className="animate-fade-up max-w-2xl flex flex-col gap-6">
      <PageHeader title="Impostazioni" subtitle="Configura il tuo chatbot e le impostazioni account" />

      {/* Chatbot settings */}
      <SettingsCard title="🤖 Configurazione Chatbot">
        <SettingsField label="Nome del chatbot" hint="Visibile agli utenti nel widget">
          <input className="glass-input w-full px-4 py-2.5 text-sm" value={botName} onChange={e => setBotName(e.target.value)} placeholder="Es. Sara AI" />
        </SettingsField>
        <SettingsField label="Messaggio di benvenuto" hint="Prima frase mostrata all'utente">
          <textarea className="glass-input w-full px-4 py-2.5 text-sm resize-none" rows={3} value={welcome} onChange={e => setWelcome(e.target.value)} />
        </SettingsField>
        <SettingsField label="Numero WhatsApp (senza +)" hint="Es. 393471234567 — qui arrivano i lead">
          <input className="glass-input w-full px-4 py-2.5 text-sm font-mono" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="393471234567" />
        </SettingsField>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-electric py-2.5 px-6 text-sm disabled:opacity-50"
        >
          {saving ? 'Salvataggio…' : saved ? '✓ Salvato!' : 'Salva modifiche'}
        </button>
      </SettingsCard>

      {/* Embed */}
      <SettingsCard title="🔗 Integrazione & Embed">
        <SettingsField label="Link pubblico chatbot" hint="Condividilo su bio link, Linktree, Instagram">
          <div className="flex gap-2">
            <input readOnly className="glass-input flex-1 px-4 py-2.5 text-sm font-mono" value={embedUrl} style={{ color: '#6b889e' }} />
            <button onClick={() => navigator.clipboard?.writeText(embedUrl)} className="btn-glass px-3 py-2.5 text-xs">Copia</button>
          </div>
        </SettingsField>
        <SettingsField label="Script tag da incollare nel tuo sito" hint="Incollalo prima di </body>">
          <div className="flex gap-2">
            <input readOnly className="glass-input flex-1 px-4 py-2.5 text-xs font-mono" value={scriptTag} style={{ color: '#6b889e' }} />
            <button onClick={() => navigator.clipboard?.writeText(scriptTag)} className="btn-glass px-3 py-2.5 text-xs">Copia</button>
          </div>
        </SettingsField>
      </SettingsCard>

      {/* Account info */}
      <SettingsCard title="👤 Account">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4d6880' }}>Email</p>
            <p style={{ color: '#94a8ba' }}>{firebaseUser?.email}</p></div>
          <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4d6880' }}>Piano</p>
            <p style={{ color: '#00D4FF', textTransform: 'capitalize' }}>{agent?.plan}</p></div>
          <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4d6880' }}>OpenAI Assistant</p>
            <p className="font-mono text-xs truncate" style={{ color: '#35506a' }}>{agent?.openaiAssistantId ?? '—'}</p></div>
          <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4d6880' }}>Embed Token</p>
            <p className="font-mono text-xs truncate" style={{ color: '#35506a' }}>{agent?.embedToken?.slice(0,16) ?? '—'}…</p></div>
        </div>
      </SettingsCard>
    </div>
  )
}

// ── Shared UI helpers ─────────────────────────────────────────
function PageHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge?: { label: string; color: string } }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 20, fontWeight: 700, color: '#E8F4FD', letterSpacing: '0.06em' }}>
          {title}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b889e' }}>{subtitle}</p>
      </div>
      {badge && (
        <span
          className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase mt-1"
          style={{ background: `${badge.color}15`, border: `1px solid ${badge.color}28`, color: badge.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-led-pulse" style={{ background: badge.color, boxShadow: `0 0 4px ${badge.color}` }} />
          {badge.label}
        </span>
      )}
    </div>
  )
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-glass p-6 flex flex-col gap-4"
      style={{ background: 'rgba(6,19,42,0.70)', border: '1px solid rgba(0,212,255,0.10)', backdropFilter: 'blur(16px)' }}>
      <h3 className="text-sm font-semibold" style={{ color: '#E8F4FD' }}>{title}</h3>
      <div className="divider-electric" />
      {children}
    </div>
  )
}

function SettingsField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: '#4d6880' }}>{label}</label>
      {children}
      {hint && <p className="text-[10px]" style={{ color: '#35506a' }}>{hint}</p>}
    </div>
  )
}
