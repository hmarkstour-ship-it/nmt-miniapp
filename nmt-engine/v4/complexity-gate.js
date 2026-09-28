import { COMPLEXITY_MIN, COMPLEXITY_MAX } from './constants.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function analyzeComplexity(genome, { allowOlympiad = false } = {}) {
  const steps = clamp(Number(genome?.steps ?? 1), 1, 6);
  const hidden = clamp((genome?.hidden_relations ?? []).length, 0, 4);
  const jumps = clamp(Number(genome?.conceptual_jumps ?? 0), 0, 4);
  const algebra = clamp(Number(genome?.algebra_load ?? 0), 0, 4);
  const visual = clamp(Number(genome?.visual_reasoning ?? 0), 0, 4);
  const theorem = clamp(Number(genome?.theorem_recall ?? 0), 0, 4);
  const combined = clamp((genome?.combined_topics ?? []).length, 0, 3);

  const score = Math.round(
    25 + steps * 5.8 + hidden * 5.2 + jumps * 5.0 + algebra * 2.8 + visual * 2.8 + theorem * 2.5 + combined * 2.5,
  );
  const bounded = clamp(score, 0, 100);
  return {
    score: bounded,
    accepted: bounded >= COMPLEXITY_MIN && (allowOlympiad || bounded <= COMPLEXITY_MAX),
    reason: bounded < COMPLEXITY_MIN ? 'too_simple' : (bounded > COMPLEXITY_MAX && !allowOlympiad ? 'too_olympiad' : 'ok'),
    standard: 'NMT_HARD',
    features: { steps, hidden, jumps, algebra, visual, theorem, combined },
  };
}
