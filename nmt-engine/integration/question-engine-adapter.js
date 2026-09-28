import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { buildFingerprint } from '../core/fingerprints.js';
import { visualSpecFromQuestion } from '../visuals/visual-spec.js';

const BLUEPRINTS = new Map(QUESTION_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));
function splitVariant(question){const key=question.variant_key??'';const i=key.indexOf(':');return i>=0?(key.slice(i+1)||'base'):(key||'base');}

export function adaptQuestionEngineItem(question) {
  if (!question || typeof question !== 'object') throw new Error('question must be an object');
  const blueprint = BLUEPRINTS.get(question.blueprint_id) ?? null;
  const g = question.genome ?? question.core_meta?.genome ?? {};
  const normalized = {
    id: question.id ?? null,
    topic: question.topic ?? blueprint?.topic ?? 'unknown',
    family: g.family ?? question.blueprint_id ?? 'unknown',
    variant: splitVariant(question),
    question: question.question ?? '',
    answer_type: question.type,
    options: question.options ?? null,
    correct_index: question.correct_index ?? null,
    left: question.left ?? null,
    match_options: question.match_options ?? null,
    correct_pairs: question.correct_pairs ?? null,
    correct_value: question.correct_value ?? null,
    explanation: question.explanation ?? '',
    diagram_svg: question.diagram_svg ?? null,
    solution_path: (g.solution_path ?? []).join('>') || blueprint?.skill || question.blueprint_id,
    representation: g.representation ?? (question.visual_spec ? 'diagram' : 'text'),
    context_type: g.context ?? question.topic ?? null,
    diagram_type: question.visual_spec?.diagram_type ?? blueprint?.diagram_type ?? null,
    parameter_bucket: g.parameter_pattern ?? null,
    distractor_pattern: g.distractor_logic ?? [],
    genome: g,
    source_question: question,
  };
  normalized.visual = visualSpecFromQuestion(question);
  normalized.fingerprint = buildFingerprint(normalized);
  return normalized;
}
