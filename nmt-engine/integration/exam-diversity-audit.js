import { adaptQuestionEngineItem } from './question-engine-adapter.js';
import { fingerprintSimilarity } from '../diversity/similarity.js';

export function auditExamDiversity(questions, { nearDuplicateThreshold = 0.86 } = {}) {
  if (!Array.isArray(questions)) throw new Error('questions must be an array');
  const normalized = questions.map(adaptQuestionEngineItem);
  const issues = [];

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const score = fingerprintSimilarity(normalized[i].fingerprint, normalized[j].fingerprint);
      if (score >= nearDuplicateThreshold) {
        issues.push({
          first: i + 1,
          second: j + 1,
          similarity: Number(score.toFixed(3)),
          first_family: normalized[i].family,
          second_family: normalized[j].family,
        });
      }
    }
  }

  return {
    itemCount: normalized.length,
    nearDuplicateThreshold,
    issueCount: issues.length,
    issues,
  };
}
