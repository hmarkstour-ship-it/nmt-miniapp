import { EXAM_SLOTS } from '../../nmt-knowledge.js';
import { normalizeDifficultyTarget } from '../difficulty/difficulty-bands.js';
import { validateQuestionBank } from './bank-validator.js';

function countBy(items, getter) {
  const out = {};
  for (const item of items) {
    const key = getter(item) ?? 'unknown';
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function average(items, getter) {
  if (!items.length) return 0;
  return Math.round((items.reduce((sum, item) => sum + Number(getter(item) || 0), 0) / items.length) * 10) / 10;
}

function fitsStoredDifficulty(item) {
  try {
    const target = normalizeDifficultyTarget(item.difficulty);
    const score = Number(item.bank_meta?.difficulty_score);
    return Number.isFinite(score) && score >= target.minScore && score <= target.maxScore;
  } catch {
    return false;
  }
}

export function auditQuestionBank(bank) {
  const items = bank.items ?? [];
  const validation = validateQuestionBank(bank);
  const exactHashes = items.map((item) => item.bank_meta?.content_hash).filter(Boolean);
  const skeletonHashes = items.map((item) => item.bank_meta?.skeleton_hash).filter(Boolean);
  const skeletonCounts = countBy(items, (item) => item.bank_meta?.skeleton_hash);
  const correctPositionCounts = countBy(
    items.filter((item) => item.type === 'choice'),
    (item) => String(item.correct_index ?? 'unknown'),
  );

  const slotCoverage = {};
  for (const slot of EXAM_SLOTS) {
    const compatible = items.filter((item) =>
      item.type === slot.type
      && (item.bank_meta?.mock_slots ?? []).includes(slot.slot),
    );
    slotCoverage[slot.slot] = {
      type: slot.type,
      compatibleItems: compatible.length,
      blueprintCount: new Set(compatible.map((item) => item.blueprint_id)).size,
    };
  }

  const directProfiles = (bank.profiles ?? []).filter((profile) => (profile.directEmissionRate ?? 1) > 0);
  const representedBlueprints = new Set(items.map((item) => item.blueprint_id));
  const missingDirectBlueprints = directProfiles
    .map((profile) => profile.id)
    .filter((id) => !representedBlueprints.has(id));

  return {
    valid: validation.ok,
    validationErrors: validation.errors,
    itemCount: items.length,
    uniqueContentCount: new Set(exactHashes).size,
    uniqueSkeletonCount: new Set(skeletonHashes).size,
    maxSkeletonReuse: Math.max(0, ...Object.values(skeletonCounts)),
    directBlueprintCount: directProfiles.length,
    representedDirectBlueprintCount: directProfiles.length - missingDirectBlueprints.length,
    missingDirectBlueprints,
    mockSlotsCovered: Object.values(slotCoverage).filter((slot) => slot.compatibleItems > 0).length,
    difficultyMismatchCount: items.filter((item) => !fitsStoredDifficulty(item)).length,
    byType: countBy(items, (item) => item.type),
    byTopic: countBy(items, (item) => item.topic),
    byBlueprint: countBy(items, (item) => item.blueprint_id),
    byDifficulty: countBy(items, (item) => item.difficulty),
    byDifficultyBand: countBy(items, (item) => item.bank_meta?.difficulty_band),
    visualCount: items.filter((item) => item.bank_meta?.visual?.required).length,
    trainingPlainCount: items.filter((item) => item.bank_meta?.usage?.training_plain).length,
    trainingVisualCount: items.filter((item) => item.bank_meta?.usage?.training_visual).length,
    averageDifficultyScore: average(items, (item) => item.bank_meta?.difficulty_score),
    averageDiversityScore: average(items, (item) => item.bank_meta?.diversity_score),
    correctPositionCounts,
    slotCoverage,
  };
}
