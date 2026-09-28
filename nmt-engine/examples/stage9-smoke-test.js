import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRuntimeBank, OfflineQuestionBankRuntime, RUNTIME_VERSION } from '../runtime/index.js';
import {
  MOCK_ENGINE_VERSION,
  createMockAttemptSnapshot,
  questionSnapshotHash,
  verifyQuestionSnapshot,
  normalizeMockAnswer,
  normalizeMockAnswers,
  applyAnswerRevision,
  remainingSeconds,
  isAttemptExpired,
  auditGradeResult,
  gradeResultHash,
  validateMockAttemptContract,
} from '../mock/index.js';
import { EXAM_SLOTS } from '../../nmt-knowledge.js';
import { gradeNmtExam, sanitizeExamQuestions, scoreToScale } from '../../nmt-exam-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const loaded = loadRuntimeBank({ root });
const runtime = new OfflineQuestionBankRuntime(loaded.bank, { bankPath: loaded.path });

assert.equal(MOCK_ENGINE_VERSION, 11);
assert.equal(RUNTIME_VERSION, 11);

const assemblySeed = 'stage9-smoke-attempt-session-0001';
const assembled = runtime.assembleMock(EXAM_SLOTS, { seed: assemblySeed });
const questions = assembled.questions;
assert.equal(questions.length, 22);
assert.equal(new Set(questions.map((q) => q.id)).size, 22);

const snapshot = createMockAttemptSnapshot({
  questions,
  bank: loaded.bank,
  assemblyQuality: assembled.quality,
  assemblySeed,
  runtimeVersion: RUNTIME_VERSION,
});

assert.equal(snapshot.mock_engine_version, 11);
assert.equal(snapshot.runtime_version, 11);
assert.equal(snapshot.item_count, 22);
assert.equal(snapshot.unique_item_count, 22);
assert.equal(snapshot.question_snapshot_hash, questionSnapshotHash(questions));
assert.equal(verifyQuestionSnapshot(questions, snapshot.question_snapshot_hash).ok, true);

const roundTrip = JSON.parse(JSON.stringify(questions));
assert.equal(
  questionSnapshotHash(roundTrip),
  snapshot.question_snapshot_hash,
  'JSONB-style key reordering/round trip must not change the snapshot hash',
);

const contract = validateMockAttemptContract({
  questions,
  snapshotHash: snapshot.question_snapshot_hash,
  mockEngineVersion: MOCK_ENGINE_VERSION,
});
assert.equal(contract.ok, true, contract.errors.join(', '));

const tampered = JSON.parse(JSON.stringify(questions));
const choiceIndex = tampered.findIndex((q) => q.type === 'choice');
assert.ok(choiceIndex >= 0);
tampered[choiceIndex].correct_index = (tampered[choiceIndex].correct_index + 1) % 5;
assert.equal(verifyQuestionSnapshot(tampered, snapshot.question_snapshot_hash).ok, false);
assert.equal(validateMockAttemptContract({
  questions: tampered,
  snapshotHash: snapshot.question_snapshot_hash,
  mockEngineVersion: MOCK_ENGINE_VERSION,
}).ok, false);

// Server-side answer normalization.
const choice = questions.find((q) => q.type === 'choice');
assert.equal(normalizeMockAnswer(choice, '2'), 2);
assert.equal(normalizeMockAnswer(choice, '99'), null);
const matching = questions.find((q) => q.type === 'matching');
const codes = matching.match_options.map((x) => x.code);
const normalizedMatching = normalizeMockAnswer(matching, {
  0: codes[0],
  1: codes[0], // duplicate must be discarded
  2: 'INVALID',
});
assert.deepEqual(normalizedMatching, { 0: codes[0] });
const short = questions.find((q) => q.type === 'short');
assert.equal(normalizeMockAnswer(short, ' 2,50 '), '2,50');

// Out-of-order autosave protection: newer revision wins, older one becomes stale.
const firstQuestionIndex = questions.findIndex((q) => q.type === 'choice');
let answerState = {};
let revisionState = {};
let applied = applyAnswerRevision({
  questions,
  answers: answerState,
  revisions: revisionState,
  index: firstQuestionIndex,
  answer: 3,
  revision: 2,
});
assert.equal(applied.accepted, true);
answerState = applied.answers;
revisionState = applied.revisions;
applied = applyAnswerRevision({
  questions,
  answers: answerState,
  revisions: revisionState,
  index: firstQuestionIndex,
  answer: 1,
  revision: 1,
});
assert.equal(applied.accepted, false);
assert.equal(applied.stale, true);
assert.equal(applied.answers[String(firstQuestionIndex)], 3);

// Server-authoritative timer.
const start = new Date('2026-09-27T10:00:00.000Z');
const expires = new Date('2026-09-27T11:00:00.000Z');
assert.equal(remainingSeconds({
  startedAt: start,
  expiresAt: expires,
  durationSeconds: 3600,
  now: new Date('2026-09-27T10:30:00.000Z'),
}), 1800);
assert.equal(isAttemptExpired({
  startedAt: start,
  expiresAt: expires,
  durationSeconds: 3600,
  now: new Date('2026-09-27T11:00:00.001Z'),
}), true);

// Perfect grading + independent Stage 9 audit.
const perfectAnswers = {};
for (let i = 0; i < questions.length; i += 1) {
  const q = questions[i];
  perfectAnswers[String(i)] = q.type === 'choice'
    ? q.correct_index
    : q.type === 'matching'
      ? q.correct_pairs
      : q.correct_value;
}
const normalizedPerfect = normalizeMockAnswers(questions, perfectAnswers);
const perfect = gradeNmtExam(questions, normalizedPerfect);
assert.equal(perfect.raw_score, 32);
assert.equal(perfect.scaled_score, 200);
const gradeAudit = auditGradeResult(questions, normalizedPerfect, perfect, { scoreToScale });
assert.equal(gradeAudit.ok, true, gradeAudit.errors.join(', '));
const resultHashA = gradeResultHash({
  snapshotHash: snapshot.question_snapshot_hash,
  answers: normalizedPerfect,
  result: perfect,
});
const resultHashB = gradeResultHash({
  snapshotHash: snapshot.question_snapshot_hash,
  answers: normalizedPerfect,
  result: JSON.parse(JSON.stringify(perfect)),
});
assert.equal(resultHashA, resultHashB);

const corruptedResult = { ...perfect, raw_score: 31 };
assert.equal(
  auditGradeResult(questions, normalizedPerfect, corruptedResult, { scoreToScale }).ok,
  false,
  'independent audit must catch grading corruption',
);

// Correct answers must not be exposed in the active attempt payload.
const clientQuestions = sanitizeExamQuestions(questions);
for (const q of clientQuestions) {
  assert.ok(!('correct_index' in q));
  assert.ok(!('correct_pairs' in q));
  assert.ok(!('correct_value' in q));
  assert.ok(!('correct_display' in q));
  assert.ok(!('explanation' in q));
}

console.log('Stage 9 smoke test OK');
console.log(JSON.stringify({
  mockEngineVersion: MOCK_ENGINE_VERSION,
  runtimeVersion: RUNTIME_VERSION,
  questions: questions.length,
  uniqueIds: new Set(questions.map((q) => q.id)).size,
  snapshotHash: snapshot.question_snapshot_hash.slice(0, 16),
  resultHash: resultHashA.slice(0, 16),
  perfectRaw: perfect.raw_score,
  perfectScaled: perfect.scaled_score,
  assemblyQuality: assembled.quality,
}, null, 2));
