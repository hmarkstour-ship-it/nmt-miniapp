import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import 'dotenv/config';
import { NMT_META, getTopic, getPublicTopics, QUESTION_BLUEPRINTS, EXAM_SLOTS } from './nmt-knowledge.js';
import { QUESTION_ENGINE_VERSION as GENERATOR_VERSION, generateTrainingChoice, validateQuestion as validateDeterministicQuestion, questionSkeleton } from './nmt-engine/generation/question-generator.js';
import { NMT_EXAM_META, generateNmtExam, sanitizeExamQuestions, gradeNmtExam, scoreToScale } from './nmt-exam-engine.js';
import { loadRuntimeBank, OfflineQuestionBankRuntime, RUNTIME_VERSION } from './nmt-engine/runtime/index.js';
import { VISUAL_ENGINE_VERSION } from './nmt-engine/visuals/visual-spec.js';
import {
  MOCK_ENGINE_VERSION,
  createMockAttemptSnapshot,
  verifyQuestionSnapshot,
  normalizeMockAnswer,
  normalizeMockAnswers,
  applyAnswerRevision,
  remainingSeconds as mockRemainingSeconds,
  isAttemptExpired,
  auditGradeResult,
  gradeResultHash,
  validateMockAttemptContract,
} from './nmt-engine/mock/index.js';
import {
  ANALYTICS_VERSION,
  createTrainingTelemetry,
  createMockTelemetryEvents,
  buildUserTopicAnalytics,
} from './nmt-engine/analytics/index.js';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const PROJECT_ROOT = fileURLToPath(new URL('.', import.meta.url));
const RUNTIME_FALLBACK_ENABLED = /^(1|true|yes)$/i.test(String(process.env.NMT_RUNTIME_FALLBACK || 'false'));
const TRAINING_VISUAL_MODE = ['plain', 'visual', 'any'].includes(process.env.NMT_TRAINING_VISUAL_MODE)
  ? process.env.NMT_TRAINING_VISUAL_MODE
  : 'any';
const STAGE10_AUTO_QUARANTINE = /^(1|true|yes)$/i.test(String(process.env.NMT_STAGE10_AUTO_QUARANTINE || 'false'));
const ADMIN_PANEL_PASSWORD = String(process.env.ADMIN_PANEL_PASSWORD || '').trim();
const ADMIN_PANEL_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const adminTokens = new Map();
const adminLoginAttempts = new Map();

let offlineBankRuntime = null;
let offlineBankLoadError = null;
try {
  const loaded = loadRuntimeBank({ root: PROJECT_ROOT, bankPath: process.env.NMT_OFFLINE_BANK_PATH || null });
  offlineBankRuntime = new OfflineQuestionBankRuntime(loaded.bank, { bankPath: loaded.path });
  console.log(`✅ NMT Engine core v${GENERATOR_VERSION}, visual v${VISUAL_ENGINE_VERSION}, runtime v${RUNTIME_VERSION}: offline bank loaded (${loaded.itemCount} items)`);
} catch (err) {
  offlineBankLoadError = err;
  console.error(`❌ NMT Engine 4 runtime: ${err.message}`);
}

if (!GEMINI_API_KEY) {
  console.warn(
    '⚠️  GEMINI_API_KEY не знайдено в .env — тренувальні завдання працюватимуть, але AI-пояснення будуть недоступні.'
  );
}
if (!DATABASE_URL) {
  console.warn(
    '⚠️  DATABASE_URL не знайдено в .env — прогрес і захист від повторів завдань працювати не будуть.'
  );
}
if (!BOT_TOKEN) {
  console.warn(
    '⚠️  BOT_TOKEN не знайдено в .env — не можемо перевірити, хто саме користувач, прогрес не зберігатиметься.'
  );
}

