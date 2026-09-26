import { normalizeDifficultyTarget, targetFitScore } from '../difficulty/difficulty-bands.js';
import { fingerprintSimilarity } from '../diversity/similarity.js';
import { createSeededRandom, deriveSeed } from '../factory/seeded-rng.js';
import { effectiveDifficultyScore } from '../analytics/policy.js';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function itemFingerprint(item) {
  return item?.bank_meta?.fingerprint ?? null;
}

function maxSimilarity(candidate, items = []) {
  const fp = itemFingerprint(candidate);
  if (!fp || !items.length) return 0;
  let max = 0;
  for (const item of items) {
    const other = itemFingerprint(item);
    if (!other) continue;
    max = Math.max(max, fingerprintSimilarity(fp, other));
  }
  return max;
}

function publicDifficultyMatch(item, target) {
  return String(item.difficulty) === String(target.label) ? 1 : 0;
}

function candidateScore(item, {
  target,
  avoidTexts,
  avoidSkeletons,
  recentItems,
  selected,
  usage,
  random,
}) {
  const score = effectiveDifficultyScore(item);
  const fit = Number.isFinite(score) ? targetFitScore(score, target) : 0;
  const exactDifficulty = publicDifficultyMatch(item, target);
  const exactSeen = avoidTexts.has(item.question);
  const skeletonSeen = item.question_skeleton && avoidSkeletons.has(item.question_skeleton);
  const recentSimilarity = maxSimilarity(item, recentItems);
  const batchSimilarity = maxSimilarity(item, selected);
  const useCount = usage.get(item.id) ?? 0;

  let total = fit * 1.15;
  total += exactDifficulty * 20;
  total -= exactSeen ? 130 : 0;
  total -= skeletonSeen ? 55 : 0;
  total -= recentSimilarity * 22;
  total -= batchSimilarity * 52;
  total -= clamp(useCount, 0, 25) * 2.5;
  total += random() * 7;
  return total;
}

export function selectTrainingBatch(index, {
  topic = 'mixed',
  difficulty = 'середній',
  count = 4,
  visualMode = 'plain',
  avoidTexts = [],
  usage = new Map(),
  seed = Date.now(),
  disabledIds = new Set(),
} = {}) {
  const target = normalizeDifficultyTarget(difficulty);
  const pool = index.trainingPool({ topic, visualMode }).filter((item) => !disabledIds.has(item.id));
  if (!pool.length) return [];

  const avoidTextSet = new Set((avoidTexts ?? []).filter(Boolean));
  const recentItems = [];
  const avoidSkeletons = new Set();
  for (const text of avoidTextSet) {
    const known = index.byText.get(text);
    if (!known) continue;
    recentItems.push(known);
    if (known.question_skeleton) avoidSkeletons.add(known.question_skeleton);
  }

  const wanted = Math.max(1, Math.min(Number(count) || 1, pool.length));
  const selected = [];
  const selectedIds = new Set();
  const random = createSeededRandom(deriveSeed(seed, topic, difficulty, visualMode, avoidTexts.length));

  while (selected.length < wanted) {
    const ranked = pool
      .filter((item) => !selectedIds.has(item.id))
      .map((item) => ({
        item,
        score: candidateScore(item, {
          target,
          avoidTexts: avoidTextSet,
          avoidSkeletons,
          recentItems,
          selected,
          usage,
          random,
        }),
      }))
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) break;

    // Randomize only among the strongest few candidates so sessions do not always
    // start from the exact same bank row while difficulty/diversity still dominate.
    const windowSize = Math.min(5, ranked.length);
    const pickIndex = Math.floor(random() * windowSize);
    const chosen = ranked[pickIndex].item;
    selected.push(chosen);
    selectedIds.add(chosen.id);
  }

  return selected;
}

export function selectSimilarTraining(index, original, {
  difficulty = 'середній',
  avoidTexts = [],
  usage = new Map(),
  seed = Date.now(),
  visualMode = 'plain',
  disabledIds = new Set(),
} = {}) {
  if (!original) return null;
  const topic = original.topic || 'mixed';
  const pool = index.trainingPool({ topic, visualMode })
    .filter((item) => !disabledIds.has(item.id))
    .filter((item) => item.id !== original.id && item.question !== original.question);
  if (!pool.length) return null;

  const target = normalizeDifficultyTarget(difficulty);
  const originalFp = itemFingerprint(original);
  const avoid = new Set([original.question, ...(avoidTexts ?? [])].filter(Boolean));
  const random = createSeededRandom(deriveSeed(seed, 'similar', original.id || original.question || topic));

  const ranked = pool.map((item) => {
    const sameFamily = item.blueprint_id && item.blueprint_id === original.blueprint_id ? 1 : 0;
    const similarity = originalFp && itemFingerprint(item)
      ? fingerprintSimilarity(originalFp, itemFingerprint(item))
      : 0;
    const fit = targetFitScore(effectiveDifficultyScore(item), target);
    const seen = avoid.has(item.question) ? 1 : 0;
    const useCount = usage.get(item.id) ?? 0;
    const score = sameFamily * 80 + similarity * 45 + fit * 0.5 - seen * 120 - useCount * 2 + random() * 4;
    return { item, score };
  }).sort((a, b) => b.score - a.score);

  return ranked[0]?.item ?? null;
}
