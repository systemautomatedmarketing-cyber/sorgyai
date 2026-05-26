// ============================================================
// SorgyAI — ScriptGenerator.tsx
// Standalone Objection → WhatsApp Script generator.
// Reusable: used inside Dashboard ObjectionAI tab, and can be
// exported as a standalone page or embedded widget.
//
// Features:
//   • 6 objection preset chips
//   • ⌘↵ / Ctrl↵ keyboard shortcut to generate
//   • Streaming-style reveal animation on script cards
//   • Per-script copy button with visual feedback
//   • Per-script WhatsApp send link
//   • Session history: last 5 generations (localStorage)
//   • Export all 3 scripts as a single .txt file
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ScriptGeneratorPayload, ScriptGeneratorResponse } from '@/types'

// ── Angolazione config ────────────────────────────────────────
export const SCRIPT_ANGLES = [
  {
    n:     '01',
    name:  'Empatia + Valore',
    emoji: '🤝',
    color: '#00D4FF',
    desc:  'Rispecchia l\'obiezione con empatia, poi svela il valore reale del prodotto',
  },
  {
    n:     '02',
    name:  'Prova Sociale + Urgenza',
    emoji: '🔥',
    color: '#FFE500',
    desc:  'Cita un risultato concreto della community e crea senso di opportunità',
  },
  {
    n:     '03',
    name:  'Ricalibrazione',
    emoji: '🎯',
    color: '#00FF88',
    desc:  'Una domanda potente che fa riflettere e riapre il dialogo',
  },
]

// ── Objection preset categories ───────────────────────────────
const PRESETS: { category: string; items: string[] }[] = [
  {
    category: 'Prezzo',
    items: ['Costa troppo', 'Non ho budget adesso', 'Ho trovato di meglio a meno'],
  },
  {
    category: 'Tempo',
    items: ['Non ho tempo', 'Devo pensarci', 'Ricontattami tra qualche mese'],
  },
  {
    category: 'Scetticismo',
    items: ['Non funziona per me', 'Ho già provato cose simili', 'Non mi fido del network marketing'],
  },
  {
    category: 'Indecisione',
    items: ['Devo sentire mia moglie/marito', 'Non è il momento giusto', 'Ho paura di sbagliare'],
  },
]

// ── History entry ─────────────────────────────────────────────
interface HistoryEntry {
  objection:   string
  product:     string
  scripts:     string[]
  generatedAt: number
}

const HISTORY_KEY = 'sorgyai_script_history'
const MAX_HISTORY = 8

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryEntry[]
  } catch { return [] }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
  } catch { /* storage full — ignore */ }
}

// ── ScriptGenerator props ─────────────────────────────────────
export interface ScriptGeneratorProps {
  agentId:    string
  className?: string
}

type GenState = 'idle' | 'loading' | 'done' | 'error'