// ---- База даних ---------------------------------------------------------------

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function initDb() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      first_name TEXT,
      correct_count INT NOT NULL DEFAULT 0,
      wrong_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      session_id TEXT PRIMARY KEY,
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_app_sessions_activity
    ON app_sessions (last_seen_at DESC, telegram_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_history (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id),
      topic TEXT NOT NULL,
      question_text TEXT NOT NULL,
      asked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_history_user_topic
    ON question_history (telegram_id, topic, asked_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_bank (
      id SERIAL PRIMARY KEY,
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'середній',
      question_text TEXT NOT NULL,
      question_json JSONB NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT true,
      is_active BOOLEAN NOT NULL DEFAULT true,
      use_count INT NOT NULL DEFAULT 0,
      report_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    ALTER TABLE question_bank
    ADD COLUMN IF NOT EXISTS verification_version INT NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE question_bank
      ADD COLUMN IF NOT EXISTS blueprint_id TEXT,
      ADD COLUMN IF NOT EXISTS generator_version INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS has_diagram BOOLEAN NOT NULL DEFAULT false;
  `);

  await pool.query(`
    ALTER TABLE question_bank
      ADD COLUMN IF NOT EXISTS offline_bank_id TEXT,
      ADD COLUMN IF NOT EXISTS content_hash TEXT,
      ADD COLUMN IF NOT EXISTS factory_version INT;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_offline_id
    ON question_bank (offline_bank_id)
    WHERE offline_bank_id IS NOT NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_blueprints (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      subtopic TEXT,
      skill TEXT,
      formats JSONB NOT NULL DEFAULT '[]'::jsonb,
      mock_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
      diagram_type TEXT,
      source_confidence INT NOT NULL DEFAULT 2,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS exam_blueprints (
      year INT NOT NULL,
      slot INT NOT NULL,
      question_type TEXT NOT NULL,
      max_score INT NOT NULL,
      blueprint_ids JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (year, slot)
    );
  `);

  for (const bp of QUESTION_BLUEPRINTS) {
    await pool.query(
      `INSERT INTO question_blueprints
        (id, topic, subtopic, skill, formats, mock_slots, diagram_type, source_confidence, metadata, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9::jsonb,now())
       ON CONFLICT (id) DO UPDATE SET
         topic=EXCLUDED.topic,
         subtopic=EXCLUDED.subtopic,
         skill=EXCLUDED.skill,
         formats=EXCLUDED.formats,
         mock_slots=EXCLUDED.mock_slots,
         diagram_type=EXCLUDED.diagram_type,
         source_confidence=EXCLUDED.source_confidence,
         metadata=EXCLUDED.metadata,
         updated_at=now()`,
      [bp.id, bp.topic, bp.subtopic || null, bp.skill || null, JSON.stringify(bp.formats || []), JSON.stringify(bp.mock_slots || []), bp.diagram_type || null, bp.source_confidence || 2, JSON.stringify(bp)]
    );
  }

  for (const slot of EXAM_SLOTS) {
    await pool.query(
      `INSERT INTO exam_blueprints (year, slot, question_type, max_score, blueprint_ids, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,now())
       ON CONFLICT (year, slot) DO UPDATE SET
         question_type=EXCLUDED.question_type,
         max_score=EXCLUDED.max_score,
         blueprint_ids=EXCLUDED.blueprint_ids,
         updated_at=now()`,
      [NMT_META.year, slot.slot, slot.type, slot.max_score, JSON.stringify(slot.blueprint_ids)]
    );
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_question_bank_pick
    ON question_bank (topic, difficulty, is_active, verified, verification_version, use_count);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_unique_text
    ON question_bank (topic, question_text);
  `);

  // Старі AI-завдання більше не віддаємо: банк версії нижче поточного генератора вимикаємо.
  await pool.query(
    `UPDATE question_bank SET is_active = false WHERE verification_version < $1`,
    [BANK_VERIFICATION_VERSION]
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_answers (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id),
      topic TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL,
      question_bank_id INT REFERENCES question_bank(id) ON DELETE SET NULL,
      answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_answers_profile
    ON user_answers (telegram_id, answered_at DESC);
  `);


  await pool.query(`
    ALTER TABLE user_answers
      ADD COLUMN IF NOT EXISTS client_answer_id TEXT,
      ADD COLUMN IF NOT EXISTS selected_index INT,
      ADD COLUMN IF NOT EXISTS response_ms INT;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_answers_client_answer
    ON user_answers (telegram_id, client_answer_id)
    WHERE client_answer_id IS NOT NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_reports (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT REFERENCES users(telegram_id),
      question_bank_id INT REFERENCES question_bank(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      question_snapshot JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS nmt_exam_attempts (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id),
      status TEXT NOT NULL DEFAULT 'in_progress',
      questions JSONB NOT NULL,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ,
      raw_score INT,
      scaled_score INT,
      weak_topics JSONB,
      result_json JSONB
    );
  `);

  await pool.query(`
    ALTER TABLE nmt_exam_attempts
      ADD COLUMN IF NOT EXISTS mock_engine_version INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS runtime_version INT,
      ADD COLUMN IF NOT EXISTS bank_schema_version TEXT,
      ADD COLUMN IF NOT EXISTS factory_version INT,
      ADD COLUMN IF NOT EXISTS question_snapshot_hash TEXT,
      ADD COLUMN IF NOT EXISTS result_hash TEXT,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS answer_revisions JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS revision INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS assembly_meta JSONB,
      ADD COLUMN IF NOT EXISTS client_session_id TEXT;
  `);

  await pool.query(`
    UPDATE nmt_exam_attempts
    SET expires_at = started_at + (${NMT_EXAM_META.durationMinutes} * interval '1 minute')
    WHERE expires_at IS NULL;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nmt_exam_attempts_user_status
    ON nmt_exam_attempts (telegram_id, status, started_at DESC);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_nmt_exam_attempts_client_session
    ON nmt_exam_attempts (telegram_id, client_session_id)
    WHERE client_session_id IS NOT NULL;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_question_reports_one_per_user
    ON question_reports (telegram_id, question_bank_id)
    WHERE question_bank_id IS NOT NULL;
  `);


  // Stage 10 — calibration + analytics telemetry.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nmt_item_events (
      id BIGSERIAL PRIMARY KEY,
      event_key TEXT NOT NULL UNIQUE,
      analytics_version INT NOT NULL DEFAULT 10,
      telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE SET NULL,
      mode TEXT NOT NULL,
      item_id TEXT,
      question_bank_id INT REFERENCES question_bank(id) ON DELETE SET NULL,
      attempt_id BIGINT REFERENCES nmt_exam_attempts(id) ON DELETE SET NULL,
      question_index INT,
      topic TEXT NOT NULL DEFAULT 'mixed',
      blueprint_id TEXT,
      question_type TEXT,
      is_correct BOOLEAN,
      score_awarded NUMERIC,
      max_score NUMERIC,
      score_fraction NUMERIC,
      selected_index INT,
      response_ms INT,
      ability_proxy NUMERIC,
      model_difficulty_score NUMERIC,
      engine_version INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nmt_item_events_item
    ON nmt_item_events (item_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nmt_item_events_user_topic
    ON nmt_item_events (telegram_id, topic, created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nmt_item_calibration (
      item_id TEXT PRIMARY KEY,
      topic TEXT,
      blueprint_id TEXT,
      question_type TEXT,
      sample_count INT NOT NULL DEFAULT 0,
      training_count INT NOT NULL DEFAULT 0,
      mock_count INT NOT NULL DEFAULT 0,
      raw_p NUMERIC,
      smoothed_p NUMERIC,
      model_difficulty_score NUMERIC,
      empirical_difficulty_score NUMERIC,
      blended_difficulty_score NUMERIC,
      confidence NUMERIC,
      discrimination NUMERIC,
      discrimination_n INT NOT NULL DEFAULT 0,
      median_response_ms INT,
      p90_response_ms INT,
      selected_index_hist JSONB NOT NULL DEFAULT '{}'::jsonb,
      quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'collecting',
      analytics_version INT NOT NULL DEFAULT 10,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nmt_item_calibration_status
    ON nmt_item_calibration (status, sample_count DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nmt_calibration_runs (
      id BIGSERIAL PRIMARY KEY,
      analytics_version INT NOT NULL,
      event_count INT NOT NULL,
      item_count INT NOT NULL,
      status_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  console.log('✅ Таблиці бази даних готові.');
}

async function getOrCreateUser(telegramUser) {
  if (!pool || !telegramUser?.id) return null;

  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, first_name, last_seen_at)
     VALUES ($1, $2, now())
     ON CONFLICT (telegram_id) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_seen_at = now()
     RETURNING telegram_id, first_name, correct_count, wrong_count, created_at, last_seen_at`,
    [telegramUser.id, telegramUser.first_name || null]
  );
  return rows[0];
}

async function getRecentQuestions(telegramId, topic, limit = 12) {
  if (!pool || !telegramId) return [];

  if (topic === 'mixed') {
    const { rows } = await pool.query(
      `SELECT question_text FROM question_history
       WHERE telegram_id = $1
       ORDER BY asked_at DESC
       LIMIT $2`,
      [telegramId, limit]
    );
    return rows.map((r) => r.question_text);
  }

  const { rows } = await pool.query(
    `SELECT question_text FROM question_history
     WHERE telegram_id = $1 AND topic = $2
     ORDER BY asked_at DESC
     LIMIT $3`,
    [telegramId, topic, limit]
  );
  return rows.map((r) => r.question_text);
}

async function saveQuestionToHistory(telegramId, topic, questionText) {
  if (!pool || !telegramId) return;
  await pool.query(
    `INSERT INTO question_history (telegram_id, topic, question_text) VALUES ($1, $2, $3)`,
    [telegramId, topic, questionText]
  );
}


async function insertStage10Event(client, event) {
  if (!client || !event?.event_key || !event?.item_id) return false;
  const result = await client.query(
    `INSERT INTO nmt_item_events (
       event_key, analytics_version, telegram_id, mode, item_id, question_bank_id,
       attempt_id, question_index, topic, blueprint_id, question_type, is_correct,
       score_awarded, max_score, score_fraction, selected_index, response_ms,
       ability_proxy, model_difficulty_score, engine_version
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
     ) ON CONFLICT (event_key) DO NOTHING`,
    [
      event.event_key, ANALYTICS_VERSION, event.telegram_id, event.mode, event.item_id,
      event.question_bank_id, event.attempt_id, event.question_index, event.topic || 'mixed',
      event.blueprint_id, event.question_type, event.is_correct, event.score_awarded,
      event.max_score, event.score_fraction, event.selected_index, event.response_ms,
      event.ability_proxy, event.model_difficulty_score, event.engine_version,
    ]
  );
  return result.rowCount > 0;
}

async function insertStage10Events(client, events = []) {
  let inserted = 0;
  for (const event of events) inserted += await insertStage10Event(client, event) ? 1 : 0;
  return inserted;
}

async function loadStage10Calibrations() {
  if (!pool || !offlineBankRuntime) return { applied: 0, quarantined: 0 };
  const { rows } = await pool.query(`
    SELECT item_id, sample_count, raw_p, smoothed_p, model_difficulty_score,
           empirical_difficulty_score, blended_difficulty_score, confidence,
           discrimination, discrimination_n, quality_flags, status, updated_at
    FROM nmt_item_calibration
  `);
  const applied = offlineBankRuntime.applyCalibrationRecords(rows, { autoQuarantine: STAGE10_AUTO_QUARANTINE });
  if (applied.applied) {
    console.log(`✅ NMT Engine Stage 10: loaded ${applied.applied} item calibrations${applied.quarantined ? `; quarantined ${applied.quarantined}` : ''}`);
  }
  return applied;
}

async function getStage10UserAnalytics(telegramId) {
  if (!pool || !telegramId) return [];
  const { rows } = await pool.query(`
    SELECT topic, score_fraction, created_at
    FROM nmt_item_events
    WHERE telegram_id = $1 AND score_fraction IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1000
  `, [telegramId]);
  return buildUserTopicAnalytics(rows);
}

async function recordAnswer(telegramId, isCorrect, topic = 'mixed', questionBankId = null, telemetry = {}) {
  if (!pool || !telegramId) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const clientAnswerId = typeof telemetry.clientAnswerId === 'string'
      ? telemetry.clientAnswerId.trim().slice(0, 128)
      : null;

    if (clientAnswerId) {
      const duplicate = await client.query(
        `SELECT id FROM user_answers WHERE telegram_id = $1 AND client_answer_id = $2 LIMIT 1`,
        [telegramId, clientAnswerId]
      );
      if (duplicate.rows.length) {
        const existing = await client.query(
          `SELECT correct_count, wrong_count FROM users WHERE telegram_id = $1`,
          [telegramId]
        );
        await client.query('COMMIT');
        return { ...(existing.rows[0] || {}), duplicate: true };
      }
    }

    let bankMeta = null;
    if (questionBankId) {
      const bankResult = await client.query(
        `SELECT id, offline_bank_id, blueprint_id, question_json
         FROM question_bank WHERE id = $1 LIMIT 1`,
        [questionBankId]
      );
      bankMeta = bankResult.rows[0] || null;
    }

    const column = isCorrect ? 'correct_count' : 'wrong_count';
    const { rows } = await client.query(
      `UPDATE users SET ${column} = ${column} + 1
       WHERE telegram_id = $1
       RETURNING correct_count, wrong_count`,
      [telegramId]
    );

    await client.query(
      `INSERT INTO user_answers (
         telegram_id, topic, is_correct, question_bank_id,
         client_answer_id, selected_index, response_ms
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        telegramId, topic || 'mixed', !!isCorrect, questionBankId || null,
        clientAnswerId,
        Number.isInteger(Number(telemetry.selectedIndex)) ? Number(telemetry.selectedIndex) : null,
        Number.isFinite(Number(telemetry.responseMs)) ? Math.max(0, Math.min(1800000, Math.round(Number(telemetry.responseMs)))) : null,
      ]
    );

    if (bankMeta?.offline_bank_id) {
      const q = bankMeta.question_json || {};
      const event = createTrainingTelemetry({
        eventKey: clientAnswerId
          ? `training:${telegramId}:${clientAnswerId}`
          : `training:${telegramId}:${crypto.randomUUID()}`,
        telegramId,
        itemId: bankMeta.offline_bank_id,
        questionBankId: bankMeta.id,
        topic: q.topic || topic || 'mixed',
        blueprintId: bankMeta.blueprint_id || q.blueprint_id || null,
        questionType: q.type || 'choice',
        isCorrect: !!isCorrect,
        selectedIndex: telemetry.selectedIndex,
        responseMs: telemetry.responseMs,
        modelDifficultyScore: q.bank_meta?.difficulty_score ?? null,
        engineVersion: q.engine_version ?? null,
      });
      await insertStage10Event(client, event);
    }

    await client.query('COMMIT');
    return { ...(rows[0] || {}), duplicate: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getQuestionFromBank(topic, difficulty, avoidList = []) {
  if (!pool) return null;

  // Беремо декілька кандидатів і фільтруємо не лише дослівні дублікати,
  // а й той самий шаблон з іншими числами.
  const { rows } = await pool.query(
    `SELECT id, question_json
     FROM question_bank
     WHERE topic = $1
       AND difficulty = $2
       AND is_active = true
       AND verified = true
       AND verification_version >= $3
     ORDER BY use_count ASC, random()
     LIMIT 24`,
    [topic, difficulty, BANK_VERIFICATION_VERSION]
  );

  const recentSkeletons = new Set((avoidList || []).map(questionSkeleton));
  const row = rows.find((candidate) => {
    const q = candidate?.question_json;
    if (!q?.question) return false;
    if ((avoidList || []).includes(q.question)) return false;
    return !recentSkeletons.has(q.question_skeleton || questionSkeleton(q.question));
  }) || rows.find((candidate) => candidate?.question_json?.question && !(avoidList || []).includes(candidate.question_json.question));

  if (!row) return null;

  await pool.query(
    `UPDATE question_bank
     SET use_count = use_count + 1, last_used_at = now()
     WHERE id = $1`,
    [row.id]
  );

  return { id: row.id, question: row.question_json };
}

async function saveQuestionToBank(topic, difficulty, question) {
  if (!pool || !question?.question) return null;

  const { rows } = await pool.query(
    `INSERT INTO question_bank
       (topic, difficulty, question_text, question_json, verified, verification_version, blueprint_id, generator_version, has_diagram)
     VALUES ($1, $2, $3, $4::jsonb, true, $5, $6, $7, $8)
     ON CONFLICT (topic, question_text)
     DO UPDATE SET
       question_json = EXCLUDED.question_json,
       verified = true,
       verification_version = EXCLUDED.verification_version,
       blueprint_id = EXCLUDED.blueprint_id,
       generator_version = EXCLUDED.generator_version,
       has_diagram = EXCLUDED.has_diagram,
       is_active = true
     RETURNING id`,
    [topic, difficulty, question.question, JSON.stringify(question), BANK_VERIFICATION_VERSION, question.blueprint_id || null, Number(question.engine_version) || BANK_VERIFICATION_VERSION, !!question.diagram_svg]
  );

  return rows[0]?.id ?? null;
}

const offlineBankDbIds = new Map();

async function ensureOfflineQuestionBankId(question) {
  if (!pool || !question?.id || !question?.question) return null;
  if (offlineBankDbIds.has(question.id)) return offlineBankDbIds.get(question.id);

  const { rows } = await pool.query(
    `INSERT INTO question_bank
       (topic, difficulty, question_text, question_json, verified, verification_version, blueprint_id, generator_version, has_diagram, offline_bank_id, content_hash, factory_version)
     VALUES ($1, $2, $3, $4::jsonb, true, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (topic, question_text)
     DO UPDATE SET
       question_json = EXCLUDED.question_json,
       verified = true,
       verification_version = EXCLUDED.verification_version,
       blueprint_id = EXCLUDED.blueprint_id,
       generator_version = EXCLUDED.generator_version,
       has_diagram = EXCLUDED.has_diagram,
       offline_bank_id = EXCLUDED.offline_bank_id,
       content_hash = EXCLUDED.content_hash,
       factory_version = EXCLUDED.factory_version
     RETURNING id, is_active`,
    [
      question.topic || 'mixed',
      question.difficulty || 'середній',
      question.question,
      JSON.stringify(question),
      BANK_VERIFICATION_VERSION,
      question.blueprint_id || null,
      Number(question.engine_version) || BANK_VERIFICATION_VERSION,
      !!question.diagram_svg,
      question.id,
      question.bank_meta?.content_hash || null,
      Number(question.bank_meta?.factory_version) || null,
    ]
  );

  const id = rows[0]?.id ?? null;
  if (id) offlineBankDbIds.set(question.id, id);
  if (rows[0]?.is_active === false) offlineBankRuntime?.disable(question.id);
  return id;
}

function compactNmtQuestionMemory(question) {
  if (!question || typeof question !== 'object') return null;
  const meta = question.bank_meta || {};
  const genome = meta.genome || question.genome || {};
  return {
    id: typeof question.id === 'string' ? question.id : null,
    topic: question.topic || genome.topic || null,
    family: meta.family || question.blueprint_id || genome.family || null,
    skeleton_hash: meta.skeleton_hash || null,
    genome_signature: meta.genome_signature || question.engine4?.evaluation?.genome_signature || null,
    solution_path: meta.solution_path || (Array.isArray(genome.solution_path) ? genome.solution_path.join('>') : null),
    concept: genome.concept || null,
    representation: meta.representation || genome.representation || question.type || null,
  };
}

async function getRecentNmtQuestionMemory(telegramId, limitAttempts = 8) {
  if (!pool || !telegramId) return { ids: [], items: [] };
  const { rows } = await pool.query(
    `SELECT questions
     FROM nmt_exam_attempts
     WHERE telegram_id = $1
     ORDER BY started_at DESC
     LIMIT $2`,
    [telegramId, Math.max(1, Math.min(12, Number(limitAttempts) || 8))]
  );

  const items = [];
  for (const row of rows) {
    const questions = Array.isArray(row.questions) ? row.questions : [];
    for (const question of questions) {
      const memory = compactNmtQuestionMemory(question);
      if (memory) items.push(memory);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const key = [
      item.id || '', item.skeleton_hash || '', item.genome_signature || '',
      item.family || '', item.solution_path || '', item.concept || '', item.topic || '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return {
    ids: [...new Set(unique.map((item) => item.id).filter(Boolean))],
    items: unique,
  };
}

async function syncOfflineBankDisabledState() {
  if (!pool || !offlineBankRuntime) return;
  const { rows } = await pool.query(
    `SELECT offline_bank_id
     FROM question_bank
     WHERE offline_bank_id IS NOT NULL AND is_active = false`
  );
  offlineBankRuntime.disableMany(rows.map((row) => row.offline_bank_id).filter(Boolean));
}

async function countStrictBankQuestions(topic, difficulty) {
  if (!pool) return 0;
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM question_bank
     WHERE topic = $1
       AND difficulty = $2
       AND is_active = true
       AND verified = true
       AND verification_version >= $3`,
    [topic, difficulty, BANK_VERIFICATION_VERSION]
  );
  return Number(rows[0]?.count) || 0;
}

async function getStrictBankTexts(topic, difficulty, limit = 24) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT question_text
     FROM question_bank
     WHERE topic = $1 AND difficulty = $2 AND is_active = true
     ORDER BY created_at DESC
     LIMIT $3`,
    [topic, difficulty, limit]
  );
  return rows.map((row) => row.question_text).filter(Boolean);
}

async function getProfileData(telegramId) {
  if (!pool || !telegramId) return null;

  const userResult = await pool.query(
    `SELECT telegram_id, first_name, correct_count, wrong_count, created_at
     FROM users WHERE telegram_id = $1`,
    [telegramId]
  );

  const user = userResult.rows[0];
  if (!user) return null;

  const statsResult = await pool.query(
    `SELECT topic, COUNT(*)::int AS total,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct
     FROM user_answers
     WHERE telegram_id = $1
     GROUP BY topic
     ORDER BY total DESC`,
    [telegramId]
  );

  const activityResult = await pool.query(
    `SELECT DISTINCT to_char(answered_at AT TIME ZONE 'Europe/Kyiv', 'YYYY-MM-DD') AS day
     FROM user_answers
     WHERE telegram_id = $1
     ORDER BY day DESC
     LIMIT 370`,
    [telegramId]
  );

  const recentResult = await pool.query(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct
     FROM user_answers
     WHERE telegram_id = $1
       AND answered_at >= now() - interval '7 days'`,
    [telegramId]
  );

  const examResult = await pool.query(
    `SELECT COUNT(*)::int AS completed,
            (SELECT finished_at FROM nmt_exam_attempts x
             WHERE x.telegram_id = $1 AND x.status = 'finished'
             ORDER BY finished_at DESC LIMIT 1) AS last_finished_at,
            (SELECT scaled_score FROM nmt_exam_attempts x
             WHERE x.telegram_id = $1 AND x.status = 'finished' AND x.scaled_score IS NOT NULL
             ORDER BY finished_at DESC LIMIT 1) AS last_scaled_score,
            (SELECT raw_score FROM nmt_exam_attempts x
             WHERE x.telegram_id = $1 AND x.status = 'finished' AND x.raw_score IS NOT NULL
             ORDER BY finished_at DESC LIMIT 1) AS last_raw_score
     FROM nmt_exam_attempts
     WHERE telegram_id = $1 AND status = 'finished'`,
    [telegramId]
  );

  return {
    user,
    topicStats: statsResult.rows,
    activityDays: activityResult.rows.map((row) => row.day).filter(Boolean),
    recent7: recentResult.rows[0] || { total: 0, correct: 0 },
    examStats: examResult.rows[0] || { completed: 0, last_scaled_score: null, last_raw_score: null, last_finished_at: null },
  };
}

function kyivDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyToDayNumber(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  if (!year || !month || !day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function calculateStreaks(dayKeys = []) {
  const days = [...new Set(dayKeys.map(dateKeyToDayNumber).filter(Number.isFinite))]
    .sort((a, b) => a - b);

  if (!days.length) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] + 1) run += 1;
    else run = 1;
    if (run > best) best = run;
  }

  const today = dateKeyToDayNumber(kyivDateKey());
  const latest = days[days.length - 1];
  if (latest < today - 1) return { current: 0, best };

  let current = 1;
  for (let i = days.length - 2; i >= 0; i--) {
    if (days[i] === days[i + 1] - 1) current += 1;
    else break;
  }

  return { current, best };
}


// ---- Пробний НМТ / Stage 9 Mock Engine ----------------------------------------

const NMT_DURATION_SECONDS = NMT_EXAM_META.durationMinutes * 60;

function normalizeClientSessionId(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(text) ? text : null;
}

function nmtRemainingSeconds(attempt) {
  if (!attempt?.started_at) return 0;
  return mockRemainingSeconds({
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at || null,
    durationSeconds: NMT_DURATION_SECONDS,
  });
}

function nmtAttemptExpired(attempt) {
  if (!attempt?.started_at) return true;
  return isAttemptExpired({
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at || null,
    durationSeconds: NMT_DURATION_SECONDS,
  });
}

async function getActiveNmtAttempt(telegramId) {
  if (!pool || !telegramId) return null;
  const { rows } = await pool.query(
    `SELECT * FROM nmt_exam_attempts
     WHERE telegram_id = $1 AND status = 'in_progress'
     ORDER BY started_at DESC
     LIMIT 1`,
    [telegramId]
  );
  return rows[0] || null;
}

async function getNmtAttemptById(telegramId, attemptId) {
  if (!pool || !telegramId) return null;
  const { rows } = await pool.query(
    `SELECT * FROM nmt_exam_attempts WHERE id = $1 AND telegram_id = $2 LIMIT 1`,
    [attemptId, telegramId]
  );
  return rows[0] || null;
}

async function getNmtAttemptByClientSession(telegramId, clientSessionId) {
  if (!pool || !telegramId || !clientSessionId) return null;
  const { rows } = await pool.query(
    `SELECT * FROM nmt_exam_attempts
     WHERE telegram_id = $1 AND client_session_id = $2
     ORDER BY started_at DESC
     LIMIT 1`,
    [telegramId, clientSessionId]
  );
  return rows[0] || null;
}

function nmtAttemptPayload(attempt) {
  if (!attempt) return null;
  return {
    id: Number(attempt.id),
    status: attempt.status,
    questions: sanitizeExamQuestions(attempt.questions || []),
    answers: attempt.answers || {},
    answer_revisions: attempt.answer_revisions || {},
    started_at: attempt.started_at,
    expires_at: attempt.expires_at || null,
    server_time: new Date().toISOString(),
    duration_seconds: NMT_DURATION_SECONDS,
    remaining_seconds: nmtRemainingSeconds(attempt),
    revision: Number(attempt.revision) || 0,
    mock_engine_version: Number(attempt.mock_engine_version) || 0,
    runtime_version: attempt.runtime_version == null ? null : Number(attempt.runtime_version),
    meta: NMT_EXAM_META,
  };
}

async function finalizeNmtAttempt({ telegramId, attemptId, incomingAnswers = null }) {
  if (!pool) throw new Error('Database unavailable');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM nmt_exam_attempts
       WHERE id = $1 AND telegram_id = $2
       FOR UPDATE`,
      [attemptId, telegramId]
    );
    const attempt = rows[0] || null;
    if (!attempt) {
      await client.query('ROLLBACK');
      return null;
    }

    if (attempt.status === 'finished' && attempt.result_json) {
      await client.query('COMMIT');
      return { attempt, result: attempt.result_json, idempotent: true };
    }
    if (attempt.status !== 'in_progress') {
      await client.query('ROLLBACK');
      const error = new Error('Attempt is not active');
      error.code = 'NMT_ATTEMPT_NOT_ACTIVE';
      throw error;
    }

    const contract = validateMockAttemptContract({
      questions: attempt.questions || [],
      snapshotHash: attempt.question_snapshot_hash,
      mockEngineVersion: attempt.mock_engine_version,
    });
    if (!contract.ok) {
      await client.query(
        `UPDATE nmt_exam_attempts
         SET status = 'invalid', finished_at = now(), revision = revision + 1
         WHERE id = $1`,
        [attempt.id]
      );
      await client.query('COMMIT');
      const error = new Error(`NMT attempt integrity check failed: ${contract.errors.join(', ')}`);
      error.code = 'NMT_INTEGRITY_ERROR';
      throw error;
    }

    const answers = incomingAnswers && typeof incomingAnswers === 'object' && !Array.isArray(incomingAnswers)
      ? normalizeMockAnswers(attempt.questions || [], incomingAnswers)
      : normalizeMockAnswers(attempt.questions || [], attempt.answers || {});

    const result = gradeNmtExam(attempt.questions || [], answers);
    const audit = auditGradeResult(attempt.questions || [], answers, result, { scoreToScale });
    if (!audit.ok) {
      await client.query('ROLLBACK');
      const error = new Error(`NMT grading audit failed: ${audit.errors.join(', ')}`);
      error.code = 'NMT_GRADING_AUDIT_ERROR';
      throw error;
    }

    const resultHash = gradeResultHash({
      snapshotHash: attempt.question_snapshot_hash,
      answers,
      result,
    });

    const { rows: updatedRows } = await client.query(
      `UPDATE nmt_exam_attempts
       SET status = 'finished', finished_at = now(), answers = $3::jsonb,
           raw_score = $4, scaled_score = $5, weak_topics = $6::jsonb,
           result_json = $7::jsonb, result_hash = $8, revision = revision + 1,
           last_saved_at = now()
       WHERE id = $1 AND telegram_id = $2
       RETURNING *`,
      [
        attempt.id,
        telegramId,
        JSON.stringify(answers),
        result.raw_score,
        result.scaled_score,
        JSON.stringify(result.weak_topics),
        JSON.stringify(result),
        resultHash,
      ]
    );

    const mockTelemetryEvents = createMockTelemetryEvents({
      attemptId: Number(attempt.id),
      telegramId,
      questions: attempt.questions || [],
      answers,
      result,
    });
    await insertStage10Events(client, mockTelemetryEvents);

    await client.query('COMMIT');
    return {
      attempt: updatedRows[0] || attempt,
      result,
      audit,
      result_hash: resultHash,
      idempotent: false,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// ---- Промпти ----------------------------------------------------------------

function buildGeneratePrompt(topicKey, difficulty, avoidList = []) {
  const topic = getTopic(topicKey);

  const avoidBlock = avoidList.length
    ? `

Користувач уже бачив ці завдання. НЕ копіюй їх, НЕ перефразовуй і НЕ роби ту саму задачу з іншими числами:
${avoidList
        .map((q, i) => `${i + 1}. ${q}`)
        .join('\n')}`
    : '';

  return `Ти — укладач тренувальних завдань для НМТ-${NMT_META.year} з математики в Україні.

ОФІЦІЙНА РАМКА:
- НМТ-${NMT_META.year} з математики базується на чинній програмі ЗНО з математики.
- Офіційні великі розділи: ${NMT_META.officialSections.join('; ')}.
- У реальному НМТ є 22 завдання. Поточний режим застосунку тренує формат "одна правильна відповідь із п'яти варіантів".
- Не виходь за межі шкільної програми НМТ. Не використовуй університетську математику, олімпіадні трюки або матеріал, якого немає в програмі.

ОБРАНА ТЕМА: ${topic.label}
Межі теми: ${topic.scope}.

Дозволені навички для цієї теми:
${topic.skills.map((x) => `- ${x}`).join('\n')}

Типові ПАТЕРНИ завдань, на які можна орієнтуватися:
${topic.patterns.map((x) => `- ${x}`).join('\n')}

РІВЕНЬ СКЛАДНОСТІ: ${difficulty}.

Згенеруй ОДНЕ нове тренувальне завдання в стилі НМТ.

ЖОРСТКІ ВИМОГИ:
- Рівно 5 варіантів відповіді.
- Лише один варіант правильний. Жоден інший варіант не може бути математично еквівалентним правильному.
- Умова має бути повною й однозначною: жодних прихованих припущень, пропущених даних або двозначних формулювань.
- Завдання має однозначно належати до обраної теми.
- Правильна відповідь повинна точно бути серед 5 варіантів.
- Перед поверненням JSON самостійно перевір арифметику, правильний індекс і те, що пояснення приводить саме до позначеної відповіді.
- Неправильні варіанти мають бути правдоподібними результатами типових учнівських помилок, а не випадковими числами.
- Не копіюй дослівно реальні завдання УЦОЯО та не відтворюй їх з мінімальними змінами.
- Завдання має бути реально розв'язати приблизно за 1-3 хвилини на чернетці.
- Уникай невиправдано громіздких обчислень і довгих десяткових дробів.
- УСЮ математику оформлюй у LaTeX і завжди бери математичний вираз у delimiters \\( ... \\) для рядкового запису або \\[ ... \\] для окремого великого виразу.
- ВАЖЛИВО ДЛЯ JSON: кожен backslash у LaTeX ОБОВ'ЯЗКОВО екрануй ще одним backslash. Наприклад, у сирому JSON правильно: "Обчисліть \\\\(\\\\sqrt{9}\\\\)". Не повертай одинарні backslash усередині JSON-рядків.
- НІКОЛИ не показуй учневі програмістський запис на кшталт sqrt(9), x^2, a/b, *, <=, >=, log_2(8).
- Використовуй нормальний шкільний математичний вигляд: \\(\\sqrt{9}\\), \\(x^{2}\\), \\(\\frac{a}{b}\\), \\(a \\cdot b\\), \\(x \\le 5\\), \\(\\log_{2} 8\\).
- КОЖНА формула повинна мати повну пару delimiters. Заборонено повертати сирий LaTeX на кшталт \\frac{1}{2}, \\sqrt{5}, \\left(...\\right) без \\( ... \\) або \\[ ... \\].
- Не починай формулу зі звичайної дужки перед LaTeX-командою. Правильно: \\(\\left(\\frac{5}{6}-\\frac{3}{4}\\right)\\cdot 24\\). Неправильно: (\\left(\\frac{5}{6}... ).
- У видимому українському тексті десятковий роздільник записуй комою: 2,5; 0,75. Крапку використовуй лише там, де це не десятковий дріб.
- Звичайний текст пиши українською, а формули — LaTeX усередині \\( ... \\).
- У поясненні дай коротке, правильне, покрокове розв'язання українською мовою з таким самим акуратним математичним оформленням. Розбий пояснення на 2-5 чітких кроків і починай кожен крок з 1., 2., 3. тощо.
- Для тем, де потрібна схема/рисунок, сформулюй задачу так, щоб її можна було однозначно розв'язати БЕЗ зображення.
${avoidBlock}

Поверни ЛИШЕ валідний JSON без markdown і без тексту навколо:
{
  "question": "текст завдання",
  "options": ["варіант 1", "варіант 2", "варіант 3", "варіант 4", "варіант 5"],
  "correct_index": 0,
  "explanation": "короткий покроковий розв'язок"
}`;
}

function buildVerifyPrompt(q, topicKey) {
  const topic = getTopic(topicKey);
  const options = q.options.map((option, index) => `${index}: ${option}`).join('\n');

  return `Ти — незалежний математичний редактор НМТ. Не довіряй автору завдання і перевір усе з нуля.

ОБРАНА ТЕМА: ${topic.label}
Допустимі навички:
${topic.skills.map((x) => `- ${x}`).join('\n')}

Завдання:
${q.question}

Варіанти:
${options}

Автор позначив правильним індекс: ${q.correct_index}
Пояснення автора:
${q.explanation}

Перевір ОБОВ'ЯЗКОВО:
1. Самостійно розв'яжи завдання і визнач фактичний правильний індекс.
2. Чи є РІВНО ОДИН правильний варіант, без еквівалентного дубля.
3. Чи умова повна, однозначна і містить усі потрібні дані.
4. Чи пояснення автора математично правильне і приводить до фактичної відповіді.
5. Чи завдання відповідає обраній темі.
6. Чи воно відповідає шкільному рівню та рамкам НМТ.
7. Чи математичний запис придатний для показу учню.

Якщо є хоч найменший математичний сумнів — став відповідний boolean у false.

Поверни ЛИШЕ валідний JSON:
{
  "actual_correct_index": 0,
  "is_correct": true,
  "has_unique_answer": true,
  "condition_complete": true,
  "explanation_correct": true,
  "topic_match": true,
  "is_nmt_appropriate": true,
  "math_format_ok": true,
  "note": "коротка причина проблеми або порожній рядок"
}`;
}

function buildAuditPrompt(q, topicKey) {
  const topic = getTopic(topicKey);
  const options = q.options.map((option, index) => `${index}: ${option}`).join('\n');

  return `Ти — суворий аудитор якості математичних завдань НМТ. Твоє завдання — спробувати ЗНАЙТИ ПОМИЛКУ, а не погодитися з автором.

Тема: ${topic.label}
Умова: ${q.question}
Варіанти:\n${options}
Позначений індекс: ${q.correct_index}
Пояснення: ${q.explanation}

Перерахуй задачу незалежно. Особливо шукай: арифметичну помилку, неоднозначність, два правильні варіанти, відсутні дані, помилку в поясненні або вихід за межі НМТ.

Поверни ЛИШЕ JSON того самого формату:
{
  "actual_correct_index": 0,
  "is_correct": true,
  "has_unique_answer": true,
  "condition_complete": true,
  "explanation_correct": true,
  "topic_match": true,
  "is_nmt_appropriate": true,
  "math_format_ok": true,
  "note": "коротка причина проблеми або порожній рядок"
}`;
}


function buildExtraHelpPrompt(mode, payload) {
  const options = Array.isArray(payload.options)
    ? payload.options.map((x, i) => `${i}: ${x}`).join('\n')
    : '';

  let modeInstruction;
  if (mode === 'detailed') {
    modeInstruction = 'Поясни трохи детальніше, але без довгої лекції: 3–5 логічних кроків, коротко пояснюючи, звідки береться кожен важливий перехід.';
  } else if (mode === 'why_wrong') {
    modeInstruction = `Учень обрав варіант ${payload.selected_index}. Поясни конкретно, чому цей варіант неправильний, де найімовірніше сталася помилка, і покажи правильний шлях.`;
  } else {
    modeInstruction = 'Поясни максимально просто: 2–4 короткі кроки людською мовою. Не починай кроки словами «Використовуємо», «Підставляємо» або «Отримуємо».';
  }

  return `Ти — уважний репетитор НМТ з математики.

Завдання: ${payload.question}
Варіанти:
${options}
Правильний індекс: ${payload.correct_index}

${modeInstruction}

Правила:
- Не змінюй умову та правильну відповідь.
- Пиши українською.
- Математику оформлюй LaTeX у \\( ... \\) або \\[ ... \\].
- Один крок = одна зрозуміла думка.
- Не повторюй умову й не додавай зайву теорію.

Поверни ЛИШЕ JSON:
{
  "title": "короткий заголовок",
  "steps": ["крок 1", "крок 2", "крок 3"]
}`;
}

function buildSimilarPrompt(topicKey, difficulty, originalQuestion) {
  return `${buildGeneratePrompt(topicKey, difficulty, [originalQuestion.question])}

ДОДАТКОВА ВИМОГА:
Створи завдання на ТУ САМУ навичку й приблизно таку саму складність, що й це завдання, але з іншими числами/умовою та без копіювання формулювання:
${originalQuestion.question}`;
}

// ---- Виклик Gemini ------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Google's servers occasionally return 503 (overloaded) or 429 (rate limited).
// These are transient — retrying after a short delay usually succeeds.
const RETRYABLE_STATUSES = new Set([429, 503]);
const DEFAULT_GEMINI_RETRIES = 1;
const DEFAULT_GEMINI_TIMEOUT_MS = 12_000;
const BANK_VERIFICATION_VERSION = GENERATOR_VERSION;
const BANK_TARGET_PER_TOPIC = 12;
const bankRefillLocks = new Set();


function stripJsonCodeFence(value) {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

// Gemini інколи повертає математичний LaTeX у JSON з одинарними backslash:
// "\\(\\frac{1}{2}\\)" замість JSON-safe "\\\\(\\\\frac{1}{2}\\\\)".
// Через це звичайний JSON.parse падає (а \\frac ще й може трактуватися як JSON escape \\f).
// Ця функція акуратно екранує лише НЕекрановані backslash усередині JSON-рядків.
function repairJsonBackslashes(raw) {
  const text = stripJsonCodeFence(raw);
  let out = '';
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    if (ch === '"') {
      // Quote closes the JSON string only if it is not escaped.
      let slashCount = 0;
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) slashCount++;
      out += ch;
      if (slashCount % 2 === 0) inString = false;
      continue;
    }

    if (ch !== '\\') {
      out += ch;
      continue;
    }

    const next = text[i + 1];
    const afterNext = text[i + 2];

    // Already JSON-escaped backslash/quote/slash: keep the pair unchanged.
    if (next === '\\' || next === '"' || next === '/') {
      out += ch + next;
      i++;
      continue;
    }

    // Valid Unicode JSON escape: \\uXXXX.
    if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
      out += text.slice(i, i + 6);
      i += 5;
      continue;
    }

    // Preserve genuine JSON control escapes only when they are standalone.
    // If a letter follows (\\frac, \\right, \\times, \\neq...), it is LaTeX.
    if ('bfnrt'.includes(next) && !/[A-Za-z]/.test(afterNext || '')) {
      out += ch + next;
      i++;
      continue;
    }

    // Everything else is treated as a literal LaTeX backslash and escaped for JSON.
    out += '\\\\';
  }

  return out;
}

function parseGeminiJson(raw) {
  const clean = stripJsonCodeFence(raw);

  try {
    return JSON.parse(clean);
  } catch (firstError) {
    const repaired = repairJsonBackslashes(clean);
    try {
      const parsed = JSON.parse(repaired);
      console.warn('⚠️ Gemini JSON автоматично виправлено (LaTeX backslash escaping).');
      return parsed;
    } catch (secondError) {
      const err = new Error(`Gemini повернув некоректний JSON: ${secondError.message}`);
      err.rawPreview = clean.slice(0, 500);
      throw err;
    }
  }
}

async function callGemini(prompt, temperature = 0.5, options = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY не налаштовано на сервері');
  }

  const timeoutMs = Math.max(3000, Number(options.timeoutMs) || DEFAULT_GEMINI_TIMEOUT_MS);
  const maxRetries = Math.max(0, Number.isInteger(options.maxRetries) ? options.maxRetries : DEFAULT_GEMINI_RETRIES);
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error('Gemini повернув порожню відповідь');

        try {
          return parseGeminiJson(text);
        } catch (parseErr) {
          console.warn('⚠️ Gemini повернув некоректний JSON. Повторюємо запит...');
          if (parseErr.rawPreview) console.warn('JSON preview:', parseErr.rawPreview);
          lastError = parseErr;
          if (attempt < maxRetries) {
            await sleep(500 * Math.pow(2, attempt));
            continue;
          }
          throw lastError;
        }
      }

      const errText = await response.text();
      lastError = new Error(`Gemini API помилка ${response.status}: ${errText}`);

      if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
        await sleep(600 * Math.pow(2, attempt));
        continue;
      }

      throw lastError;
    } catch (err) {
      if (err.name === 'AbortError') {
        lastError = new Error(`Gemini не відповів за ${Math.round(timeoutMs / 1000)} секунд`);
        if (attempt < maxRetries) continue;
        throw lastError;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}


function isValidQuestion(q) {
  return (
    q &&
    typeof q.question === 'string' &&
    q.question.trim().length > 0 &&
    Array.isArray(q.options) &&
    q.options.length === 5 &&
    q.options.every((o) => typeof o === 'string' && o.trim().length > 0) &&
    new Set(q.options.map((o) => o.trim())).size === 5 &&
    Number.isInteger(q.correct_index) &&
    q.correct_index >= 0 &&
    q.correct_index <= 4 &&
    typeof q.explanation === 'string' &&
    q.explanation.trim().length > 0
  );
}


// ---- Нормалізація математичного запису ---------------------------------------
// Страховка на випадок, якщо модель інколи поверне старий текстовий формат.
// Основний формат — LaTeX у \( ... \) / \[ ... \], а ці перетворення ловлять
// найтиповіші записи на кшталт sqrt(9), log_2(8), (a+b)/2 тощо.

function normalizeLegacyMathNotation(value) {
  if (typeof value !== 'string') return value;

  let text = value;

  // sqrt(25) -> \(\sqrt{25}\)
  text = text.replace(/(?<!\\)sqrt\(([^()]+)\)/gi, (_, inside) =>
    `\\(\\sqrt{${inside}}\\)`
  );

  // log_2(8) -> \(\log_{2}\left(8\right)\)
  text = text.replace(/(?<!\\)log_([0-9a-zA-Z]+)\(([^()]+)\)/g, (_, base, inside) =>
    `\\(\\log_{${base}}\\left(${inside}\\right)\\)`
  );

  // (a+b)/2 -> \(\frac{a+b}{2}\)
  text = text.replace(/\(([^()]+)\)\s*\/\s*([0-9a-zA-Z]+)/g, (_, numerator, denominator) =>
    `\\(\\frac{${numerator}}{${denominator}}\\)`
  );

  // 3/4 або a/b -> \(\frac{3}{4}\)
  text = text.replace(/\b([0-9a-zA-Z]+)\s*\/\s*([0-9a-zA-Z]+)\b/g, (_, numerator, denominator) =>
    `\\(\\frac{${numerator}}{${denominator}}\\)`
  );

  // x^2 -> \(x^{2}\) (для простих legacy-випадків)
  text = text.replace(/\b([a-zA-Z0-9]+)\^(-?[0-9]+)\b/g, (_, base, exponent) =>
    `\\(${base}^{${exponent}}\\)`
  );

  // Зрозумілі символи навіть якщо це не було оформлено як LaTeX.
  text = text
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
    .replace(/\s\*\s/g, ' · ')
    .replace(/\bpi\b/gi, 'π');

  return text;
}

function normalizeQuestionMath(question) {
  if (!question || typeof question !== 'object') return question;

  return {
    ...question,
    question: normalizeLegacyMathNotation(question.question),
    options: Array.isArray(question.options)
      ? question.options.map(normalizeLegacyMathNotation)
      : question.options,
    explanation: normalizeLegacyMathNotation(question.explanation),
  };
}


// ---- Контроль математичного форматування -------------------------------------
// KaTeX рендерить лише формули в явних delimiters. Якщо модель повернула
// сирий LaTeX (наприклад, \\frac без \\( ... \\)), таке завдання не показуємо
// учневі — генеруємо інше.

function stripDelimitedMath(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ');
}

function hasBalancedMathDelimiters(value) {
  if (typeof value !== 'string') return true;
  const pairs = [
    [/\\\(/g, /\\\)/g],
    [/\\\[/g, /\\\]/g],
  ];
  for (const [openRe, closeRe] of pairs) {
    const opens = value.match(openRe)?.length ?? 0;
    const closes = value.match(closeRe)?.length ?? 0;
    if (opens !== closes) return false;
  }
  const dollars = value.match(/\$\$/g)?.length ?? 0;
  return dollars % 2 === 0;
}

function hasUnsafeRawMath(value) {
  if (typeof value !== 'string') return false;

  const outsideMath = stripDelimitedMath(value);
  const rawLatexCommand = /\\(?:frac|dfrac|tfrac|sqrt|left|right|cdot|times|div|log|ln|sin|cos|tan|cot|le|ge|neq|approx|pi|infty|sum|prod|overline|vec|begin|end)\b/;
  const legacyNotation = /\bsqrt\s*\(|\blog_[A-Za-z0-9]+\s*\(?|\b[A-Za-z]\s*[+−\-*/^]\s*\(?-?\d|\d\s*\^\s*\d/;
  const compactMath = /[A-Za-zА-Яа-яІіЇїЄєҐґ0-9₀-₉ₙₐₑₒₓ][A-Za-zА-Яа-яІіЇїЄєҐґ0-9₀-₉ₙₐₑₒₓ_(){}\[\]+−\-*/·×^=<>≤≥≠:%.,]{1,100}/gu;
  const hasCompactMath = [...outsideMath.matchAll(compactMath)].some(([token]) => {
    // Only reject compact fragments that clearly look like an unwrapped formula,
    // not ordinary hyphenated words or version-like text.
    const hasRelationOrPower = /[=<>≤≥≠^√]/u.test(token);
    const hasNumericOperation = /(?:\d[^\s]{0,30}[+−*/·×]|[+−*/·×][^\s]{0,30}\d)/u.test(token);
    const hasSubscriptFormula = /[A-Za-zА-Яа-яІіЇїЄєҐґ][₀-₉ₙₐₑₒₓ]/u.test(token) && /[=+−*/·×^]/u.test(token);
    return hasRelationOrPower || hasNumericOperation || hasSubscriptFormula;
  });

  return rawLatexCommand.test(outsideMath) || legacyNotation.test(outsideMath) || hasCompactMath;
}

function hasSafeQuestionMath(question) {
  if (!question || typeof question !== 'object') return false;

  const fields = [
    question.question,
    ...(Array.isArray(question.options) ? question.options : []),
    question.explanation,
    ...(Array.isArray(question.explanation_steps) ? question.explanation_steps : []),
    ...(Array.isArray(question.left) ? question.left : []),
    ...(Array.isArray(question.match_options) ? question.match_options.map((x) => x?.label) : []),
  ];

  if (question.solution && typeof question.solution === 'object') {
    fields.push(
      question.solution.given,
      question.solution.find,
      question.solution.method,
      question.solution.why,
      question.solution.answer,
      ...(Array.isArray(question.solution.steps) ? question.solution.steps : []),
    );
  }

  return fields.every((value) => hasBalancedMathDelimiters(value) && !hasUnsafeRawMath(value));
}

function verificationPasses(check, candidate) {
  const actualIndex = Number(check?.actual_correct_index);
  return (
    check?.is_correct === true &&
    check?.has_unique_answer === true &&
    check?.condition_complete === true &&
    check?.explanation_correct === true &&
    check?.topic_match === true &&
    check?.is_nmt_appropriate === true &&
    check?.math_format_ok === true &&
    Number.isInteger(actualIndex) &&
    actualIndex === candidate.correct_index
  );
}

async function strictVerifyQuestion(candidate, topicKey) {
  const prompts = [buildVerifyPrompt(candidate, topicKey), buildAuditPrompt(candidate, topicKey)];
  const results = await Promise.allSettled(
    prompts.map((prompt) => callGemini(prompt, 0, { timeoutMs: 10_000, maxRetries: 0 }))
  );

  const successful = [];
  let hardReject = false;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
      if (!verificationPasses(result.value, candidate)) hardReject = true;
    }
  }

  if (hardReject) {
    return { ok: false, checks: successful, reason: 'reviewer_rejected' };
  }

  // Для максимальної точності потрібні дві незалежні успішні перевірки.
  // Якщо одна впала технічно, робимо один короткий резервний аудит.
  if (successful.length < 2) {
    try {
      const backup = await callGemini(buildAuditPrompt(candidate, topicKey), 0, { timeoutMs: 9_000, maxRetries: 0 });
      successful.push(backup);
      if (!verificationPasses(backup, candidate)) {
        return { ok: false, checks: successful, reason: 'backup_rejected' };
      }
    } catch (err) {
      return { ok: false, checks: successful, reason: 'not_enough_reviewers' };
    }
  }

  return {
    ok: successful.length >= 2 && successful.every((check) => verificationPasses(check, candidate)),
    checks: successful,
  };
}

async function generateStrictQuestion(topic, difficulty, avoidList = [], attempts = 3, promptBuilder = null) {
  // Нова архітектура: математику створює детермінований рушій.
  // Gemini більше НЕ визначає правильну відповідь, НЕ рахує арифметику
  // і НЕ впливає на те, який варіант позначено правильним.
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const candidate = generateTrainingChoice(topic, difficulty, avoidList);

      if (!validateDeterministicQuestion(candidate)) {
        console.warn(`⚠️ Deterministic generation ${attempt}: внутрішня валідація не пройдена`);
        continue;
      }

      if (!isValidQuestion(candidate) || !hasSafeQuestionMath(candidate)) {
        console.warn(`⚠️ Deterministic generation ${attempt}: формат кандидата відхилено`);
        continue;
      }

      return candidate;
    } catch (err) {
      console.warn(`⚠️ Deterministic generation ${attempt}: ${err.message}`);
    }
  }

  return null;
}

async function refillBankOnce(topic, difficulty) {
  if (!pool) return;
  const lockKey = `${topic}:${difficulty}`;
  if (bankRefillLocks.has(lockKey)) return;
  bankRefillLocks.add(lockKey);

  try {
    const count = await countStrictBankQuestions(topic, difficulty);
    if (count >= BANK_TARGET_PER_TOPIC) return;

    const existing = await getStrictBankTexts(topic, difficulty, 24);
    const candidate = await generateStrictQuestion(topic, difficulty, existing, 2);
    if (candidate) await saveQuestionToBank(topic, difficulty, candidate);
  } catch (err) {
    console.warn('BANK REFILL ERROR:', err.message);
  } finally {
    bankRefillLocks.delete(lockKey);
  }
}

function scheduleBankRefill(topic, difficulty) {
  if (!pool) return;
  setTimeout(() => refillBankOnce(topic, difficulty), 25);
}

// ---- Перевірка Telegram initData -----------------------------------
// Документація: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return null;

  const userJson = params.get('user');
  return userJson ? JSON.parse(userJson) : null;
}

function safePasswordEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length || !left.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function adminAttemptKey(req) {
  return String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
}

function isAdminLoginRateLimited(req) {
  const key = adminAttemptKey(req);
  const now = Date.now();
  const current = adminLoginAttempts.get(key);
  if (!current || now - current.startedAt > ADMIN_LOGIN_WINDOW_MS) {
    adminLoginAttempts.set(key, { startedAt: now, count: 0 });
    return false;
  }
  return current.count >= ADMIN_LOGIN_MAX_ATTEMPTS;
}

function registerAdminLoginFailure(req) {
  const key = adminAttemptKey(req);
  const now = Date.now();
  const current = adminLoginAttempts.get(key);
  if (!current || now - current.startedAt > ADMIN_LOGIN_WINDOW_MS) {
    adminLoginAttempts.set(key, { startedAt: now, count: 1 });
  } else {
    current.count += 1;
    adminLoginAttempts.set(key, current);
  }
}

function clearAdminLoginFailures(req) {
  adminLoginAttempts.delete(adminAttemptKey(req));
}

function createAdminToken(telegramId = null) {
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, {
    telegramId: telegramId ? String(telegramId) : null,
    expiresAt: Date.now() + ADMIN_PANEL_TOKEN_TTL_MS,
  });
  return token;
}

function requireAdminToken(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const session = token ? adminTokens.get(token) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (token) adminTokens.delete(token);
    return res.status(401).json({ error: 'Адмін-сесія недійсна або завершилась.' });
  }
  req.adminSession = session;
  next();
}

// ---- Роути --------------------------------------------------------------------

app.get('/api/topics', (req, res) => {
  res.json([{ key: 'mixed', label: '🎯 Змішані завдання НМТ' }]);
});

app.post('/api/activity/heartbeat', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'База даних недоступна.' });
  try {
    const telegramUser = verifyTelegramInitData(req.body?.initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Не вдалося підтвердити Telegram-користувача.' });
    const sessionId = String(req.body?.sessionId || '').trim().slice(0, 128);
    if (!sessionId) return res.status(400).json({ error: 'Немає sessionId.' });

    await getOrCreateUser(telegramUser);
    await pool.query(
      `INSERT INTO app_sessions (session_id, telegram_id, started_at, last_seen_at)
       VALUES ($1, $2, now(), now())
       ON CONFLICT (session_id) DO UPDATE SET
         telegram_id = EXCLUDED.telegram_id,
         last_seen_at = now()`,
      [sessionId, telegramUser.id]
    );
    await pool.query(`UPDATE users SET last_seen_at = now() WHERE telegram_id = $1`, [telegramUser.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('HEARTBEAT ERROR:', err);
    res.status(500).json({ error: 'Не вдалося оновити активність.' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    if (!ADMIN_PANEL_PASSWORD) {
      return res.status(503).json({ error: 'Адмін-панель не налаштована на сервері.' });
    }
    if (isAdminLoginRateLimited(req)) {
      return res.status(429).json({ error: 'Забагато спроб. Спробуй пізніше.' });
    }

    const telegramUser = verifyTelegramInitData(req.body?.initData);
    if (BOT_TOKEN && !telegramUser?.id) {
      registerAdminLoginFailure(req);
      return res.status(401).json({ error: 'Адмін-вхід доступний лише з Telegram Mini App.' });
    }

    if (!safePasswordEqual(req.body?.password, ADMIN_PANEL_PASSWORD)) {
      registerAdminLoginFailure(req);
      return res.status(401).json({ error: 'Неправильний пароль.' });
    }

    clearAdminLoginFailures(req);
    const token = createAdminToken(telegramUser?.id || null);
    res.json({ token, expires_in: Math.floor(ADMIN_PANEL_TOKEN_TTL_MS / 1000) });
  } catch (err) {
    console.error('ADMIN LOGIN ERROR:', err);
    res.status(500).json({ error: 'Не вдалося увійти в адмін-панель.' });
  }
});

app.get('/api/admin/stats', requireAdminToken, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'База даних недоступна.' });
  try {
    const summaryQuery = await pool.query(`
      WITH activity_events AS (
        SELECT telegram_id, asked_at AS activity_at FROM question_history
        UNION ALL
        SELECT telegram_id, answered_at AS activity_at FROM user_answers
        UNION ALL
        SELECT telegram_id, started_at AS activity_at FROM nmt_exam_attempts
        UNION ALL
        SELECT telegram_id, last_seen_at AS activity_at FROM app_sessions
      )
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE last_seen_at >= now() - interval '2 minutes') AS active_now,
        (SELECT COUNT(DISTINCT telegram_id)::int FROM activity_events WHERE activity_at >= date_trunc('day', now())) AS active_today,
        (SELECT COUNT(DISTINCT telegram_id)::int FROM activity_events WHERE activity_at >= now() - interval '7 days') AS active_7d,
        (SELECT COUNT(DISTINCT telegram_id)::int FROM activity_events WHERE activity_at >= now() - interval '30 days') AS active_30d,
        (SELECT COUNT(*)::int FROM users WHERE created_at >= now() - interval '7 days') AS new_users_7d,
        (SELECT COUNT(*)::int FROM app_sessions) AS total_sessions,
        (SELECT COALESCE(ROUND((AVG(LEAST(EXTRACT(EPOCH FROM (last_seen_at - started_at)), 14400)) / 60.0)::numeric, 1), 0)
           FROM app_sessions
          WHERE started_at >= now() - interval '30 days' AND last_seen_at >= started_at) AS avg_session_minutes,
        (SELECT COUNT(*)::int FROM user_answers WHERE answered_at >= now() - interval '7 days') AS answers_7d,
        (SELECT COUNT(*)::int FROM nmt_exam_attempts WHERE status = 'finished' AND finished_at >= now() - interval '30 days') AS finished_nmt_30d
    `);

    const activityQuery = await pool.query(`
      WITH days AS (
        SELECT generate_series(current_date - interval '13 days', current_date, interval '1 day')::date AS day
      ), activity_events AS (
        SELECT telegram_id, asked_at AS activity_at FROM question_history
        UNION ALL
        SELECT telegram_id, answered_at AS activity_at FROM user_answers
        UNION ALL
        SELECT telegram_id, started_at AS activity_at FROM nmt_exam_attempts
        UNION ALL
        SELECT telegram_id, last_seen_at AS activity_at FROM app_sessions
      ), activity AS (
        SELECT date_trunc('day', activity_at)::date AS day, COUNT(DISTINCT telegram_id)::int AS users
        FROM activity_events
        WHERE activity_at >= current_date - interval '13 days'
        GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS day, COALESCE(activity.users, 0)::int AS users
      FROM days
      LEFT JOIN activity USING(day)
      ORDER BY days.day ASC
    `);

    res.json({
      generated_at: new Date().toISOString(),
      summary: summaryQuery.rows[0] || {},
      daily: activityQuery.rows || [],
    });
  } catch (err) {
    console.error('ADMIN STATS ERROR:', err);
    res.status(500).json({ error: 'Не вдалося завантажити статистику.' });
  }
});


app.get('/api/knowledge/meta', (req, res) => {
  res.json({
    version: GENERATOR_VERSION,
    core_engine_version: GENERATOR_VERSION,
    visual_engine_version: VISUAL_ENGINE_VERSION,
    runtime_version: RUNTIME_VERSION,
    year: NMT_META.year,
    blueprints: QUESTION_BLUEPRINTS.length,
    exam_slots: EXAM_SLOTS,
    runtime: offlineBankRuntime
      ? { ready: true, fallback_enabled: RUNTIME_FALLBACK_ENABLED, ...offlineBankRuntime.getStats() }
      : { ready: false, fallback_enabled: RUNTIME_FALLBACK_ENABLED, error: offlineBankLoadError?.message || 'offline_bank_unavailable' },
    analytics: {
      version: ANALYTICS_VERSION,
      auto_quarantine: STAGE10_AUTO_QUARANTINE,
      calibration_loaded: offlineBankRuntime?.calibrations?.size ?? 0,
    },
  });
});

// Повертає збережений прогрес користувача
app.post('/api/progress', async (req, res) => {
  const { initData } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);
    const user = await getOrCreateUser(telegramUser);

    res.json({
      correct: user?.correct_count ?? 0,
      wrong: user?.wrong_count ?? 0,
      persistent: !!user,
    });
  } catch (err) {
    console.error('PROGRESS ERROR:', err);

    res.status(500).json({
      correct: 0,
      wrong: 0,
      persistent: false,
    });
  }
});


// Записує відповідь користувача
app.post('/api/answer', async (req, res) => {
  const { initData, isCorrect, topic = 'mixed', questionBankId = null, selectedIndex = null, responseMs = null, clientAnswerId = null } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);

    if (!telegramUser?.id) {
      return res.json({ saved: false });
    }

    await getOrCreateUser(telegramUser);

    const updated = await recordAnswer(
      telegramUser.id,
      !!isCorrect,
      topic,
      Number.isInteger(Number(questionBankId)) ? Number(questionBankId) : null,
      { selectedIndex, responseMs, clientAnswerId }
    );

    res.json({
      saved: !!updated,
      ...updated,
    });

  } catch (err) {
    console.error('ANSWER ERROR:', err);

    res.status(500).json({
      saved: false
    });
  }
});



// ---- Пробний НМТ: Stage 9 production attempt lifecycle -------------------------

function isCurrentNmtAttempt(attempt) {
  const questions = Array.isArray(attempt?.questions) ? attempt.questions : [];
  if (questions.length !== NMT_EXAM_META.questions) return false;
  if (Number(attempt?.mock_engine_version) !== MOCK_ENGINE_VERSION) return false;
  if (Number(attempt?.runtime_version) !== RUNTIME_VERSION) return false;
  if (Number(questions[0]?.engine_version) !== Number(NMT_EXAM_META.generatorVersion)) return false;
  return verifyQuestionSnapshot(questions, attempt?.question_snapshot_hash).ok;
}

async function discardLegacyNmtAttempt(attempt) {
  if (!attempt || !pool || isCurrentNmtAttempt(attempt)) return attempt;
  const nextStatus = Number(attempt?.mock_engine_version) === MOCK_ENGINE_VERSION ? 'invalid' : 'abandoned';
  await pool.query(
    `UPDATE nmt_exam_attempts SET status = $2, finished_at = COALESCE(finished_at, now()) WHERE id = $1`,
    [attempt.id, nextStatus]
  );
  return null;
}

app.post('/api/nmt/resume', async (req, res) => {
  const { initData } = req.body;
  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });
    await getOrCreateUser(telegramUser);

    let attempt = await getActiveNmtAttempt(telegramUser.id);
    attempt = await discardLegacyNmtAttempt(attempt);

    if (attempt && nmtAttemptExpired(attempt)) {
      const finalized = await finalizeNmtAttempt({
        telegramId: telegramUser.id,
        attemptId: Number(attempt.id),
      });
      return res.json({ attempt: null, expired_result: finalized?.result || null });
    }

    res.json({ attempt: nmtAttemptPayload(attempt), mock_engine_version: MOCK_ENGINE_VERSION });
  } catch (err) {
    console.error('NMT RESUME ERROR:', err);
    res.status(500).json({ error: 'Не вдалося перевірити активний пробний НМТ.' });
  }
});

app.post('/api/nmt/start', async (req, res) => {
  const { initData, forceNew = false, clientSessionId = null } = req.body;
  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });
    await getOrCreateUser(telegramUser);

    if (!pool) return res.status(503).json({ error: 'База даних тимчасово недоступна.' });

    const normalizedSessionId = normalizeClientSessionId(clientSessionId) || crypto.randomUUID();

    // Idempotency: a retry with the same client session must return the same attempt.
    const replay = await getNmtAttemptByClientSession(telegramUser.id, normalizedSessionId);
    if (replay) {
      if (replay.status === 'finished' && replay.result_json) {
        return res.json({ attempt: null, result: replay.result_json, resumed: true, idempotent: true });
      }
      if (replay.status === 'in_progress' && isCurrentNmtAttempt(replay)) {
        return res.json({
          attempt: nmtAttemptPayload(replay),
          resumed: true,
          idempotent: true,
          client_session_id: normalizedSessionId,
        });
      }
    }

    let current = await getActiveNmtAttempt(telegramUser.id);
    current = await discardLegacyNmtAttempt(current);

    // A concurrent retry may have created this exact session after the replay lookup above.
    if (current?.client_session_id === normalizedSessionId && isCurrentNmtAttempt(current)) {
      return res.json({
        attempt: nmtAttemptPayload(current),
        resumed: true,
        idempotent: true,
        client_session_id: normalizedSessionId,
      });
    }

    if (current && nmtAttemptExpired(current)) {
      await finalizeNmtAttempt({ telegramId: telegramUser.id, attemptId: Number(current.id) });
      current = null;
    }

    if (current && !forceNew) {
      return res.json({
        attempt: nmtAttemptPayload(current),
        resumed: true,
        client_session_id: current.client_session_id || null,
      });
    }

    if (current && forceNew) {
      await pool.query(
        `UPDATE nmt_exam_attempts
         SET status = 'abandoned', finished_at = now(), revision = revision + 1
         WHERE id = $1 AND status = 'in_progress'`,
        [current.id]
      );
    }

    let questions = null;
    let assemblyQuality = null;
    const assemblySeed = `${telegramUser.id}:${normalizedSessionId}:stage9`;

    if (offlineBankRuntime) {
      // v1.0.4: remember several previous NMT attempts by structure, not only by item id.
      // This prevents a fresh test from feeling like the previous one with different numbers.
      const recentMemory = await getRecentNmtQuestionMemory(telegramUser.id, 8);
      const assembled = offlineBankRuntime.assembleMock(EXAM_SLOTS, {
        recentIds: recentMemory.ids,
        recentItems: recentMemory.items,
        attempts: 48,
        seed: assemblySeed,
      });
      questions = assembled.questions;
      assemblyQuality = assembled.quality;
    } else if (RUNTIME_FALLBACK_ENABLED) {
      questions = generateNmtExam().map((question) => ({
        ...question,
        runtime_source: 'engine-fallback',
        runtime_meta: { version: RUNTIME_VERSION, mode: 'mock', bank_item_id: null },
      }));
      assemblyQuality = { fallback: true };
    } else {
      return res.status(503).json({
        error: 'Офлайн-банк НМТ тимчасово недоступний. Спробуй ще раз пізніше.',
      });
    }

    const snapshot = createMockAttemptSnapshot({
      questions,
      bank: offlineBankRuntime?.bank || null,
      assemblyQuality,
      assemblySeed,
      runtimeVersion: RUNTIME_VERSION,
    });

    const contract = validateMockAttemptContract({
      questions,
      snapshotHash: snapshot.question_snapshot_hash,
      mockEngineVersion: MOCK_ENGINE_VERSION,
    });
    if (!contract.ok) {
      throw new Error(`Stage 9 mock contract failed: ${contract.errors.join(', ')}`);
    }

    const assemblyMeta = {
      source: offlineBankRuntime ? 'offline_bank' : 'engine_fallback',
      quality: assemblyQuality,
      item_ids: snapshot.item_ids,
      unique_item_count: snapshot.unique_item_count,
      unique_content_hash_count: snapshot.unique_content_hash_count,
      assembly_seed_hash: snapshot.assembly_seed_hash,
      integrity_version: snapshot.integrity_version,
    };

    const { rows } = await pool.query(
      `INSERT INTO nmt_exam_attempts (
         telegram_id, questions, answers, answer_revisions,
         mock_engine_version, runtime_version, bank_schema_version, factory_version,
         question_snapshot_hash, expires_at, assembly_meta, client_session_id
       )
       VALUES (
         $1, $2::jsonb, '{}'::jsonb, '{}'::jsonb,
         $3, $4, $5, $6, $7,
         now() + ($8 * interval '1 second'), $9::jsonb, $10
       )
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        telegramUser.id,
        JSON.stringify(questions),
        MOCK_ENGINE_VERSION,
        RUNTIME_VERSION,
        snapshot.bank_schema_version == null ? null : String(snapshot.bank_schema_version),
        snapshot.factory_version == null ? null : Number(snapshot.factory_version),
        snapshot.question_snapshot_hash,
        NMT_DURATION_SECONDS,
        JSON.stringify(assemblyMeta),
        normalizedSessionId,
      ]
    );

    let created = rows[0] || null;
    if (!created) created = await getNmtAttemptByClientSession(telegramUser.id, normalizedSessionId);
    if (!created) throw new Error('Failed to persist Stage 9 mock attempt');

    res.json({
      attempt: nmtAttemptPayload(created),
      resumed: false,
      idempotent: false,
      client_session_id: normalizedSessionId,
    });
  } catch (err) {
    console.error('NMT START ERROR:', err);
    res.status(500).json({ error: 'Не вдалося створити пробний НМТ.' });
  }
});

