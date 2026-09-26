export function validateDistractors(item) {
  if (item.answer_type !== 'choice') return { ok: true, errors: [] };

  const options = item.options ?? [];
  const normalized = options.map((option) => String(option).trim());
  const errors = [];

  if (options.length !== 5) errors.push(`NMT choice requires 5 options; found ${options.length}`);
  if (new Set(normalized).size !== normalized.length) errors.push('duplicate answer options detected');

  return { ok: errors.length === 0, errors };
}
