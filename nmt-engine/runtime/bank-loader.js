import fs from 'node:fs';
import path from 'node:path';
import { validateQuestionBank } from '../factory/bank-validator.js';
import { DEFAULT_RUNTIME_BANK_PATH } from './constants.js';

export function resolveRuntimeBankPath({ root = process.cwd(), bankPath = null } = {}) {
  const requested = bankPath || process.env.NMT_OFFLINE_BANK_PATH || DEFAULT_RUNTIME_BANK_PATH;
  return path.isAbsolute(requested) ? requested : path.resolve(root, requested);
}

export function loadRuntimeBank({ root = process.cwd(), bankPath = null } = {}) {
  const absolutePath = resolveRuntimeBankPath({ root, bankPath });
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Offline NMT bank not found: ${absolutePath}`);
  }

  let bank;
  try {
    bank = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (err) {
    throw new Error(`Offline NMT bank is not valid JSON: ${err.message}`);
  }

  const validation = validateQuestionBank(bank);
  if (!validation.ok) {
    throw new Error(`Offline NMT bank failed validation: ${validation.errors.slice(0, 8).join(', ')}`);
  }

  return {
    bank,
    path: absolutePath,
    itemCount: bank.items.length,
  };
}
