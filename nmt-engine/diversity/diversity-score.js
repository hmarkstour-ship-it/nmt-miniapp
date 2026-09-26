import { fingerprintSimilarity } from './similarity.js';

export function calculateDiversityScore(candidate, history = [], { compareLast = 30 } = {}) {
  if (!history.length) return 100;
  const recent = history.slice(-compareLast);
  let maxSimilarity = 0;
  for (const item of recent) {
    maxSimilarity = Math.max(maxSimilarity, fingerprintSimilarity(candidate.fingerprint ?? candidate, item.fingerprint ?? item));
  }
  return Math.round((1 - maxSimilarity) * 100);
}
