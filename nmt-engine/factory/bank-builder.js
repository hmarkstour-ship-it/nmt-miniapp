import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { DifficultyController } from '../difficulty/difficulty-controller.js';
import { DiversityEngine } from '../diversity/diversity-engine.js';
import { profileBlueprints, eligibleBlueprintsForTarget } from './blueprint-profiler.js';
import { buildCoveragePlan } from './coverage-planner.js';
import { BankDuplicateGuard } from './content-fingerprint.js';
import { OfflineQuestionFactory } from './question-factory.js';
import { toBankItem } from './bank-item.js';
import {
  FACTORY_VERSION,
  BANK_SCHEMA_VERSION,
  DEFAULT_DIFFICULTY_MIX,
  DEFAULT_FACTORY_OPTIONS,
} from './constants.js';

function mergeStats(total, next) {
  for (const [key, value] of Object.entries(next ?? {})) {
    total[key] = (total[key] ?? 0) + Number(value || 0);
  }
  return total;
}

function rotate(items, offset) {
  if (!items.length) return [];
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

export function buildQuestionBank({
  total = DEFAULT_FACTORY_OPTIONS.total,
  seed = DEFAULT_FACTORY_OPTIONS.seed,
  difficultyMix = DEFAULT_DIFFICULTY_MIX,
  topic = null,
  answerType = null,
  profileSamplesPerBlueprint = DEFAULT_FACTORY_OPTIONS.profileSamplesPerBlueprint,
  candidateBatchSize = DEFAULT_FACTORY_OPTIONS.candidateBatchSize,
  maxAttemptsPerRequest = DEFAULT_FACTORY_OPTIONS.maxAttemptsPerRequest,
  diversityHistoryWindow = DEFAULT_FACTORY_OPTIONS.diversityHistoryWindow,
  maxPerSkeleton = DEFAULT_FACTORY_OPTIONS.maxPerSkeleton,
  strictDifficulty = DEFAULT_FACTORY_OPTIONS.strictDifficulty,
  strictDiversity = DEFAULT_FACTORY_OPTIONS.strictDiversity,
  allowPartial = false,
  difficultyController = new DifficultyController(),
  diversityEngine = new DiversityEngine({
    minDiversityScore: 8,
    nearDuplicateThreshold: 0.98,
    cooldown: { familyCooldown: 2, variantCooldown: 4, solutionPathCooldown: 2 },
    exposure: { maxFamilyShare: 0.55, maxVariantShare: 0.40, minSampleSize: 8 },
  }),
} = {}) {
  const scopedBlueprints = QUESTION_BLUEPRINTS.filter((blueprint) => {
    if (topic && topic !== 'mixed' && blueprint.topic !== topic) return false;
    return true;
  });

  const profiles = profileBlueprints({
    samplesPerBlueprint: profileSamplesPerBlueprint,
    seed,
    controller: difficultyController,
    blueprints: scopedBlueprints,
  });

  const plan = buildCoveragePlan({
    total,
    profiles,
    difficultyMix,
    topic,
    answerType,
  });

  const duplicateGuard = new BankDuplicateGuard({ maxPerSkeleton });
  const factory = new OfflineQuestionFactory({
    seed,
    candidateBatchSize,
    maxAttemptsPerRequest,
    diversityHistoryWindow,
    difficultyController,
    diversityEngine,
  });

  const history = [];
  const items = [];
  const failures = [];
  const rejectionStats = {};

  for (let requestIndex = 0; requestIndex < plan.requests.length; requestIndex += 1) {
    const request = plan.requests[requestIndex];
    const eligible = eligibleBlueprintsForTarget(profiles, request.target);
    const ids = [
      request.blueprintId,
      ...eligible.map((profile) => profile.id).filter((id) => id !== request.blueprintId),
    ];
    const candidates = request.coverageSeed ? ids : rotate(ids, requestIndex);
    let accepted = null;

    for (const blueprintId of candidates) {
      const profile = profiles.find((item) => item.id === blueprintId);
      if (!profile) continue;
      if (answerType && !profile.answerTypes.includes(answerType)) continue;

      const result = factory.generate({
        blueprintId,
        target: request.target,
        history,
        duplicateGuard,
        requestIndex,
        strictDifficulty,
        strictDiversity: request.coverageSeed && blueprintId === request.blueprintId
          ? false
          : strictDiversity,
      });
      mergeStats(rejectionStats, result.rejectionStats);

      if (!result.accepted || !result.raw || !result.normalized) continue;

      const duplicate = duplicateGuard.add(result.raw);
      if (!duplicate.accepted) {
        rejectionStats.duplicate = (rejectionStats.duplicate ?? 0) + 1;
        continue;
      }

      const item = toBankItem({
        raw: result.raw,
        normalized: result.normalized,
        target: request.target,
        difficulty: result.selection.difficulty,
        diversity: result.selection.diversity,
        duplicate,
      });

      items.push(item);
      history.push(result.normalized);
      accepted = { blueprintId, item };
      break;
    }

    if (!accepted) {
      failures.push({
        requestIndex,
        target: request.target,
        primaryBlueprintId: request.blueprintId,
      });
      if (!allowPartial) {
        const error = new Error(
          `Stage 7 factory could not satisfy request ${requestIndex + 1}/${plan.requests.length} (${request.target})`,
        );
        error.factoryState = { itemsBuilt: items.length, failures, rejectionStats, plan };
        throw error;
      }
    }
  }

  const bank = {
    schema_version: BANK_SCHEMA_VERSION,
    factory_version: FACTORY_VERSION,
    engine_name: 'NMT Engine 3.0',
    mode: 'offline_question_bank',
    seed,
    requested_item_count: total,
    item_count: items.length,
    scope: {
      topic: topic ?? 'mixed',
      answer_type: answerType ?? 'all',
    },
    difficulty_mix: difficultyMix,
    plan: {
      difficulty_counts: plan.difficultyCounts,
      profile_samples_per_blueprint: profileSamplesPerBlueprint,
    },
    build_stats: {
      failures,
      rejection_stats: rejectionStats,
      duplicate_guard: duplicateGuard.snapshot(),
    },
    profiles,
    items,
  };

  return bank;
}
