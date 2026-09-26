export const DIFFICULTY_BANDS = Object.freeze([
  'easy',
  'medium',
  'medium_hard',
  'hard',
  'very_hard',
]);

export const BAND_CENTERS = Object.freeze({
  easy: 20,
  medium: 40,
  medium_hard: 58,
  hard: 75,
  very_hard: 90,
});

export const PUBLIC_DIFFICULTY_TARGETS = Object.freeze({
  'легкий': Object.freeze({
    id: 'easy',
    label: 'легкий',
    minScore: 0,
    maxScore: 34,
    targetScore: 22,
    preferredBands: ['easy'],
  }),
  easy: Object.freeze({
    id: 'easy',
    label: 'легкий',
    minScore: 0,
    maxScore: 34,
    targetScore: 22,
    preferredBands: ['easy'],
  }),
  'середній': Object.freeze({
    id: 'medium',
    label: 'середній',
    minScore: 30,
    maxScore: 66,
    targetScore: 48,
    preferredBands: ['medium', 'medium_hard'],
  }),
  medium: Object.freeze({
    id: 'medium',
    label: 'середній',
    minScore: 30,
    maxScore: 66,
    targetScore: 48,
    preferredBands: ['medium', 'medium_hard'],
  }),
  'складний': Object.freeze({
    id: 'hard',
    label: 'складний',
    minScore: 56,
    maxScore: 100,
    targetScore: 74,
    preferredBands: ['medium_hard', 'hard', 'very_hard'],
  }),
  hard: Object.freeze({
    id: 'hard',
    label: 'складний',
    minScore: 56,
    maxScore: 100,
    targetScore: 74,
    preferredBands: ['medium_hard', 'hard', 'very_hard'],
  }),
});

export function clampDifficultyScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, numeric));
}

export function scoreToDifficultyBand(score) {
  const value = clampDifficultyScore(score);
  if (value < 30) return 'easy';
  if (value < 50) return 'medium';
  if (value < 65) return 'medium_hard';
  if (value < 83) return 'hard';
  return 'very_hard';
}

export function normalizeDifficultyTarget(target = 'середній') {
  if (target && typeof target === 'object') {
    const minScore = clampDifficultyScore(target.minScore ?? 0);
    const maxScore = clampDifficultyScore(target.maxScore ?? 100);
    if (maxScore < minScore) throw new Error('Difficulty target maxScore must be >= minScore');
    return {
      id: target.id ?? 'custom',
      label: target.label ?? 'custom',
      minScore,
      maxScore,
      targetScore: clampDifficultyScore(target.targetScore ?? ((minScore + maxScore) / 2)),
      preferredBands: Array.isArray(target.preferredBands) ? [...target.preferredBands] : [],
    };
  }

  const key = String(target ?? 'середній').trim().toLowerCase();
  if (PUBLIC_DIFFICULTY_TARGETS[key]) return { ...PUBLIC_DIFFICULTY_TARGETS[key] };
  if (key === 'medium_hard') return { id: 'medium_hard', label: 'medium_hard', minScore: 50, maxScore: 64, targetScore: 58, preferredBands: ['medium_hard'] };
  if (key === 'very_hard') return { id: 'very_hard', label: 'very_hard', minScore: 83, maxScore: 100, targetScore: 90, preferredBands: ['very_hard'] };
  throw new Error(`Unknown difficulty target: ${target}`);
}

export function difficultyDistance(score, target = 'середній') {
  const profile = normalizeDifficultyTarget(target);
  const value = clampDifficultyScore(score);
  if (value < profile.minScore) return profile.minScore - value;
  if (value > profile.maxScore) return value - profile.maxScore;
  return 0;
}

export function targetFitScore(score, target = 'середній') {
  const profile = normalizeDifficultyTarget(target);
  const value = clampDifficultyScore(score);
  const distanceFromCenter = Math.abs(value - profile.targetScore);
  const outsideDistance = difficultyDistance(value, profile);
  const centerFit = Math.max(0, 100 - distanceFromCenter * 2);
  if (outsideDistance === 0) return Math.round(centerFit);
  return Math.max(0, Math.round(centerFit - outsideDistance * 2.5));
}
