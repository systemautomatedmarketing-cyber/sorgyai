// ============================================================
// SorgyAI — LeadTable.tsx
// Standalone, reusable lead table component.
// Used inside Dashboard.tsx LeadHub tab, but also exportable
// as an embeddable widget in future partner integrations.
//
// Features:
//   • Column sorting (click header to sort asc/desc)
//   • Multi-column search (name, phone, intent, summary)
//   • Status filter + bulk status update
//   • Expandable row detail with WhatsApp CTA
//   • CSV export of current filtered view
//   • Pagination (client-side, 20 rows per page)
//   • Skeleton loading state
// ============================================================

import { useState, useMemo, useCallback } from 'react'
import type { LeadStatus } from '@/types'

// ── Lead row shape (snake_case from D1 API) ───────────────────
export interface LeadRow {
  id:                   string
  agent_id:             string
  name:                 string
  phone:                string
  intent_summary:       string
  conversation_summary: string
  thread_id:            string
  status:               LeadStatus
  source:               string
  created_at:           number
  updated_at:           number
}

// ── Status display config ─────────────────────────────────────
export const STATUS_CFG: Record<LeadStatus, {
  label: string; color: string; bg: string; border: string
}> = {
  new:       { label: 'Nuovo',       color: '#00D4FF', bg: 'rgba(0,212,255,0.10)',  border: 'rgba(0,212,255,0.25)'  },
  contacted: { label: 'Contattato',  color: '#FFE500', bg: 'rgba(255,229,0,0.10)',  border: 'rgba(255,229,0,0.25)'  },
  qualified: { label: 'Qualificato', color: '#00FF88', bg: 'rgba(0,255,136,0.10)',  border: 'rgba(0,255,136,0.25)'  },
  closed:    { label: 'Chiuso',      color: '#9D00FF', bg: 'rgba(157,0,255,0.10)',  border: 'rgba(157,0,255,0.25)'  },
}

const ALL_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'closed']
const PAGE_SIZE = 20

// ── Sort state ────────────────────────────────────────────────
type SortKey = 'name' | 'status' | 'created_at' | 'updated_at'
type SortDir = 'asc' | 'desc'

interface SortState { key: SortKey; dir: SortDir }

// ── LeadTable props ───────────────────────────────────────────
export interface LeadTableProps {
  leads:           LeadRow[]
  loading?:        boolean
  onStatusChange?: (leadId: string, status: LeadStatus) => Promise<void>
  onRefresh?:      () => void
  updatingIds?:    Set<string>
}

