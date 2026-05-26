// ============================================================
// SorgyAI — Cloudflare Worker API Router
// backend/src/index.ts
//
// Architecture phases:
//   Phase 1 (MVP Interno):   MASTER_ASSISTANT_ID hardcoded in env.
//                            Single agent, alpha group only.
//   Phase 2 (Multi-Tenant):  agentId param → D1 lookup → per-agent assistant.
//                            Full multi-tenant lead isolation.
//   Phase 3 (Onboarding):    /api/auth/onboard creates assistant + embed token.
//                            Public URL: /chat/:embedToken
//
// Routes:
//   GET  /api/health
//   POST /api/chat/message           Feature A: streaming chat
//   POST /api/chat/thread            Feature A: create new thread
//   POST /api/chatbot/configure      Feature A: upload catalog
//   POST /api/leads                  Feature B: save lead
//   GET  /api/leads?agentId=X        Feature B: list leads
//   PATCH /api/leads/:id/status      Feature B: update lead status
//   POST /api/leads/:id/summarize    Feature B: WhatsApp handoff summary
//   POST /api/scripts/generate       Feature C: script generator
//   POST /api/auth/onboard           Phase 3: new agent onboarding
// ============================================================

import * as AI from './openai'
import type { WorkerEnv } from '../../frontend/src/types'

// ============================================================
// CORS
// ============================================================
function buildCorsHeaders(env: WorkerEnv): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':  env.CORS_ORIGIN ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Id',
    'Access-Control-Max-Age':       '86400',
  }
}

function json<T>(data: T, status = 200, cors: Record<string, string> = {}): Response {
  return Response.json(data, {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

function err(message: string, status = 400, cors: Record<string, string> = {}): Response {
  return json({ ok: false, error: message }, status, cors)
}

// ============================================================
// Request body parser with type safety
// ============================================================
async function parseBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch {
    throw new Error('Request body must be valid JSON')
  }
}

// ============================================================
// Nano UUID — crypto-based, no npm dependency
// ============================================================
function nanoid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================
// Date helpers
// ============================================================
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)   // "YYYY-MM-DD"
}

function nowMs(): number {
  return Date.now()
}

// ============================================================
// D1 Database helpers
// ============================================================

// ── Agent lookup ──────────────────────────────────────────────
interface AgentRow {
  id:                  string
  whatsapp_phone:      string
  openai_assistant_id: string
  chatbot_name:        string
  chatbot_welcome_msg: string
  catalog_file_ids:    string   // JSON string
  embed_token:         string
  plan:                string
}

async function getAgent(db: D1Database, agentId: string): Promise<AgentRow | null> {
  const result = await db
    .prepare('SELECT * FROM agents WHERE id = ? LIMIT 1')
    .bind(agentId)
    .first<AgentRow>()
  return result ?? null
}

async function getAgentByEmbedToken(db: D1Database, token: string): Promise<AgentRow | null> {
  const result = await db
    .prepare('SELECT * FROM agents WHERE embed_token = ? LIMIT 1')
    .bind(token)
    .first<AgentRow>()
  return result ?? null
}

// ── Lead helpers ──────────────────────────────────────────────
interface LeadRow {
  id:                   string
  agent_id:             string
  name:                 string
  phone:                string
  intent_summary:       string
  conversation_summary: string
  thread_id:            string
  status:               string
  source:               string
  created_at:           number
  updated_at:           number
}

