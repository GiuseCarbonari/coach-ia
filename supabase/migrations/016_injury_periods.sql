-- Migration 016: injury_periods su athlete_profiles
-- Array di periodi infortunio {start: YYYY-MM-DD, end: YYYY-MM-DD, note?: string}
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS injury_periods jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.athlete_profiles.injury_periods IS
  'Array di {start: YYYY-MM-DD, end: YYYY-MM-DD, note?: string}';