// ============================================================
// ScriptGenerator
// ============================================================
export default function ScriptGenerator({ agentId, className = '' }: ScriptGeneratorProps) {
  const [objection, setObjection]   = useState('')
  const [product, setProduct]       = useState('')
  const [genState, setGenState]     = useState<GenState>('idle')
  const [scripts, setScripts]       = useState<string[]>([])
  const [errorMsg, setErrorMsg]     = useState('')
  const [copiedIdx, setCopiedIdx]   = useState<number | null>(null)
  const [history, setHistory]       = useState<HistoryEntry[]>([])
  const [showPresets, setShowPresets] = useState<string | null>(null)   // active category
  const [charCount, setCharCount]   = useState(0)
  const objectionRef = useRef<HTMLTextAreaElement>(null)

  // ── Load history on mount ────────────────────────────────
  useEffect(() => { setHistory(loadHistory()) }, [])

  // ── Char counter for objection field ────────────────────
  useEffect(() => { setCharCount(objection.length) }, [objection])

  // ── Generate ─────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!objection.trim() || !product.trim() || genState === 'loading') return

    setGenState('loading')
    setErrorMsg('')
    setScripts([])

    try {
      const payload: ScriptGeneratorPayload = {
        agentId,
        objection: objection.trim(),
        product:   product.trim(),
      }

      const res = await fetch('/api/scripts/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `Errore ${res.status}`)
      }

      const data = await res.json() as ScriptGeneratorResponse

      if (!data.scripts?.length) throw new Error('Nessuno script ricevuto dall\'API')

      setScripts(data.scripts)
      setGenState('done')

      // Persist to history
      const entry: HistoryEntry = {
        objection: objection.trim(),
        product:   product.trim(),
        scripts:   data.scripts,
        generatedAt: Date.now(),
      }
      const updated = [entry, ...history.filter(h =>
        h.objection !== entry.objection || h.product !== entry.product
      )]
      setHistory(updated)
      saveHistory(updated)

    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Errore sconosciuto. Riprova.')
      setGenState('error')
    }
  }, [agentId, objection, product, genState, history])

  // ── Keyboard shortcut ─────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleGenerate()
    }
  }, [handleGenerate])

  // ── Copy script ───────────────────────────────────────────
  const handleCopy = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2200)
    } catch { /* no clipboard */ }
  }, [])

  // ── Export all scripts as .txt ────────────────────────────
  const handleExport = useCallback(() => {
    if (!scripts.length) return
    const content = [
      `SorgyAI — Script WhatsApp`,
      `Obiezione: ${objection}`,
      `Prodotto: ${product}`,
      `Generato: ${new Date().toLocaleString('it-IT')}`,
      '',
      ...scripts.flatMap((s, i) => [
        `--- SCRIPT ${SCRIPT_ANGLES[i]?.n ?? i+1}: ${SCRIPT_ANGLES[i]?.name ?? ''} ${SCRIPT_ANGLES[i]?.emoji ?? ''} ---`,
        s,
        '',
      ])
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `script-${objection.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}.txt`,
    })
    a.click()
    URL.revokeObjectURL(url)
  }, [scripts, objection, product])

  // ── Load from history ─────────────────────────────────────
  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setObjection(entry.objection)
    setProduct(entry.product)
    setScripts(entry.scripts)
    setGenState('done')
  }, [])

  const canGenerate = objection.trim().length > 0 && product.trim().length > 0

  return (
    <div className={`flex flex-col gap-6 ${className}`} onKeyDown={handleKeyDown}>

      {/* ── Input Panel ───────────────────────────────────── */}
      <div
        className="rounded-glass p-6 relative overflow-hidden"
        style={{
          background: 'rgba(6,19,42,0.75)',
          border: '1px solid rgba(0,212,255,0.12)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Decorative background glow */}
        <div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)' }}
        />

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.22), rgba(0,102,255,0.12))',
              border: '1px solid rgba(0,212,255,0.30)',
              boxShadow: '0 0 20px rgba(0,212,255,0.15)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill="#00D4FF"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h2
              style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '15px', color: '#E8F4FD', letterSpacing: '0.08em', fontWeight: 700 }}
            >
              OBJECTION AI GENERATOR
            </h2>
            <p style={{ fontSize: '12px', color: '#6b889e', marginTop: 2 }}>
              Inserisci l'obiezione → ricevi 3 script WhatsApp pronti
            </p>
          </div>
        </div>

        <div className="divider-electric mb-6" />

        <div className="flex flex-col gap-5">

          {/* ── Objection textarea ─────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-[11px] uppercase tracking-widest font-bold"
                style={{ color: '#4d6880' }}
              >
                💬 Obiezione del cliente
              </label>
              <span className="text-[10px]" style={{ color: charCount > 0 ? '#6b889e' : '#35506a' }}>
                {charCount}/200
              </span>
            </div>
            <textarea
              ref={objectionRef}
              value={objection}
              onChange={e => setObjection(e.target.value.slice(0, 200))}
              placeholder='Scrivi l\'obiezione esatta del cliente… es. "Costa troppo per quello che offre"'
              rows={2}
              className="glass-input w-full px-4 py-3 text-sm resize-none"
              style={{ fontFamily: "'DM Sans', sans-serif", lineHeight: '1.6' }}
            />

            {/* Preset categories */}
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#35506a' }}>
                Preset rapidi:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(cat => (
                  <div key={cat.category} className="relative">
                    <button
                      onClick={() => setShowPresets(showPresets === cat.category ? null : cat.category)}
                      className="text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all duration-150"
                      style={{
                        background: showPresets === cat.category ? 'rgba(0,212,255,0.14)' : 'rgba(0,212,255,0.05)',
                        border: `1px solid ${showPresets === cat.category ? 'rgba(0,212,255,0.32)' : 'rgba(0,212,255,0.12)'}`,
                        color: showPresets === cat.category ? '#00D4FF' : '#6b889e',
                      }}
                    >
                      {cat.category}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        style={{ transform: showPresets === cat.category ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>

                    {/* Dropdown of presets for this category */}
                    {showPresets === cat.category && (
                      <div
                        className="absolute top-full left-0 mt-1 z-10 flex flex-col gap-1 p-2 rounded-xl animate-fade-up"
                        style={{
                          background: 'rgba(6,19,42,0.98)',
                          border: '1px solid rgba(0,212,255,0.20)',
                          backdropFilter: 'blur(16px)',
                          minWidth: 200,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.50)',
                        }}
                      >
                        {cat.items.map(item => (
                          <button
                            key={item}
                            onClick={() => { setObjection(item); setShowPresets(null); objectionRef.current?.focus() }}
                            className="text-xs text-left px-3 py-2 rounded-lg transition-all duration-100 whitespace-nowrap"
                            style={{ color: '#bccad6' }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(0,212,255,0.10)'
                              e.currentTarget.style.color = '#E8F4FD'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = '#bccad6'
                            }}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Product input ──────────────────────────────── */}
          <div>
            <label
              className="text-[11px] uppercase tracking-widest font-bold mb-2 block"
              style={{ color: '#4d6880' }}
            >
              📦 Prodotto / Opportunità
            </label>
            <input
              type="text"
              value={product}
              onChange={e => setProduct(e.target.value)}
              placeholder='Es. "Integratore XYZ Slim", "Piano Business Gold", "Programma detox 30gg"…'
              className="glass-input w-full px-4 py-3 text-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>

          {/* ── Error message ──────────────────────────────── */}
          {genState === 'error' && (
            <div
              className="rounded-xl px-4 py-3 text-sm flex items-center gap-2 animate-fade-up"
              style={{
                background: 'rgba(255,107,107,0.07)',
                border: '1px solid rgba(255,107,107,0.22)',
                color: '#FF6B6B',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {errorMsg}
            </div>
          )}

          {/* ── CTA ───────────────────────────────────────── */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || genState === 'loading'}
            className="relative w-full py-4 rounded-xl font-bold text-sm tracking-wide overflow-hidden transition-all duration-200 disabled:cursor-not-allowed"
            style={{
              background: !canGenerate || genState === 'loading'
                ? 'rgba(0,212,255,0.08)'
                : 'linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)',
              color: !canGenerate || genState === 'loading' ? 'rgba(0,212,255,0.50)' : '#030c1a',
              border: !canGenerate || genState === 'loading' ? '1px solid rgba(0,212,255,0.18)' : 'none',
              boxShadow: canGenerate && genState !== 'loading'
                ? '0 0 32px rgba(0,212,255,0.32), 0 4px 20px rgba(0,0,0,0.25)'
                : 'none',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {/* Shimmer */}
            {canGenerate && genState !== 'loading' && (
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.10) 50%, transparent 80%)',
                  animation: 'led-sweep 3s linear infinite',
                  backgroundSize: '200% 100%',
                }}
              />
            )}

            <span className="relative flex items-center justify-center gap-2.5">
              {genState === 'loading' ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#00D4FF' }} />
                  Generazione in corso…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" fill="currentColor"/>
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Genera 3 Script WhatsApp
                  <kbd
                    className="text-[10px] font-normal opacity-60 px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.20)', border: '1px solid rgba(0,0,0,0.30)' }}
                  >
                    ⌘↵
                  </kbd>
                </>
              )}
            </span>
          </button>

          {/* Angle legend */}
          <div className="flex gap-3 flex-wrap">
            {SCRIPT_ANGLES.map(a => (
              <div key={a.n} className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: a.color, boxShadow: `0 0 4px ${a.color}` }}
                />
                <span className="text-[10px]" style={{ color: '#4d6880' }}>
                  {a.emoji} {a.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────── */}
      {genState === 'done' && scripts.length > 0 && (
        <div className="flex flex-col gap-4">

          {/* Result header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.30))' }} />
              <span
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
                style={{ color: '#4d6880' }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-led-pulse" style={{ background: '#00FF88', boxShadow: '0 0 6px #00FF88' }} />
                {scripts.length} script generati
              </span>
              <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.30), transparent)' }} />
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                background: 'rgba(0,212,255,0.06)',
                border: '1px solid rgba(0,212,255,0.15)',
                color: '#94a8ba',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#00D4FF'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.28)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a8ba'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Esporta .txt
            </button>
          </div>

          {/* Script cards */}
          {scripts.map((script, idx) => {
            const angle = SCRIPT_ANGLES[idx] ?? SCRIPT_ANGLES[0]!
            const isCopied = copiedIdx === idx

            return (
              <ScriptCard
                key={idx}
                idx={idx}
                script={script}
                angle={angle}
                isCopied={isCopied}
                onCopy={() => handleCopy(script, idx)}
              />
            )
          })}
        </div>
      )}

      {/* ── History ───────────────────────────────────────── */}
      {history.length > 0 && (
        <HistoryPanel history={history} onLoad={loadFromHistory} />
      )}
    </div>
  )
}

// ============================================================
// ScriptCard
// ============================================================
interface AngleConfig { n: string; name: string; emoji: string; color: string; desc: string }

function ScriptCard({
  idx, script, angle, isCopied, onCopy,
}: {
  idx: number
  script: string
  angle: AngleConfig
  isCopied: boolean
  onCopy: () => void
}) {
  const waUrl = `https://wa.me/?text=${encodeURIComponent(script)}`

  return (
    <div
      className="rounded-glass overflow-hidden relative animate-fade-up"
      style={{
        background: 'rgba(6,19,42,0.78)',
        border: `1px solid ${angle.color}1A`,
        backdropFilter: 'blur(12px)',
        animationDelay: `${idx * 90}ms`,
      }}
    >
      {/* Left color bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
        style={{ background: `linear-gradient(180deg, ${angle.color}, ${angle.color}30)` }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between pl-5 pr-4 py-3.5"
        style={{ borderBottom: `1px solid ${angle.color}12` }}
      >
        <div className="flex items-center gap-3">
          {/* Number badge */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{
              background: `${angle.color}18`,
              border: `1px solid ${angle.color}30`,
              color: angle.color,
              fontFamily: "'Orbitron', sans-serif",
            }}
          >
            {angle.n}
          </div>

          <div>
            <p className="text-xs font-bold" style={{ color: angle.color }}>
              {angle.emoji} {angle.name}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#4d6880' }}>{angle.desc}</p>
          </div>
        </div>

        {/* Copy button */}
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all duration-150"
          style={{
            background: isCopied ? `${angle.color}20` : 'rgba(0,0,0,0.28)',
            border: `1px solid ${isCopied ? angle.color + '45' : 'rgba(255,255,255,0.08)'}`,
            color: isCopied ? angle.color : '#6b889e',
            boxShadow: isCopied ? `0 0 12px ${angle.color}25` : 'none',
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
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copia
            </>
          )}
        </button>
      </div>

      {/* Script text */}
      <div className="pl-5 pr-4 py-4">
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: '#bccad6', fontFamily: "'DM Sans', sans-serif", lineHeight: '1.75' }}
        >
          {script}
        </p>
      </div>

      {/* Footer: WhatsApp link */}
      <div
        className="pl-5 pr-4 pb-3.5 pt-2 flex items-center justify-between"
        style={{ borderTop: `1px solid ${angle.color}0C` }}
      >
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all duration-150"
          style={{
            background: 'rgba(37,211,102,0.08)',
            border: '1px solid rgba(37,211,102,0.18)',
            color: '#25D366',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,211,102,0.14)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,211,102,0.08)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
          Invia su WhatsApp
        </a>

        <span className="text-[10px]" style={{ color: '#35506a' }}>
          Script {angle.n} · {script.split(' ').length} parole
        </span>
      </div>
    </div>
  )
}

// ============================================================
// HistoryPanel
// ============================================================
function HistoryPanel({
  history,
  onLoad,
}: {
  history: HistoryEntry[]
  onLoad: (e: HistoryEntry) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-glass overflow-hidden"
      style={{
        background: 'rgba(6,19,42,0.55)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 transition-all duration-150"
        style={{ color: '#6b889e' }}
        onMouseEnter={e => e.currentTarget.style.color = '#94a8ba'}
        onMouseLeave={e => e.currentTarget.style.color = '#6b889e'}
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Storico ricerche ({history.length})
        </span>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-4 pb-4 animate-fade-up"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}
        >
          {history.map((entry, i) => (
            <button
              key={i}
              onClick={() => onLoad(entry)}
              className="w-full text-left rounded-xl px-3.5 py-3 transition-all duration-150 group"
              style={{
                background: 'rgba(0,0,0,0.20)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,212,255,0.07)'
                e.currentTarget.style.borderColor = 'rgba(0,212,255,0.18)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.20)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
              }}
            >
              <p
                className="text-xs font-semibold truncate mb-0.5"
                style={{ color: '#bccad6' }}
              >
                "{entry.objection}"
              </p>
              <p className="text-[10px] truncate" style={{ color: '#4d6880' }}>
                {entry.product} · {new Date(entry.generatedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
              <p
                className="text-[10px] mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ color: '#00D4FF' }}
              >
                Clicca per ricaricare →
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