app.post('/api/nmt/save-answer', async (req, res) => {
  const { initData, attemptId, index, answer, revision = null } = req.body;
  let client = null;
  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });
    if (!pool) return res.status(503).json({ saved: false, error: 'База даних тимчасово недоступна.' });

    client = await pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM nmt_exam_attempts
       WHERE id = $1 AND telegram_id = $2
       FOR UPDATE`,
      [Number(attemptId), telegramUser.id]
    );
    const attempt = rows[0] || null;
    if (!attempt || attempt.status !== 'in_progress') {
      await client.query('ROLLBACK');
      return res.status(404).json({ saved: false, error: 'Активний тест не знайдено.' });
    }

    if (!isCurrentNmtAttempt(attempt)) {
      await client.query(
        `UPDATE nmt_exam_attempts SET status = 'invalid', finished_at = now() WHERE id = $1`,
        [attempt.id]
      );
      await client.query('COMMIT');
      return res.status(409).json({ saved: false, error: 'Цей варіант тесту більше не є валідним.' });
    }

    if (nmtAttemptExpired(attempt)) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      const finalized = await finalizeNmtAttempt({ telegramId: telegramUser.id, attemptId: Number(attempt.id) });
      return res.status(409).json({
        saved: false,
        expired: true,
        error: 'Час тесту вийшов.',
        result: finalized?.result || null,
      });
    }

    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= NMT_EXAM_META.questions) {
      await client.query('ROLLBACK');
      return res.status(400).json({ saved: false, error: 'Некоректний номер завдання.' });
    }

    const previousRevision = Number(attempt.answer_revisions?.[String(i)]) || 0;
    const requestedRevision = Number.isInteger(Number(revision)) && Number(revision) > 0
      ? Number(revision)
      : previousRevision + 1;

    const applied = applyAnswerRevision({
      questions: attempt.questions || [],
      answers: attempt.answers || {},
      revisions: attempt.answer_revisions || {},
      index: i,
      answer,
      revision: requestedRevision,
    });

    if (applied.stale) {
      await client.query('COMMIT');
      return res.json({
        saved: true,
        stale: true,
        answer_revision: previousRevision,
        attempt_revision: Number(attempt.revision) || 0,
      });
    }
    if (!applied.accepted) {
      await client.query('ROLLBACK');
      return res.status(400).json({ saved: false, error: 'Некоректна версія відповіді.' });
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE nmt_exam_attempts
       SET answers = $3::jsonb, answer_revisions = $4::jsonb,
           last_saved_at = now(), revision = revision + 1
       WHERE id = $1 AND telegram_id = $2
       RETURNING revision`,
      [
        attempt.id,
        telegramUser.id,
        JSON.stringify(applied.answers),
        JSON.stringify(applied.revisions),
      ]
    );

    await client.query('COMMIT');
    res.json({
      saved: true,
      stale: false,
      answer_revision: requestedRevision,
      attempt_revision: Number(updatedRows[0]?.revision) || ((Number(attempt.revision) || 0) + 1),
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.error('NMT SAVE ANSWER ERROR:', err);
    res.status(500).json({ saved: false, error: 'Не вдалося зберегти відповідь.' });
  } finally {
    if (client) client.release();
  }
});

