// ============================================================
// SorgyAI — Dashboard.tsx
// The authenticated networker's command center.
//
// Tabs:
//   1. Lead Hub      — real-time lead table with status mgmt
//   2. Objection AI  — killer feature: 3 WhatsApp scripts from
//                      a single objection input
//
// Design: Cyber-Glass — deep space + electric blue + LED glow
// Fonts:  Orbitron (display) · DM Sans (body) · JetBrains Mono
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Lead, LeadStatus, Agent } from '@/types'

// ── Mock agent for standalone rendering (replace with auth context) ──
const MOCK_AGENT: Agent = {
  id: 'agent_demo',
  email: 'demo@sorgyai.app',
  displayName: 'Marco Rossi',
  whatsappPhone: '393471234567',
  openaiAssistantId: 'asst_demo',
  chatbotName: 'SorgyAI Demo',
  chatbotWelcomeMsg: 'Ciao!',
  catalogFileIds: [],
  embedToken: 'demo_token',
  plan: 'pro',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

// ── Lead row as returned by D1 API (snake_case) ──────────────
interface LeadRow {
  id: string
  agent_id: string
  name: string
  phone: string
  intent_summary: string
  conversation_summary: string
  thread_id: string
  status: LeadStatus
  source: string
  created_at: number
  updated_at: number
}

// ── Tab IDs ───────────────────────────────────────────────────
type Tab = 'leads' | 'objection'

// ── Status config ─────────────────────────────────────────────
const STATUS_CFG: Record<LeadStatus, { label: string; color: string; bg: string; dot: string }> = {
  new:       { label: 'Nuovo',       color: '#00D4FF', bg: 'rgba(0,212,255,0.10)',  dot: '#00D4FF' },
  contacted: { label: 'Contattato',  color: '#FFE500', bg: 'rgba(255,229,0,0.10)',  dot: '#FFE500' },
  qualified: { label: 'Qualificato', color: '#00FF88', bg: 'rgba(0,255,136,0.10)', dot: '#00FF88' },
  closed:    { label: 'Chiuso',      color: '#9D00FF', bg: 'rgba(157,0,255,0.10)', dot: '#9D00FF' },
}

const ALL_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'closed']

