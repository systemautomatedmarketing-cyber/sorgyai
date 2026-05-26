-- ============================================================
-- SorgyAI — Cloudflare D1 Database Schema
-- Apply with: wrangler d1 execute sorgyai-db --file=schema.sql
-- ============================================================

-- ----------------------------------------------------------
-- AGENTS (Users)
-- Phase 1: 5-10 alpha users inserted manually.
-- Phase 2: populated via API on signup.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
  id                   TEXT PRIMARY KEY,   -- Firebase UID
  email                TEXT NOT NULL UNIQUE,
  display_name         TEXT NOT NULL,
  whatsapp_phone       TEXT NOT NULL,      -- "393471234567"
  openai_assistant_id  TEXT NOT NULL,
  chatbot_name         TEXT NOT NULL DEFAULT 'SorgyAI',
  chatbot_welcome_msg  TEXT NOT NULL DEFAULT 'Ciao! Come posso aiutarti?',
  catalog_file_ids     TEXT NOT NULL DEFAULT '[]',  -- JSON array of OpenAI File IDs
  embed_token          TEXT NOT NULL UNIQUE,         -- Phase 3: /chat/:token
  plan                 TEXT NOT NULL DEFAULT 'alpha' CHECK(plan IN ('alpha','free','pro')),
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

-- ----------------------------------------------------------
-- LEADS
-- Captured from chat widget; one row per captured visitor.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id                    TEXT PRIMARY KEY,
  agent_id              TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL DEFAULT '',
  phone                 TEXT NOT NULL DEFAULT '',
  intent_summary        TEXT NOT NULL DEFAULT '',
  conversation_summary  TEXT NOT NULL DEFAULT '',
  thread_id             TEXT NOT NULL,      -- OpenAI Thread ID
  status                TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','closed')),
  source                TEXT NOT NULL DEFAULT 'widget' CHECK(source IN ('widget','link','embed')),
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_agent_id   ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- ----------------------------------------------------------
-- ANALYTICS
-- One row per agent per day — simple counters.
-- Used to monitor scaling toward 300-400 user quota ceiling.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_daily (
  id                  TEXT PRIMARY KEY,  -- "{agent_id}::{YYYY-MM-DD}"
  agent_id            TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  date                TEXT NOT NULL,     -- "YYYY-MM-DD"
  messages_in         INTEGER NOT NULL DEFAULT 0,
  messages_out        INTEGER NOT NULL DEFAULT 0,
  leads_created       INTEGER NOT NULL DEFAULT 0,
  whatsapp_handoffs   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(agent_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_agent_date ON analytics_daily(agent_id, date DESC);