app.post('/api/nmt/finish', async (req, res) => {
  const { initData, attemptId, answers = null } = req.body;
  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });

    const current = await getNmtAttemptById(telegramUser.id, Number(attemptId));
    if (!current) return res.status(404).json({ error: 'Пробний НМТ не знайдено.' });

    const acceptIncomingAnswers = current.status === 'in_progress' && !nmtAttemptExpired(current);
    const finalized = await finalizeNmtAttempt({
      telegramId: telegramUser.id,
      attemptId: Number(attemptId),
      incomingAnswers: acceptIncomingAnswers && answers && typeof answers === 'object' && !Array.isArray(answers)
        ? answers
        : null,
    });

    if (!finalized) return res.status(404).json({ error: 'Пробний НМТ не знайдено.' });
    res.json({
      result: finalized.result,
      idempotent: !!finalized.idempotent,
      mock_engine_version: MOCK_ENGINE_VERSION,
    });
  } catch (err) {
    console.error('NMT FINISH ERROR:', err);
    const status = ['NMT_INTEGRITY_ERROR', 'NMT_GRADING_AUDIT_ERROR', 'NMT_ATTEMPT_NOT_ACTIVE'].includes(err.code) ? 409 : 500;
    res.status(status).json({ error: 'Не вдалося завершити пробний НМТ.' });
  }
});

