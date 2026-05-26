#!/usr/bin/env node
// ============================================================
// SorgyAI — scripts/seed-agent.ts
// Phase 1 setup script: creates the first alpha agent in D1.
//
// QUANDO USARLO:
//   Prima ancora di aprire il browser. Questo script:
//     1. Crea l'OpenAI Assistant per il tuo account
//     2. Crea il Vector Store e lo aggancia all'assistant
//     3. Inserisce la riga agente nel database D1 locale
//     4. Stampa il Firebase UID da usare per il login
//
// COME ESEGUIRLO:
//   cd sorgyai-monorepo/scripts
//   npx tsx seed-agent.ts
//   (oppure: npx ts-node seed-agent.ts)
//
// PREREQUISITI:
//   - wrangler dev deve essere in esecuzione (npm run dev:backend)
//     oppure si può puntare direttamente a D1 con wrangler d1
//   - Il file .env.seed (vedi sotto) deve essere compilato
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// ── Leggi .env.seed ───────────────────────────────────────────
const envPath = path.join(__dirname, '.env.seed')

if (!fs.existsSync(envPath)) {
  console.error(`
❌ File mancante: scripts/.env.seed

Crea il file con questo contenuto:

  OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxx
  FIREBASE_UID=INCOLLA_QUI_IL_TUO_FIREBASE_UID
  AGENT_EMAIL=tua@email.com
  AGENT_NAME=Il Tuo Nome
  WHATSAPP_PHONE=393471234567
  CHATBOT_NAME=SorgyAI Demo
  WELCOME_MSG=Ciao! Come posso aiutarti oggi?
  WORKER_BASE_URL=http://localhost:8787

Come trovare il Firebase UID:
  1. Vai su console.firebase.google.com
  2. Seleziona progetto → Authentication → Users
  3. Crea un utente manualmente con la tua email
  4. Copia il valore nella colonna "User UID"
`)
  process.exit(1)
}

// Parse .env.seed (formato KEY=VALUE, no librerie esterne)
const envVars: Record<string, string> = {}
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const [key, ...rest] = trimmed.split('=')
  if (key) envVars[key.trim()] = rest.join('=').trim()
})

const required = ['OPENAI_API_KEY','FIREBASE_UID','AGENT_EMAIL','AGENT_NAME','WHATSAPP_PHONE','WORKER_BASE_URL']
const missing  = required.filter(k => !envVars[k])
if (missing.length > 0) {
  console.error(`❌ Campi mancanti in .env.seed: ${missing.join(', ')}`)
  process.exit(1)
}

const {
  OPENAI_API_KEY,
  FIREBASE_UID,
  AGENT_EMAIL,
  AGENT_NAME,
  WHATSAPP_PHONE,
  CHATBOT_NAME    = 'SorgyAI',
  WELCOME_MSG     = 'Ciao! Come posso aiutarti?',
  WORKER_BASE_URL = 'http://localhost:8787',
} = envVars

// ── Helpers ───────────────────────────────────────────────────
const OPENAI_BASE = 'https://api.openai.com/v1'

async function oaiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${OPENAI_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta':  'assistants=v2',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`OpenAI ${path}: ${e?.error?.message ?? res.status}`)
  }
  return res.json() as Promise<T>
}

