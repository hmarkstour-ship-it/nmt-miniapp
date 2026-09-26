import { ANALYTICS_VERSION } from './constants.js';
import { clamp } from './statistics.js';

function boundedInt(value, min, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function normalizeResponseMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n), 30 * 60 * 1000);
}

export function normalizeScoreFraction(scoreAwarded, maxScore) {
  const max = Number(maxScore);
  const score = Number(scoreAwarded);
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(score)) return null;
  return clamp(score / max, 0, 1);
}

export function createTrainingTelemetry({
  eventKey,
  telegramId,
  itemId = null,
  questionBankId = null,
  topic = 'mixed',
  blueprintId = null,
  questionType = 'choice',
  isCorrect,
  selectedIndex = null,
  responseMs = null,
  modelDifficultyScore = null,
  engineVersion = null,
} = {}) {
  return {
    analytics_version: ANALYTICS_VERSION,
    event_key: eventKey || null,
    telegram_id: telegramId ?? null,
    mode: 'training',
    item_id: itemId || null,
    question_bank_id: questionBankId == null ? null : Number(questionBankId),
    attempt_id: null,
    question_index: null,
    topic: topic || 'mixed',
    blueprint_id: blueprintId || null,
    question_type: questionType || 'choice',
    is_correct: !!isCorrect,
    score_awarded: isCorrect ? 1 : 0,
    max_score: 1,
    score_fraction: isCorrect ? 1 : 0,
    selected_index: boundedInt(selectedIndex, 0, 4),
    response_ms: normalizeResponseMs(responseMs),
    ability_proxy: null,
    model_difficulty_score: Number.isFinite(Number(modelDifficultyScore)) ? Number(modelDifficultyScore) : null,
    engine_version: Number.isFinite(Number(engineVersion)) ? Number(engineVersion) : null,
  };
}

export function createMockTelemetryEvents({
  attemptId,
  telegramId,
  questions = [],
  answers = {},
  result,
} = {}) {
  const review = Array.isArray(result?.review) ? result.review : [];
  const raw = Number(result?.raw_score) || 0;
  const maxTotal = Number(result?.max_score) || 32;
  const out = [];

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const r = review[i] || {};
    const max = Number(q?.max_score) || Number(r?.max_score) || 1;
    const awarded = Number(r?.score_awarded) || 0;
    const adjustedDen = Math.max(1, maxTotal - max);
    const adjustedAbility = clamp((raw - awarded) / adjustedDen, 0, 1);
    const answer = answers?.[String(i)] ?? null;

    out.push({
      analytics_version: ANALYTICS_VERSION,
      event_key: `mock:${attemptId}:${i}`,
      telegram_id: telegramId ?? null,
      mode: 'mock',
      item_id: q?.runtime_meta?.bank_item_id || q?.id || null,
      question_bank_id: null,
      attempt_id: Number(attemptId),
      question_index: i,
      topic: q?.topic || r?.topic || 'mixed',
      blueprint_id: q?.blueprint_id || null,
      question_type: q?.type || null,
      is_correct: awarded >= max,
      score_awarded: awarded,
      max_score: max,
      score_fraction: normalizeScoreFraction(awarded, max),
      selected_index: q?.type === 'choice' ? boundedInt(answer, 0, 4) : null,
      response_ms: null,
      ability_proxy: adjustedAbility,
      model_difficulty_score: Number.isFinite(Number(q?.bank_meta?.difficulty_score)) ? Number(q.bank_meta.difficulty_score) : null,
      engine_version: Number.isFinite(Number(q?.engine_version)) ? Number(q.engine_version) : null,
    });
  }

  return out;
}
