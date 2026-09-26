export const DEFAULT_WEIGHTS = Object.freeze({
  topic: 0.08,
  family: 0.22,
  variant: 0.18,
  solution_path: 0.18,
  representation: 0.08,
  context_type: 0.06,
  diagram_type: 0.06,
  parameter_bucket: 0.05,
  answer_type: 0.04,
  distractor_pattern: 0.05,
});

function arrayJaccard(a = [], b = []) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return null;
  const intersection = [...A].filter((item) => B.has(item)).length;
  const union = new Set([...A, ...B]).size;
  return union ? intersection / union : 0;
}

function scalarSimilarity(a, b) {
  if (a == null && b == null) return null;
  if (a == null || b == null) return 0;
  return a === b ? 1 : 0;
}

export function fieldSimilarity(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return arrayJaccard(Array.isArray(a) ? a : [], Array.isArray(b) ? b : []);
  }
  return scalarSimilarity(a, b);
}

export function fingerprintSimilarity(a, b, weights = DEFAULT_WEIGHTS) {
  let weighted = 0;
  let totalWeight = 0;

  for (const [field, weight] of Object.entries(weights)) {
    const similarity = fieldSimilarity(a?.[field], b?.[field]);
    if (similarity == null) continue;
    weighted += similarity * weight;
    totalWeight += weight;
  }

  return totalWeight ? weighted / totalWeight : 0;
}
