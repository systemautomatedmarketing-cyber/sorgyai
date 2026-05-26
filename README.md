# SorgyAI 🤖⚡

> AI Chatbot SaaS per Network Marketing e Social Selling.  
> Stack serverless a costo quasi zero — **<$5/mese per 400 utenti attivi**.

---

## Tech Stack

| Layer       | Tecnologia                                      |
|-------------|--------------------------------------------------|
| Frontend    | React 18 · TypeScript · Vite · Tailwind CSS     |
| Backend     | Cloudflare Workers (Edge, pay-per-use)          |
| Database    | Cloudflare D1 (SQLite serverless)               |
| Cache       | Cloudflare KV                                   |
| Storage     | Cloudflare R2 (cataloghi prodotti)              |
| AI Engine   | OpenAI Assistants API — `gpt-4o-mini`           |
| Auth        | Firebase Authentication                         |

---

## Data Flow

```
Visitor (Browser)
  │  
  ▼  
ChatWidget (React)          ← /chat/:agentId  (Phase 3 embed URL)
  │ POST /api/chat/message
  ▼
Cloudflare Worker (Edge)    ← CORS validated, rate-limited
  │  lookup agentId → D1   (Phase 2 multi-tenant)
  │  fetch assistantId → KV cache
  ▼
OpenAI Assistants API       ← gpt-4o-mini + RAG on product catalog
  │  streaming response
  ▼
Worker → streams back to widget
  │  saves lead to D1
  ▼
ChatWidget shows reply + "Parla con un consulente" button
  │  click → summarize thread (OpenAI)
  ▼
WhatsApp deep link: wa.me/{phone}?text={AI summary + lead info}
```

---

## Folder Structure

```
sorgyai-monorepo/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWidget.tsx        ← Feature B (lead capture + WA handoff)
│   │   │   ├── Dashboard.tsx         ← Agent dashboard shell
│   │   │   ├── LeadTable.tsx         ← Feature B (lead list)
│   │   │   └── ScriptGenerator.tsx   ← Feature C (WA closing scripts)
│   │   ├── context/
│   │   │   └── AuthContext.tsx       ← Firebase Auth state
│   │   ├── services/
│   │   │   └── api.ts                ← Worker API client
│   │   ├── types/
│   │   │   └── index.ts              ← Shared TS interfaces (DB schema)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css                 ← Glassmorphism base styles
│   ├── tailwind.config.js            ← ⭐ Electric blue / LED glow theme
│   ├── vite.config.ts
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── index.ts                  ← Cloudflare Worker API router
│   │   └── openai.ts                 ← OpenAI Assistants API wrapper
│   ├── schema.sql                    ← D1 database schema
│   ├── wrangler.toml                 ← ⭐ Worker config (D1, KV, R2, secrets)
│   ├── .dev.vars.example             ← Local secrets template
│   └── package.json
│
└── package.json                      ← Monorepo root (npm workspaces)
```

---

## Roadmap

### Phase 1 — MVP Interno (Alpha)
- [ ] Hardcode `MASTER_ASSISTANT_ID` in `wrangler.toml`
- [ ] Implement `backend/src/openai.ts` (thread + streaming)
- [ ] Implement `ChatWidget.tsx` with lead capture form
- [ ] Test con 5-10 utenti alpha

### Phase 2 — Team Duplication (Multi-Tenant)
- [ ] Implement D1 multi-tenant routing via `agentId` param
- [ ] Dashboard: agent settings + catalog upload
- [ ] Lead table per agent

### Phase 3 — Automated Onboarding
- [ ] Sign-up flow → auto-create OpenAI Assistant → generate `embedToken`
- [ ] Public URL: `https://sorgyai.app/chat/:embedToken`
- [ ] Copy-paste `<script>` tag for external embed

---

## Setup Rapido

```bash
# 1. Clone & install
git clone https://github.com/your-org/sorgyai-monorepo.git
cd sorgyai-monorepo && npm install

# 2. Crea D1 database
cd backend
npx wrangler d1 create sorgyai-db
# → copia il database_id in wrangler.toml

# 3. Applica schema
npx wrangler d1 execute sorgyai-db --file=schema.sql

# 4. Crea KV namespace
npx wrangler kv:namespace create CHATBOT_CONFIG_CACHE
# → copia id e preview_id in wrangler.toml

# 5. Imposta secrets
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT

# 6. Dev locale
npm run dev   # avvia frontend (5173) + worker (8787) in parallelo
```

---

## Costi Stimati (400 utenti attivi)

| Servizio             | Piano         | Costo Fisso |
|----------------------|---------------|-------------|
| Cloudflare Workers   | Free (100k/day)| $0         |
| Cloudflare D1        | Free (5M rows) | $0         |
| Cloudflare KV        | Free (100k/day)| $0         |
| Cloudflare R2        | Free (10GB)    | $0         |
| Firebase Auth        | Spark (free)   | $0         |
| OpenAI API           | Pay-per-use    | ~$2-5/mese* |

*Stimato su ~400 utenti × ~20 msg/mese × gpt-4o-mini pricing.

**Totale fisso: $0/mese. Variabile: ~$2-5/mese.**
