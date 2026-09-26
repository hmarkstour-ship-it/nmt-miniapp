import { rankCandidates } from './candidate-ranker.js';

export function selectCandidate(candidates, history, diversityEngine) {
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('No candidates supplied');
  const evaluated = candidates.map((candidate) => ({ candidate, result: diversityEngine.evaluate(candidate, history) }));
  const ranked = rankCandidates(evaluated);
  const accepted = ranked.find((entry) => entry.result.accepted) ?? null;
  const selected = accepted ?? ranked[0];

  return {
    selected: selected.candidate,
    evaluation: selected.result,
    usedFallback: accepted == null,
    evaluated: ranked,
  };
}
