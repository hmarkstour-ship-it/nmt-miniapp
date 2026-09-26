import { targetFitScore } from '../difficulty/difficulty-bands.js';
import { createSeededRandom, deriveSeed } from '../factory/seeded-rng.js';
import { auditExamDiversity } from '../integration/exam-diversity-audit.js';
import { validateExamQuestions } from '../../question-engine.js';
import { SLOT_DIFFICULTY_TARGETS } from './constants.js';
import { effectiveDifficultyScore } from '../analytics/policy.js';

function familyKey(item) {
  return item?.bank_meta?.family || item?.blueprint_id || 'unknown';
}

function variantKey(item) {
  return item?.bank_meta?.variant || item?.variant_key || item?.id || 'unknown';
}

function candidateScore(item, slot, {
  selected,
  recentIds,
  usage,
  random,
}) {
  const target = SLOT_DIFFICULTY_TARGETS[slot.slot] || 'середній';
  const difficultyScore = effectiveDifficultyScore(item);
  const fit = Number.isFinite(difficultyScore) ? targetFitScore(difficultyScore, target) : 50;
  const familyRepeats = selected.filter((q) => familyKey(q) === familyKey(item)).length;
  const variantRepeats = selected.filter((q) => variantKey(q) === variantKey(item)).length;
  const recentlySeen = recentIds.has(item.id) ? 1 : 0;
  const useCount = usage.get(item.id) ?? 0;

  return fit
    - familyRepeats * 16
    - variantRepeats * 28
    - recentlySeen * 95
    - Math.min(useCount, 20) * 1.5
    + random() * 7;
}

function candidatesForSlot(index, slot, disabledIds = new Set()) {
  const direct = index.mockPool(slot.slot, slot.type).filter((item) => !disabledIds.has(item.id));
  if (direct.length) return direct;

  // Defensive fallback for a bank whose mock_slots metadata is incomplete.
  return index.items.filter((item) =>
    !disabledIds.has(item.id)
    && item.bank_meta?.usage?.mock
    && item.type === slot.type
    && slot.blueprint_ids.includes(item.blueprint_id),
  );
}

function assembleOnce(index, slots, {
  recentIds,
  usage,
  seed,
  disabledIds,
}) {
  const random = createSeededRandom(seed);
  const slotPools = slots.map((slot) => ({ slot, pool: candidatesForSlot(index, slot, disabledIds) }));
  for (const entry of slotPools) {
    if (!entry.pool.length) throw new Error(`Offline bank has no candidates for NMT slot ${entry.slot.slot}`);
  }

  // Fill scarce slots first so a broad early slot cannot consume the only item
  // that a later narrow slot requires.
  slotPools.sort((a, b) => a.pool.length - b.pool.length || a.slot.slot - b.slot.slot);

  const selectedBySlot = new Map();
  const selected = [];
  const usedIds = new Set();

  for (const { slot, pool } of slotPools) {
    const ranked = pool
      .filter((item) => !usedIds.has(item.id))
      .map((item) => ({
        item,
        score: candidateScore(item, slot, { selected, recentIds, usage, random }),
      }))
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) throw new Error(`Offline bank exhausted while filling NMT slot ${slot.slot}`);
    const windowSize = Math.min(4, ranked.length);
    const chosen = ranked[Math.floor(random() * windowSize)].item;
    selected.push(chosen);
    usedIds.add(chosen.id);
    selectedBySlot.set(slot.slot, {
      ...chosen,
      number: slot.slot,
      max_score: slot.max_score,
      runtime_source: 'offline_bank',
    });
  }

  const exam = [...selectedBySlot.values()].sort((a, b) => a.number - b.number);
  validateExamQuestions(exam);
  return exam;
}

function examQuality(exam, recentIds) {
  const repeats = exam.filter((q) => recentIds.has(q.id)).length;
  const diversity = auditExamDiversity(exam);
  const uniqueFamilies = new Set(exam.map(familyKey)).size;
  return {
    repeats,
    diversityIssues: diversity.issueCount,
    uniqueFamilies,
    score: repeats * 100 + diversity.issueCount * 7 - uniqueFamilies,
  };
}

export function assembleMockExam(index, slots, {
  recentIds = [],
  usage = new Map(),
  seed = Date.now(),
  attempts = 16,
  disabledIds = new Set(),
} = {}) {
  const recent = new Set(recentIds ?? []);
  let best = null;

  for (let i = 0; i < Math.max(1, attempts); i += 1) {
    const exam = assembleOnce(index, slots, {
      recentIds: recent,
      usage,
      seed: deriveSeed(seed, 'mock', i),
      disabledIds,
    });
    const quality = examQuality(exam, recent);
    if (!best || quality.score < best.quality.score) best = { exam, quality };
    if (quality.repeats === 0 && quality.diversityIssues === 0) break;
  }

  return best;
}
