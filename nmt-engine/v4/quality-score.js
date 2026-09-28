import { QUALITY_MIN, NOVELTY_MIN, NMT_SIMILARITY_MIN } from './constants.js';

export function computeQualityScore({ math=100, nmt=0, novelty=0, visual=100, distractors=85, wording=85, complexity }) {
  const complexityFit = complexity?.accepted ? Math.max(80, 100 - Math.abs((complexity.score ?? 78) - 78) * 1.7) : 0;
  const overall = Math.round(
    math*.24 + nmt*.17 + novelty*.17 + visual*.13 + distractors*.10 + wording*.09 + complexityFit*.10,
  );
  return {
    overall,
    accepted: math === 100 && nmt >= NMT_SIMILARITY_MIN && novelty >= NOVELTY_MIN && overall >= QUALITY_MIN && Boolean(complexity?.accepted),
    components: { math, nmt, novelty, visual, distractors, wording, complexity: complexityFit },
  };
}
