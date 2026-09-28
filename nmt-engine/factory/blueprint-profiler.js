import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { generateByBlueprint, validateQuestion } from '../generation/question-generator.js';
import { adaptQuestionEngineItem } from '../integration/question-engine-adapter.js';
import { validateGeneratedItem } from '../validation/generation-validator.js';
import { DifficultyController } from '../difficulty/difficulty-controller.js';
import { withSeededRandom, deriveSeed } from './seeded-rng.js';

const TARGETS = ['легкий', 'середній', 'складний'];

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

export function profileBlueprints({
  samplesPerBlueprint = 18,
  seed = 73001,
  controller = new DifficultyController(),
  blueprints = QUESTION_BLUEPRINTS,
} = {}) {
  const profiles = [];

  for (const blueprint of blueprints) {
    const samples = [];

    for (let i = 0; i < samplesPerBlueprint; i += 1) {
      const raw = withSeededRandom(
        deriveSeed(seed, 'profile', blueprint.id, i),
        () => generateByBlueprint(blueprint.id),
      );

      if (!validateQuestion(raw)) continue;
      const normalized = adaptQuestionEngineItem(raw);
      const validation = validateGeneratedItem(normalized);
      if (!validation.ok) continue;

      const evaluations = Object.fromEntries(
        TARGETS.map((target) => [target, controller.evaluate(normalized, target)]),
      );

      samples.push({
        score: evaluations['середній'].difficulty.score,
        band: evaluations['середній'].difficulty.band,
        type: raw.type,
        variant: normalized.variant,
        hasVisual: Boolean(raw.diagram_svg),
        targetAccepted: Object.fromEntries(
          TARGETS.map((target) => [target, evaluations[target].accepted]),
        ),
        targetFit: Object.fromEntries(
          TARGETS.map((target) => [target, evaluations[target].fitScore]),
        ),
        emittedBlueprintId: raw.blueprint_id ?? null,
      });
    }

    const scores = samples.map((sample) => sample.score);
    const routeScores = {};

    for (const target of TARGETS) {
      if (!samples.length) {
        routeScores[target] = 0;
        continue;
      }
      const acceptanceRate = samples.filter((sample) => sample.targetAccepted[target]).length / samples.length;
      const averageFit = mean(samples.map((sample) => sample.targetFit[target])) / 100;
      routeScores[target] = round((acceptanceRate * 0.75 + averageFit * 0.25) * 100) / 100;
    }

    profiles.push({
      id: blueprint.id,
      topic: blueprint.topic,
      formats: [...(blueprint.formats ?? [])],
      mock_slots: [...(blueprint.mock_slots ?? [])],
      diagram_type: blueprint.diagram_type ?? null,
      source_confidence: blueprint.source_confidence ?? null,
      sampleCount: samples.length,
      minScore: scores.length ? round(Math.min(...scores)) : null,
      meanScore: scores.length ? round(mean(scores)) : null,
      maxScore: scores.length ? round(Math.max(...scores)) : null,
      variants: [...new Set(samples.map((sample) => sample.variant))].sort(),
      answerTypes: [...new Set(samples.map((sample) => sample.type))].sort(),
      visualShare: samples.length
        ? round(samples.filter((sample) => sample.hasVisual).length / samples.length)
        : 0,
      emittedBlueprints: [...new Set(samples.map((sample) => sample.emittedBlueprintId).filter(Boolean))].sort(),
      directEmissionRate: samples.length
        ? round(samples.filter((sample) => sample.emittedBlueprintId === blueprint.id).length / samples.length)
        : 0,
      routeScores,
    });
  }

  return profiles;
}

export function eligibleBlueprintsForTarget(
  profiles,
  target,
  { minimumRouteScore = 0.10 } = {},
) {
  const directProfiles = profiles.filter((profile) => (profile.directEmissionRate ?? 1) > 0);
  const source = directProfiles.length ? directProfiles : profiles;
  const ranked = [...source].sort((a, b) => {
    const diff = (b.routeScores?.[target] ?? 0) - (a.routeScores?.[target] ?? 0);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  const eligible = ranked.filter(
    (profile) => (profile.routeScores?.[target] ?? 0) >= minimumRouteScore,
  );

  return eligible.length ? eligible : ranked.slice(0, Math.min(8, ranked.length));
}
