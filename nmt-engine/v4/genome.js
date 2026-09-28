import crypto from 'node:crypto';
import { GENOME_VERSION } from './constants.js';

const clean = (v) => Array.isArray(v) ? v.map(clean) : (typeof v === 'string' ? v.trim().toLowerCase() : v);

export function createGenome(input = {}) {
  const genome = {
    version: GENOME_VERSION,
    topic: input.topic ?? 'unknown',
    subtopic: input.subtopic ?? null,
    family: input.family ?? input.blueprintId ?? 'unknown',
    concept: input.concept ?? 'unknown',
    solution_path: [...(input.solutionPath ?? [])],
    steps: Number(input.steps ?? 3),
    hidden_relations: [...(input.hiddenRelations ?? [])],
    conceptual_jumps: Number(input.conceptualJumps ?? 1),
    algebra_load: Number(input.algebraLoad ?? 0),
    visual_reasoning: Number(input.visualReasoning ?? 0),
    theorem_recall: Number(input.theoremRecall ?? 0),
    combined_topics: [...(input.combinedTopics ?? [])],
    context: input.context ?? 'abstract',
    representation: input.representation ?? 'text',
    visual_topology: input.visualTopology ?? null,
    parameter_pattern: input.parameterPattern ?? 'mixed-integers',
    answer_format: input.answerFormat ?? 'choice',
    distractor_logic: [...(input.distractorLogic ?? [])],
    wording_style: input.wordingStyle ?? 'nmt-compact',
  };
  return Object.freeze(genome);
}

export function genomeSignature(genome) {
  const stable = JSON.stringify(Object.fromEntries(Object.entries(genome).map(([k,v]) => [k, clean(v)])));
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 24);
}

export function genomeDistance(a, b) {
  if (!a || !b) return 1;
  const fields = [
    ['family', .18], ['concept', .16], ['solution_path', .20], ['hidden_relations', .12],
    ['context', .07], ['representation', .06], ['visual_topology', .08],
    ['parameter_pattern', .05], ['distractor_logic', .08],
  ];
  let similarity = 0;
  for (const [field, weight] of fields) {
    const av = a[field], bv = b[field];
    if (Array.isArray(av) || Array.isArray(bv)) {
      const A = new Set(av ?? []), B = new Set(bv ?? []);
      const union = new Set([...A, ...B]).size || 1;
      const intersection = [...A].filter((x) => B.has(x)).length;
      similarity += weight * (intersection / union);
    } else if (av === bv) similarity += weight;
  }
  return Math.max(0, Math.min(1, 1 - similarity));
}