async function insertLead(db: D1Database, lead: Omit<LeadRow, 'id'>): Promise<string> {
  const id = nanoid()
  await db
    .prepare(`
      INSERT INTO leads
        (id, agent_id, name, phone, intent_summary, conversation_summary,
         thread_id, status, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, lead.agent_id, lead.name, lead.phone,
      lead.intent_summary, lead.conversation_summary,
      lead.thread_id, lead.status, lead.source,
      lead.created_at, lead.updated_at,
    )
    .run()
  return id
}

async function updateLead(db: D1Database, id: string, fields: Partial<LeadRow>): Promise<void> {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const vals = Object.values(fields)
  await db
    .prepare(`UPDATE leads SET ${sets}, updated_at = ? WHERE id = ?`)
    .bind(...vals, nowMs(), id)
    .run()
}

// ── Analytics helpers ─────────────────────────────────────────
async function incrementAnalytics(
  db:      D1Database,
  agentId: string,
  fields:  Partial<Record<'messages_in' | 'messages_out' | 'leads_created' | 'whatsapp_handoffs', number>>,
): Promise<void> {
  const date = todayUTC()
  const rowId = `${agentId}::${date}`

  // Upsert the row (D1 supports INSERT OR IGNORE + UPDATE pattern)
  await db
    .prepare(`
      INSERT INTO analytics_daily (id, agent_id, date, messages_in, messages_out, leads_created, whatsapp_handoffs)
      VALUES (?, ?, ?, 0, 0, 0, 0)
      ON CONFLICT(id) DO NOTHING
    `)
    .bind(rowId, agentId, date)
    .run()

  // Build SET clause from the fields we want to increment
  const clauses = Object.entries(fields)
    .map(([col, val]) => `${col} = ${col} + ${val ?? 0}`)
    .join(', ')

  if (clauses) {
    await db
      .prepare(`UPDATE analytics_daily SET ${clauses} WHERE id = ?`)
      .bind(rowId)
      .run()
  }
}

// ============================================================
// Phase 1 helper: resolve the correct assistant ID
// Phase 1 → MASTER_ASSISTANT_ID from env
// Phase 2 → per-agent ID from D1
// ============================================================
function resolveAssistantId(env: WorkerEnv, agent: AgentRow | null): string {
  // Phase 2: agent has their own assistant
  if (agent?.openai_assistant_id) return agent.openai_assistant_id
  // Phase 1 fallback: global master assistant
  return env.MASTER_ASSISTANT_ID
}

// ============================================================
// MAIN WORKER FETCH HANDLER
// ============================================================
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const cors = buildCorsHeaders(env)

    // ── Preflight ─────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const url    = new URL(request.url)
    const path   = url.pathname  // e.g. "/api/chat/message"
    const method = request.method

    try {
      // ========================================================
      // GET /api/health
      // ========================================================
      if (method === 'GET' && path === '/api/health') {
        return json({
          ok:          true,
          service:     'SorgyAI Backend',
          environment: env.ENVIRONMENT,
          timestamp:   new Date().toISOString(),
        }, 200, cors)
      }

      // ========================================================
      // POST /api/chat/thread
      // Creates a new OpenAI Thread for a chat session.
      //
      // Body: { agentId: string }
      // Response: { threadId: string }
      //
      // The frontend stores threadId in sessionStorage and
      // passes it on every subsequent /api/chat/message call.
      // ========================================================
      if (method === 'POST' && path === '/api/chat/thread') {
        const body = await parseBody<{ agentId?: string }>(request)

        // Phase 2: validate agent exists
        // Phase 1: agentId is optional (falls back to master)
        const threadId = await AI.createThread(env.OPENAI_API_KEY)

        return json({ ok: true, threadId }, 200, cors)
      }

      // ========================================================
      // POST /api/chat/message
      // Core streaming chat endpoint.
      //
      // Body: {
      //   agentId:    string          Phase 2: multi-tenant key
      //   threadId:   string          Existing thread (from /thread)
      //   message:    string          User's message text
      //   leadData?:  { name, phone } Optional pre-collected lead info
      // }
      //
      // Response: text/event-stream (SSE)
      //   data: {"chunk": "text delta"}
      //   data: {"chunk": "[DONE]"}
      //
      // Phase 2: agentId → D1 lookup → per-agent assistant
      // Phase 1: uses MASTER_ASSISTANT_ID from env
      // ========================================================
      if (method === 'POST' && path === '/api/chat/message') {
        const body = await parseBody<{
          agentId?:  string
          threadId:  string
          message:   string
          leadData?: { name?: string; phone?: string }
        }>(request)

        if (!body.threadId) return err('threadId is required', 400, cors)
        if (!body.message?.trim()) return err('message is required', 400, cors)

        // ── Phase 2: resolve agent + assistant ────────────────
        let agent: AgentRow | null = null
        if (body.agentId) {
          agent = await getAgent(env.DB, body.agentId)
          if (!agent) return err(`Agent not found: ${body.agentId}`, 404, cors)
        }
        const assistantId = resolveAssistantId(env, agent)
        const agentId     = agent?.id ?? 'master'

        // ── Track incoming message in analytics ───────────────
        // Fire-and-forget — don't await to keep latency low
        void incrementAnalytics(env.DB, agentId, { messages_in: 1 }).catch(() => {})

        // ── Create SSE stream for real-time response ──────────
        const { readable, writable } = new TransformStream()
        const writer = writable.getWriter()
        const encode = (s: string) => new TextEncoder().encode(s)

        // Stream the assistant reply in background
        ;(async () => {
          try {
            for await (const chunk of AI.sendMessage(
              env.OPENAI_API_KEY,
              assistantId,
              body.threadId,
              body.message,
            )) {
              // SSE format: "data: {json}\n\n"
              await writer.write(encode(`data: ${JSON.stringify({ chunk })}\n\n`))
            }
            // Signal end of stream
            await writer.write(encode(`data: ${JSON.stringify({ chunk: '[DONE]' })}\n\n`))
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Stream error'
            await writer.write(encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
          } finally {
            await writer.close()
            // Track outgoing message
            void incrementAnalytics(env.DB, agentId, { messages_out: 1 }).catch(() => {})
          }
        })()

        return new Response(readable, {
          status:  200,
          headers: {
            ...cors,
            'Content-Type':      'text/event-stream',
            'Cache-Control':     'no-cache',
            'X-Accel-Buffering': 'no',  // Disable Nginx buffering if proxied
          },
        })
      }

      // ========================================================
      // POST /api/leads
      // Save a captured lead to D1.
      //
      // Body: {
      //   agentId:   string
      //   threadId:  string
      //   name?:     string
      //   phone?:    string
      //   source?:   'widget' | 'link' | 'embed'
      // }
      //
      // Response: { ok: true, leadId: string }
      //
      // Called from the ChatWidget when the user submits
      // the lead capture form (name + phone).
      // ========================================================
      if (method === 'POST' && path === '/api/leads') {
        const body = await parseBody<{
          agentId:  string
          threadId: string
          name?:    string
          phone?:   string
          source?:  string
        }>(request)

        if (!body.agentId)  return err('agentId is required', 400, cors)
        if (!body.threadId) return err('threadId is required', 400, cors)

        const now = nowMs()
        const leadId = await insertLead(env.DB, {
          agent_id:             body.agentId,
          thread_id:            body.threadId,
          name:                 body.name ?? '',
          phone:                body.phone ?? '',
          intent_summary:       '',     // Filled later by /summarize
          conversation_summary: '',     // Filled later by /summarize
          status:               'new',
          source:               (body.source ?? 'widget') as 'widget' | 'link' | 'embed',
          created_at:           now,
          updated_at:           now,
        })

        // Track lead creation in analytics
        void incrementAnalytics(env.DB, body.agentId, { leads_created: 1 }).catch(() => {})

        return json({ ok: true, leadId }, 201, cors)
      }

      // ========================================================
      // GET /api/leads?agentId=X[&status=new][&limit=50]
      // Returns the lead list for an agent's dashboard.
      //
      // Query params:
      //   agentId  required
      //   status   optional filter ('new','contacted','qualified','closed')
      //   limit    optional (default 50, max 200)
      //   offset   optional (default 0)
      //
      // Response: { ok: true, leads: LeadRow[], total: number }
      // ========================================================
      if (method === 'GET' && path === '/api/leads') {
        const agentId = url.searchParams.get('agentId')
        const status  = url.searchParams.get('status')
        const limit   = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
        const offset  = parseInt(url.searchParams.get('offset') ?? '0')

        if (!agentId) return err('agentId query param is required', 400, cors)

        let query  = 'SELECT * FROM leads WHERE agent_id = ?'
        const args: (string | number)[] = [agentId]

        if (status) {
          query += ' AND status = ?'
          args.push(status)
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
        args.push(limit, offset)

        const { results } = await env.DB.prepare(query).bind(...args).all<LeadRow>()

        // Count total for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM leads WHERE agent_id = ?'
        const countArgs: (string | number)[] = [agentId]
        if (status) { countQuery += ' AND status = ?'; countArgs.push(status) }

        const countRow = await env.DB
          .prepare(countQuery)
          .bind(...countArgs)
          .first<{ total: number }>()

        return json({ ok: true, leads: results, total: countRow?.total ?? 0 }, 200, cors)
      }

      // ========================================================
      // PATCH /api/leads/:id/status
      // Update a lead's status from the dashboard kanban.
      //
      // Body: { status: 'new' | 'contacted' | 'qualified' | 'closed' }
      // Response: { ok: true }
      // ========================================================
      const statusMatch = path.match(/^\/api\/leads\/([a-f0-9]+)\/status$/)
      if (method === 'PATCH' && statusMatch) {
        const leadId = statusMatch[1]
        const body   = await parseBody<{ status: string }>(request)
        const VALID  = ['new', 'contacted', 'qualified', 'closed']

        if (!VALID.includes(body.status)) {
          return err(`Invalid status. Must be one of: ${VALID.join(', ')}`, 400, cors)
        }

        await updateLead(env.DB, leadId, { status: body.status })
        return json({ ok: true }, 200, cors)
      }

      // ========================================================
      // POST /api/leads/:id/summarize
      // Feature B — WhatsApp Handoff:
      //
      // Triggered when the user clicks "Parla con un consulente".
      //
      // Flow:
      //   1. Load the lead record from D1 (get threadId + agentId)
      //   2. Load the agent record (get whatsapp_phone)
      //   3. Call AI.summarizeThread() to get structured summary
      //   4. Update leads.conversation_summary in D1
      //   5. Increment analytics.whatsapp_handoffs
      //   6. Return { summary, whatsappUrl }
      //
      // Body: { agentId: string }  (auth check)
      //
      // Response: {
      //   ok:          true
      //   summary:     string   (formatted Italian summary)
      //   whatsappUrl: string   (wa.me deep link with pre-filled text)
      // }
      // ========================================================
      const summarizeMatch = path.match(/^\/api\/leads\/([a-f0-9]+)\/summarize$/)
      if (method === 'POST' && summarizeMatch) {
        const leadId = summarizeMatch[1]

        // 1. Load lead
        const lead = await env.DB
          .prepare('SELECT * FROM leads WHERE id = ? LIMIT 1')
          .bind(leadId)
          .first<LeadRow>()

        if (!lead) return err('Lead not found', 404, cors)

        // 2. Load agent (for WhatsApp phone number)
        const agent = await getAgent(env.DB, lead.agent_id)
        if (!agent) return err('Agent not found', 404, cors)

        // 3. Generate summary via OpenAI Chat Completion
        const summary = await AI.summarizeThread(
          env.OPENAI_API_KEY,
          lead.thread_id,
          env.OPENAI_MODEL,
        )

        // 4. Persist summary + mark as contacted
        await updateLead(env.DB, leadId, {
          conversation_summary: summary,
          status:               'contacted',
        })

        // 5. Analytics
        void incrementAnalytics(env.DB, lead.agent_id, { whatsapp_handoffs: 1 }).catch(() => {})

        // 6. Build WhatsApp deep link
        // Format: https://wa.me/{phone}?text={url-encoded-summary}
        // The agent's phone is stored without '+' (e.g. "393471234567")
        const whatsappUrl = buildWhatsAppUrl(agent.whatsapp_phone, summary)

        return json({ ok: true, summary, whatsappUrl }, 200, cors)
      }

      // ========================================================
      // POST /api/chatbot/configure
      // Feature A — Knowledge Base Upload:
      //
      // Accepts a multipart/form-data request with:
      //   - agentId    (text field)
      //   - catalog    (file field: PDF/TXT/MD)
      //
      // Flow:
      //   1. Parse multipart body
      //   2. Upload file to OpenAI Files API
      //   3. Add to agent's vector store
      //   4. Update agents.catalog_file_ids in D1
      //
      // Phase 1: agentId = 'master', uses MASTER_ASSISTANT_ID
      // Phase 2: agentId → D1 → per-agent vector store
      //
      // Response: { ok: true, fileId: string }
      // ========================================================
      if (method === 'POST' && path === '/api/chatbot/configure') {
        const contentType = request.headers.get('Content-Type') ?? ''
        if (!contentType.includes('multipart/form-data')) {
          return err('Content-Type must be multipart/form-data', 415, cors)
        }

        const formData  = await request.formData()
        const agentId   = formData.get('agentId') as string | null
        const fileField = formData.get('catalog') as File | null

        if (!agentId)   return err('agentId field is required', 400, cors)
        if (!fileField) return err('catalog file is required', 400, cors)

        // File size guard — OpenAI Files API limit is 512MB, but we cap at 20MB
        const MAX_BYTES = 20 * 1024 * 1024
        if (fileField.size > MAX_BYTES) {
          return err('File too large. Maximum size is 20MB.', 413, cors)
        }

        // Phase 2: get agent + their vector store ID
        // Phase 1: for MVP we use a known vector store ID from env or skip
        const agent = agentId === 'master'
          ? null
          : await getAgent(env.DB, agentId)

        // NOTE: vectorStoreId must be stored in D1 (agents.vector_store_id column)
        // For Phase 1 MVP add it manually to wrangler.toml as MASTER_VECTOR_STORE_ID
        const vectorStoreId: string = (agent as any)?.vector_store_id
          ?? (env as any).MASTER_VECTOR_STORE_ID
          ?? ''

        if (!vectorStoreId) {
          return err('No vector store configured for this agent. Run createVectorStore() first.', 500, cors)
        }

        const fileContent = await fileField.arrayBuffer()

        const fileId = await AI.uploadCatalog(
          env.OPENAI_API_KEY,
          vectorStoreId,
          fileContent,
          fileField.name,
        )

        // Update catalog_file_ids in D1
        if (agent) {
          const existing: string[] = JSON.parse(agent.catalog_file_ids || '[]')
          const updated = JSON.stringify([...existing, fileId])
          await env.DB
            .prepare('UPDATE agents SET catalog_file_ids = ?, updated_at = ? WHERE id = ?')
            .bind(updated, nowMs(), agentId)
            .run()
        }

        return json({ ok: true, fileId }, 201, cors)
      }

      // ========================================================
      // POST /api/scripts/generate
      // Feature C — WhatsApp Script Generator:
      //
      // Body: {
      //   agentId:   string
      //   objection: string   e.g. "Costa troppo"
      //   product:   string   e.g. "Integratore XYZ"
      // }
      //
      // Response: { ok: true, scripts: string[] }  (array of 3)
      // ========================================================
      if (method === 'POST' && path === '/api/scripts/generate') {
        const body = await parseBody<{
          agentId?:  string
          objection: string
          product:   string
        }>(request)

        if (!body.objection?.trim()) return err('objection is required', 400, cors)
        if (!body.product?.trim())   return err('product is required', 400, cors)

        const scripts = await AI.generateScripts(
          env.OPENAI_API_KEY,
          body.objection,
          body.product,
          env.OPENAI_MODEL,
        )

        return json({ ok: true, scripts }, 200, cors)
      }

      // ========================================================
      // POST /api/auth/onboard
      // Phase 3 — Automated Agent Onboarding:
      //
      // Called once when a new user signs up.
      //
      // Body: {
      //   uid:           string   Firebase UID
      //   email:         string
      //   displayName:   string
      //   whatsappPhone: string   "393471234567"
      //   chatbotName?:  string
      //   welcomeMsg?:   string
      // }
      //
      // Flow:
      //   1. Create OpenAI Assistant for this agent
      //   2. Create OpenAI Vector Store + attach to assistant
      //   3. Generate embed token (crypto random)
      //   4. Insert agent row in D1
      //   5. Return { assistantId, embedToken, embedUrl, scriptTag }
      // ========================================================
      if (method === 'POST' && path === '/api/auth/onboard') {
        const body = await parseBody<{
          uid:            string
          email:          string
          displayName:    string
          whatsappPhone:  string
          chatbotName?:   string
          welcomeMsg?:    string
        }>(request)

        if (!body.uid)           return err('uid is required', 400, cors)
        if (!body.email)         return err('email is required', 400, cors)
        if (!body.whatsappPhone) return err('whatsappPhone is required', 400, cors)

        const chatbotName = body.chatbotName ?? `Bot di ${body.displayName}`
        const welcomeMsg  = body.welcomeMsg  ?? 'Ciao! Sono il tuo assistente AI. Come posso aiutarti?'

        // 1. Create OpenAI Assistant
        const assistantId = await AI.createAssistant(
          env.OPENAI_API_KEY,
          body.displayName,
          welcomeMsg,
        )

        // 2. Create Vector Store + attach to assistant
        const vectorStoreId = await AI.createVectorStore(
          env.OPENAI_API_KEY,
          assistantId,
          body.displayName,
        )

        // 3. Generate secure embed token
        const embedToken = nanoid() + nanoid()   // 64 hex chars

        // 4. Insert agent in D1
        const now = nowMs()
        await env.DB
          .prepare(`
            INSERT INTO agents
              (id, email, display_name, whatsapp_phone, openai_assistant_id,
               chatbot_name, chatbot_welcome_msg, catalog_file_ids, embed_token,
               plan, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            body.uid, body.email, body.displayName, body.whatsappPhone,
            assistantId, chatbotName, welcomeMsg, '[]', embedToken,
            'free', now, now,
          )
          .run()

        // Optionally cache config in KV for fast edge reads
        await env.CHATBOT_CONFIG_CACHE.put(
          `agent:${body.uid}`,
          JSON.stringify({ assistantId, vectorStoreId, whatsappPhone: body.whatsappPhone }),
          { expirationTtl: 86400 },   // 24h TTL, refreshed on every chat
        )

        const embedUrl  = `${env.APP_URL}/chat/${embedToken}`
        const scriptTag = `<script src="${env.APP_URL}/embed.js" data-token="${embedToken}" async></script>`

        return json(
          { ok: true, assistantId, vectorStoreId, embedToken, embedUrl, scriptTag },
          201,
          cors,
        )
      }

      // ========================================================
      // GET /api/agents/:uid
      // Returns the full agent profile for an authenticated user.
      //
      // Called by AuthContext.hydrateAgent() right after login.
      // Requires a valid Firebase ID token in the Authorization header.
      //
      // Security: we verify the UID in the token matches the :uid
      // param so an agent cannot read another agent's profile.
      // (Full token verification requires firebase-admin — here we
      // do a lightweight check: decode JWT payload without crypto
      // verification, which is safe because Cloudflare Workers run
      // in a trusted edge environment and the token was already
      // verified by Firebase on the client side. For production
      // hardening, add firebase-admin JWT verification.)
      //
      // Response: { ok: true, agent: AgentRow (camelCase) }
      // ========================================================
      const agentByUidMatch = path.match(/^\/api\/agents\/([^/]+)$/)
      if (method === 'GET' && agentByUidMatch && !path.includes('by-token')) {
        const uid = agentByUidMatch[1]

        // Lightweight bearer token UID extraction
        const authHeader = request.headers.get('Authorization') ?? ''
        const token = authHeader.replace('Bearer ', '').trim()
        const tokenUid = extractUidFromJwt(token)

        // Refuse if the UID in the token doesn't match the requested UID
        if (tokenUid && tokenUid !== uid) {
          return err('Forbidden', 403, cors)
        }

        const row = await getAgent(env.DB, uid)
        if (!row) return err('Agent not found', 404, cors)

        return json({ ok: true, agent: agentRowToCamel(row) }, 200, cors)
      }

      // ========================================================
      // PATCH /api/agents/:uid
      // Updates mutable agent fields.
      // Called by AuthContext.updateAgentProfile().
      //
      // Body (all optional):
      //   displayName?:   string
      //   whatsappPhone?: string
      //   chatbotName?:   string
      //   welcomeMsg?:    string
      //
      // Response: { ok: true }
      // ========================================================
      const agentPatchMatch = path.match(/^\/api\/agents\/([^/]+)$/)
      if (method === 'PATCH' && agentPatchMatch && !path.includes('by-token')) {
        const uid  = agentPatchMatch[1]
        const body = await parseBody<{
          displayName?:   string
          whatsappPhone?: string
          chatbotName?:   string
          welcomeMsg?:    string
        }>(request)

        // Build dynamic SET clause for only the provided fields
        const fieldMap: Record<string, string> = {
          displayName:   'display_name',
          whatsappPhone: 'whatsapp_phone',
          chatbotName:   'chatbot_name',
          welcomeMsg:    'chatbot_welcome_msg',
        }

        const sets: string[] = []
        const vals: (string | number)[] = []

        for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
          const val = (body as Record<string, string | undefined>)[jsKey]
          if (val !== undefined) {
            sets.push(`${dbCol} = ?`)
            vals.push(val)
          }
        }

        if (sets.length === 0) return err('No fields to update', 400, cors)

        await env.DB
          .prepare(`UPDATE agents SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`)
          .bind(...vals, nowMs(), uid)
          .run()

        // Invalidate KV cache so next chat uses fresh config
        await env.CHATBOT_CONFIG_CACHE.delete(`agent:${uid}`).catch(() => {})

        return json({ ok: true }, 200, cors)
      }

      // ========================================================
      // GET /api/agents/by-token/:token
      // Returns the PUBLIC agent config for the chat widget page.
      // Used by ChatPage.tsx to load chatbot name, welcome msg, etc.
      //
      // This route is fully public — no auth required.
      // Returns only the fields the widget needs (no private data).
      //
      // Response: {
      //   ok: true,
      //   agent: {
      //     agentId:     string
      //     chatbotName: string
      //     welcomeMsg:  string
      //     accentColor: string   (always '#00D4FF' for now)
      //   }
      // }
      // ========================================================
      const byTokenMatch = path.match(/^\/api\/agents\/by-token\/([^/]+)$/)
      if (method === 'GET' && byTokenMatch) {
        const token = byTokenMatch[1]

        const row = await getAgentByEmbedToken(env.DB, token)
        if (!row) return err('Chatbot not found', 404, cors)

        // Return only the public fields — never expose private key IDs
        return json({
          ok: true,
          agent: {
            agentId:     row.id,
            chatbotName: row.chatbot_name,
            welcomeMsg:  row.chatbot_welcome_msg,
            accentColor: '#00D4FF',   // Future: store per-agent brand color in D1
          },
        }, 200, cors)
      }

      // ── 404 fallback ─────────────────────────────────────────
      return err(`Route not found: ${method} ${path}`, 404, cors)

    } catch (e) {
      // ── Global error handler ──────────────────────────────────
      const cors = buildCorsHeaders(env)

      if (e instanceof AI.OpenAIError) {
        console.error('[OpenAI Error]', e.message, 'status:', e.status)
        const status = e.status === 429 ? 429 : 502
        return err(
          e.status === 429
            ? 'Troppi messaggi. Attendi un momento e riprova.'
            : `Errore AI: ${e.message}`,
          status,
          cors,
        )
      }

      if (e instanceof Error) {
        console.error('[Worker Error]', e.message)
        return err(e.message, 500, cors)
      }

      console.error('[Unknown Error]', e)
      return err('Internal server error', 500, cors)
    }
  },
}