// Профіль користувача та статистика по темах
app.post('/api/profile', async (req, res) => {
  const { initData } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });

    await getOrCreateUser(telegramUser);
    const profile = await getProfileData(telegramUser.id);
    if (!profile) return res.status(404).json({ error: 'Профіль не знайдено.' });

    const correct = Number(profile.user.correct_count) || 0;
    const wrong = Number(profile.user.wrong_count) || 0;
    const total = correct + wrong;

    const topicStats = profile.topicStats.map((row) => {
      const rowTotal = Number(row.total) || 0;
      const rowCorrect = Number(row.correct) || 0;
      return {
        topic: row.topic,
        label: getTopic(row.topic)?.label || row.topic,
        total: rowTotal,
        correct: rowCorrect,
        accuracy: rowTotal ? Math.round((rowCorrect / rowTotal) * 100) : 0,
      };
    });

    const streaks = calculateStreaks(profile.activityDays || []);
    const rankedTopics = topicStats
      .filter((row) => row.total >= 3)
      .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);
    const strongestTopic = rankedTopics[0] || null;
    const weakestTopic = rankedTopics.length
      ? [...rankedTopics].sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)[0]
      : null;
    const recent7Total = Number(profile.recent7?.total) || 0;
    const recent7Correct = Number(profile.recent7?.correct) || 0;
    const stage10Topics = await getStage10UserAnalytics(telegramUser.id);

    res.json({
      first_name: profile.user.first_name || telegramUser.first_name || 'Учень',
      correct,
      wrong,
      total,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      streak: streaks.current,
      best_streak: streaks.best,
      created_at: profile.user.created_at,
      topic_stats: topicStats,
      recent_7_days: {
        total: recent7Total,
        correct: recent7Correct,
        accuracy: recent7Total ? Math.round((recent7Correct / recent7Total) * 100) : 0,
      },
      strongest_topic: strongestTopic,
      weakest_topic: weakestTopic,
      nmt: {
        completed: Number(profile.examStats?.completed) || 0,
        last_scaled_score: profile.examStats?.last_scaled_score == null ? null : Number(profile.examStats.last_scaled_score),
        last_raw_score: profile.examStats?.last_raw_score == null ? null : Number(profile.examStats.last_raw_score),
        last_finished_at: profile.examStats?.last_finished_at || null,
      },
      learning_analytics: {
        version: ANALYTICS_VERSION,
        topics: stage10Topics,
        weakest_topic: stage10Topics[0] || null,
        strongest_topic: stage10Topics.length ? stage10Topics[stage10Topics.length - 1] : null,
      },
    });
  } catch (err) {
    console.error('PROFILE ERROR:', err);
    res.status(500).json({ error: 'Не вдалося завантажити профіль.' });
  }
});