// ============================================================
// Dashboard — root component
// ============================================================
export default function Dashboard({ agent = MOCK_AGENT }: { agent?: Agent }) {
  const [activeTab, setActiveTab] = useState<Tab>('leads')

  return (
    <div className="min-h-screen app-bg" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Top Navigation Bar ─────────────────────────────── */}
      <TopBar agent={agent} />

      {/* ── Main layout ────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* ── Stats row ──────────────────────────────────────── */}
        <StatsRow agentId={agent.id} />

        {/* ── Tab switcher ───────────────────────────────────── */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* ── Tab content ────────────────────────────────────── */}
        <div className="mt-6">
          {activeTab === 'leads'     && <LeadHub     agentId={agent.id} />}
          {activeTab === 'objection' && <ObjectionAI agentId={agent.id} />}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// TopBar
// ============================================================
function TopBar({ agent }: { agent: Agent }) {
  const initials = agent.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-4 mb-8"
      style={{
        background: 'rgba(3,12,26,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,212,255,0.10)',
        boxShadow: '0 4px 40px rgba(0,0,0,0.40)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #00D4FF, #0066FF)',
            boxShadow: '0 0 16px rgba(0,212,255,0.45)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="#030c1a"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              stroke="#030c1a" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span
          className="text-lg font-bold tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif", color: '#E8F4FD', letterSpacing: '0.12em' }}
        >
          SORGY<span style={{ color: '#00D4FF' }}>AI</span>
        </span>
      </div>

      {/* Right: embed link + avatar */}
      <div className="flex items-center gap-3">
        {/* Embed link pill */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer group"
          style={{
            background: 'rgba(0,212,255,0.06)',
            border: '1px solid rgba(0,212,255,0.18)',
          }}
          onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/chat/${agent.embedToken}`)}
          title="Clicca per copiare il link del chatbot"
        >
          <span className="w-1.5 h-1.5 rounded-full animate-led-pulse" style={{ background: '#00FF88', boxShadow: '0 0 6px #00FF88' }} />
          <span className="text-xs font-mono" style={{ color: '#94a8ba' }}>
            /chat/<span style={{ color: '#00D4FF' }}>{agent.embedToken.slice(0, 8)}…</span>
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a8ba" strokeWidth="2" strokeLinecap="round" className="group-hover:stroke-[#00D4FF] transition-colors">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </div>

        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(0,102,255,0.12))',
            border: '1px solid rgba(0,212,255,0.30)',
            color: '#00D4FF',
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: '0.05em',
            boxShadow: '0 0 12px rgba(0,212,255,0.20)',
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}

// ============================================================
// StatsRow — 4 KPI cards
// ============================================================
interface StatCard { label: string; value: string | number; sub: string; color: string; icon: React.ReactNode }

function StatsRow({ agentId }: { agentId: string }) {
  const [stats, setStats] = useState({ total: 0, new: 0, qualified: 0, handoffs: 0 })

  useEffect(() => {
    fetch(`/api/leads?agentId=${agentId}&limit=200`)
      .then(r => r.json())
      .then((d: { leads?: LeadRow[]; total?: number }) => {
        const leads = d.leads ?? []
        setStats({
          total:     d.total ?? leads.length,
          new:       leads.filter(l => l.status === 'new').length,
          qualified: leads.filter(l => l.status === 'qualified').length,
          handoffs:  leads.filter(l => l.status === 'contacted' || l.status === 'closed').length,
        })
      })
      .catch(() => {})
  }, [agentId])

  const cards: StatCard[] = [
    {
      label: 'Lead Totali',
      value: stats.total,
      sub: 'raccolti dal chatbot',
      color: '#00D4FF',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Nuovi Oggi',
      value: stats.new,
      sub: 'da qualificare',
      color: '#00D4FF',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      ),
    },
    {
      label: 'Qualificati',
      value: stats.qualified,
      sub: 'pronti alla chiusura',
      color: '#00FF88',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ),
    },
    {
      label: 'Handoff WA',
      value: stats.handoffs,
      sub: 'trasferiti su WhatsApp',
      color: '#25D366',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-glass p-5 relative overflow-hidden group"
          style={{
            background: 'rgba(6,19,42,0.70)',
            border: `1px solid rgba(255,255,255,0.07)`,
            backdropFilter: 'blur(12px)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = `${card.color}30`
            e.currentTarget.style.boxShadow = `0 0 30px ${card.color}12`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {/* Background glow blob */}
          <div
            className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: `radial-gradient(circle, ${card.color}18 0%, transparent 70%)` }}
          />

          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6b889e' }}>
              {card.label}
            </span>
            <span style={{ color: card.color, opacity: 0.7 }}>{card.icon}</span>
          </div>

          <div
            className="text-3xl font-bold mb-1"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: card.color,
              textShadow: `0 0 20px ${card.color}50`,
              letterSpacing: '-0.02em',
            }}
          >
            {card.value}
          </div>

          <p className="text-xs" style={{ color: '#6b889e' }}>{card.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// TabBar
// ============================================================
function TabBar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'leads',
      label: 'Lead Hub',
      badge: 'Live',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'objection',
      label: 'Objection AI',
      badge: 'AI',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
  ]

  return (
    <div
      className="flex gap-1 p-1 rounded-xl w-fit"
      style={{
        background: 'rgba(3,12,26,0.60)',
        border: '1px solid rgba(0,212,255,0.12)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {tabs.map(tab => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              background: active ? 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,102,255,0.08))' : 'transparent',
              color: active ? '#E8F4FD' : '#6b889e',
              border: active ? '1px solid rgba(0,212,255,0.25)' : '1px solid transparent',
              boxShadow: active ? '0 0 20px rgba(0,212,255,0.12)' : 'none',
            }}
          >
            <span style={{ color: active ? '#00D4FF' : '#6b889e' }}>{tab.icon}</span>
            {tab.label}
            {tab.badge && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wider"
                style={{
                  background: tab.id === 'objection' ? 'rgba(0,212,255,0.15)' : 'rgba(0,255,136,0.15)',
                  color:      tab.id === 'objection' ? '#00D4FF' : '#00FF88',
                  border:     `1px solid ${tab.id === 'objection' ? 'rgba(0,212,255,0.25)' : 'rgba(0,255,136,0.25)'}`,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// LeadHub — Tab 1
// ============================================================
function LeadHub({ agentId }: { agentId: string }) {
  const [leads, setLeads]         = useState<LeadRow[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [filterStatus, setFilter] = useState<LeadStatus | 'all'>('all')
  const [search, setSearch]       = useState('')
  const [selectedLead, setSelected] = useState<LeadRow | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch leads ──────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      const statusParam = filterStatus !== 'all' ? `&status=${filterStatus}` : ''
      const res = await fetch(`/api/leads?agentId=${agentId}${statusParam}&limit=100`)
      if (!res.ok) return
      const data = await res.json() as { leads: LeadRow[]; total: number }
      setLeads(data.leads ?? [])
      setTotal(data.total ?? 0)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [agentId, filterStatus])

  // ── Initial fetch + 30s polling ──────────────────────────
  useEffect(() => {
    setLoading(true)
    fetchLeads()
    pollingRef.current = setInterval(fetchLeads, 30_000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [fetchLeads])

  // ── Update lead status ───────────────────────────────────
  const updateStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    setUpdatingId(leadId)
    try {
      await fetch(`/api/leads/${leadId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status, updated_at: Date.now() } : l))
    } catch { /* silent */ } finally {
      setUpdatingId(null)
    }
  }, [])

  // ── Client-side search filter ────────────────────────────
  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    return !q || l.name.toLowerCase().includes(q) || l.phone.includes(q) || l.intent_summary?.toLowerCase().includes(q)
  })

  return (
    <div className="animate-fade-up">
      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">

        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6b889e' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, telefono, interesse…"
            className="glass-input w-full pl-9 pr-4 py-2.5 text-sm"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', ...ALL_STATUSES] as const).map(s => {
            const cfg = s === 'all' ? null : STATUS_CFG[s]
            const active = filterStatus === s
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150"
                style={{
                  background: active
                    ? (cfg ? cfg.bg : 'rgba(0,212,255,0.12)')
                    : 'rgba(3,12,26,0.50)',
                  color: active ? (cfg?.color ?? '#00D4FF') : '#6b889e',
                  border: `1px solid ${active ? (cfg?.color ?? '#00D4FF') + '40' : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                {s === 'all' ? 'Tutti' : cfg?.label}
              </button>
            )
          })}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchLeads}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150"
          style={{
            background: 'rgba(0,212,255,0.06)',
            border: '1px solid rgba(0,212,255,0.18)',
            color: '#00D4FF',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Aggiorna
        </button>
      </div>

      {/* ── Table card ───────────────────────────────────── */}
      <div
        className="rounded-glass overflow-hidden"
        style={{
          background: 'rgba(6,19,42,0.65)',
          border: '1px solid rgba(0,212,255,0.10)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Table header */}
        <div
          className="grid items-center px-5 py-3 text-xs font-semibold tracking-widest uppercase"
          style={{
            gridTemplateColumns: '1fr 140px 180px 130px 100px 48px',
            color: '#4d6880',
            borderBottom: '1px solid rgba(0,212,255,0.08)',
            background: 'rgba(0,0,0,0.20)',
          }}
        >
          <span>Lead</span>
          <span>Telefono</span>
          <span>Interesse</span>
          <span>Status</span>
          <span>Data</span>
          <span></span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16" style={{ color: '#4d6880' }}>
            <span className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#00D4FF' }} />
            Caricamento lead…
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4d6880" strokeWidth="1.5" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <p style={{ color: '#4d6880', fontSize: '14px' }}>
              {search ? 'Nessun lead corrisponde alla ricerca' : 'Nessun lead ancora — il chatbot li raccoglierà automaticamente!'}
            </p>
          </div>
        )}

        {/* Rows */}
        {!loading && filtered.map((lead, i) => (
          <LeadRow
            key={lead.id}
            lead={lead}
            index={i}
            isUpdating={updatingId === lead.id}
            isSelected={selectedLead?.id === lead.id}
            onSelect={() => setSelected(selectedLead?.id === lead.id ? null : lead)}
            onStatusChange={status => updateStatus(lead.id, status)}
          />
        ))}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div
            className="px-5 py-3 flex items-center justify-between text-xs"
            style={{ borderTop: '1px solid rgba(0,212,255,0.08)', color: '#4d6880' }}
          >
            <span>
              {filtered.length} di {total} lead
              {search && <span style={{ color: '#00D4FF' }}> · filtraggio attivo</span>}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full animate-led-pulse" style={{ background: '#00FF88', boxShadow: '0 0 4px #00FF88' }} />
              Aggiornamento auto ogni 30s
            </span>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ─────────────────────────────────── */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ── Lead Table Row ────────────────────────────────────────────
function LeadRow({
  lead, index, isUpdating, isSelected, onSelect, onStatusChange,
}: {
  lead: LeadRow
  index: number
  isUpdating: boolean
  isSelected: boolean
  onSelect: () => void
  onStatusChange: (s: LeadStatus) => void
}) {
  const cfg = STATUS_CFG[lead.status] ?? STATUS_CFG.new
  const date = new Date(lead.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  const initials = lead.name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div
      className="grid items-center px-5 py-3.5 cursor-pointer transition-all duration-150 group"
      style={{
        gridTemplateColumns: '1fr 140px 180px 130px 100px 48px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: isSelected
          ? 'rgba(0,212,255,0.06)'
          : index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.12)',
        animationDelay: `${index * 40}ms`,
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(0,212,255,0.04)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.12)' }}
    >
      {/* Name + avatar */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
          style={{
            background: `linear-gradient(135deg, ${cfg.color}20, ${cfg.color}08)`,
            border: `1px solid ${cfg.color}30`,
            color: cfg.color,
            fontFamily: "'Orbitron', sans-serif",
          }}
        >
          {initials}
        </div>
        <span className="text-sm font-medium truncate" style={{ color: '#E8F4FD' }}>
          {lead.name || <span style={{ color: '#4d6880', fontStyle: 'italic' }}>Anonimo</span>}
        </span>
      </div>

      {/* Phone */}
      <span className="text-sm font-mono truncate" style={{ color: '#94a8ba', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
        {lead.phone || '—'}
      </span>

      {/* Intent */}
      <span className="text-xs truncate" style={{ color: '#6b889e' }}>
        {lead.intent_summary || <em style={{ color: '#4d6880' }}>In attesa di riassunto</em>}
      </span>

      {/* Status dropdown */}
      <div className="relative">
        <select
          value={lead.status}
          onChange={e => onStatusChange(e.target.value as LeadStatus)}
          disabled={isUpdating}
          className="text-xs font-medium rounded-lg px-2.5 py-1.5 pr-6 appearance-none cursor-pointer transition-all w-full disabled:opacity-50"
          style={{
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.color}35`,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s} style={{ background: '#06132a', color: STATUS_CFG[s].color }}>
              {STATUS_CFG[s].label}
            </option>
          ))}
        </select>
        {isUpdating && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-transparent animate-spin" style={{ borderTopColor: cfg.color }} />
        )}
      </div>

      {/* Date */}
      <span className="text-xs" style={{ color: '#4d6880' }}>{date}</span>

      {/* Detail toggle */}
      <button
        onClick={onSelect}
        className="w-8 h-8 rounded-lg flex items-center justify-center ml-auto transition-all duration-150"
        style={{
          background: isSelected ? 'rgba(0,212,255,0.15)' : 'rgba(0,212,255,0.04)',
          border: `1px solid ${isSelected ? 'rgba(0,212,255,0.35)' : 'rgba(0,212,255,0.10)'}`,
          color: isSelected ? '#00D4FF' : '#4d6880',
        }}
        title="Vedi dettagli"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {isSelected
            ? <polyline points="18 15 12 9 6 15"/>
            : <polyline points="6 9 12 15 18 9"/>
          }
        </svg>
      </button>
    </div>
  )
}

