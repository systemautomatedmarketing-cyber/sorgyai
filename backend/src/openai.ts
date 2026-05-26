// ============================================================
// SorgyAI — OpenAI Assistants API Wrapper
// backend/src/openai.ts
//
// All calls are raw fetch() — the openai npm SDK is NOT used
// here because Cloudflare Workers bundle size matters and the
// SDK pulls in Node.js polyfills. We call the REST API directly.
//
// Exports:
//   createAssistant()        Phase 1/3: create a per-agent assistant
//   createVectorStore()      Attach a vector store to the assistant
//   uploadCatalog()          Upload PDF/TXT and add to vector store
//   deleteCatalogFile()      Remove a file from vector store + Files API
//   createThread()           Start a new conversation thread
//   sendMessage()            Add user msg + stream assistant reply (SSE)
//   collectThreadMessages()  Fetch all messages for summarization
//   summarizeThread()        Feature B: WhatsApp handoff summary
//   generateScripts()        Feature C: objection closing scripts
//   waitForRunCompletion()   Non-streaming polling fallback
// ============================================================

export type AssistantId   = string
export type ThreadId      = string
export type FileId        = string
export type VectorStoreId = string

// ── Custom error ──────────────────────────────────────────────
export class OpenAIError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'OpenAIError'
  }
}

// ── Constants ─────────────────────────────────────────────────
const OPENAI_BASE = 'https://api.openai.com/v1'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Minimal response shape types ─────────────────────────────
interface OAIAssistant    { id: string }
interface OAIThread       { id: string }
interface OAIFile         { id: string }
interface OAIVectorStore  { id: string }
interface OAIRun          { id: string; status: string; last_error?: { message: string } }
interface OAIContent      { type: string; text?: { value: string } }
interface OAIMessage      { id: string; role: string; content: OAIContent[] }
interface OAIMessageList  { data: OAIMessage[] }
interface OAIChatResponse { choices: Array<{ message: { content: string } }> }

// ============================================================
// Low-level fetch helpers
// ============================================================

/** Base fetch with OpenAI auth + Assistants v2 beta header. */
async function oaiFetch(apiKey: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${OPENAI_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta':   'assistants=v2',
      'Content-Type':  'application/json',
      ...(init.headers ?? {}),
    },
  })
}

