import { buildFingerprint } from '../core/fingerprints.js';

export function buildItem(input) {
  const item = {
    id: input.id ?? null,
    topic: input.topic,
    family: input.family,
    variant: input.variant,
    question: input.question,
    answer_type: input.answer_type,
    options: input.options ?? null,
    correct_index: input.correct_index ?? null,
    left: input.left ?? null,
    match_options: input.match_options ?? null,
    correct_pairs: input.correct_pairs ?? null,
    correct_value: input.correct_value ?? null,
    explanation: input.explanation ?? '',
    diagram_svg: input.diagram_svg ?? null,
    metadata: { ...(input.metadata ?? {}) },
    solution_path: input.solution_path ?? input.metadata?.solution_path ?? null,
    representation: input.representation ?? input.metadata?.representation ?? 'text',
    context_type: input.context_type ?? input.metadata?.context_type ?? null,
    diagram_type: input.diagram_type ?? input.metadata?.diagram_type ?? null,
    parameter_bucket: input.parameter_bucket ?? input.metadata?.parameter_bucket ?? null,
    distractor_pattern: input.distractor_pattern ?? input.metadata?.distractor_pattern ?? [],
  };

  item.fingerprint = buildFingerprint(item);
  return item;
}