// ── Lead Detail Drawer ────────────────────────────────────────
function LeadDetailDrawer({ lead, onClose }: { lead: LeadRow; onClose: () => void }) {
  const cfg = STATUS_CFG[lead.status] ?? STATUS_CFG.new
  const waUrl = lead.conversation_summary
    ? `https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(lead.conversation_summary)}`
    : null

  return (
    <div
      className="mt-4 rounded-glass p-6 animate-fade-up"
      style={{
        background: 'rgba(6,19,42,0.80)',
        border: `1px solid ${cfg.color}25`,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 8px 40px rgba(0,0,0,0.40), 0 0 0 1px ${cfg.color}10`,
      }}
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold" style={{ color: '#E8F4FD', fontFamily: "'DM Sans', sans-serif" }}>
            {lead.name || 'Lead Anonimo'}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: '#94a8ba' }}>{lead.phone}</p>
        </div>
        <button onClick={onClose} className="text-sm" style={{ color: '#4d6880' }}>✕ chiudi</button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Intent */}
        <div
          className="rounded-lg p-4"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#4d6880' }}>Interesse principale</p>
          <p className="text-sm" style={{ color: '#bccad6' }}>
            {lead.intent_summary || <em style={{ color: '#4d6880' }}>Non ancora disponibile</em>}
          </p>
        </div>

        {/* Summary */}
        <div
          className="rounded-lg p-4"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#4d6880' }}>Riassunto AI per WhatsApp</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: '#bccad6', fontSize: '12px' }}>
            {lead.conversation_summary || <em style={{ color: '#4d6880' }}>Riassunto non ancora generato</em>}
          </p>
        </div>
      </div>

      {/* Actions */}
      {waUrl && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, rgba(37,211,102,0.15), rgba(37,211,102,0.06))',
              border: '1px solid rgba(37,211,102,0.30)',
              color: '#25D366',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
            Ricontatta su WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ObjectionAI — Tab 2 — The killer feature
// ============================================================
type GenerateState = 'idle' | 'loading' | 'done' | 'error'

interface ScriptResult {
  scripts: string[]
  objection: string
  product: string
  generatedAt: number
}

function ObjectionAI({ agentId }: { agentId: string }) {
  const [objection, setObjection] = useState('')
  const [product, setProduct]     = useState('')
  const [state, setState]         = useState<GenerateState>('idle')
  const [result, setResult]       = useState<ScriptResult | null>(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [copied, setCopied]       = useState<number | null>(null)
  const [history, setHistory]     = useState<ScriptResult[]>([])

  // Quick objection presets
  const PRESETS = [
    'Costa troppo',
    'Non ho tempo',
    'Devo pensarci',
    'Non funziona per me',
    'Ho già provato cose simili',
    'Non è il momento giusto',
  ]

  const handleGenerate = useCallback(async () => {
    if (!objection.trim() || !product.trim() || state === 'loading') return
    setState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/scripts/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ agentId, objection: objection.trim(), product: product.trim() }),
      })

      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? `Errore ${res.status}`)
      }

      const data = await res.json() as { scripts: string[] }

      const newResult: ScriptResult = {
        scripts:     data.scripts,
        objection:   objection.trim(),
        product:     product.trim(),
        generatedAt: Date.now(),
      }

      setResult(newResult)
      setHistory(prev => [newResult, ...prev].slice(0, 5))
      setState('done')

    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Errore sconosciuto')
      setState('error')
    }
  }, [agentId, objection, product, state])

  const handleCopy = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(idx)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* no clipboard access */ }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate()
  }

  return (
    <div className="animate-fade-up grid lg:grid-cols-[1fr_340px] gap-6">

      {/* ── Left: Generator ─────────────────────────────── */}
      <div className="flex flex-col gap-5">

        {/* Header card */}
        <div
          className="rounded-glass p-6 relative overflow-hidden"
          style={{
            background: 'rgba(6,19,42,0.70)',
            border: '1px solid rgba(0,212,255,0.12)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Decorative mesh */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 80% 0%, rgba(0,212,255,0.06) 0%, transparent 60%)',
          }} />

          <div className="relative">
            {/* Title */}
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.20), rgba(0,102,255,0.10))',
                  border: '1px solid rgba(0,212,255,0.30)',
                  boxShadow: '0 0 16px rgba(0,212,255,0.15)',
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" fill="#00D4FF"/>
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2
                  className="text-lg font-bold"
                  style={{ fontFamily: "'Orbitron', sans-serif", color: '#E8F4FD', letterSpacing: '0.06em' }}
                >
                  OBJECTION AI
                </h2>
                <p className="text-xs" style={{ color: '#6b889e' }}>3 script WhatsApp pronti in 5 secondi</p>
              </div>
            </div>

            <div className="mt-5 divider-electric" />

            {/* ── Form ────────────────────────────────────── */}
            <div className="mt-5 flex flex-col gap-4" onKeyDown={handleKeyDown}>

              {/* Objection input */}
              <div>
                <label className="text-[11px] uppercase tracking-widest font-semibold mb-2 block" style={{ color: '#4d6880' }}>
                  💬 Obiezione del cliente
                </label>
                <input
                  type="text"
                  value={objection}
                  onChange={e => setObjection(e.target.value)}
                  placeholder='Es. "Costa troppo", "Devo pensarci", "Non ho tempo"…'
                  className="glass-input w-full px-4 py-3 text-sm"
                />

                {/* Quick presets */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {PRESETS.map(p => (
                    <button
                      key={p}
                      onClick={() => setObjection(p)}
                      className="text-[11px] px-2.5 py-1 rounded-lg transition-all duration-150"
                      style={{
                        background: objection === p ? 'rgba(0,212,255,0.15)' : 'rgba(0,212,255,0.05)',
                        border: `1px solid ${objection === p ? 'rgba(0,212,255,0.35)' : 'rgba(0,212,255,0.12)'}`,
                        color: objection === p ? '#00D4FF' : '#6b889e',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product input */}
              <div>
                <label className="text-[11px] uppercase tracking-widest font-semibold mb-2 block" style={{ color: '#4d6880' }}>
                  📦 Prodotto / Opportunità di riferimento
                </label>
                <input
                  type="text"
                  value={product}
                  onChange={e => setProduct(e.target.value)}
                  placeholder='Es. "Integratore XYZ", "Piano Business Silver", "Programma detox"…'
                  className="glass-input w-full px-4 py-3 text-sm"
                />
              </div>

              {/* CTA */}
              <button
                onClick={handleGenerate}
                disabled={!objection.trim() || !product.trim() || state === 'loading'}
                className="
                  relative w-full py-4 rounded-xl text-sm font-bold tracking-wide
                  transition-all duration-200 overflow-hidden
                  disabled:opacity-40 disabled:cursor-not-allowed
                "
                style={{
                  background: state === 'loading'
                    ? 'rgba(0,212,255,0.10)'
                    : 'linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)',
                  color: state === 'loading' ? '#00D4FF' : '#030c1a',
                  boxShadow: state !== 'loading' ? '0 0 30px rgba(0,212,255,0.35), 0 4px 20px rgba(0,0,0,0.30)' : 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  border: state === 'loading' ? '1px solid rgba(0,212,255,0.25)' : 'none',
                }}
              >
                {/* Shimmer overlay on hover */}
                {state !== 'loading' && (
                  <span
                    className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', backgroundSize: '200% 100%' }}
                  />
                )}

                <span className="relative flex items-center justify-center gap-2.5">
                  {state === 'loading' ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#00D4FF' }} />
                      Generazione script AI in corso…
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="3" fill="currentColor"/>
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Genera 3 Script WhatsApp
                      <span className="text-xs opacity-70 font-normal ml-1">⌘↵</span>
                    </>
                  )}
                </span>
              </button>

              {state === 'error' && (
                <div
                  className="rounded-lg px-4 py-3 text-sm animate-fade-up"
                  style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.20)', color: '#FF6B6B' }}
                >
                  ⚠️ {errorMsg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Script results ──────────────────────────────── */}
        {state === 'done' && result && (
          <ScriptResults result={result} copied={copied} onCopy={handleCopy} />
        )}
      </div>

      {/* ── Right: Sidebar ──────────────────────────────── */}
      <div className="flex flex-col gap-5">

        {/* How it works */}
        <HowItWorksCard />

        {/* History */}
        {history.length > 1 && (
          <HistoryCard
            history={history.slice(1)}
            onSelect={r => { setObjection(r.objection); setProduct(r.product); setResult(r); setState('done') }}
          />
        )}
      </div>
    </div>
  )
}

// ── Script Results ────────────────────────────────────────────
const SCRIPT_LABELS = [
  { n: '01', name: 'Empatia + Valore',       emoji: '🤝', color: '#00D4FF' },
  { n: '02', name: 'Prova Sociale + Urgenza', emoji: '🔥', color: '#FFE500' },
  { n: '03', name: 'Domanda di Ricalibrazione', emoji: '🎯', color: '#00FF88' },
]

function ScriptResults({
  result, copied, onCopy,
}: {
  result: ScriptResult
  copied: number | null
  onCopy: (text: string, idx: number) => void
}) {
  return (
    <div className="flex flex-col gap-4 animate-fade-up">

      {/* Result header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.30))' }} />
        <span className="text-xs font-semibold tracking-widest uppercase flex items-center gap-2" style={{ color: '#4d6880' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00FF88', boxShadow: '0 0 6px #00FF88' }} />
          3 Script generati per "{result.objection}"
        </span>
        <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.30), transparent)' }} />
      </div>

      {/* Script cards */}
      {result.scripts.map((script, idx) => {
        const lbl = SCRIPT_LABELS[idx] ?? SCRIPT_LABELS[0]
        const isCopied = copied === idx

        return (
          <div
            key={idx}
            className="rounded-glass relative overflow-hidden group animate-fade-up"
            style={{
              background: 'rgba(6,19,42,0.75)',
              border: `1px solid ${lbl.color}20`,
              backdropFilter: 'blur(12px)',
              animationDelay: `${idx * 80}ms`,
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `${lbl.color}40`
              e.currentTarget.style.boxShadow = `0 0 24px ${lbl.color}10`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = `${lbl.color}20`
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {/* Left accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-0.5"
              style={{ background: `linear-gradient(180deg, ${lbl.color}, transparent)` }}
            />

            {/* Top bar */}
            <div
              className="flex items-center justify-between px-5 pt-4 pb-2"
              style={{ borderBottom: `1px solid ${lbl.color}12` }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{
                    background: `${lbl.color}18`,
                    border: `1px solid ${lbl.color}30`,
                    color: lbl.color,
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: '10px',
                  }}
                >
                  {lbl.n}
                </span>
                <span className="text-xs font-semibold" style={{ color: lbl.color }}>
                  {lbl.emoji} {lbl.name}
                </span>
              </div>

              {/* Copy button */}
              <button
                onClick={() => onCopy(script, idx)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                style={{
                  background: isCopied ? `${lbl.color}20` : 'rgba(0,0,0,0.25)',
                  border: `1px solid ${isCopied ? lbl.color + '50' : 'rgba(255,255,255,0.08)'}`,
                  color: isCopied ? lbl.color : '#6b889e',
                  boxShadow: isCopied ? `0 0 12px ${lbl.color}25` : 'none',
                }}
              >
                {isCopied ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copiato!
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copia
                  </>
                )}
              </button>
            </div>

            {/* Script text */}
            <div className="px-5 py-4">
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: '#bccad6', fontFamily: "'DM Sans', sans-serif", lineHeight: '1.7' }}
              >
                {script}
              </p>
            </div>

            {/* WhatsApp send button */}
            <div className="px-5 pb-4">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(script)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150"
                style={{
                  background: 'rgba(37,211,102,0.08)',
                  border: '1px solid rgba(37,211,102,0.20)',
                  color: '#25D366',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
                Invia su WhatsApp
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── How It Works Sidebar Card ─────────────────────────────────
function HowItWorksCard() {
  const steps = [
    { n: '01', text: 'Inserisci l\'obiezione esatta del cliente', color: '#00D4FF' },
    { n: '02', text: 'Specifica il prodotto o l\'opportunità', color: '#FFE500' },
    { n: '03', text: 'L\'AI genera 3 risposte con angolazioni diverse', color: '#00FF88' },
    { n: '04', text: 'Copia e incolla direttamente su WhatsApp', color: '#9D00FF' },
  ]

  return (
    <div
      className="rounded-glass p-5"
      style={{
        background: 'rgba(6,19,42,0.65)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#4d6880' }}>
        Come funziona
      </h3>
      <div className="flex flex-col gap-3">
        {steps.map(step => (
          <div key={step.n} className="flex items-start gap-3">
            <span
              className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
              style={{
                background: `${step.color}15`,
                border: `1px solid ${step.color}25`,
                color: step.color,
                fontFamily: "'Orbitron', sans-serif",
              }}
            >
              {step.n}
            </span>
            <p className="text-xs leading-relaxed" style={{ color: '#94a8ba' }}>{step.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] text-center" style={{ color: '#4d6880' }}>
          Powered by <span style={{ color: '#00D4FF' }}>GPT-4o-mini</span> · ~$0.0002 per generazione
        </p>
      </div>
    </div>
  )
}

// ── History Sidebar Card ──────────────────────────────────────
function HistoryCard({
  history, onSelect,
}: {
  history: ScriptResult[]
  onSelect: (r: ScriptResult) => void
}) {
  return (
    <div
      className="rounded-glass p-5"
      style={{
        background: 'rgba(6,19,42,0.65)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#4d6880' }}>
        Ultime ricerche
      </h3>
      <div className="flex flex-col gap-2">
        {history.map((r, i) => (
          <button
            key={i}
            onClick={() => onSelect(r)}
            className="w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group"
            style={{
              background: 'rgba(0,0,0,0.20)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0,212,255,0.06)'
              e.currentTarget.style.borderColor = 'rgba(0,212,255,0.18)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.20)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
            }}
          >
            <p className="text-xs font-medium truncate" style={{ color: '#bccad6' }}>"{r.objection}"</p>
            <p className="text-[10px] truncate mt-0.5" style={{ color: '#4d6880' }}>{r.product}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
