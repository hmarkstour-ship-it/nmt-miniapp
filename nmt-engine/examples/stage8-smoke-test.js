import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRuntimeBank, OfflineQuestionBankRuntime, RUNTIME_VERSION } from '../runtime/index.js';
import { EXAM_SLOTS, getPublicTopics } from '../../nmt-knowledge.js';
import { validateQuestion, validateExamQuestions } from '../generation/question-generator.js';
import { gradeNmtExam, sanitizeExamQuestions } from '../../nmt-exam-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const loaded = loadRuntimeBank({ root });
const runtime = new OfflineQuestionBankRuntime(loaded.bank, { bankPath: loaded.path });
const stats = runtime.getStats();

assert.equal(RUNTIME_VERSION, 11);
assert.equal(stats.item_count, loaded.bank.items.length);
assert.ok(stats.item_count >= 120, 'runtime bank should contain a substantial offline dataset');
assert.ok(stats.training_plain_count > 0);
assert.ok(stats.training_visual_count > 0);
for (let slot = 1; slot <= 22; slot += 1) {
  assert.ok(stats.mock_slot_coverage[slot] > 0, `slot ${slot} must be covered`);
}

// Every public training topic must be serviceable from the plain offline bank.
for (const topic of getPublicTopics()) {
  const key = topic.key ?? topic.id;
  if (!key) continue;
  const batch = runtime.pickTrainingBatch({
    topic: key,
    difficulty: 'середній',
    count: 4,
    visualMode: 'plain',
    seed: `stage8-training-${key}`,
  });

  assert.equal(batch.length, 4, `${key} should provide a full 4-question buffer`);
  assert.equal(new Set(batch.map((q) => q.id)).size, batch.length, `${key} batch must not repeat IDs`);
  for (const q of batch) {
    assert.equal(q.type, 'choice');
    assert.equal(q.diagram_svg, null, `${key} plain training should not contain a diagram`);
    assert.equal(q.runtime_source, 'offline_bank');
    assert.equal(q.runtime_meta.version, 11);
    assert.ok(validateQuestion(q), `${q.id} must remain compatible with the existing training UI`);
  }
}

// Recent-history avoidance should move the selector to different bank rows when inventory allows it.
const firstTraining = runtime.pickTrainingBatch({
  topic: 'mixed', difficulty: 'середній', count: 5, visualMode: 'plain', seed: 801,
});
const secondTraining = runtime.pickTrainingBatch({
  topic: 'mixed', difficulty: 'середній', count: 5, visualMode: 'plain',
  avoidTexts: firstTraining.map((q) => q.question), seed: 802,
});
assert.equal(firstTraining.filter((q) => secondTraining.some((x) => x.id === q.id)).length, 0);

// Moderation can disable a static bank row without rebuilding the JSON file.
const blocked = firstTraining[0];
runtime.disable(blocked.id);
const afterBlock = runtime.pickTrainingBatch({
  topic: 'mixed', difficulty: 'середній', count: 5, visualMode: 'plain', seed: 803,
});
assert.ok(!afterBlock.some((q) => q.id === blocked.id), 'disabled bank item must not be served');
runtime.enable(blocked.id);

const similar = runtime.pickSimilar(firstTraining[1], {
  difficulty: firstTraining[1].difficulty,
  avoidTexts: firstTraining.map((q) => q.question),
  visualMode: 'plain',
  seed: 804,
});
assert.ok(similar, 'similar-task selector should find another verified bank item');
assert.notEqual(similar.id, firstTraining[1].id);
assert.equal(similar.type, 'choice');
assert.equal(similar.diagram_svg, null);

// Mock NMT must be assembled entirely from the same bank and remain grade-compatible.
const signatures = new Set();
for (let i = 0; i < 30; i += 1) {
  const { questions, quality } = runtime.assembleMock(EXAM_SLOTS, { seed: `stage8-mock-${i}` });
  assert.equal(questions.length, 22);
  assert.equal(new Set(questions.map((q) => q.id)).size, 22, 'one mock must not reuse an item');
  assert.equal(questions.filter((q) => q.type === 'choice').length, 15);
  assert.equal(questions.filter((q) => q.type === 'matching').length, 3);
  assert.equal(questions.filter((q) => q.type === 'short').length, 4);
  validateExamQuestions(questions);

  for (let index = 0; index < questions.length; index += 1) {
    const q = questions[index];
    const slot = EXAM_SLOTS[index];
    assert.equal(q.number, slot.slot);
    assert.equal(q.type, slot.type);
    assert.ok((q.bank_meta?.mock_slots ?? []).includes(slot.slot), `${q.id} must be compatible with slot ${slot.slot}`);
    assert.equal(q.runtime_source, 'offline_bank');
  }

  assert.ok(quality.repeats >= 0);
  signatures.add(questions.map((q) => q.id).join('|'));
}
assert.ok(signatures.size >= 20, 'different seeds should produce many distinct mock variants');

const firstMock = runtime.assembleMock(EXAM_SLOTS, { seed: 'first-attempt' }).questions;
const nextMock = runtime.assembleMock(EXAM_SLOTS, {
  seed: 'second-attempt',
  recentIds: firstMock.map((q) => q.id),
}).questions;
assert.equal(firstMock.filter((q) => nextMock.some((x) => x.id === q.id)).length, 0,
  'a second mock should avoid the immediately previous variant when inventory permits');

const answers = {};
for (let i = 0; i < firstMock.length; i += 1) {
  const q = firstMock[i];
  answers[String(i)] = q.type === 'choice'
    ? q.correct_index
    : q.type === 'matching'
      ? q.correct_pairs
      : q.correct_value;
}
const perfect = gradeNmtExam(firstMock, answers);
assert.equal(perfect.raw_score, 32);
assert.equal(perfect.scaled_score, 200);

const sanitized = sanitizeExamQuestions(firstMock);
for (const q of sanitized) {
  assert.ok(!('correct_index' in q));
  assert.ok(!('correct_pairs' in q));
  assert.ok(!('correct_value' in q));
  assert.ok(!('explanation' in q));
}

console.log('Stage 8 smoke test OK');
console.log(JSON.stringify({
  runtimeVersion: RUNTIME_VERSION,
  bankItems: stats.item_count,
  trainingPlain: stats.training_plain_count,
  trainingVisual: stats.training_visual_count,
  mockSlotsCovered: Object.values(stats.mock_slot_coverage).filter((n) => n > 0).length,
  generatedMockSignatures: signatures.size,
}, null, 2));
