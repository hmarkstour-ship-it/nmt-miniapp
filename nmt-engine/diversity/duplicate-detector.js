import { fingerprintKey } from './fingerprint.js';
import { fingerprintSimilarity } from './similarity.js';

export function isExactStructuralDuplicate(candidate, history = []) {
  const candidateKey = fingerprintKey(candidate.fingerprint ?? candidate);
  return history.some((item) => fingerprintKey(item.fingerprint ?? item) === candidateKey);
}

export function findNearDuplicate(candidate, history = [], threshold = 0.86) {
  let best = null;
  for (const item of history) {
    const score = fingerprintSimilarity(candidate.fingerprint ?? candidate, item.fingerprint ?? item);
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= threshold ? best : null;
}
