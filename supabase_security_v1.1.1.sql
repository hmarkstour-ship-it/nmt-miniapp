-- NMT v1.1.1 — Supabase hardening
-- Run ONCE in Supabase > SQL Editor after deploying the backend update.
-- The Mini App does not need direct anon/authenticated access to these tables;
-- the Node backend connects to Postgres directly through DATABASE_URL.

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users',
    'app_sessions',
    'question_history',
    'question_bank',
    'question_blueprints',
    'exam_blueprints',
    'user_answers',
    'question_reports',
    'nmt_exam_attempts',
    'nmt_item_events',
    'nmt_item_calibration',
    'nmt_calibration_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', t);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;

-- Revoke direct sequence access used by SERIAL/BIGSERIAL tables.
DO $$
DECLARE
  s text;
  sequences text[] := ARRAY[
    'question_history_id_seq',
    'question_bank_id_seq',
    'user_answers_id_seq',
    'question_reports_id_seq',
    'nmt_exam_attempts_id_seq',
    'nmt_item_events_id_seq',
    'nmt_calibration_runs_id_seq'
  ];
BEGIN
  FOREACH s IN ARRAY sequences LOOP
    IF to_regclass(format('public.%I', s)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE public.%I FROM anon', s);
      EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE public.%I FROM authenticated', s);
    END IF;
  END LOOP;
END $$;

-- Keep future public tables closed by default when they are created by the
-- current migration/owner role. (Safe to run even if no future tables are added.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;

-- Verification: all listed tables should show row_security = true.
SELECT c.relname AS table_name, c.relrowsecurity AS row_security
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'users','app_sessions','question_history','question_bank','question_blueprints',
    'exam_blueprints','user_answers','question_reports','nmt_exam_attempts',
    'nmt_item_events','nmt_item_calibration','nmt_calibration_runs'
  )
ORDER BY c.relname;