// ============================================================
// LeadTable
// ============================================================
export default function LeadTable({
  leads,
  loading     = false,
  onStatusChange,
  onRefresh,
  updatingIds = new Set(),
}: LeadTableProps) {

  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState<LeadStatus | 'all'>('all')
  const [sort, setSort]             = useState<SortState>({ key: 'created_at', dir: 'desc' })
  const [expandedId, setExpanded]   = useState<string | null>(null)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [page, setPage]             = useState(1)
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>('contacted')
  const [bulkLoading, setBulkLoading] = useState(false)

  // ── Filtered + sorted data ────────────────────────────────
  const processed = useMemo(() => {
    let rows = [...leads]

    // Status filter
    if (statusFilter !== 'all') {
      rows = rows.filter(r => r.status === statusFilter)
    }

    // Full-text search across key columns
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.intent_summary.toLowerCase().includes(q) ||
        r.conversation_summary.toLowerCase().includes(q)
      )
    }

    // Sort
    rows.sort((a, b) => {
      let va: string | number = a[sort.key] ?? ''
      let vb: string | number = b[sort.key] ?? ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ?  1 : -1
      return 0
    })

    return rows
  }, [leads, statusFilter, search, sort])

  // ── Pagination ────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE))
  const paginated  = processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset page when filters change
  const resetPage = useCallback(() => setPage(1), [])

  // ── Sort toggle ───────────────────────────────────────────
  const toggleSort = useCallback((key: SortKey) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
    )
    resetPage()
  }, [resetPage])

  // ── Row selection ─────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected(prev =>
      prev.size === paginated.length
        ? new Set()
        : new Set(paginated.map(r => r.id))
    )
  }, [paginated])

  // ── Bulk status update ────────────────────────────────────
  const handleBulkUpdate = useCallback(async () => {
    if (!onStatusChange || selected.size === 0) return
    setBulkLoading(true)
    try {
      await Promise.all([...selected].map(id => onStatusChange(id, bulkStatus)))
      setSelected(new Set())
    } finally {
      setBulkLoading(false)
    }
  }, [onStatusChange, selected, bulkStatus])

  // ── CSV export ────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = ['Nome', 'Telefono', 'Status', 'Interesse', 'Fonte', 'Data']
    const rows = processed.map(r => [
      r.name,
      r.phone,
      STATUS_CFG[r.status]?.label ?? r.status,
      r.intent_summary.replace(/,/g, ';'),
      r.source,
      new Date(r.created_at).toLocaleDateString('it-IT'),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })  // BOM for Excel
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `leads-sorgyai-${new Date().toISOString().slice(0,10)}.csv`,
    })
    a.click()
    URL.revokeObjectURL(url)
  }, [processed])

  // ── Status badge ──────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length }
    ALL_STATUSES.forEach(s => { counts[s] = leads.filter(l => l.status === s).length })
    return counts
  }, [leads])

  return (
    <div className="flex flex-col gap-4">

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">

        {/* Row 1: search + actions */}
        <div className="flex gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#4d6880' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }}
              placeholder="Cerca nome, telefono, interesse…"
              className="glass-input w-full pl-9 pr-4 py-2 text-sm"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); resetPage() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: '#4d6880' }}
              >✕</button>
            )}
          </div>

          {/* Export CSV */}
          <ActionButton
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            }
            label="Esporta CSV"
            onClick={exportCSV}
            disabled={processed.length === 0}
          />

          {/* Refresh */}
          {onRefresh && (
            <ActionButton
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              }
              label="Aggiorna"
              onClick={onRefresh}
            />
          )}
        </div>

        {/* Row 2: status filter pills */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-[10px] uppercase tracking-widest font-semibold mr-1" style={{ color: '#4d6880' }}>Filtro:</span>
          {(['all', ...ALL_STATUSES] as const).map(s => {
            const cfg = s === 'all' ? null : STATUS_CFG[s]
            const active = statusFilter === s
            const count  = statusCounts[s] ?? 0
            return (
              <button
                key={s}
                onClick={() => { setStatus(s); resetPage() }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150"
                style={{
                  background: active ? (cfg?.bg ?? 'rgba(0,212,255,0.12)') : 'rgba(3,12,26,0.50)',
                  color:      active ? (cfg?.color ?? '#00D4FF')            : '#6b889e',
                  border:     `1px solid ${active ? (cfg?.border ?? 'rgba(0,212,255,0.30)') : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                {s === 'all' ? 'Tutti' : cfg?.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{
                    background: active ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.06)',
                    color: active ? (cfg?.color ?? '#00D4FF') : '#4d6880',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Row 3: bulk actions — only when rows selected */}
        {selected.size > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl animate-fade-up"
            style={{
              background: 'rgba(0,212,255,0.06)',
              border: '1px solid rgba(0,212,255,0.18)',
            }}
          >
            <span className="text-xs font-semibold" style={{ color: '#00D4FF' }}>
              {selected.size} selezionati
            </span>
            <span className="text-xs" style={{ color: '#4d6880' }}>→ Imposta come:</span>
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value as LeadStatus)}
              className="text-xs rounded-lg px-2 py-1 outline-none"
              style={{
                background: 'rgba(3,12,26,0.80)',
                border: '1px solid rgba(0,212,255,0.20)',
                color: '#E8F4FD',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {ALL_STATUSES.map(s => (
                <option key={s} value={s} style={{ background: '#06132a' }}>
                  {STATUS_CFG[s].label}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkUpdate}
              disabled={bulkLoading}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #00D4FF, #0066FF)',
                color: '#030c1a',
              }}
            >
              {bulkLoading ? 'Aggiornamento…' : 'Applica'}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs"
              style={{ color: '#4d6880' }}
            >
              ✕ Deseleziona
            </button>
          </div>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div
        className="rounded-glass overflow-hidden"
        style={{
          background: 'rgba(6,19,42,0.65)',
          border: '1px solid rgba(0,212,255,0.10)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Header */}
        <div
          className="grid items-center px-4 py-3 text-[10px] font-bold tracking-widest uppercase select-none"
          style={{
            gridTemplateColumns: '32px 1fr 130px 150px 120px 90px 80px 40px',
            color: '#4d6880',
            borderBottom: '1px solid rgba(0,212,255,0.08)',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          {/* Checkbox all */}
          <div className="flex items-center justify-center">
            <Checkbox
              checked={selected.size > 0 && selected.size === paginated.length}
              indeterminate={selected.size > 0 && selected.size < paginated.length}
              onChange={toggleSelectAll}
            />
          </div>

          <SortableHeader label="Nome"    sortKey="name"       sort={sort} onSort={toggleSort} />
          <span>Telefono</span>
          <span>Interesse</span>
          <SortableHeader label="Status"  sortKey="status"     sort={sort} onSort={toggleSort} />
          <span>Fonte</span>
          <SortableHeader label="Data"    sortKey="created_at" sort={sort} onSort={toggleSort} />
          <span />
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && paginated.length === 0 && (
          <EmptyState hasSearch={!!search || statusFilter !== 'all'} />
        )}

        {/* Data rows */}
        {!loading && paginated.map((lead, i) => (
          <LeadTableRow
            key={lead.id}
            lead={lead}
            index={i}
            isExpanded={expandedId === lead.id}
            isSelected={selected.has(lead.id)}
            isUpdating={updatingIds.has(lead.id)}
            onToggleExpand={() => setExpanded(expandedId === lead.id ? null : lead.id)}
            onToggleSelect={() => toggleSelect(lead.id)}
            onStatusChange={onStatusChange}
          />
        ))}

        {/* Footer: count + pagination */}
        {!loading && processed.length > 0 && (
          <TableFooter
            total={processed.length}
            page={page}
            totalPages={totalPages}
            onPage={setPage}
          />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

// ── Action Button ─────────────────────────────────────────────
function ActionButton({
  icon, label, onClick, disabled = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: 'rgba(0,212,255,0.06)',
        border: '1px solid rgba(0,212,255,0.15)',
        color: '#94a8ba',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = '#00D4FF'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.30)' }}}
      onMouseLeave={e => { e.currentTarget.style.color = '#94a8ba'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)' }}
    >
      {icon}{label}
    </button>
  )
}

// ── Sortable Header ───────────────────────────────────────────
function SortableHeader({
  label, sortKey, sort, onSort,
}: {
  label: string
  sortKey: SortKey
  sort: SortState
  onSort: (k: SortKey) => void
}) {
  const active = sort.key === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-left transition-colors duration-150"
      style={{ color: active ? '#00D4FF' : '#4d6880' }}
    >
      {label}
      <span style={{ opacity: active ? 1 : 0.3 }}>
        {active && sort.dir === 'asc' ? '↑' : '↓'}
      </span>
    </button>
  )
}

// ── Checkbox ──────────────────────────────────────────────────
function Checkbox({
  checked, indeterminate, onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
}) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange() }}
      className="w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all duration-150 flex-shrink-0"
      style={{
        background: checked || indeterminate ? 'rgba(0,212,255,0.20)' : 'rgba(3,12,26,0.60)',
        border: `1.5px solid ${checked || indeterminate ? '#00D4FF' : 'rgba(0,212,255,0.20)'}`,
        boxShadow: checked || indeterminate ? '0 0 8px rgba(0,212,255,0.25)' : 'none',
      }}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="3.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      {indeterminate && !checked && (
        <span style={{ width: 8, height: 2, background: '#00D4FF', borderRadius: 1 }} />
      )}
    </div>
  )
}

// ── Lead Table Row ────────────────────────────────────────────
function LeadTableRow({
  lead, index, isExpanded, isSelected, isUpdating,
  onToggleExpand, onToggleSelect, onStatusChange,
}: {
  lead: LeadRow
  index: number
  isExpanded: boolean
  isSelected: boolean
  isUpdating: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
  onStatusChange?: (id: string, s: LeadStatus) => Promise<void>
}) {
  const cfg = STATUS_CFG[lead.status] ?? STATUS_CFG.new
  const initials = lead.name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'
  const date = new Date(lead.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })

  const baseRowBg = index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.10)'

  return (
    <>
      <div
        className="grid items-center px-4 py-3 cursor-pointer transition-all duration-100 group"
        style={{
          gridTemplateColumns: '32px 1fr 130px 150px 120px 90px 80px 40px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: isSelected
            ? 'rgba(0,212,255,0.07)'
            : isExpanded
            ? 'rgba(0,212,255,0.04)'
            : baseRowBg,
        }}
        onClick={onToggleExpand}
        onMouseEnter={e => {
          if (!isSelected) e.currentTarget.style.background = 'rgba(0,212,255,0.04)'
        }}
        onMouseLeave={e => {
          if (!isSelected) e.currentTarget.style.background = isExpanded ? 'rgba(0,212,255,0.04)' : baseRowBg
        }}
      >
        {/* Checkbox */}
        <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <Checkbox checked={isSelected} onChange={onToggleSelect} />
        </div>

        {/* Name + avatar */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
            style={{
              background: `${cfg.color}18`,
              border: `1px solid ${cfg.color}28`,
              color: cfg.color,
              fontFamily: "'Orbitron', sans-serif",
            }}
          >
            {initials}
          </div>
          <span className="text-sm truncate" style={{ color: '#E8F4FD' }}>
            {lead.name || <em style={{ color: '#4d6880' }}>Anonimo</em>}
          </span>
        </div>

        {/* Phone */}
        <span
          className="text-xs truncate font-mono"
          style={{ color: '#94a8ba', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}
        >
          {lead.phone || '—'}
        </span>

        {/* Intent */}
        <span className="text-xs truncate" style={{ color: '#6b889e' }}>
          {lead.intent_summary || <em style={{ color: '#4d6880' }}>—</em>}
        </span>

        {/* Status dropdown */}
        <div onClick={e => e.stopPropagation()}>
          <select
            value={lead.status}
            onChange={e => onStatusChange?.(lead.id, e.target.value as LeadStatus)}
            disabled={isUpdating || !onStatusChange}
            className="text-xs rounded-lg px-2 py-1 appearance-none cursor-pointer w-full outline-none transition-all disabled:opacity-50"
            style={{
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.border}`,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {ALL_STATUSES.map(s => (
              <option key={s} value={s} style={{ background: '#06132a', color: STATUS_CFG[s].color }}>
                {STATUS_CFG[s].label}
              </option>
            ))}
          </select>
        </div>

        {/* Source badge */}
        <span
          className="text-[10px] px-2 py-0.5 rounded-full w-fit"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#6b889e',
          }}
        >
          {lead.source}
        </span>

        {/* Date */}
        <span className="text-[11px]" style={{ color: '#4d6880' }}>{date}</span>

        {/* Expand chevron */}
        <div className="flex items-center justify-center">
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={isExpanded ? '#00D4FF' : '#4d6880'} strokeWidth="2.5" strokeLinecap="round"
            className="transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* ── Expanded detail panel ─────────────────────────── */}
      {isExpanded && (
        <LeadDetailPanel lead={lead} />
      )}
    </>
  )
}

// ── Expanded Lead Detail Panel ────────────────────────────────
function LeadDetailPanel({ lead }: { lead: LeadRow }) {
  const [copied, setCopied] = useState(false)

  const waUrl = lead.phone && lead.conversation_summary
    ? `https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(lead.conversation_summary)}`
    : lead.phone
    ? `https://wa.me/${lead.phone.replace(/\D/g, '')}`
    : null

  const handleCopy = async () => {
    if (!lead.conversation_summary) return
    await navigator.clipboard.writeText(lead.conversation_summary).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="px-4 py-4 grid sm:grid-cols-3 gap-4 animate-fade-up"
      style={{
        borderBottom: '1px solid rgba(0,212,255,0.08)',
        background: 'rgba(0,0,0,0.20)',
      }}
    >
      {/* Intent summary */}
      <InfoBlock
        label="Interesse principale"
        value={lead.intent_summary}
        placeholder="Riassunto non ancora disponibile"
      />

      {/* Conversation summary */}
      <div
        className="rounded-lg p-3.5 relative"
        style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#4d6880' }}>
            Riassunto AI per WhatsApp
          </p>
          {lead.conversation_summary && (
            <button
              onClick={handleCopy}
              className="text-[10px] flex items-center gap-1 transition-colors duration-150"
              style={{ color: copied ? '#00FF88' : '#4d6880' }}
            >
              {copied ? '✓ Copiato' : 'Copia'}
            </button>
          )}
        </div>
        <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: '#94a8ba' }}>
          {lead.conversation_summary || <em style={{ color: '#4d6880' }}>Non ancora generato — avvia una chat dal widget</em>}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 justify-start">
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#4d6880' }}>
          Azioni rapide
        </p>
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
            style={{
              background: 'rgba(37,211,102,0.09)',
              border: '1px solid rgba(37,211,102,0.22)',
              color: '#25D366',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
            Contatta su WhatsApp
          </a>
        )}
        <div className="text-[10px] mt-1" style={{ color: '#4d6880' }}>
          Thread: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#35506a' }}>{lead.thread_id.slice(0, 18)}…</span>
        </div>
        <div className="text-[10px]" style={{ color: '#4d6880' }}>
          Aggiornato: {new Date(lead.updated_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
    </div>
  )
}

// ── Info Block ────────────────────────────────────────────────
function InfoBlock({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
  return (
    <div
      className="rounded-lg p-3.5"
      style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#4d6880' }}>
        {label}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: value ? '#94a8ba' : '#4d6880' }}>
        {value || <em>{placeholder}</em>}
      </p>
    </div>
  )
}

// ── Skeleton Row ──────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div
      className="grid items-center px-4 py-3.5"
      style={{
        gridTemplateColumns: '32px 1fr 130px 150px 120px 90px 80px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {[32, 120, 90, 100, 80, 60, 55, 20].map((w, i) => (
        <div
          key={i}
          className="h-3 rounded animate-pulse"
          style={{ width: w, background: 'rgba(255,255,255,0.05)', maxWidth: '100%' }}
        />
      ))}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────
function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4d6880" strokeWidth="1.5" strokeLinecap="round">
          {hasSearch
            ? <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>
            : <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></>
          }
        </svg>
      </div>
      <p className="text-sm" style={{ color: '#4d6880' }}>
        {hasSearch
          ? 'Nessun lead corrisponde alla ricerca'
          : 'Ancora nessun lead — il chatbot li raccoglierà automaticamente'
        }
      </p>
    </div>
  )
}

// ── Table Footer with pagination ──────────────────────────────
function TableFooter({
  total, page, totalPages, onPage,
}: {
  total: number
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderTop: '1px solid rgba(0,212,255,0.08)', color: '#4d6880', fontSize: '11px' }}
    >
      <span>{total} lead totali</span>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <PaginationBtn label="←" disabled={page === 1}         onClick={() => onPage(page - 1)} />
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i
            if (p > totalPages) return null
            return (
              <PaginationBtn
                key={p}
                label={String(p)}
                active={page === p}
                onClick={() => onPage(p)}
              />
            )
          })}
          <PaginationBtn label="→" disabled={page === totalPages} onClick={() => onPage(page + 1)} />
        </div>
      )}

      <span style={{ opacity: 0.5 }}>Pagina {page} / {totalPages}</span>
    </div>
  )
}

function PaginationBtn({
  label, active, disabled, onClick,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: active ? 'rgba(0,212,255,0.15)' : 'rgba(0,0,0,0.20)',
        border: `1px solid ${active ? 'rgba(0,212,255,0.30)' : 'rgba(255,255,255,0.06)'}`,
        color: active ? '#00D4FF' : '#6b889e',
      }}
    >
      {label}
    </button>
  )
}
