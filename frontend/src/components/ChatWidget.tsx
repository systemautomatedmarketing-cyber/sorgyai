// ============================================================
// SorgyAI — ChatWidget.tsx
// The customer-facing chat widget.
//
// Stages:
//   1. LEAD CAPTURE  → Name + phone form before chat opens
//   2. CHAT          → Streaming conversation with the AI
//   3. HANDOFF       → "Parla con un consulente" → WhatsApp
//
// Props:
//   agentId      Phase 2: identifies the agent (from URL param)
//   chatbotName  Display name of the bot
//   welcomeMsg   First message shown in the chat
//   accentColor  Optional override (default: #00D4FF)
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '@/types'

// ── Props ─────────────────────────────────────────────────────
interface ChatWidgetProps {
  agentId:      string
  chatbotName?: string
  welcomeMsg?:  string
  accentColor?: string
}

// ── Lead form data ────────────────────────────────────────────
interface LeadData {
  name:  string
  phone: string
}

// ── Widget stages ─────────────────────────────────────────────
type Stage = 'capture' | 'chat' | 'handoff'

// ── Utility ───────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10)

// ============================================================
// ChatWidget
// ============================================================
export default function ChatWidget({
  agentId,
  chatbotName = 'SorgyAI',
  welcomeMsg  = 'Ciao! 👋 Sono il tuo assistente AI. Prima di iniziare, come ti chiami?',
  accentColor = '#00D4FF',
}: ChatWidgetProps) {

  // ── State ──────────────────────────────────────────────────
  const [stage, setStage]             = useState<Stage>('capture')
  const [lead, setLead]               = useState<LeadData>({ name: '', phone: '' })
  const [leadId, setLeadId]           = useState<string | null>(null)
  const [threadId, setThreadId]       = useState<string | null>(null)
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [input, setInput]             = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isHandingOff, setIsHandingOff] = useState(false)
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState('')
  const [isOpen, setIsOpen]           = useState(false)
  const [hasNewMsg, setHasNewMsg]     = useState(false)

  // ── Refs ───────────────────────────────────────────────────
  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLTextAreaElement>(null)
  const abortRef        = useRef<AbortController | null>(null)

  // ── Auto-scroll to bottom ──────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Focus input when chat opens ────────────────────────────
  useEffect(() => {
    if (isOpen && stage === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen, stage])

  // ── Unread badge when closed ───────────────────────────────
  useEffect(() => {
    if (!isOpen && messages.length > 0) setHasNewMsg(true)
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen) setHasNewMsg(false)
  }, [isOpen])

  // ============================================================
  // STAGE 1 — Lead Capture Submit
  // ============================================================
  const handleCaptureSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setCaptureError('')

    if (!lead.name.trim()) { setCaptureError('Inserisci il tuo nome'); return }
    if (!lead.phone.trim() || !/^\+?[\d\s\-]{8,}$/.test(lead.phone)) {
      setCaptureError('Inserisci un numero di telefono valido')
      return
    }

    try {
      // 1. Create OpenAI thread
      const threadRes = await fetch('/api/chat/thread', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ agentId }),
      })
      if (!threadRes.ok) throw new Error('Errore di connessione')
      const { threadId: tid } = await threadRes.json() as { threadId: string }
      setThreadId(tid)

      // 2. Save lead to D1
      const leadRes = await fetch('/api/leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          agentId,
          threadId: tid,
          name:   lead.name.trim(),
          phone:  lead.phone.trim(),
          source: 'widget',
        }),
      })
      if (leadRes.ok) {
        const { leadId: lid } = await leadRes.json() as { leadId: string }
        setLeadId(lid)
      }

      // 3. Transition to chat with welcome message
      setMessages([{
        id:        uid(),
        role:      'assistant',
        content:   welcomeMsg,
        timestamp: Date.now(),
      }])
      setStage('chat')

    } catch (err) {
      setCaptureError('Qualcosa è andato storto. Riprova.')
      console.error(err)
    }
  }, [agentId, lead, welcomeMsg])

  // ============================================================
  // STAGE 2 — Send Message (streaming SSE)
  // ============================================================
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming || !threadId) return

    setInput('')
    setIsStreaming(true)

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: uid(), role: 'user', content: text, timestamp: Date.now(),
    }
    // Add empty assistant bubble that will be streamed into
    const assistantMsgId = uid()
    const assistantMsg: ChatMessage = {
      id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true,
    }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    try {
      abortRef.current = new AbortController()

      const res = await fetch('/api/chat/message', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ agentId, threadId, message: text }),
        signal:  abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('Stream non disponibile')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''
      let   fullText = ''

      // Parse SSE stream
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const line = event.trim()
          if (!line.startsWith('data: ')) continue

          const dataStr = line.slice(6)
          try {
            const data = JSON.parse(dataStr) as { chunk?: string; error?: string }

            if (data.error) throw new Error(data.error)

            if (data.chunk && data.chunk !== '[DONE]') {
              fullText += data.chunk
              // Update the streaming assistant bubble in place
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, content: fullText }
                  : m
              ))
            }

            if (data.chunk === '[DONE]') {
              // Mark streaming complete
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, isStreaming: false }
                  : m
              ))
            }
          } catch { /* skip malformed events */ }
        }
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: '⚠️ Errore di connessione. Riprova.', isStreaming: false }
          : m
      ))
    } finally {
      setIsStreaming(false)
    }
  }, [agentId, input, isStreaming, threadId])

  // ── Enter key sends, Shift+Enter newline ──────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ============================================================
  // STAGE 3 — WhatsApp Handoff
  // ============================================================
  const handleWhatsAppHandoff = useCallback(async () => {
    if (!leadId || isHandingOff) return
    setIsHandingOff(true)

    try {
      const res = await fetch(`/api/leads/${leadId}/summarize`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ agentId }),
      })

      if (!res.ok) throw new Error('Errore nella generazione del riassunto')

      const { whatsappUrl: url } = await res.json() as { whatsappUrl: string }
      setWhatsappUrl(url)
      setStage('handoff')

      // Open WhatsApp after a brief moment (lets user see the handoff screen)
      setTimeout(() => window.open(url, '_blank'), 1200)

    } catch (err) {
      console.error(err)
      // Fallback: open WhatsApp without summary
      const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(`Ciao! Sono ${lead.name}, vi contatto dal chatbot SorgyAI.`)}`
      setWhatsappUrl(fallbackUrl)
      setStage('handoff')
      setTimeout(() => window.open(fallbackUrl, '_blank'), 1200)
    } finally {
      setIsHandingOff(false)
    }
  }, [agentId, leadId, isHandingOff, lead.name])

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      {/* ── FAB Launcher Button ─────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Chiudi chat' : 'Apri chat'}
        style={{ '--accent': accentColor } as React.CSSProperties}
        className="
          fixed bottom-6 right-6 z-50
          w-16 h-16 rounded-full
          flex items-center justify-center
          transition-all duration-300 ease-out
          focus:outline-none
          group
        "
      >
        {/* Glow ring */}
        <span className="
          absolute inset-0 rounded-full
          bg-[radial-gradient(circle,rgba(0,212,255,0.35)_0%,transparent_70%)]
          animate-led-pulse
        " />
        {/* Button body */}
        <span className="
          relative w-full h-full rounded-full
          flex items-center justify-center
          overflow-hidden
          shadow-glow-md
          transition-transform duration-200
          group-hover:scale-110 group-active:scale-95
        "
          style={{
            background: isOpen
              ? 'linear-gradient(135deg, #0d2550, #06132a)'
              : `linear-gradient(135deg, ${accentColor}, #0066FF)`,
            border: `1px solid ${isOpen ? 'rgba(0,212,255,0.3)' : 'transparent'}`,
          }}
        >
          {isOpen ? (
            // X icon
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            // Chat bubble icon
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#030c1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )}
        </span>

        {/* Unread badge */}
        {hasNewMsg && !isOpen && (
          <span className="
            absolute -top-1 -right-1
            w-5 h-5 rounded-full
            bg-[#00FF88] text-[#030c1a]
            text-[10px] font-bold
            flex items-center justify-center
            shadow-glow-green
            animate-fade-up
          ">
            {messages.filter(m => m.role === 'assistant').length}
          </span>
        )}
      </button>

      {/* ── Widget Panel ────────────────────────────────────── */}
      <div
        className={`
          fixed bottom-28 right-6 z-50
          w-[380px] max-w-[calc(100vw-24px)]
          flex flex-col
          rounded-glass overflow-hidden
          transition-all duration-300 ease-out
          origin-bottom-right
          ${isOpen
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
          }
        `}
        style={{
          height: '600px',
          maxHeight: 'calc(100vh - 140px)',
          background: 'rgba(6, 19, 42, 0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(0, 212, 255, 0.18)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.70), 0 0 0 1px rgba(0,212,255,0.06), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <WidgetHeader
          chatbotName={chatbotName}
          stage={stage}
          accentColor={accentColor}
          onClose={() => setIsOpen(false)}
        />

        {/* ── Body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden relative">

          {/* STAGE 1: Lead Capture */}
          {stage === 'capture' && (
            <LeadCaptureForm
              lead={lead}
              error={captureError}
              accentColor={accentColor}
              chatbotName={chatbotName}
              onChange={setLead}
              onSubmit={handleCaptureSubmit}
            />
          )}

          {/* STAGE 2: Chat */}
          {stage === 'chat' && (
            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
              chatbotName={chatbotName}
              messagesEndRef={messagesEndRef}
            />
          )}

          {/* STAGE 3: Handoff */}
          {stage === 'handoff' && (
            <HandoffScreen
              leadName={lead.name}
              whatsappUrl={whatsappUrl}
              accentColor={accentColor}
            />
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        {stage === 'chat' && (
          <ChatFooter
            input={input}
            isStreaming={isStreaming}
            isHandingOff={isHandingOff}
            accentColor={accentColor}
            inputRef={inputRef}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            onSend={sendMessage}
            onHandoff={handleWhatsAppHandoff}
          />
        )}
      </div>
    </>
  )
}

// ============================================================
// Sub-components
// ============================================================

// ── Widget Header ─────────────────────────────────────────────
function WidgetHeader({
  chatbotName, stage, accentColor, onClose,
}: {
  chatbotName: string
  stage: Stage
  accentColor: string
  onClose: () => void
}) {
  const stageLabel: Record<Stage, string> = {
    capture: 'Identifica',
    chat:    'Online',
    handoff: 'Trasferito',
  }
  const stageColor: Record<Stage, string> = {
    capture: '#FFE500',
    chat:    '#00FF88',
    handoff: accentColor,
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
      style={{
        background: 'linear-gradient(90deg, rgba(0,212,255,0.08) 0%, rgba(0,102,255,0.04) 100%)',
        borderBottom: '1px solid rgba(0,212,255,0.12)',
      }}
    >
      {/* Avatar */}
      <div
        className="relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${accentColor}22, #0066FF22)`,
          border: `1px solid ${accentColor}44`,
          boxShadow: `0 0 12px ${accentColor}30`,
        }}
      >
        {/* AI Icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" fill={accentColor}/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
            stroke={accentColor} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {/* Live dot */}
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#06132a]"
          style={{
            background: stageColor[stage],
            boxShadow: `0 0 6px ${stageColor[stage]}`,
          }}
        />
      </div>

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <p
          className="font-display text-sm font-semibold truncate"
          style={{ color: '#E8F4FD', letterSpacing: '0.04em' }}
        >
          {chatbotName}
        </p>
        <p className="text-[11px] flex items-center gap-1.5" style={{ color: stageColor[stage] }}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: stageColor[stage], boxShadow: `0 0 4px ${stageColor[stage]}` }}
          />
          {stageLabel[stage]} · AI Powered
        </p>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.10)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a8ba" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

// ── Lead Capture Form ─────────────────────────────────────────
function LeadCaptureForm({
  lead, error, accentColor, chatbotName, onChange, onSubmit,
}: {
  lead: LeadData
  error: string
  accentColor: string
  chatbotName: string
  onChange: (d: LeadData) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-8 animate-fade-up">

      {/* Hero graphic */}
      <div className="relative mb-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, rgba(0,102,255,0.05) 70%)',
            border: '1px solid rgba(0,212,255,0.25)',
            boxShadow: '0 0 40px rgba(0,212,255,0.15)',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="7" r="4" stroke={accentColor} strokeWidth="1.5"/>
            <path d="M16 3.5c1.5.5 3 2 3 4" stroke={accentColor} strokeWidth="1" strokeLinecap="round" opacity=".5"/>
          </svg>
        </div>
        {/* Orbiting dot */}
        <span
          className="absolute top-1 right-1 w-3 h-3 rounded-full animate-led-pulse"
          style={{ background: '#00FF88', boxShadow: '0 0 8px #00FF88' }}
        />
      </div>

      {/* Heading */}
      <h2
        className="font-display text-lg font-bold text-center mb-1"
        style={{ color: '#E8F4FD', letterSpacing: '0.05em', textShadow: `0 0 20px ${accentColor}40` }}
      >
        Benvenuto!
      </h2>
      <p className="text-sm text-center mb-6" style={{ color: '#94a8ba' }}>
        Prima di chattare con <span style={{ color: accentColor }}>{chatbotName}</span>, presentati 👇
      </p>

      {/* Form */}
      <form onSubmit={onSubmit} className="w-full flex flex-col gap-3">

        {/* Name field */}
        <div className="relative">
          <label className="text-[11px] font-medium mb-1 block" style={{ color: '#94a8ba', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Il tuo nome
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: accentColor, opacity: 0.7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <input
              type="text"
              value={lead.name}
              onChange={e => onChange({ ...lead, name: e.target.value })}
              placeholder="Es. Marco Rossi"
              autoComplete="name"
              className="glass-input w-full pl-9 pr-4 py-3 text-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
        </div>

        {/* Phone field */}
        <div className="relative">
          <label className="text-[11px] font-medium mb-1 block" style={{ color: '#94a8ba', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Numero WhatsApp
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: accentColor, opacity: 0.7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 17z"/>
              </svg>
            </span>
            <input
              type="tel"
              value={lead.phone}
              onChange={e => onChange({ ...lead, phone: e.target.value })}
              placeholder="+39 347 123 4567"
              autoComplete="tel"
              className="glass-input w-full pl-9 pr-4 py-3 text-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p
            className="text-xs px-3 py-2 rounded-lg animate-fade-up"
            style={{
              color: '#FF6B6B',
              background: 'rgba(255,107,107,0.08)',
              border: '1px solid rgba(255,107,107,0.20)',
            }}
          >
            ⚠️ {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="btn-electric w-full py-3.5 mt-1 text-sm font-semibold tracking-wide"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Inizia la chat →
        </button>

        <p className="text-center text-[10px]" style={{ color: 'rgba(148,168,186,0.5)' }}>
          🔒 I tuoi dati sono al sicuro e non vengono condivisi
        </p>
      </form>
    </div>
  )
}

// ── Chat Messages ─────────────────────────────────────────────
function ChatMessages({
  messages, isStreaming, chatbotName, messagesEndRef,
}: {
  messages: ChatMessage[]
  isStreaming: boolean
  chatbotName: string
  messagesEndRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div
      className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-3 scrollbar-glass"
      style={{ scrollbarGutter: 'stable' }}
    >
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          msg={msg}
          chatbotName={chatbotName}
          isLatest={i === messages.length - 1}
        />
      ))}

      {/* Typing indicator — shows only when streaming but last message is still empty */}
      {isStreaming && messages[messages.length - 1]?.content === '' && (
        <TypingIndicator chatbotName={chatbotName} />
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

// ── Message Bubble ────────────────────────────────────────────
function MessageBubble({
  msg, chatbotName, isLatest,
}: {
  msg: ChatMessage
  chatbotName: string
  isLatest: boolean
}) {
  const isUser = msg.role === 'user'

  return (
    <div
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-up`}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,102,255,0.1))',
            border: '1px solid rgba(0,212,255,0.25)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="#00D4FF"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Name label */}
        <span className="text-[10px] px-1" style={{ color: 'rgba(148,168,186,0.6)' }}>
          {isUser ? 'Tu' : chatbotName}
        </span>

        {/* Bubble */}
        <div
          className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
          style={isUser
            ? {
                background: 'linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,102,255,0.14))',
                border: '1px solid rgba(0,212,255,0.25)',
                color: '#E8F4FD',
                borderBottomRightRadius: '4px',
              }
            : {
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: '#dde6ef',
                borderBottomLeftRadius: '4px',
              }
          }
        >
          {msg.content}
          {/* Streaming cursor */}
          {msg.isStreaming && msg.content && (
            <span
              className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-cursor-blink"
              style={{ background: '#00D4FF' }}
            />
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[9px] px-1" style={{ color: 'rgba(148,168,186,0.35)' }}>
          {new Date(msg.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

// ── Typing Indicator ──────────────────────────────────────────
function TypingIndicator({ chatbotName }: { chatbotName: string }) {
  return (
    <div className="flex gap-2.5 flex-row animate-fade-up">
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,102,255,0.1))',
          border: '1px solid rgba(0,212,255,0.25)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" fill="#00D4FF"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="flex flex-col gap-1 items-start">
        <span className="text-[10px] px-1" style={{ color: 'rgba(148,168,186,0.6)' }}>{chatbotName}</span>
        <div
          className="px-4 py-3 rounded-2xl rounded-bl-[4px] flex items-center gap-1.5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#00D4FF',
                animation: `dot-bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Chat Footer ───────────────────────────────────────────────
function ChatFooter({
  input, isStreaming, isHandingOff, accentColor,
  inputRef, onChange, onKeyDown, onSend, onHandoff,
}: {
  input: string
  isStreaming: boolean
  isHandingOff: boolean
  accentColor: string
  inputRef: React.RefObject<HTMLTextAreaElement>
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onHandoff: () => void
}) {
  return (
    <div
      className="flex-shrink-0 flex flex-col gap-2 p-3"
      style={{ borderTop: '1px solid rgba(0,212,255,0.10)' }}
    >
      {/* WhatsApp Handoff CTA — the killer feature button */}
      <button
        onClick={onHandoff}
        disabled={isHandingOff}
        className="
          w-full flex items-center justify-center gap-2.5
          py-2.5 px-4 rounded-xl
          text-sm font-semibold
          transition-all duration-200
          disabled:opacity-60 disabled:cursor-not-allowed
          group relative overflow-hidden
        "
        style={{
          background: isHandingOff
            ? 'rgba(0,212,255,0.08)'
            : 'linear-gradient(135deg, rgba(37,211,102,0.15) 0%, rgba(37,211,102,0.05) 100%)',
          border: '1px solid rgba(37,211,102,0.35)',
          color: '#25D366',
          boxShadow: isHandingOff ? 'none' : '0 0 20px rgba(37,211,102,0.12)',
        }}
        onMouseEnter={e => {
          if (!isHandingOff) {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(37,211,102,0.22) 0%, rgba(37,211,102,0.10) 100%)'
            e.currentTarget.style.boxShadow = '0 0 28px rgba(37,211,102,0.22)'
          }
        }}
        onMouseLeave={e => {
          if (!isHandingOff) {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(37,211,102,0.15) 0%, rgba(37,211,102,0.05) 100%)'
            e.currentTarget.style.boxShadow = '0 0 20px rgba(37,211,102,0.12)'
          }
        }}
      >
        {isHandingOff ? (
          <>
            {/* Spinner */}
            <span
              className="w-4 h-4 rounded-full border-2 border-transparent animate-spin"
              style={{ borderTopColor: '#25D366' }}
            />
            Preparazione riassunto AI…
          </>
        ) : (
          <>
            {/* WhatsApp icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
            Parla con un consulente
          </>
        )}
      </button>

      {/* Input row */}
      <div
        className="flex items-end gap-2 rounded-xl p-2"
        style={{
          background: 'rgba(3,12,26,0.60)',
          border: '1px solid rgba(0,212,255,0.15)',
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => {
            onChange(e.target.value)
            // Auto-resize
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
          }}
          onKeyDown={onKeyDown}
          placeholder="Scrivi un messaggio…"
          rows={1}
          disabled={isStreaming}
          className="
            flex-1 bg-transparent border-none outline-none resize-none
            text-sm leading-relaxed py-1 px-1
            scrollbar-glass
            disabled:opacity-50
          "
          style={{
            color: '#E8F4FD',
            fontFamily: "'DM Sans', sans-serif",
            minHeight: '28px',
            maxHeight: '100px',
          }}
        />

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={!input.trim() || isStreaming}
          className="
            w-8 h-8 rounded-lg flex-shrink-0
            flex items-center justify-center
            transition-all duration-150
            disabled:opacity-30 disabled:cursor-not-allowed
          "
          style={{
            background: input.trim() && !isStreaming
              ? `linear-gradient(135deg, ${accentColor}, #0066FF)`
              : 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.20)',
            boxShadow: input.trim() && !isStreaming ? '0 0 12px rgba(0,212,255,0.3)' : 'none',
          }}
        >
          {isStreaming ? (
            <span
              className="w-3 h-3 rounded-full border-[1.5px] border-transparent animate-spin"
              style={{ borderTopColor: '#00D4FF' }}
            />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#030c1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>

      {/* Hint */}
      <p className="text-center text-[10px]" style={{ color: 'rgba(148,168,186,0.35)' }}>
        Invio con ↵ · Nuova riga con Shift+↵
      </p>
    </div>
  )
}

// ── Handoff Screen ────────────────────────────────────────────
function HandoffScreen({
  leadName, whatsappUrl, accentColor,
}: {
  leadName: string
  whatsappUrl: string | null
  accentColor: string
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-8 animate-fade-up">

      {/* Success graphic */}
      <div className="relative mb-6">
        {/* Outer glow ring */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center animate-led-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(37,211,102,0.15) 0%, transparent 70%)',
            border: '1px solid rgba(37,211,102,0.30)',
          }}
        >
          {/* Inner circle */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(37,211,102,0.20), rgba(37,211,102,0.08))',
              border: '1px solid rgba(37,211,102,0.40)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
          </div>
        </div>
        {/* Checkmark badge */}
        <span
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            boxShadow: '0 0 12px rgba(37,211,102,0.5)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
      </div>

      {/* Text */}
      <h2
        className="font-display text-lg font-bold text-center mb-2"
        style={{ color: '#E8F4FD', letterSpacing: '0.05em' }}
      >
        Ottimo, {leadName}! 🎉
      </h2>
      <p className="text-sm text-center mb-2" style={{ color: '#94a8ba', lineHeight: '1.6' }}>
        Stiamo aprendo WhatsApp con un riassunto della tua conversazione.
        Il consulente ti risponderà a breve!
      </p>
      <p className="text-xs text-center mb-8 px-4" style={{ color: 'rgba(148,168,186,0.5)' }}>
        Il tuo consulente riceverà tutte le informazioni necessarie per aiutarti al meglio.
      </p>

      {/* Reopen WhatsApp button */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex items-center gap-2.5 px-6 py-3 rounded-xl
            text-sm font-semibold
            transition-all duration-200
          "
          style={{
            background: 'linear-gradient(135deg, rgba(37,211,102,0.20), rgba(37,211,102,0.08))',
            border: '1px solid rgba(37,211,102,0.40)',
            color: '#25D366',
            boxShadow: '0 0 20px rgba(37,211,102,0.15)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
          Riapri WhatsApp
        </a>
      )}

      {/* Divider */}
      <div className="w-full my-6 divider-electric" />

      {/* Powered by */}
      <p className="text-[10px]" style={{ color: 'rgba(148,168,186,0.30)' }}>
        Powered by{' '}
        <span style={{ color: accentColor, opacity: 0.6 }}>SorgyAI</span>
        {' '}· AI assistente per il network marketing
      </p>
    </div>
  )
}
