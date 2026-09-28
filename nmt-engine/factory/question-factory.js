import { generateByBlueprint, validateQuestion } from '../generation/question-generator.js';
import { adaptQuestionEngineItem } from '../integration/question-engine-adapter.js';
import { validateGeneratedItem } from '../validation/generation-validator.js';
import { DifficultyController } from '../difficulty/difficulty-controller.js';
import { DiversityEngine } from '../diversity/diversity-engine.js';
import { selectDifficultyCandidate } from '../difficulty/candidate-selector.js';
import { withSeededRandom, deriveSeed } from './seeded-rng.js';

function rejectionBucket(result) {
  if (!result) return 'unknown';
  if (!result.validation?.ok) return 'validation';
  if (!result.duplicate?.accepted) return 'duplicate';
  if (!result.selection?.difficulty?.accepted) return 'difficulty';
  if (result.selection?.diversity && !result.selection.diversity.accepted) return 'diversity';
  return 'other';
}

export class OfflineQuestionFactory {
  constructor({
    seed = 73001,
    candidateBatchSize = 12,
    maxAttemptsPerRequest = 90,
    diversityHistoryWindow = 8,
    difficultyController = new DifficultyController(),
    diversityEngine = new DiversityEngine({
      minDiversityScore: 8,
      nearDuplicateThreshold: 0.98,
      cooldown: {
        familyCooldown: 2,
        variantCooldown: 4,
        solutionPathCooldown: 2,
      },
      exposure: {
        maxFamilyShare: 0.55,
        maxVariantShare: 0.40,
        minSampleSize: 8,
      },
    }),
  } = {}) {
    this.seed = seed;
    this.candidateBatchSize = candidateBatchSize;
    this.maxAttemptsPerRequest = maxAttemptsPerRequest;
    this.diversityHistoryWindow = diversityHistoryWindow;
    this.difficultyController = difficultyController;
    this.diversityEngine = diversityEngine;
    this.sequence = 0;
  }

  makeCandidate(blueprintId, requestIndex, attemptIndex) {
    const seed = deriveSeed(this.seed, 'candidate', blueprintId, requestIndex, attemptIndex, this.sequence++);
    const raw = withSeededRandom(seed, () => generateByBlueprint(blueprintId));
    if (!validateQuestion(raw)) {
      return { ok: false, raw, validation: { ok: false, errors: ['question-engine validation failed'] } };
    }

    const normalized = adaptQuestionEngineItem(raw);
    const validation = validateGeneratedItem(normalized);
    return { ok: validation.ok, raw, normalized, validation, seed };
  }

  generate({
    blueprintId,
    target,
    history = [],
    duplicateGuard,
    requestIndex = 0,
    strictDifficulty = true,
    strictDiversity = true,
  }) {
    const rejectionStats = {
      validation: 0,
      duplicate: 0,
      difficulty: 0,
      diversity: 0,
      other: 0,
    };
    let bestFallback = null;
    let attempts = 0;

    while (attempts < this.maxAttemptsPerRequest) {
      const batch = [];
      const batchMeta = new Map();

      for (let i = 0; i < this.candidateBatchSize && attempts < this.maxAttemptsPerRequest; i += 1) {
        const created = this.makeCandidate(blueprintId, requestIndex, attempts);
        attempts += 1;
        if (!created.ok) {
          rejectionStats.validation += 1;
          continue;
        }

        const duplicate = duplicateGuard.inspect(created.raw);
        if (!duplicate.accepted) {
          rejectionStats.duplicate += 1;
          continue;
        }

        batch.push(created.normalized);
        batchMeta.set(created.normalized, { ...created, duplicate });
      }

      if (!batch.length) continue;

      const selection = selectDifficultyCandidate(batch, target, {
        controller: this.difficultyController,
        diversityEngine: this.diversityEngine,
        history: history.slice(-this.diversityHistoryWindow),
        difficultyWeight: 0.68,
        diversityWeight: 0.32,
      });

      const meta = batchMeta.get(selection.selected);
      const difficultyOk = selection.difficulty.accepted || !strictDifficulty;
      const diversityOk = !selection.diversity || selection.diversity.accepted || !strictDiversity;
      const accepted = difficultyOk && diversityOk;

      const candidateResult = {
        accepted,
        raw: meta.raw,
        normalized: meta.normalized,
        validation: meta.validation,
        duplicate: meta.duplicate,
        selection,
        attempts,
        seed: meta.seed,
      };

      if (accepted) return { ...candidateResult, rejectionStats };

      if (!selection.difficulty.accepted) rejectionStats.difficulty += 1;
      if (selection.diversity && !selection.diversity.accepted) rejectionStats.diversity += 1;

      if (!bestFallback || selection.evaluated[0].combinedScore > bestFallback.selection.evaluated[0].combinedScore) {
        bestFallback = candidateResult;
      }
    }

    const result = bestFallback ?? {
      accepted: false,
      raw: null,
      normalized: null,
      validation: { ok: false, errors: ['No candidate survived validation/duplicate filtering'] },
      duplicate: null,
      selection: null,
      attempts,
    };

    const bucket = rejectionBucket(result);
    if (bucket in rejectionStats) rejectionStats[bucket] += 1;
    return { ...result, rejectionStats };
  }
}