/** POST with JSON body — returns parsed response or throws OpenAIError. */
async function oaiPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await oaiFetch(apiKey, path, { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new OpenAIError(err?.error?.message ?? `OpenAI POST ${path} → ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

/** GET — returns parsed response or throws OpenAIError. */
async function oaiGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await oaiFetch(apiKey, path, { method: 'GET' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new OpenAIError(err?.error?.message ?? `OpenAI GET ${path} → ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

/** DELETE — fire and forget, throws on non-2xx. */
async function oaiDelete(apiKey: string, path: string): Promise<void> {
  const res = await oaiFetch(apiKey, path, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new OpenAIError(err?.error?.message ?? `OpenAI DELETE ${path} → ${res.status}`, res.status)
  }
}

// ============================================================
// createAssistant
// ============================================================
// Creates a new OpenAI Assistant bound to one SorgyAI agent.
//
// Phase 1: called once manually for each alpha user.
//   → Save returned ID as MASTER_ASSISTANT_ID in wrangler.toml.
// Phase 3: called automatically on user onboarding.
//   → Saved to agents.openai_assistant_id in D1.
//
// The assistant uses file_search (built-in RAG) to answer
// questions from the uploaded product catalog PDFs/TXTs.
// No external vector DB required — zero extra cost.
// ============================================================
export async function createAssistant(
  apiKey:     string,
  agentName:  string,
  welcomeMsg: string,
): Promise<AssistantId> {
  const assistant = await oaiPost<OAIAssistant>(apiKey, '/assistants', {
    name:         `SorgyAI — ${agentName}`,
    model:        'gpt-4o-mini',
    instructions: buildSystemPrompt(agentName, welcomeMsg),
    tools:        [{ type: 'file_search' }],
    temperature:  0.7,
    // tool_resources.file_search.vector_store_ids will be patched
    // after createVectorStore() is called (see below)
  })
  return assistant.id
}

/** Network-marketing-optimised Italian system prompt. */
function buildSystemPrompt(agentName: string, welcomeMsg: string): string {
  return `Sei l'assistente AI di ${agentName}, specializzato in network marketing e social selling.

COMPORTAMENTO:
- Rispondi SOLO usando le informazioni nei file allegati (catalogo prodotti, FAQ). Se non trovi la risposta, dillo onestamente.
- Qualifica il visitatore in modo naturale: scopri nome, esigenza principale e contatto WhatsApp nel corso della conversazione.
- Gestisci le obiezioni (prezzo, tempo, scetticismo) con empatia, senza pressione.
- Massimo 3-4 frasi per risposta. Mai lunghi elenchi.
- Tono: amichevole e professionale. Mai aggressivo o da venditore stereotipato.

MESSAGGIO DI BENVENUTO (usalo come prima risposta se non modificato):
"${welcomeMsg}"

QUANDO L'UTENTE SEMBRA PRONTO:
Suggeriscigli di cliccare "Parla con un consulente" per ricevere assistenza personalizzata.`
}

// ============================================================
// createVectorStore
// ============================================================
// Creates an OpenAI Vector Store and attaches it to the
// assistant via tool_resources. This is the zero-cost RAG
// layer — no Pinecone, no Weaviate, no extra bills.
//
// Returns the VectorStoreId to be saved in D1 or KV.
// ============================================================
export async function createVectorStore(
  apiKey:      string,
  assistantId: AssistantId,
  agentName:   string,
): Promise<VectorStoreId> {
  // 1. Create the vector store object
  const vs = await oaiPost<OAIVectorStore>(apiKey, '/vector_stores', {
    name: `sorgyai-catalog-${agentName.toLowerCase().replace(/\s+/g, '-')}`,
    expires_after: { anchor: 'last_active_at', days: 365 },
  })

  // 2. Patch the assistant to use this vector store
  await oaiFetch(apiKey, `/assistants/${assistantId}`, {
    method: 'POST',
    body:   JSON.stringify({
      tool_resources: {
        file_search: { vector_store_ids: [vs.id] },
      },
    }),
  })

  return vs.id
}

// ============================================================
// uploadCatalog
// ============================================================
// Uploads a product catalog file (PDF/TXT/MD/DOCX) to the
// OpenAI Files API, then adds it to the agent's vector store.
//
// The file is chunked and embedded automatically by OpenAI —
// no manual embedding pipeline needed.
//
// Returns the FileId to store in agents.catalog_file_ids (JSON array in D1).
// ============================================================
export async function uploadCatalog(
  apiKey:        string,
  vectorStoreId: VectorStoreId,
  fileContent:   ArrayBuffer,
  fileName:      string,
): Promise<FileId> {
  // 1. Upload to Files API via multipart/form-data
  const form = new FormData()
  form.append('purpose', 'assistants')
  form.append(
    'file',
    new Blob([fileContent], { type: resolveMimeType(fileName) }),
    fileName,
  )

  const uploadRes = await fetch(`${OPENAI_BASE}/files`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta':   'assistants=v2',
      // NOTE: do NOT set Content-Type here — browser sets multipart boundary automatically
    },
    body: form,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({})) as { error?: { message?: string } }
    throw new OpenAIError(err?.error?.message ?? `File upload failed ${uploadRes.status}`, uploadRes.status)
  }

  const file = await uploadRes.json() as OAIFile

  // 2. Add file to the vector store (triggers async chunking + embedding)
  await oaiPost(apiKey, `/vector_stores/${vectorStoreId}/files`, {
    file_id: file.id,
  })

  return file.id
}

function resolveMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    pdf:  'application/pdf',
    txt:  'text/plain',
    md:   'text/markdown',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
  return map[ext ?? ''] ?? 'application/octet-stream'
}

// ============================================================
// deleteCatalogFile
// ============================================================
// Removes a file from both the vector store and the Files API.
// Called when an agent replaces or removes a catalog.
// ============================================================
export async function deleteCatalogFile(
  apiKey:        string,
  vectorStoreId: VectorStoreId,
  fileId:        FileId,
): Promise<void> {
  // Remove association from vector store first
  await oaiDelete(apiKey, `/vector_stores/${vectorStoreId}/files/${fileId}`)
  // Then delete the underlying file object
  await oaiDelete(apiKey, `/files/${fileId}`)
}

// ============================================================
// createThread
// ============================================================
// Starts a new OpenAI Thread representing one chat session.
//
// The threadId is:
//   - Returned to the frontend widget and stored in localStorage
//   - Saved in leads.thread_id in D1 for conversation continuity
//   - Used to fetch messages for the WhatsApp summary
// ============================================================
export async function createThread(apiKey: string): Promise<ThreadId> {
  const thread = await oaiPost<OAIThread>(apiKey, '/threads', {})
  return thread.id
}

