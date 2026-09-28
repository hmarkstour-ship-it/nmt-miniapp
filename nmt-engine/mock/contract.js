import { validateExamQuestions } from '../generation/question-generator.js';
import { MOCK_ENGINE_VERSION } from './constants.js';
import { verifyQuestionSnapshot } from './snapshot.js';

export function validateMockAttemptContract({
  questions,
  snapshotHash,
  mockEngineVersion = MOCK_ENGINE_VERSION,
} = {}) {
  const errors = [];
  try {
    validateExamQuestions(questions);
  } catch (err) {
    errors.push(`exam_validation:${err.message}`);
  }

  if (Number(mockEngineVersion) !== MOCK_ENGINE_VERSION) {
    errors.push(`mock_engine_version:${mockEngineVersion}`);
  }

  const integrity = verifyQuestionSnapshot(questions, snapshotHash);
  if (!integrity.ok) errors.push(integrity.reason);

  const ids = (questions ?? []).map((q) => q?.id).filter(Boolean);
  if (ids.length !== 22 || new Set(ids).size !== 22) errors.push('question_ids_not_unique');

  return { ok: errors.length === 0, errors, integrity };
}
