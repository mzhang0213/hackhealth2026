-- ── Rebound Supabase Schema ──────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS column checks.

-- ── 1. Extend existing `users` table ─────────────────────────────────────────
-- Your table has user_id int4 PK. We add supabase_id uuid for Auth linkage.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS supabase_id       UUID        UNIQUE,
  ADD COLUMN IF NOT EXISTS name              TEXT,
  ADD COLUMN IF NOT EXISTS sport             TEXT,
  ADD COLUMN IF NOT EXISTS injury_description TEXT,
  ADD COLUMN IF NOT EXISTS injury_date       TEXT,
  ADD COLUMN IF NOT EXISTS doctor_diagnosis  TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS pt_name           TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS users_supabase_id ON public.users (supabase_id);

-- ── 2. Extend existing `injury_logs` table ────────────────────────────────────
-- Body-diagram marker data. One row per marked body part per user.
ALTER TABLE public.injury_logs
  ADD COLUMN IF NOT EXISTS supabase_user_id  UUID,
  ADD COLUMN IF NOT EXISTS slug              TEXT,
  ADD COLUMN IF NOT EXISTS side              TEXT,        -- 'left' | 'right' | null
  ADD COLUMN IF NOT EXISTS status            TEXT,        -- 'pain' | 'moderate' | 'recovering'
  ADD COLUMN IF NOT EXISTS how_it_happened   TEXT,
  ADD COLUMN IF NOT EXISTS date_of_injury    TEXT,
  ADD COLUMN IF NOT EXISTS doctor_diagnosis  TEXT,
  ADD COLUMN IF NOT EXISTS initial_symptoms  TEXT,
  ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS injury_logs_user ON public.injury_logs (supabase_user_id);

-- ── 3. Extend existing `mobility_scans` table ─────────────────────────────────
-- ROM scan results from the CV pipeline.
ALTER TABLE public.mobility_scans
  ADD COLUMN IF NOT EXISTS supabase_user_id  UUID,
  ADD COLUMN IF NOT EXISTS muscle            TEXT,
  ADD COLUMN IF NOT EXISTS joint_key         TEXT,
  ADD COLUMN IF NOT EXISTS max_rom           FLOAT,
  ADD COLUMN IF NOT EXISTS average_rom       FLOAT,
  ADD COLUMN IF NOT EXISTS previous_rom      FLOAT,
  ADD COLUMN IF NOT EXISTS peak_delta        FLOAT,
  ADD COLUMN IF NOT EXISTS ml_classification INTEGER,
  ADD COLUMN IF NOT EXISTS ml_status         TEXT,
  ADD COLUMN IF NOT EXISTS ai_message        TEXT,
  ADD COLUMN IF NOT EXISTS scanned_at        TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS mobility_scans_user ON public.mobility_scans (supabase_user_id);

-- ── 4. Exercises (daily rehab protocol + weekly schedule) ─────────────────────
CREATE TABLE IF NOT EXISTS exercises (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        TEXT        NOT NULL,
    name           TEXT        NOT NULL,
    sets           INTEGER     NOT NULL DEFAULT 3,
    reps           INTEGER     NOT NULL DEFAULT 15,
    duration       TEXT,
    cat            TEXT        NOT NULL DEFAULT 'mobility',
    accent_color   TEXT        NOT NULL DEFAULT '#00d4ff',
    is_rehab       BOOLEAN     NOT NULL DEFAULT FALSE,
    scheduled_date DATE        NOT NULL,
    completed      BOOLEAN     NOT NULL DEFAULT FALSE,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exercises_user_date ON exercises (user_id, scheduled_date);

-- ── 5. Daily pain / symptom check-ins ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkins (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT        NOT NULL,
    pain_level  INTEGER     NOT NULL CHECK (pain_level BETWEEN 0 AND 10),
    symptoms    TEXT[]      NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checkins_user_date ON checkins (user_id, created_at DESC);

-- ── 6. Weekly recovery metrics ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recovery_metrics (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        TEXT        NOT NULL,
    week_label     TEXT        NOT NULL,
    pain_score     FLOAT       NOT NULL DEFAULT 0,
    mobility_score FLOAT       NOT NULL DEFAULT 0,
    strength_score FLOAT       NOT NULL DEFAULT 0,
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS metrics_user_date ON recovery_metrics (user_id, recorded_at);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable on all tables. FastAPI uses the service key → bypasses RLS.
-- Prevents the anon key (embedded in the mobile app) from reading raw data.
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises             ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_metrics      ENABLE ROW LEVEL SECURITY;
