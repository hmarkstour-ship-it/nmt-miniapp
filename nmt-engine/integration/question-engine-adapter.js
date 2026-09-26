import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { buildFingerprint } from '../core/fingerprints.js';
import { visualSpecFromQuestion } from '../visuals/visual-spec.js';

const BLUEPRINTS = new Map(QUESTION_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));

function splitVariant(question) {
  const key = question.variant_key ?? '';
  const separator = key.indexOf(':');
  if (separator >= 0) return key.slice(separator + 1) || 'base';
  return key || 'base';
}

function inferRepresentation(question, blueprint) {
  if (!question.diagram_svg) return 'text';
  const type = blueprint?.diagram_type ?? '';
  if (type.includes('chart')) return 'chart';
  if (type.includes('graph')) return 'graph';
  if (['solid', 'linked_solids'].includes(type)) return 'spatial_diagram';
  return 'geometry_diagram';
}

function inferDistractorPattern(question) {
  if (question.type !== 'choice') return [];
  return ['generated_distractors', `option_count_${question.options?.length ?? 0}`];
}

export function adaptQuestionEngineItem(question) {
  if (!question || typeof question !== 'object') throw new Error('question must be an object');
  const blueprint = BLUEPRINTS.get(question.blueprint_id) ?? null;
  const normalized = {
    id: question.id ?? null,
    topic: question.topic ?? blueprint?.topic ?? 'unknown',
    family: question.blueprint_id ?? 'unknown',
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
    solution_path: blueprint?.skill ?? question.subtopic ?? question.blueprint_id ?? null,
    representation: inferRepresentation(question, blueprint),
    context_type: question.topic ?? null,
    diagram_type: blueprint?.diagram_type ?? null,
    parameter_bucket: question.difficulty ?? null,
    distractor_pattern: inferDistractorPattern(question),
    source_question: question,
  };
  normalized.visual = visualSpecFromQuestion(question, normalized.diagram_type);
  normalized.fingerprint = buildFingerprint(normalized);
  return normalized;
}