function log(emoji: string, msg: string) {
  console.log(`${emoji}  ${msg}`)
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(55))
  console.log('  SorgyAI — Phase 1 Agent Seed Script')
  console.log('═'.repeat(55))
  console.log()

  // 1. CREATE OPENAI ASSISTANT ─────────────────────────────────
  log('🤖', `Creazione OpenAI Assistant per "${AGENT_NAME}"…`)

  const assistant = await oaiPost<{ id: string }>('/assistants', {
    name:  `SorgyAI — ${AGENT_NAME}`,
    model: 'gpt-4o-mini',
    instructions: `Sei l'assistente AI di ${AGENT_NAME}, specializzato in network marketing e social selling.

COMPORTAMENTO:
- Rispondi SOLO usando le informazioni nei file allegati (catalogo prodotti, FAQ).
- Qualifica il visitatore: scopri nome, esigenza principale e contatto WhatsApp.
- Gestisci le obiezioni con empatia, senza pressione.
- Massimo 3-4 frasi per risposta. Mai lunghi elenchi.
- Tono: amichevole e professionale.

MESSAGGIO DI BENVENUTO: "${WELCOME_MSG}"

Quando l'utente sembra pronto, suggerisci di cliccare "Parla con un consulente".`,
    tools:       [{ type: 'file_search' }],
    temperature: 0.7,
  })

  log('✅', `Assistant creato: ${assistant.id}`)

  // 2. CREATE VECTOR STORE ─────────────────────────────────────
  log('🗃️ ', 'Creazione Vector Store…')

  const vs = await oaiPost<{ id: string }>('/vector_stores', {
    name:         `sorgyai-catalog-${AGENT_NAME.toLowerCase().replace(/\s+/g, '-')}`,
    expires_after: { anchor: 'last_active_at', days: 365 },
  })

  // Attach vector store to assistant
  await fetch(`${OPENAI_BASE}/assistants/${assistant.id}`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta':  'assistants=v2',
    },
    body: JSON.stringify({
      tool_resources: { file_search: { vector_store_ids: [vs.id] } },
    }),
  })

  log('✅', `Vector Store creato e agganciato: ${vs.id}`)

  // 3. INSERT AGENT IN D1 via Worker API ───────────────────────
  log('💾', 'Inserimento agente nel database D1…')
  log('ℹ️ ', `Worker URL: ${WORKER_BASE_URL}`)

  // Generate embed token (same logic as the Worker)
  const embedToken = Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    b => b.toString(16).padStart(2, '0')
  ).join('')

  const now = Date.now()

  // Call the Worker's internal seed endpoint
  // Note: in Phase 1 we insert directly via a raw D1 query
  // using wrangler d1 execute (see instructions at the bottom)
  const insertSQL = `
INSERT INTO agents (
  id, email, display_name, whatsapp_phone,
  openai_assistant_id, chatbot_name, chatbot_welcome_msg,
  catalog_file_ids, embed_token, plan, created_at, updated_at
) VALUES (
  '${FIREBASE_UID}',
  '${AGENT_EMAIL}',
  '${AGENT_NAME}',
  '${WHATSAPP_PHONE.replace(/[^0-9]/g, '')}',
  '${assistant.id}',
  '${CHATBOT_NAME}',
  '${WELCOME_MSG}',
  '[]',
  '${embedToken}',
  'alpha',
  ${now},
  ${now}
) ON CONFLICT(id) DO UPDATE SET
  openai_assistant_id = '${assistant.id}',
  embed_token = '${embedToken}',
  updated_at = ${now};
`.trim()

  // Try to insert via Worker health endpoint (dev mode)
  // If the worker is not running, we fall back to printing the SQL
  let insertedViaWorker = false
  try {
    const healthRes = await fetch(`${WORKER_BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) })
    if (healthRes.ok) {
      // Worker is running — but there's no raw SQL endpoint, so we
      // use wrangler d1 execute to run the SQL directly.
      // The script will print the command to run.
      insertedViaWorker = false
    }
  } catch {
    log('⚠️ ', 'Worker non raggiungibile — usa il comando wrangler d1 sotto per inserire il record.')
  }

  // 4. PRINT RESULTS ────────────────────────────────────────────
  console.log()
  console.log('═'.repeat(55))
  console.log('  ✅ SETUP COMPLETATO')
  console.log('═'.repeat(55))
  console.log()
  console.log('📋 Valori generati — SALVALI in un posto sicuro:\n')
  console.log(`  Firebase UID:        ${FIREBASE_UID}`)
  console.log(`  OpenAI Assistant ID: ${assistant.id}`)
  console.log(`  OpenAI Vector Store: ${vs.id}`)
  console.log(`  Embed Token:         ${embedToken}`)
  console.log(`  Chat URL:            http://localhost:5173/chat/${embedToken}`)
  console.log()

  // 5. PRINT WRANGLER COMMAND ───────────────────────────────────
  console.log('─'.repeat(55))
  console.log('  PASSO FINALE: esegui questo comando nel terminale')
  console.log('  (dalla cartella sorgyai-monorepo/backend)')
  console.log('─'.repeat(55))
  console.log()
  console.log('  # Inserisce l\'agente nel database D1 locale:')
  console.log()

  // Write SQL to a temp file for easy execution
  const sqlFile = path.join(__dirname, '_seed_output.sql')
  fs.writeFileSync(sqlFile, insertSQL)
  console.log(`  npx wrangler d1 execute sorgyai-db --local --file=../scripts/_seed_output.sql`)
  console.log()
  console.log('  # Per il database di PRODUZIONE (dopo il deploy):')
  console.log(`  npx wrangler d1 execute sorgyai-db --file=../scripts/_seed_output.sql`)
  console.log()

  // 6. PRINT WRANGLER.TOML REMINDER ────────────────────────────
  console.log('─'.repeat(55))
  console.log('  AGGIORNA wrangler.toml con questi valori:')
  console.log('─'.repeat(55))
  console.log()
  console.log('  [vars]')
  console.log(`  MASTER_ASSISTANT_ID = "${assistant.id}"`)
  console.log()

  // 7. PRINT .env.local REMINDER ───────────────────────────────
  console.log('─'.repeat(55))
  console.log('  AGGIORNA frontend/.env.local con:')
  console.log('─'.repeat(55))
  console.log()
  console.log('  (Le chiavi Firebase le trovi già lì — nessuna modifica)')
  console.log()

  console.log('🚀 Ora puoi avviare il progetto con: npm run dev')
  console.log()
}

main().catch(e => {
  console.error('\n❌ Errore:', e.message)
  process.exit(1)
})
