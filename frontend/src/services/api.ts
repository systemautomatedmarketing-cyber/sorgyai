// ============================================================
// SorgyAI — API Service (Cloudflare Worker client)
// All calls go through /api — proxied by Vite in dev,
// direct in production (same-origin or custom domain).
// ============================================================
import type {
  SendMessagePayload,
  SendMessageResponse,
  ConfigureChatbotPayload,
  ScriptGeneratorPayload,
  ScriptGeneratorResponse,
} from '@/types'

const BASE = '/api'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error((err as any).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Feature A — Chat
export const sendMessage = (payload: SendMessagePayload) =>
  post<SendMessageResponse>('/chat/message', payload)

// Feature A — Chatbot config (catalog upload handled via multipart in implementation)
export const configureChatbot = (_payload: ConfigureChatbotPayload) =>
  post<{ assistantId: string }>('/chatbot/configure', {})

// Feature C — Script generator
export const generateScripts = (payload: ScriptGeneratorPayload) =>
  post<ScriptGeneratorResponse>('/scripts/generate', payload)
