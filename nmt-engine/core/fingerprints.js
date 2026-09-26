export const FINGERPRINT_FIELDS = Object.freeze([
  'topic',
  'family',
  'variant',
  'solution_path',
  'representation',
  'context_type',
  'diagram_type',
  'parameter_bucket',
  'answer_type',
  'distractor_pattern',
]);

function normalizeScalar(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value.trim().toLowerCase();
  return value;
}

export function buildFingerprint(item = {}) {
  const fingerprint = {};
  for (const field of FINGERPRINT_FIELDS) {
    const raw = item[field] ?? item.metadata?.[field] ?? null;
    fingerprint[field] = Array.isArray(raw)
      ? [...new Set(raw.map(normalizeScalar).filter((x) => x != null))].sort()
      : normalizeScalar(raw);
  }
  return fingerprint;
}

export function fingerprintKey(fingerprint) {
  const ordered = {};
  for (const field of FINGERPRINT_FIELDS) ordered[field] = fingerprint?.[field] ?? null;
  return JSON.stringify(ordered);
}
