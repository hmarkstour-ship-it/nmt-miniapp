import { genomeDistance, genomeSignature } from './genome.js';

function textSkeleton(s='') {
  return String(s).toLowerCase().replace(/\\\([\s\S]*?\\\)/g,' <math> ').replace(/\d+(?:[.,]\d+)?/g,'#').replace(/\s+/g,' ').trim();
}

export function noveltyScore(candidate, history = []) {
  if (!history.length) return { score:100, nearest:null };
  let maxStructural = 0, exactSkeleton = false, nearest = null;
  const cg = candidate.genome;
  const cs = textSkeleton(candidate.question?.question ?? candidate.question ?? '');
  for (const item of history) {
    const d = genomeDistance(cg, item.genome ?? item?.bank_meta?.genome);
    const sim = 1-d;
    if (sim > maxStructural) { maxStructural = sim; nearest = item; }
    const other = textSkeleton(item.question?.question ?? item.question ?? '');
    if (cs && other === cs) exactSkeleton = true;
  }
  const score = Math.max(0, Math.round(100 - maxStructural*72 - (exactSkeleton?35:0)));
  return { score, nearest: nearest ? genomeSignature(nearest.genome ?? nearest?.bank_meta?.genome ?? {}) : null };
}
