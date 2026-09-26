import { DEFAULT_CALIBRATION_CONFIG, CALIBRATION_SCHEMA_VERSION } from './constants.js';
import { clamp, mean, pearsonCorrelation, quantile, round } from './statistics.js';
import { evaluateQualityFlags, calibrationStatus } from './quality-flags.js';

function selectedHistogram(events) {
  const hist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let has = false;
  for (const event of events) {
    const i = Number(event?.selected_index);
    if (Number.isInteger(i) && i >= 0 && i <= 4) {
      hist[i] += 1;
      has = true;
    }
  }
  return has ? hist : {};
}

export function calibrateItemEvents(events = [], config = DEFAULT_CALIBRATION_CONFIG) {
  if (!events.length) return null;
  const normalized = events.filter((event) => Number.isFinite(Number(event?.score_fraction)));
  if (!normalized.length) return null;

  const sampleCount = normalized.length;
  const rawP = mean(normalized.map((e) => Number(e.score_fraction))) ?? 0.5;
  const modelScores = normalized
    .filter((e) => e.model_difficulty_score !== null && e.model_difficulty_score !== undefined && e.model_difficulty_score !== '')
    .map((e) => Number(e.model_difficulty_score))
    .filter(Number.isFinite);
  const modelDifficulty = modelScores.length ? (mean(modelScores) ?? 50) : 50;
  const priorP = clamp(1 - modelDifficulty / 100, 0.02, 0.98);
  const successes = normalized.reduce((sum, e) => sum + Number(e.score_fraction), 0);
  const smoothedP = (successes + config.priorStrength * priorP) / (sampleCount + config.priorStrength);
  const empiricalDifficulty = clamp((1 - smoothedP) * 100, 0, 100);
  const confidence = sampleCount / (sampleCount + config.confidenceHalfLife);
  const empiricalWeight = Math.min(config.maxEmpiricalWeight, confidence * config.maxEmpiricalWeight);
  const blendedDifficulty = modelDifficulty * (1 - empiricalWeight) + empiricalDifficulty * empiricalWeight;

  const discriminationEvents = normalized.filter((e) =>
    e.ability_proxy !== null && e.ability_proxy !== undefined && e.ability_proxy !== ''
    && Number.isFinite(Number(e.ability_proxy))
  );
  const discrimination = discriminationEvents.length >= 2
    ? pearsonCorrelation(
      discriminationEvents.map((e) => Number(e.score_fraction)),
      discriminationEvents.map((e) => Number(e.ability_proxy)),
    )
    : null;

  const responseTimes = normalized.map((e) => Number(e.response_ms)).filter((n) => Number.isFinite(n) && n >= 0);
  const metrics = {
    schema_version: CALIBRATION_SCHEMA_VERSION,
    item_id: normalized[0]?.item_id || null,
    topic: normalized[0]?.topic || 'mixed',
    blueprint_id: normalized[0]?.blueprint_id || null,
    question_type: normalized[0]?.question_type || null,
    sample_count: sampleCount,
    training_count: normalized.filter((e) => e.mode === 'training').length,
    mock_count: normalized.filter((e) => e.mode === 'mock').length,
    raw_p: round(rawP, 5),
    smoothed_p: round(smoothedP, 5),
    model_difficulty_score: round(modelDifficulty, 2),
    empirical_difficulty_score: round(empiricalDifficulty, 2),
    blended_difficulty_score: round(blendedDifficulty, 2),
    confidence: round(confidence, 5),
    discrimination: round(discrimination, 5),
    discrimination_n: discriminationEvents.length,
    median_response_ms: responseTimes.length ? Math.round(quantile(responseTimes, 0.5)) : null,
    p90_response_ms: responseTimes.length ? Math.round(quantile(responseTimes, 0.9)) : null,
    selected_index_hist: selectedHistogram(normalized),
  };

  metrics.quality_flags = evaluateQualityFlags(metrics, config);
  metrics.status = calibrationStatus(metrics.quality_flags, sampleCount);
  return metrics;
}

export function buildCalibrationSnapshot(events = [], config = DEFAULT_CALIBRATION_CONFIG) {
  const byItem = new Map();
  for (const event of events) {
    const itemId = event?.item_id;
    if (!itemId) continue;
    if (!byItem.has(itemId)) byItem.set(itemId, []);
    byItem.get(itemId).push(event);
  }

  const items = [...byItem.entries()]
    .map(([itemId, rows]) => calibrateItemEvents(rows, config))
    .filter(Boolean)
    .sort((a, b) => a.item_id.localeCompare(b.item_id));

  const statuses = {};
  for (const item of items) statuses[item.status] = (statuses[item.status] ?? 0) + 1;

  return {
    schema_version: CALIBRATION_SCHEMA_VERSION,
    item_count: items.length,
    event_count: events.length,
    statuses,
    items,
  };
}
