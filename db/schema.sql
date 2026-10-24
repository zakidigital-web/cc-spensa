-- ========================================================
-- Schema: Cerdas Cermat IFP Suite (PostgreSQL on Neon)
-- ========================================================

-- 1. App Configuration & Settings (Fast Key-Value + Structured Config)
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Event Metadata & Identity
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
  title VARCHAR(255) NOT NULL,
  school_name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sub_title TEXT,
  chairman_name VARCHAR(150),
  jury_chief_name VARCHAR(150),
  principal_name VARCHAR(150),
  theme VARCHAR(20) DEFAULT 'dark',
  sound BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Isolated Question Banks for All 3 Stages
CREATE TABLE IF NOT EXISTS question_banks (
  id VARCHAR(100) PRIMARY KEY,
  stage VARCHAR(50) NOT NULL, -- 'penyisihan', 'semifinal', 'final'
  category VARCHAR(100),       -- Mapel kurikulum SMP, BS, PG1, PG2, Essay, Tier
  question TEXT NOT NULL,
  options JSONB,               -- Array of string choices: ["A", "B", "C", "D"]
  key_index INT,               -- 0, 1, 2, 3
  answer_key TEXT,             -- Text answer
  points INT DEFAULT 0,
  penalty INT DEFAULT 0,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_banks_stage ON question_banks(stage);
CREATE INDEX IF NOT EXISTS idx_question_banks_category ON question_banks(category);

-- 4. Tournament Stage Progression & Live States
CREATE TABLE IF NOT EXISTS stage_states (
  stage VARCHAR(50) PRIMARY KEY, -- 'penyisihan', 'semifinal', 'final'
  config JSONB NOT NULL,         -- Stage configuration rules (teams, timers, modes)
  state_data JSONB NOT NULL,     -- Live match state (scores, active round, done boxes)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Official Reports & Berita Acara Penetapan Juara
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  doc_number VARCHAR(100) UNIQUE,
  event_id VARCHAR(50) REFERENCES events(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  school_name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  finalists JSONB NOT NULL,      -- Array of top 5 finalists with rank, title, badge, score
  signatories JSONB NOT NULL,    -- Signatures of Jury, Committee Chairman, and Principal
  created_at TIMESTAMPTZ DEFAULT NOW()
);
