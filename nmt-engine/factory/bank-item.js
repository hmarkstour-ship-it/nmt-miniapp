import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { FACTORY_VERSION, BANK_SCHEMA_VERSION } from './constants.js';

const BLUEPRINTS = new Map(QUESTION_BLUEPRINTS.map((item) => [item.id, item]));

function publicDifficulty(target) {
  if (target === 'легкий' || target === 'easy') return 'легкий';
  if (target === 'складний' || target === 'hard') return 'складний';
  return 'середній';
}

export function toBankItem({
  raw,
  normalized,
  target,
  difficulty,
  diversity,
  duplicate,
}) {
  const id = `nmt3-${duplicate.contentHash.slice(0, 16)}`;
  const hasVisual = Boolean(raw.visual_spec || raw.diagram_svg);
  const blueprint = BLUEPRINTS.get(raw.blueprint_id) ?? null;

  return {
    ...raw,
    id,
    difficulty: publicDifficulty(target),
    bank_meta: {
      schema_version: BANK_SCHEMA_VERSION,
      factory_version: FACTORY_VERSION,
      content_hash: duplicate.contentHash,
      skeleton_hash: duplicate.skeletonHash,
      family: normalized.family,
      variant: normalized.variant,
      solution_path: normalized.solution_path,
      representation: normalized.representation,
      difficulty_score: difficulty.difficulty.score,
      difficulty_band: difficulty.difficulty.band,
      difficulty_target: difficulty.target.id,
      difficulty_fit: difficulty.fitScore,
      diversity_score: diversity?.diversityScore ?? 100,
      mock_slots: [...(blueprint?.mock_slots ?? [])],
      usage: {
        training: raw.type === 'choice',
        training_plain: raw.type === 'choice' && !hasVisual,
        training_visual: raw.type === 'choice' && hasVisual,
        mock: true,
      },
      visual: {
        required: hasVisual,
        diagram_type: normalized.diagram_type ?? null,
      },
      fingerprint: normalized.fingerprint,
    },
  };
}
