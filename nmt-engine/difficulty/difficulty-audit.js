import { DifficultyController } from './difficulty-controller.js';

function round(value) {
  return Math.round(value * 10) / 10;
}

export function auditDifficulty(items, {
  target = null,
  controller = new DifficultyController(),
} = {}) {
  if (!Array.isArray(items)) throw new Error('items must be an array');
  const rows = items.map((item, index) => {
    const result = controller.evaluate(item, target ?? item.source_question?.difficulty ?? item.difficulty ?? 'середній');
    return {
      index: index + 1,
      family: item.family ?? item.blueprint_id ?? null,
      variant: item.variant ?? null,
      score: result.difficulty.score,
      band: result.difficulty.band,
      target: result.target.id,
      accepted: result.accepted,
      distance: result.distance,
    };
  });

  const counts = {};
  for (const row of rows) counts[row.band] = (counts[row.band] ?? 0) + 1;
  const averageScore = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : 0;
  const acceptedCount = rows.filter((row) => row.accepted).length;

  return {
    itemCount: rows.length,
    averageScore: round(averageScore),
    bandCounts: counts,
    acceptedCount,
    mismatchCount: rows.length - acceptedCount,
    rows,
  };
}
