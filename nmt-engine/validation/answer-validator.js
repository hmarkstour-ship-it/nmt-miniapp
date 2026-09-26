export function validateAnswer(item) {
  const errors = [];

  if (item.answer_type === 'choice') {
    const options = item.options ?? [];
    if (!Number.isInteger(item.correct_index) || item.correct_index < 0 || item.correct_index >= options.length) {
      errors.push('choice correct_index is outside options');
    }
  }

  if (item.answer_type === 'matching') {
    const pairs = item.correct_pairs ?? {};
    if (Object.keys(pairs).length !== 3) errors.push('matching item must contain exactly 3 correct pairs');
  }

  if (item.answer_type === 'short' && !Number.isFinite(Number(item.correct_value))) {
    errors.push('short answer is not finite');
  }

  return { ok: errors.length === 0, errors };
}