// ============================================================
// sendMessage
// ============================================================
// Core Feature A — Streaming Chat:
//
// Flow:
//   1. Appends the user message to the existing Thread
//   2. Creates a streaming Run bound to the agent's Assistant
//   3. Parses the Server-Sent Events stream from OpenAI
//   4. Yields text delta strings for real-time frontend display
//
// The caller (route handler in index.ts) transforms this
// AsyncGenerator into a ReadableStream SSE response.
//
// Cost: gpt-4o-mini ~ $0.15/1M input + $0.60/1M output tokens.
// A typical chat message costs ~$0.0001.
// ============================================================
export async function* sendMessage(
  apiKey:      string,
  assistantId: AssistantId,
  threadId:    ThreadId,
  userMessage: string,
): AsyncGenerator<string> {
  // 1. Add user message to thread
  await oaiPost(apiKey, `/threads/${threadId}/messages`, {
    role:    'user',
    content: userMessage,
  })

  // 2. Kick off a streaming run
  const runRes = await oaiFetch(apiKey, `/threads/${threadId}/runs`, {
    method: 'POST',
    body:   JSON.stringify({
      assistant_id: assistantId,
      stream:       true,
      model:        'gpt-4o-mini',
      // Keep context window small to control costs
      truncation_strategy: { type: 'last_messages', last_messages: 20 },
      // Max output tokens per response
      max_completion_tokens: 500,
    }),
  })

  if (!runRes.ok || !runRes.body) {
    const err = await runRes.json().catch(() => ({})) as { error?: { message?: string } }
    throw new OpenAIError(err?.error?.message ?? `Run create failed ${runRes.status}`, runRes.status)
  }

  // 3. Parse SSE stream and yield text deltas
  yield* readSSEStream(runRes.body)
}

