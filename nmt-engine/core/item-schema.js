import { ANSWER_TYPES } from './constants.js';

export function validateNormalizedItemShape(item) {
  const errors = [];

  if (!item || typeof item !== 'object') return { ok: false, errors: ['item must be an object'] };

  for (const field of ['topic', 'family', 'variant', 'question', 'answer_type']) {
    if (typeof item[field] !== 'string' || !item[field].trim()) errors.push(`${field} must be a non-empty string`);
  }

  if (!Object.values(ANSWER_TYPES).includes(item.answer_type)) {
    errors.push(`unsupported answer_type: ${item.answer_type}`);
  }

  if (item.answer_type === ANSWER_TYPES.CHOICE) {
    if (!Array.isArray(item.options) || item.options.length !== 5) errors.push('choice item must have exactly 5 options');
    if (!Number.isInteger(item.correct_index) || item.correct_index < 0 || item.correct_index > 4) {
      errors.push('choice item must have correct_index in [0, 4]');
    }
  }

  if (item.answer_type === ANSWER_TYPES.MATCHING) {
    if (!Array.isArray(item.left) || item.left.length !== 3) errors.push('matching item must have exactly 3 left entries');
    if (!Array.isArray(item.match_options) || item.match_options.length !== 5) errors.push('matching item must have exactly 5 match options');
  }

  if (item.answer_type === ANSWER_TYPES.SHORT && !Number.isFinite(Number(item.correct_value))) {
    errors.push('short item must have a finite correct_value');
  }

  return { ok: errors.length === 0, errors };
}
