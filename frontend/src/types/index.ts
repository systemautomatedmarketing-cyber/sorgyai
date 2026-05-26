// ============================================================
// SorgyAI — Shared TypeScript Types & Interfaces
// Mirrors the database schema for type-safety end-to-end.
// ============================================================

// ----------------------------------------------------------
// USERS / AGENTS
// Phase 1: single master user
// Phase 2: multi-tenant, each with own AssistantId
// ----------------------------------------------------------
export interface Agent {
  id: string                    // Firebase UID / D1 primary key
  email: string
  displayName: string
  whatsappPhone: string         // e.g. "393471234567" (no + prefix)
  openaiAssistantId: string     // Assigned OpenAI Assistant ID
  chatbotName: string           // Custom bot name shown in widget
  chatbotWelcomeMsg: string     // First message from the bot
  catalogFileIds: string[]      // OpenAI File IDs attached to the assistant
  embedToken: string            // Phase 3: unique token for embed script/URL
  plan: 'alpha' | 'free' | 'pro'
  createdAt: number             // Unix timestamp ms
  updatedAt: number
}

// ----------------------------------------------------------
// LEADS
// Captured inside the chat widget before/during conversation.
// ----------------------------------------------------------
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed'

export interface Lead {
  id: string
  agentId: string               // Owner agent — enables multi-tenant filtering
  name: string
  phone: string
  intentSummary: string         // AI-generated summary of conversation intent
  conversationSummary: string   // Full AI summary for WhatsApp handoff
  threadId: string              // OpenAI Thread ID for context continuity
  status: LeadStatus
  source: 'widget' | 'link' | 'embed'
  createdAt: number
  updatedAt: number
}

// ----------------------------------------------------------
// ANALYTICS
// Simple message counters — no expensive analytics platform.
// Used to track scaling quota toward the 300-400 user ceiling.
// ----------------------------------------------------------
export interface AnalyticsDay {
  id: string                    // Format: "AGENT_ID::YYYY-MM-DD"
  agentId: string
  date: string                  // "YYYY-MM-DD"
  messagesIn: number            // User messages received
  messagesOut: number           // AI responses sent
  leadsCreated: number
  whatsappHandoffs: number
}

// ----------------------------------------------------------
// CHAT MESSAGES (Frontend state only, not persisted)
// ----------------------------------------------------------
export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  isStreaming?: boolean
}

// ----------------------------------------------------------
// API PAYLOADS
// ----------------------------------------------------------
export interface SendMessagePayload {
  agentId: string
  threadId?: string             // Omit to start a new thread
  message: string
  leadData?: Partial<Pick<Lead, 'name' | 'phone'>>
}

export interface SendMessageResponse {
  threadId: string
  reply: string
  leadId?: string               // Set if a lead was captured/updated
}

export interface ConfigureChatbotPayload {
  agentId: string
  catalogFiles: File[]          // Uploaded by agent in dashboard
}

export interface ScriptGeneratorPayload {
  agentId: string
  objection: string             // e.g. "Costa troppo"
  product: string               // e.g. "Integratore XYZ"
}

export interface ScriptGeneratorResponse {
  scripts: string[]             // Array of 3 WhatsApp closing scripts
}

// ----------------------------------------------------------
// CLOUDFLARE WORKER ENV (Backend types)
// ----------------------------------------------------------
export interface WorkerEnv {
  ENVIRONMENT:          string
  APP_URL:              string
  CORS_ORIGIN:          string
  OPENAI_MODEL:         string
  MASTER_ASSISTANT_ID:  string
  OPENAI_API_KEY:       string       // Secret — set via wrangler secret put
  FIREBASE_SERVICE_ACCOUNT: string   // Secret — JSON stringified
  DB:                   D1Database
  CHATBOT_CONFIG_CACHE: KVNamespace
  CATALOGS_BUCKET:      R2Bucket
  RATE_LIMITER:         any          // Cloudflare Rate Limiting binding
}