// ── SSE Stream Reader ─────────────────────────────────────────
// OpenAI Assistants streaming emits SSE events.
// We handle these event types:
//
//   thread.message.delta    → text delta to stream to client
//   thread.run.completed    → stream is done
//   thread.run.failed       → throw error
//   thread.run.requires_action → not expected (no function tools)
//
// All other events (thread.run.created, thread.run.queued, etc.)
// are silently ignored.
async function* readSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader  = body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE messages are delimited by double newline
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() ?? ''   // Keep last incomplete chunk

      for (const chunk of chunks) {
        const result = extractSSEPayload(chunk)
        if (!result) continue

        const { event, data } = result

        if (event === 'thread.message.delta') {
          const deltaContent = (data as {
            delta?: { content?: Array<{ type: string; text?: { value: string } }> }
          })?.delta?.content ?? []

          for (const block of deltaContent) {
            if (block.type === 'text' && block.text?.value) {
              yield block.text.value
            }
          }
        }

        if (event === 'thread.run.failed') {
          const run = data as OAIRun
          throw new OpenAIError(
            run?.last_error?.message ?? 'OpenAI run failed unexpectedly',
          )
        }

        if (event === 'thread.run.completed' || event === 'done') {
          return
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

interface SSEPayload { event: string; data: unknown }

function extractSSEPayload(raw: string): SSEPayload | null {
  let event = ''
  let dataStr = ''

  for (const line of raw.trim().split('\n')) {
    if (line.startsWith('event: ')) event   = line.slice(7).trim()
    if (line.startsWith('data: '))  dataStr = line.slice(6).trim()
  }

  if (!event || !dataStr || dataStr === '[DONE]') return null

  try {
    return { event, data: JSON.parse(dataStr) }
  } catch {
    return null
  }
}

// ============================================================
// collectThreadMessages
// ============================================================
// Fetches the full message history of a thread in chronological
// order. Used as input context for summarizeThread().
//
// Limits to 50 messages (more than enough for a chat session).
// ============================================================
export async function collectThreadMessages(
  apiKey:   string,
  threadId: ThreadId,
): Promise<Array<{ role: string; text: string }>> {
  const list = await oaiGet<OAIMessageList>(
    apiKey,
    `/threads/${threadId}/messages?limit=50&order=asc`,
  )

  return list.data.map(msg => ({
    role: msg.role,
    text: msg.content
      .filter(c => c.type === 'text')
      .map(c => c.text?.value ?? '')
      .join(' ')
      .trim(),
  }))
}

// ============================================================
// summarizeThread
// ============================================================
// Feature B — WhatsApp Handoff:
//
// When the user clicks "Parla con un consulente", this function:
//   1. Fetches all messages from the thread
//   2. Sends them to gpt-4o-mini via Chat Completion (direct,
//      no assistant/thread overhead) for a structured summary
//   3. Returns an Italian-formatted WhatsApp-ready message
//
// The result is URL-encoded and appended to the WhatsApp
// deep link: wa.me/{phone}?text={encoded_summary}
//
// Model: gpt-4o-mini at temperature 0.2 for consistent output.
// ============================================================
export async function summarizeThread(
  apiKey:   string,
  threadId: ThreadId,
  model:    string,
): Promise<string> {
  const messages = await collectThreadMessages(apiKey, threadId)

  if (messages.length === 0) {
    return [
      '🔔 *Nuovo contatto — SorgyAI*',
      '',
      '👤 *Nome:* Non fornito',
      '📱 *Telefono:* Non fornito',
      '💬 *Interesse:* Il visitatore ha aperto la chat ma non ha scritto messaggi.',
      '✅ *Prossimo step:* Contattare e chiedere come possiamo aiutare.',
    ].join('\n')
  }

  const transcript = messages
    .map(m => `[${m.role === 'user' ? 'VISITATORE' : 'BOT'}]: ${m.text}`)
    .join('\n')

  const res = await oaiPost<OAIChatResponse>(apiKey, '/chat/completions', {
    model,
    temperature: 0.2,
    max_tokens:  450,
    messages: [
      {
        role: 'system',
        content: `Sei un assistente di vendita per network marketing.
Analizza questa trascrizione di chat e genera un riassunto STRUTTURATO e AZIONABILE per l'agente umano che lo riceverà su WhatsApp.

FORMATO OBBLIGATORIO (rispetta esattamente emoji e label in grassetto):
🔥 *Nuovo lead qualificato — SorgyAI*

👤 *Nome:* [nome se menzionato, altrimenti "Non fornito"]
📱 *Telefono:* [telefono se menzionato, altrimenti "Non fornito"]
💬 *Interesse principale:* [max 15 parole]
⚠️ *Obiezioni emerse:* [breve elenco separato da virgola, o "Nessuna"]
🌡️ *Temperatura lead:* [Freddo / Tiepido / Caldo]
✅ *Prossimo step:* [1 azione specifica e concreta]

Regole: max 12 righe totali. Nessun testo aggiuntivo fuori dal formato.`,
      },
      {
        role: 'user',
        content: `Trascrizione:\n\n${transcript}`,
      },
    ],
  })

  return res.choices[0]?.message?.content?.trim() ?? '🔔 Riassunto non disponibile.'
}

// ============================================================
// generateScripts
// ============================================================
// Feature C — Script & Objection Generator:
//
// Given a customer objection ("Costa troppo") and a product
// name, returns exactly 3 WhatsApp closing scripts.
//
// Each script uses a distinct persuasion angle:
//   Script 1: Empatia + valore concreto
//   Script 2: Prova sociale + urgenza leggera
//   Script 3: Domanda di ricalibrazione (reframe)
//
// Output is split on "---" separator for easy array parsing.
// Model: gpt-4o-mini at temperature 0.85 for creative variety.
// ============================================================
export async function generateScripts(
  apiKey:    string,
  objection: string,
  product:   string,
  model:     string,
): Promise<string[]> {
  const res = await oaiPost<OAIChatResponse>(apiKey, '/chat/completions', {
    model,
    temperature: 0.85,
    max_tokens:  700,
    messages: [
      {
        role: 'system',
        content: `Sei un copywriter esperto di network marketing italiano e comunicazione persuasiva su WhatsApp.
Scrivi esattamente 3 script di risposta a un'obiezione, pronti da copiare e incollare.

REGOLE FERREE:
- Ogni script inizia con 👉
- Tono: autentico e amichevole, MAI da venditore aggressivo
- Lunghezza: 2-5 frasi per script
- Includi sempre il nome del prodotto
- Massimo 2 emoji per script
- Separa i 3 script SOLO con "---" (tre trattini su riga separata)
- Nessun testo extra prima del primo script o dopo il terzo

ANGOLAZIONI (una per script, in questo ordine):
Script 1 — Empatia genuina: rispecchia l'obiezione → svela il valore reale del prodotto
Script 2 — Prova sociale: cita un risultato concreto o la comunità → crea senso di opportunità
Script 3 — Domanda di ricalibrazione: una domanda che fa riflettere → apre il dialogo`,
      },
      {
        role: 'user',
        content: `Prodotto: ${product}\nObiezione: "${objection}"\n\nScrivi i 3 script.`,
      },
    ],
  })

  const raw = res.choices[0]?.message?.content?.trim() ?? ''

  const scripts = raw
    .split(/\n---\n/)
    .map(s => s.trim())
    .filter(s => s.length > 15)
    .slice(0, 3)

  if (scripts.length === 0) {
    throw new OpenAIError('La generazione degli script non ha prodotto output valido.')
  }

  return scripts
}

// ============================================================
// waitForRunCompletion  (non-streaming polling fallback)
// ============================================================
// Used for background tasks (e.g., catalog processing check)
// where streaming is not needed. Polls every 800ms.
// ============================================================
export async function waitForRunCompletion(
  apiKey:      string,
  threadId:    ThreadId,
  runId:       string,
  timeoutMs =  30_000,
): Promise<OAIRun> {
  const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'expired', 'incomplete'])
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const run = await oaiGet<OAIRun>(apiKey, `/threads/${threadId}/runs/${runId}`)
    if (TERMINAL.has(run.status)) {
      if (run.status === 'failed') {
        throw new OpenAIError(run.last_error?.message ?? 'Run failed', 500)
      }
      return run
    }
    await sleep(800)
  }

  throw new OpenAIError(`Run polling timeout after ${timeoutMs}ms`)
}
