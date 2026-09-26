import assert from 'node:assert/strict';
import {
  buildQuestionBank,
  auditQuestionBank,
  contentFingerprint,
} from '../factory/index.js';
import { normalizeDifficultyTarget } from '../difficulty/index.js';

const options = {
  total: 64,
  seed: 70707,
  profileSamplesPerBlueprint: 8,
  candidateBatchSize: 8,
  maxAttemptsPerRequest: 72,
  maxPerSkeleton: 24,
};

const bank = buildQuestionBank(options);
const audit = auditQuestionBank(bank);

assert.equal(bank.item_count, 64);
assert.equal(bank.items.length, 64);
assert.equal(audit.valid, true, audit.validationErrors.join('\n'));
assert.equal(audit.uniqueContentCount, 64);
assert.equal(Object.values(audit.slotCoverage).filter((slot) => slot.compatibleItems > 0).length, 22);
assert.ok(audit.trainingPlainCount > 0);
assert.ok(audit.trainingVisualCount > 0);
assert.ok((audit.byType.choice ?? 0) > 0);
assert.ok((audit.byType.matching ?? 0) > 0);
assert.ok((audit.byType.short ?? 0) > 0);

for (const item of bank.items) {
  assert.equal(contentFingerprint(item), item.bank_meta.content_hash);
  const target = normalizeDifficultyTarget(item.difficulty);
  assert.ok(item.bank_meta.difficulty_score >= target.minScore);
  assert.ok(item.bank_meta.difficulty_score <= target.maxScore);
  if (item.bank_meta.usage.training_plain) assert.equal(Boolean(item.diagram_svg), false);
}

// Reproducibility: the same seed/config must build the same content sequence.
const replay = buildQuestionBank(options);
assert.deepEqual(
  replay.items.map((item) => item.bank_meta.content_hash),
  bank.items.map((item) => item.bank_meta.content_hash),
);

console.log(JSON.stringify({
  ok: true,
  items: bank.item_count,
  byType: audit.byType,
  byDifficulty: audit.byDifficulty,
  blueprints: Object.keys(audit.byBlueprint).length,
  topics: Object.keys(audit.byTopic).length,
  mockSlotsCovered: Object.values(audit.slotCoverage).filter((slot) => slot.compatibleItems > 0).length,
  uniqueSkeletons: audit.uniqueSkeletonCount,
  averageDifficultyScore: audit.averageDifficultyScore,
  averageDiversityScore: audit.averageDiversityScore,
}, null, 2));
