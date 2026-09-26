import { sha256 } from '../factory/content-fingerprint.js';
import { MOCK_ENGINE_VERSION, MOCK_INTEGRITY_VERSION } from './constants.js';

function questionIntegrityShape(question) {
  return {
    id: question?.id ?? null,
    number: question?.number ?? null,
    type: question?.type ?? null,
    topic: question?.topic ?? null,
    blueprint_id: question?.blueprint_id ?? null,
    question: question?.question ?? null,
    options: question?.options ?? null,
    left: question?.left ?? null,
    match_options: question?.match_options ?? null,
    correct_index: question?.correct_index ?? null,
    correct_pairs: question?.correct_pairs ?? null,
    correct_value: question?.correct_value ?? null,
    max_score: question?.max_score ?? null,
    diagram_svg: question?.diagram_svg ?? null,
    explanation: question?.explanation ?? null,
    bank_content_hash: question?.bank_meta?.content_hash ?? null,
  };
}

export function questionSnapshotHash(questions = []) {
  return sha256({
    integrity_version: MOCK_INTEGRITY_VERSION,
    questions: questions.map(questionIntegrityShape),
  });
}

export function verifyQuestionSnapshot(questions, expectedHash) {
  if (!expectedHash || !Array.isArray(questions)) {
    return { ok: false, expected: expectedHash || null, actual: null, reason: 'missing_snapshot_hash' };
  }
  const actual = questionSnapshotHash(questions);
  return {
    ok: actual === expectedHash,
    expected: expectedHash,
    actual,
    reason: actual === expectedHash ? null : 'question_snapshot_hash_mismatch',
  };
}

export function createMockAttemptSnapshot({
  questions,
  bank = null,
  assemblyQuality = null,
  assemblySeed = null,
  runtimeVersion = null,
} = {}) {
  if (!Array.isArray(questions) || questions.length !== 22) {
    throw new Error('Mock attempt snapshot requires exactly 22 questions');
  }

  const snapshotHash = questionSnapshotHash(questions);
  const itemIds = questions.map((q) => q?.id).filter(Boolean);
  const contentHashes = questions.map((q) => q?.bank_meta?.content_hash).filter(Boolean);

  return {
    mock_engine_version: MOCK_ENGINE_VERSION,
    integrity_version: MOCK_INTEGRITY_VERSION,
    question_snapshot_hash: snapshotHash,
    runtime_version: runtimeVersion,
    bank_schema_version: bank?.schema_version ?? null,
    factory_version: bank?.factory_version ?? null,
    item_ids: itemIds,
    item_count: questions.length,
    unique_item_count: new Set(itemIds).size,
    content_hash_count: contentHashes.length,
    unique_content_hash_count: new Set(contentHashes).size,
    assembly_seed_hash: assemblySeed == null ? null : sha256(String(assemblySeed)),
    assembly_quality: assemblyQuality ?? null,
  };
}
