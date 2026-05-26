# SorgyAI — Guida Operativa Completa
## Dalla cartella vuota al chatbot live in produzione

---

## INDICE
1. [Prerequisiti](#1-prerequisiti)
2. [Clona e installa](#2-clona-e-installa)
3. [Setup Firebase](#3-setup-firebase)
4. [Setup Cloudflare](#4-setup-cloudflare)
5. [Setup OpenAI](#5-setup-openai)
6. [Configura i file di ambiente](#6-configura-i-file-di-ambiente)
7. [Inizializza il database D1](#7-inizializza-il-database-d1)
8. [Crea il primo agente (Phase 1 Seed)](#8-crea-il-primo-agente-phase-1-seed)
9. [Avvia in locale](#9-avvia-in-locale)
10. [Deploy in produzione](#10-deploy-in-produzione)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisiti

Installa questi strumenti prima di iniziare:

```bash
# Node.js 18+ (verifica con)
node --version   # deve essere >= 18.0.0

# npm 9+ (incluso con Node)
npm --version

# Wrangler CLI (Cloudflare Workers)
npm install -g wrangler

# tsx (per eseguire script TypeScript)
npm install -g tsx

# Verifica login Cloudflare
wrangler login
# → si apre il browser, autorizza l'accesso al tuo account Cloudflare
```

Account necessari:
- **Cloudflare** (gratuito) → cloudflare.com
- **Firebase** (gratuito) → console.firebase.google.com
- **OpenAI** (pay-per-use) → platform.openai.com

---

## 2. Clona e installa

```bash
git clone https://github.com/tuo-user/sorgyai-monorepo.git
cd sorgyai-monorepo

# Installa tutte le dipendenze (frontend + backend + scripts)
npm install
```

Struttura risultante:
```
sorgyai-monorepo/
├── frontend/      ← React + Vite + Tailwind
├── backend/       ← Cloudflare Worker
├── scripts/       ← Script di setup
└── SETUP.md       ← Questa guida
```

---

## 3. Setup Firebase

### 3a. Crea il progetto Firebase

1. Vai su **console.firebase.google.com**
2. Clicca **"Aggiungi progetto"**
3. Nome: `sorgyai` (o quello che preferisci)
4. Disabilita Google Analytics se non ti serve
5. Clicca **"Crea progetto"**

### 3b. Attiva Authentication

1. Nel menu laterale → **Authentication** → **Inizia**
2. Tab **"Metodi di accesso"** → clicca **"Email/Password"**
3. Abilita **"Email/Password"** (il primo toggle) → **Salva**

### 3c. Crea il tuo utente alpha

1. Authentication → tab **"Utenti"** → **"Aggiungi utente"**
2. Inserisci la tua email e una password
3. Clicca **"Aggiungi utente"**
4. **COPIA il valore nella colonna "User UID"** — ti serve nel passo 8

### 3d. Ottieni le credenziali per il frontend

1. ⚙️ **Impostazioni progetto** (ingranaggio in alto a sinistra)
2. Tab **"Generali"** → scorri fino a **"Le tue app"**
3. Clicca **"Aggiungi app"** → icona **</>** (Web)
4. Nickname: `sorgyai-web` → **"Registra app"**
5. **Copia i valori** da `firebaseConfig` — ti servono nel passo 6

```javascript
// Esempio di quello che vedrai:
const firebaseConfig = {
  apiKey:            "AIzaSyXXXXXXXXXXXX",       // ← VITE_FIREBASE_API_KEY
  authDomain:        "sorgyai.firebaseapp.com",    // ← VITE_FIREBASE_AUTH_DOMAIN
  projectId:         "sorgyai",                    // ← VITE_FIREBASE_PROJECT_ID
  storageBucket:     "sorgyai.appspot.com",        // ← VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789012",               // ← VITE_FIREBASE_MESSAGING_SENDER_ID
  appId:             "1:123456789012:web:abc123",  // ← VITE_FIREBASE_APP_ID
};
```

### 3e. Genera il Service Account (per il backend)

1. ⚙️ Impostazioni progetto → tab **"Account di servizio"**
2. Sezione **"Firebase Admin SDK"** → **"Genera nuova chiave privata"**
3. Conferma → scarica il file `.json`
4. **Salvalo fuori dalla cartella del progetto** (es. `~/sorgyai-adminsdk.json`)

---

## 4. Setup Cloudflare

### 4a. Crea il database D1

```bash
cd sorgyai-monorepo/backend

# Crea il database
npx wrangler d1 create sorgyai-db
```

Output:
```
✅ Successfully created DB 'sorgyai-db'

[[d1_databases]]
binding = "DB"
database_name = "sorgyai-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   ← COPIA QUESTO
```

**Apri `backend/wrangler.toml`** e incolla il `database_id`:
```toml
[[d1_databases]]
binding       = "DB"
database_name = "sorgyai-db"
database_id   = "INCOLLA-QUI-IL-TUO-DATABASE-ID"
```

### 4b. Crea il KV Namespace

```bash
npx wrangler kv:namespace create CHATBOT_CONFIG_CACHE
```

Output:
```
add the following to your wrangler.toml:
[[kv_namespaces]]
binding = "CHATBOT_CONFIG_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"   ← COPIA QUESTO
```

```bash
# Crea anche il preview namespace (per dev locale)
npx wrangler kv:namespace create CHATBOT_CONFIG_CACHE --preview
# → copia il preview_id
```

**Aggiorna `backend/wrangler.toml`**:
```toml
[[kv_namespaces]]
binding    = "CHATBOT_CONFIG_CACHE"
id         = "INCOLLA-QUI-IL-TUO-KV-ID"
preview_id = "INCOLLA-QUI-IL-TUO-PREVIEW-ID"
```

### 4c. Applica lo schema del database

```bash
# Database locale (per dev)
npx wrangler d1 execute sorgyai-db --local --file=schema.sql

# Database di produzione
npx wrangler d1 execute sorgyai-db --file=schema.sql
```

Output atteso:
```
✅ Executed 3 statements
```

---

## 5. Setup OpenAI

1. Vai su **platform.openai.com**
2. Menu **"API Keys"** → **"Create new secret key"**
3. Nome: `sorgyai-backend`
4. **Copia la chiave** (inizia con `sk-proj-...`) — la vedrai solo una volta!
5. Assicurati di avere credito disponibile (anche $5 bastano per il Phase 1)

---

## 6. Configura i file di ambiente

### 6a. Frontend — `frontend/.env.local`

```bash
cd sorgyai-monorepo/frontend
cp .env.local.example .env.local
```

Apri `.env.local` e incolla i valori copiati al passo 3d:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=il-tuo-progetto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=il-tuo-progetto
VITE_FIREBASE_STORAGE_BUCKET=il-tuo-progetto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

### 6b. Backend — `backend/.dev.vars`

```bash
cd sorgyai-monorepo/backend
```

Crea il file `.dev.vars` con i due secret necessari:

```bash
# Step 1: aggiungi la OpenAI API Key
echo "OPENAI_API_KEY=sk-proj-INCOLLA-LA-TUA-KEY-QUI" > .dev.vars

# Step 2: aggiungi il Firebase Service Account in una sola riga
# (sostituisci il percorso con quello reale del tuo file .json)
node -e "
const fs = require('fs');
const json = JSON.parse(fs.readFileSync('$HOME/sorgyai-adminsdk.json', 'utf8'));
console.log('FIREBASE_SERVICE_ACCOUNT=' + JSON.stringify(json));
" >> .dev.vars
```

Verifica che `.dev.vars` contenga entrambe le righe:
```bash
grep -c "=" .dev.vars   # deve stampare 2
```

### 6c. Carica i secret su Cloudflare (produzione)

```bash
cd sorgyai-monorepo/backend

# OpenAI Key
npx wrangler secret put OPENAI_API_KEY
# → incolla la key quando richiesto

# Firebase Service Account
cat $HOME/sorgyai-adminsdk.json | npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
```

Verifica:
```bash
npx wrangler secret list
# Deve mostrare: OPENAI_API_KEY e FIREBASE_SERVICE_ACCOUNT
```

---

## 7. Inizializza il database D1

Il comando del passo 4c ha già creato le tabelle. Verifica:

```bash
cd sorgyai-monorepo/backend

npx wrangler d1 execute sorgyai-db --local \
  --command="SELECT name FROM sqlite_master WHERE type='table';"
```

Output atteso:
```
┌──────────────────┐
│ name             │
├──────────────────┤
│ agents           │
│ leads            │
│ analytics_daily  │
└──────────────────┘
```

Se le tabelle non ci sono, riesegui:
```bash
npx wrangler d1 execute sorgyai-db --local --file=schema.sql
```

---

## 8. Crea il primo agente (Phase 1 Seed)

### 8a. Configura lo script di seed

```bash
cd sorgyai-monorepo/scripts
cp .env.seed.example .env.seed
```

Apri `.env.seed` e compila:

```env
OPENAI_API_KEY=sk-proj-XXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_UID=INCOLLA-IL-TUO-UID-DA-FIREBASE-AUTH   ← dal passo 3c
AGENT_EMAIL=tua@email.com
AGENT_NAME=Marco Rossi
WHATSAPP_PHONE=393471234567
CHATBOT_NAME=SorgyAI
WELCOME_MSG=Ciao! Come posso aiutarti oggi?
WORKER_BASE_URL=http://localhost:8787
```

### 8b. Esegui lo script

```bash
cd sorgyai-monorepo/scripts
npx tsx seed-agent.ts
```

Lo script:
1. Crea l'OpenAI Assistant per il tuo account
2. Crea il Vector Store e lo aggancia
3. Genera un embed token univoco
4. Stampa i valori e il comando SQL da eseguire

Output esempio:
```
═══════════════════════════════════════════════════════
  SorgyAI — Phase 1 Agent Seed Script
═══════════════════════════════════════════════════════

🤖  Creazione OpenAI Assistant per "Marco Rossi"…
✅  Assistant creato: asst_xxxxxxxxxxxxxxxxxxxxxxxx
🗃️   Creazione Vector Store…
✅  Vector Store creato e agganciato: vs_xxxxxxxxxxxxxxxx

═══════════════════════════════════════════════════════
  ✅ SETUP COMPLETATO
═══════════════════════════════════════════════════════

📋 Valori generati — SALVALI in un posto sicuro:

  Firebase UID:        abc123def456
  OpenAI Assistant ID: asst_xxxxxxxxxxxxxxxxxxxxxxxx
  OpenAI Vector Store: vs_xxxxxxxxxxxxxxxxxxxxxxxx
  Embed Token:         a1b2c3d4e5f6...
  Chat URL:            http://localhost:5173/chat/a1b2c3d4e5f6...

─────────────────────────────────────────────────────
  PASSO FINALE: esegui questo comando nel terminale

  npx wrangler d1 execute sorgyai-db --local \
    --file=../scripts/_seed_output.sql
```

### 8c. Inserisci l'agente in D1

Copia ed esegui il comando stampato dallo script:

```bash
cd sorgyai-monorepo/backend

# Database locale (dev)
npx wrangler d1 execute sorgyai-db --local \
  --file=../scripts/_seed_output.sql

# Verifica che l'agente sia stato inserito
npx wrangler d1 execute sorgyai-db --local \
  --command="SELECT id, display_name, openai_assistant_id FROM agents;"
```

### 8d. Aggiorna `wrangler.toml`

Apri `backend/wrangler.toml` e aggiorna il MASTER_ASSISTANT_ID:

```toml
[vars]
MASTER_ASSISTANT_ID = "asst_xxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## 9. Avvia in locale

Apri **tre terminali** separati:

```bash
# Terminale 1 — Frontend (React + Vite)
cd sorgyai-monorepo/frontend
npm run dev
# → http://localhost:5173

# Terminale 2 — Backend (Cloudflare Worker)
cd sorgyai-monorepo/backend
npm run dev
# → http://localhost:8787

# Terminale 3 — (opzionale) log combinati
cd sorgyai-monorepo
npm run dev   # avvia entrambi con concurrently
```

Oppure con un solo comando dalla root:
```bash
cd sorgyai-monorepo
npm run dev
```

### Verifica che tutto funzioni

```bash
# Health check del Worker
curl http://localhost:8787/api/health
# → {"ok":true,"service":"SorgyAI Backend","environment":"development"}

# Frontend
open http://localhost:5173
# → deve mostrare il redirect a /login
```

### Flusso di test completo

1. **Login** → `http://localhost:5173/login`
   - Email e password del tuo utente Firebase (passo 3c)
   - Deve reindirizzare a `/dashboard/leads`

2. **Chatbot pubblico** → `http://localhost:5173/chat/[embed-token]`
   - Il token è quello stampato dallo script di seed
   - Deve mostrare il widget di chat

3. **Dashboard** → `/dashboard/leads` e `/dashboard/scripts`
   - Lead Hub: tabella vuota (nessun lead ancora)
   - Objection AI: inserisci un'obiezione e premi genera

---

## 10. Deploy in produzione

### 10a. Build e deploy del Worker

```bash
cd sorgyai-monorepo/backend

# Deploy su Cloudflare Edge
npx wrangler deploy
```

Output:
```
✅ Deployed to: https://sorgyai-backend.your-subdomain.workers.dev
```

### 10b. Aggiorna CORS in `wrangler.toml`

```toml
[env.production.vars]
CORS_ORIGIN = "https://sorgyai.app"   # ← il tuo dominio frontend
```

### 10c. Build e deploy del Frontend

Il frontend è una SPA statica — puoi deploiarlo su:

**Opzione A — Cloudflare Pages (consigliato, gratuito)**
```bash
cd sorgyai-monorepo/frontend

# Build
npm run build

# Deploy su Pages
npx wrangler pages deploy dist --project-name=sorgyai-frontend
```

**Opzione B — Vercel**
```bash
cd sorgyai-monorepo/frontend
npx vercel --prod
```

### 10d. Seed in produzione

Dopo il deploy del Worker, esegui il seed sul database di produzione:

```bash
cd sorgyai-monorepo/backend

# Applica schema su D1 produzione (se non già fatto)
npx wrangler d1 execute sorgyai-db --file=schema.sql

# Inserisci l'agente
npx wrangler d1 execute sorgyai-db \
  --file=../scripts/_seed_output.sql
```

---

## 11. Troubleshooting

### ❌ "Missing script: dev"
```bash
# Assicurati di essere nella cartella giusta
cd sorgyai-monorepo   # root del monorepo
npm install           # reinstalla le dipendenze
npm run dev
```

### ❌ "Cannot find module firebase"
```bash
cd sorgyai-monorepo/frontend
npm install
```

### ❌ Il Worker risponde 404 su /api/agents/:uid
Controlla che il tuo `index.ts` abbia le route `GET /api/agents/:uid` e `GET /api/agents/by-token/:token`. Queste sono state aggiunte nell'ultimo aggiornamento — riscrivile se hai una versione precedente.

### ❌ "Agent not found" dopo il login
Il Firebase UID nel database non corrisponde all'utente con cui hai fatto login.
```bash
# Controlla il UID nel database
npx wrangler d1 execute sorgyai-db --local \
  --command="SELECT id, display_name FROM agents;"

# Controlla il UID Firebase
# → Firebase Console → Authentication → Users → colonna UID
```

### ❌ Errore OpenAI "No assistant found"
Verifica che `MASTER_ASSISTANT_ID` in `wrangler.toml` sia corretto:
```bash
# Elenca i tuoi assistant OpenAI
curl https://api.openai.com/v1/assistants \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Beta: assistants=v2" | python3 -m json.tool | grep '"id"'
```

### ❌ CORS error nel browser
In `wrangler.toml` assicurati che `CORS_ORIGIN` corrisponda all'URL del frontend:
```toml
[vars]
CORS_ORIGIN = "http://localhost:5173"   # dev
```

### ❌ Il chatbot non trova info dal catalogo
Il Vector Store è vuoto — devi caricare almeno un file catalogo. Dalla dashboard:
→ Impostazioni → sezione upload catalogo (da implementare in Phase 2)
Oppure usa l'API direttamente:
```bash
curl -X POST http://localhost:8787/api/chatbot/configure \
  -F "agentId=IL-TUO-FIREBASE-UID" \
  -F "catalog=@/percorso/tuo-catalogo.pdf"
```

---

## Riepilogo comandi utili

```bash
# Avvia tutto in locale
npm run dev

# Solo frontend
npm run dev:frontend

# Solo backend
npm run dev:backend

# Seed primo agente
cd scripts && npx tsx seed-agent.ts

# Controlla tabelle D1
cd backend && npx wrangler d1 execute sorgyai-db --local \
  --command="SELECT * FROM agents;"

# Controlla lead raccolti
cd backend && npx wrangler d1 execute sorgyai-db --local \
  --command="SELECT name, phone, status FROM leads ORDER BY created_at DESC LIMIT 10;"

# Deploy backend
cd backend && npx wrangler deploy

# Deploy frontend (Cloudflare Pages)
cd frontend && npm run build && npx wrangler pages deploy dist
```

---

*SorgyAI — AI Chatbot per Network Marketing · Powered by Cloudflare Workers + OpenAI*