// Скарга на некоректне/незрозуміле завдання
app.post('/api/report-question', async (req, res) => {
  const { initData, questionBankId = null, reason = 'Інше', question = null } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });
    await getOrCreateUser(telegramUser);

    const bankId = Number(questionBankId);
    const validBankId = Number.isInteger(bankId) && bankId > 0 ? bankId : null;

    let inserted = true;

    if (pool) {
      const reportResult = await pool.query(
        validBankId
          ? `INSERT INTO question_reports (telegram_id, question_bank_id, reason, question_snapshot)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (telegram_id, question_bank_id) WHERE question_bank_id IS NOT NULL DO NOTHING
             RETURNING id`
          : `INSERT INTO question_reports (telegram_id, question_bank_id, reason, question_snapshot)
             VALUES ($1, $2, $3, $4::jsonb)
             RETURNING id`,
        [telegramUser.id, validBankId, String(reason).slice(0, 120), JSON.stringify(question || null)]
      );
      inserted = reportResult.rowCount > 0;
    }

    if (pool && validBankId && inserted) {
      const { rows } = await pool.query(
        `UPDATE question_bank
         SET report_count = report_count + 1
         WHERE id = $1
         RETURNING report_count, offline_bank_id`,
        [validBankId]
      );

      if ((rows[0]?.report_count || 0) >= 3) {
        await pool.query(`UPDATE question_bank SET is_active = false WHERE id = $1`, [validBankId]);
        if (rows[0]?.offline_bank_id) offlineBankRuntime?.disable(rows[0].offline_bank_id);
      }
    }

    res.json({ saved: true, duplicate: !inserted });
  } catch (err) {
    console.error('REPORT ERROR:', err);
    res.status(500).json({ saved: false, error: 'Не вдалося надіслати скаргу.' });
  }
});

