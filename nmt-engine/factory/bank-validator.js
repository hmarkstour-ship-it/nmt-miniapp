import { validateQuestion } from '../../question-engine.js';

export function validateBankItem(item) {
  const errors = [];
  if (!validateQuestion(item)) errors.push('invalid_question_shape');
  if (!item?.id || !String(item.id).startsWith('nmt3-')) errors.push('invalid_bank_id');
  if (!item?.bank_meta?.content_hash) errors.push('missing_content_hash');
  if (!Number.isFinite(Number(item?.bank_meta?.difficulty_score))) errors.push('missing_difficulty_score');
  if (!item?.bank_meta?.difficulty_band) errors.push('missing_difficulty_band');
  if (!item?.bank_meta?.usage) errors.push('missing_usage_metadata');
  return { ok: errors.length === 0, errors };
}

export function validateQuestionBank(bank) {
  const errors = [];
  if (!bank || typeof bank !== 'object') return { ok: false, errors: ['bank must be an object'] };
  if (!Array.isArray(bank.items)) return { ok: false, errors: ['bank.items must be an array'] };
  if (bank.item_count !== bank.items.length) errors.push('item_count_mismatch');

  const ids = new Set();
  const hashes = new Set();
  bank.items.forEach((item, index) => {
    const itemResult = validateBankItem(item);
    for (const error of itemResult.errors) errors.push(`item_${index + 1}:${error}`);
    if (ids.has(item.id)) errors.push(`item_${index + 1}:duplicate_id`);
    ids.add(item.id);
    const hash = item.bank_meta?.content_hash;
    if (hash && hashes.has(hash)) errors.push(`item_${index + 1}:duplicate_content_hash`);
    if (hash) hashes.add(hash);
  });

  return { ok: errors.length === 0, errors };
}