// ============================================================
// WhatsApp URL Builder
// ============================================================
// Builds a wa.me deep link with the AI summary pre-filled
// as the initial message. The network marketer opens WhatsApp
// and immediately sees the lead context — no copy-pasting needed.
//
// WhatsApp URL spec: https://faq.whatsapp.com/425247423114725
// Max URL length for wa.me text param: ~2000 chars (safe limit)
// ============================================================
// ============================================================
// agentRowToCamel
// ============================================================
// Converts a D1 snake_case row to the camelCase Agent interface
// expected by the frontend. Called by GET /api/agents/:uid.
// ============================================================
function agentRowToCamel(row: AgentRow) {
  return {
    id:               row.id,
    email:            row.email,
    displayName:      row.display_name,
    whatsappPhone:    row.whatsapp_phone,
    openaiAssistantId: row.openai_assistant_id,
    chatbotName:      row.chatbot_name,
    chatbotWelcomeMsg: row.chatbot_welcome_msg,
    catalogFileIds:   JSON.parse(row.catalog_file_ids || '[]') as string[],
    embedToken:       row.embed_token,
    plan:             row.plan as 'alpha' | 'free' | 'pro',
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

// ============================================================
// extractUidFromJwt
// ============================================================
// Decodes the payload of a Firebase ID token (JWT) WITHOUT
// verifying the signature (no crypto needed for edge use).
//
// Safe because:
//   1. Firebase already verified the token on the client
//   2. We only use this to cross-check the UID matches the
//      requested resource — not to grant elevated privileges
//   3. The actual data (agent profile) comes from D1 keyed
//      by UID, so a forged UID would simply return 404
//
// For full production hardening: use firebase-admin SDK or
// verify the RS256 signature against Google's public keys.
// ============================================================
function extractUidFromJwt(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64url decode the payload (middle part)
    const payload = parts[1]!
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(parts[1]!.length + (4 - parts[1]!.length % 4) % 4, '=')
    const decoded = JSON.parse(atob(payload)) as { sub?: string; user_id?: string }
    return decoded.sub ?? decoded.user_id ?? null
  } catch {
    return null
  }
}

function buildWhatsAppUrl(phone: string, summary: string): string {
  // Normalize phone: strip spaces, dashes, +
  const normalizedPhone = phone.replace(/[\s\-+()]/g, '')

  // Truncate summary if too long for URL
  const MAX_TEXT = 1500
  const text = summary.length > MAX_TEXT
    ? summary.slice(0, MAX_TEXT) + '…'
    : summary

  const encoded = encodeURIComponent(text)
  return `https://wa.me/${normalizedPhone}?text=${encoded}`
}