// Додаткова AI-допомога після відповіді
app.post('/api/explain-more', async (req, res) => {
  const { initData, mode = 'simple', topic = 'mixed', difficulty = 'NMT HARD', question } = req.body;

  try {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser?.id) return res.status(401).json({ error: 'Потрібно відкрити застосунок через Telegram.' });
    if (!question?.question || !Array.isArray(question.options)) return res.status(400).json({ error: 'Немає даних завдання.' });

    if (mode === 'similar') {
      const recent = await getRecentQuestions(telegramUser.id, topic, 24);
      const avoid = [question.question, ...recent].filter(Boolean);
      let similar = null;
      let source = 'offline-bank';

      if (offlineBankRuntime) {
        similar = offlineBankRuntime.pickSimilar(question, {
          difficulty,
          avoidTexts: avoid,
          visualMode: TRAINING_VISUAL_MODE,
          seed: `${telegramUser.id}:similar:${Date.now()}`,
        });
      }

      if (!similar && RUNTIME_FALLBACK_ENABLED) {
        source = 'engine-fallback';
        similar = await generateStrictQuestion(topic, difficulty, avoid, 4);
      }

      if (!similar) {
        return res.status(503).json({ error: 'У перевіреному банку зараз немає іншого схожого завдання.' });
      }

      const bankId = source === 'offline-bank'
        ? await ensureOfflineQuestionBankId(similar)
        : await saveQuestionToBank(topic, difficulty, similar);
      await saveQuestionToHistory(telegramUser.id, similar.topic || topic, similar.question);

      return res.json({
        mode: 'similar',
        question: {
          ...similar,
          topic: similar.topic || topic,
          difficulty: similar.difficulty || difficulty,
          verified: true,
          bank_id: bankId,
          source,
        },
      });
    }

    if (!['simple', 'detailed', 'why_wrong'].includes(mode)) return res.status(400).json({ error: 'Невідомий режим пояснення.' });

    const help = await callGemini(buildExtraHelpPrompt(mode, question), 0.25);
    const steps = Array.isArray(help.steps) ? help.steps.filter((x) => typeof x === 'string' && x.trim()) : [];
    if (!steps.length) return res.status(502).json({ error: 'ШІ не повернув пояснення.' });

    res.json({ title: help.title || 'Пояснення', steps: steps.slice(0, 6) });
  } catch (err) {
    console.error('EXPLAIN MORE ERROR:', err);
    res.status(500).json({ error: 'Не вдалося отримати додаткове пояснення.' });
  }
});


