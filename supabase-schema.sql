-- ═══════════════════════════════════════════════════════════════
-- Matriz QA — Supabase Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Table: giros (each QA Matrix generation)
CREATE TABLE IF NOT EXISTS giros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  bancos_controlados INTEGER NOT NULL,
  total_records INTEGER NOT NULL,
  total_defects INTEGER NOT NULL,
  total_defect_types INTEGER NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  qa_rows JSONB NOT NULL DEFAULT '[]',
  format TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: pdca (Plan-Do-Check-Act per voice per giro)
CREATE TABLE IF NOT EXISTS pdca (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giro_id UUID NOT NULL REFERENCES giros(id) ON DELETE CASCADE,
  voz_num INTEGER NOT NULL,
  responsable TEXT DEFAULT '',
  plan BOOLEAN DEFAULT FALSE,
  do_step BOOLEAN DEFAULT FALSE,
  "check" BOOLEAN DEFAULT FALSE,
  act BOOLEAN DEFAULT FALSE,
  comments TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(giro_id, voz_num)
);

-- Enable RLS (Row Level Security) - for now, allow all access
ALTER TABLE giros ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdca ENABLE ROW LEVEL SECURITY;

-- Policies: allow all operations (open access for plant use)
CREATE POLICY "Allow all on giros" ON giros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pdca" ON pdca FOR ALL USING (true) WITH CHECK (true);

-- Index for faster PDCA lookups
CREATE INDEX IF NOT EXISTS idx_pdca_giro ON pdca(giro_id);
