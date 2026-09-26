import { DifficultyController } from './difficulty-controller.js';

export function selectDifficultyCandidate(candidates, target = 'середній', {
  controller = new DifficultyController(),
  diversityEngine = null,
  history = [],
  difficultyWeight = 0.62,
  diversityWeight = 0.38,
} = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('No difficulty candidates supplied');

  const evaluated = candidates.map((candidate) => {
    const difficulty = controller.evaluate(candidate, target);
    const diversity = diversityEngine?.evaluate ? diversityEngine.evaluate(candidate, history) : null;
    const diversityScore = diversity ? diversity.diversityScore : 100;
    const valid = difficulty.accepted && (!diversity || diversity.accepted);
    const combinedScore = difficulty.fitScore * difficultyWeight + diversityScore * diversityWeight;

    return {
      candidate,
      difficulty,
      diversity,
      accepted: valid,
      combinedScore: Math.round(combinedScore * 10) / 10,
    };
  });

  evaluated.sort((a, b) => {
    if (a.accepted !== b.accepted) return Number(b.accepted) - Number(a.accepted);
    if (a.combinedScore !== b.combinedScore) return b.combinedScore - a.combinedScore;
    return a.difficulty.distance - b.difficulty.distance;
  });

  const selected = evaluated[0];
  return {
    selected: selected.candidate,
    difficulty: selected.difficulty,
    diversity: selected.diversity,
    accepted: selected.accepted,
    usedFallback: !selected.accepted,
    evaluated,
  };
}