// Віддає невеликий буфер готових завдань одним HTTP-запитом.
// Це прибирає мережеву паузу між «Наступне завдання» і новою карткою.
app.post('/api/questions-batch', async (req, res) => {
  const {
    topic = 'mixed',
    difficulty = 'NMT HARD',
    initData,
    count = 4,
  } = req.body;

  const effectiveTopic = 'mixed';
  const batchSize = Math.max(1, Math.min(5, Number(count) || 4));

  try {
    const telegramUser = verifyTelegramInitData(initData);
    const user = await getOrCreateUser(telegramUser);
    const telegramId = user?.telegram_id ?? null;
    const avoidList = telegramId
      ? await getRecentQuestions(telegramId, effectiveTopic, 180)
      : [];

    const questions = [];

    if (offlineBankRuntime) {
      const selected = offlineBankRuntime.pickTrainingBatch({
        topic: effectiveTopic,
        difficulty,
        count: batchSize,
        visualMode: TRAINING_VISUAL_MODE,
        avoidTexts: avoidList,
        seed: `${telegramId || 'anon'}:${effectiveTopic}:${Date.now()}`,
      });

      for (const question of selected) {
        if (!isValidQuestion(question) || !hasSafeQuestionMath(question)) continue;
        let bankId = null;
        try {
          bankId = await ensureOfflineQuestionBankId(question);
        } catch (dbErr) {
          console.warn('OFFLINE BANK DB MAP:', dbErr.message);
        }

        if (telegramId) {
          await saveQuestionToHistory(telegramId, question.topic || effectiveTopic, question.question);
        }

        questions.push({
          ...question,
          verified: true,
          bank_id: bankId,
          source: 'offline-bank',
          requested_difficulty: difficulty,
        });
      }
    }

    // Emergency compatibility path only. Stage 8 keeps this disabled by default.
    if (questions.length < batchSize && RUNTIME_FALLBACK_ENABLED) {
      const fallbackAvoid = [...avoidList, ...questions.map((q) => q.question)];
      while (questions.length < batchSize) {
        const question = await generateStrictQuestion(effectiveTopic, difficulty, fallbackAvoid, 6);
        if (!question) break;
        fallbackAvoid.push(question.question);

        let bankId = null;
        try { bankId = await saveQuestionToBank(effectiveTopic, difficulty, question); }
        catch (saveErr) { console.warn('ENGINE FALLBACK SAVE:', saveErr.message); }

        if (telegramId) await saveQuestionToHistory(telegramId, question.topic || effectiveTopic, question.question);
        questions.push({
          ...question,
          topic: effectiveTopic,
          difficulty,
          verified: true,
          bank_id: bankId,
          source: 'engine-fallback',
        });
      }
    }

    if (!questions.length) {
      return res.status(503).json({
        error: offlineBankRuntime
          ? 'У перевіреному банку зараз немає завдань для цієї теми.'
          : 'Офлайн-банк завдань тимчасово недоступний.',
      });
    }

    const freshUser = telegramUser ? await getOrCreateUser(telegramUser) : null;
    res.json({
      questions,
      bank_runtime: offlineBankRuntime ? 8 : null,
      progress: {
        correct: freshUser?.correct_count ?? 0,
        wrong: freshUser?.wrong_count ?? 0,
      },
    });
  } catch (err) {
    console.error('QUESTIONS BATCH ERROR:', err);
    res.status(500).json({ error: 'Не вдалося підготувати завдання.' });
  }
});


// Віддає інше перевірене питання з offline bank
app.post('/api/generate-question', async (req, res) => {
  const {
    topic = 'mixed',
    difficulty = 'NMT HARD',
    initData,
  } = req.body;

  const effectiveTopic = 'mixed';

  try {
    const telegramUser = verifyTelegramInitData(initData);
    const user = await getOrCreateUser(telegramUser);
    const telegramId = user?.telegram_id ?? null;
    const avoidList = telegramId
      ? await getRecentQuestions(telegramId, effectiveTopic, 180)
      : [];

    let question = null;
    let bankId = null;
    let source = 'offline-bank';

    if (offlineBankRuntime) {
      [question] = offlineBankRuntime.pickTrainingBatch({
        topic: effectiveTopic,
        difficulty,
        count: 1,
        visualMode: TRAINING_VISUAL_MODE,
        avoidTexts: avoidList,
        seed: `${telegramId || 'anon'}:${effectiveTopic}:single:${Date.now()}`,
      });
      if (question && (!isValidQuestion(question) || !hasSafeQuestionMath(question))) question = null;
      if (question) {
        try { bankId = await ensureOfflineQuestionBankId(question); }
        catch (dbErr) { console.warn('OFFLINE BANK DB MAP:', dbErr.message); }
      }
    }

    if (!question && RUNTIME_FALLBACK_ENABLED) {
      source = 'engine-fallback';
      question = await generateStrictQuestion(effectiveTopic, difficulty, avoidList, 4);
      if (question) {
        try { bankId = await saveQuestionToBank(effectiveTopic, difficulty, question); }
        catch (saveErr) { console.warn('ENGINE FALLBACK SAVE:', saveErr.message); }
      }
    }

    if (!question) {
      return res.status(503).json({
        error: offlineBankRuntime
          ? 'У перевіреному банку зараз немає іншого завдання для цієї теми.'
          : 'Офлайн-банк завдань тимчасово недоступний.',
      });
    }

    if (telegramId) await saveQuestionToHistory(telegramId, question.topic || effectiveTopic, question.question);
    const freshUser = telegramUser ? await getOrCreateUser(telegramUser) : null;

    res.json({
      ...question,
      verified: true,
      bank_id: bankId,
      source,
      requested_difficulty: difficulty,
      progress: {
        correct: freshUser?.correct_count ?? 0,
        wrong: freshUser?.wrong_count ?? 0,
      },
    });
  } catch (err) {
    console.error('GENERATE ERROR:', err);
    res.status(500).json({
      error: 'Не вдалося підготувати завдання. Спробуй ще раз.',
    });
  }
});



app.use(
  express.static('public', {
    etag: false,
    lastModified: false,
    maxAge: 0,

    setHeaders: (res) => {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
    },
  })
);


app.listen(PORT, async () => {
  console.log(
    `✅ Сервер запущено: http://localhost:${PORT}`
  );

  console.log(
    '   Для Telegram Mini App потрібен публічний HTTPS-URL.'
  );

  try {
    await initDb();
    await syncOfflineBankDisabledState();
    await loadStage10Calibrations();

  } catch (err) {
    console.error(
      '❌ Не вдалося ініціалізувати базу даних:',
      err.message
    );
  }
});