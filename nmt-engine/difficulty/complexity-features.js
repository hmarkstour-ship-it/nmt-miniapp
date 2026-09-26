const HARD_VARIANT_PATTERNS = [
  'without-replacement',
  'tangent-circle-rectangle',
  'two-right-triangles',
  'cone-pyramid',
  'cylinder-prism',
  'rational-unique-root',
  'sign-interval',
  'joint-work',
  'successive-change',
];

const FAMILY_PRIORS = Object.freeze({
  data_chart_reading: 0.16,
  powers_roots_transform: 0.30,
  linear_inequality_pick: 0.35,
  algebra_simplify: 0.38,
  trig_exact_values: 0.38,
  applied_ratio_percent: 0.48,
  planimetry_angle_parallel: 0.45,
  solid_geometry_concept: 0.46,
  function_graph_transform: 0.48,
  vectors_3d: 0.52,
  probability_counting_basic: 0.52,
  quadratic_equation: 0.50,
  systems_linear: 0.50,
  progression_ap: 0.48,
  circle_inscribed_angle: 0.48,
  geometry_statements: 0.52,
  log_exp_equation_interval: 0.54,
  calculus_basic: 0.54,
  similar_triangles_ratio: 0.64,
  quadratic_inequality_interval: 0.62,
  word_work_rate: 0.66,
  word_motion: 0.48,
  triangle_cosine_nmt: 0.68,
  circle_rectangle_geometry: 0.92,
  matching_functions: 0.62,
  matching_expressions: 0.62,
  matching_planimetry: 0.68,
  short_calculus: 0.72,
  short_applied: 0.66,
  short_parameter_roots: 0.86,
  short_stereometry_linked_solids: 0.98,
});

const EASY_VARIANT_PATTERNS = [
  'bar-total',
  'line-threshold',
  'sqrt-square',
  'rotation',
];

const HIDDEN_RELATION_WORDS = [
  'нехай', 'звідси', 'оскільки', 'тому', 'одз', 'симетрич', 'вписан', 'описан',
  'середина', 'продуктивн', 'подібн', 'дискримінант', 'теорем', 'обернен', 'єдиний корінь',
];

const EXPLICIT_FORMULA_WORDS = [
  'обчисліть', 'спростіть', 'знайдіть значення', 'підставляємо', 'первісна',
];

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function textOf(item) {
  return `${item.question ?? ''} ${item.explanation ?? ''}`.toLowerCase();
}

function variantOf(item) {
  return String(item.variant ?? '').toLowerCase();
}

function familyPrior(item) {
  const family = String(item.family ?? item.blueprint_id ?? '');
  let prior = FAMILY_PRIORS[family] ?? (item.answer_type === 'short' ? 0.66 : item.answer_type === 'matching' ? 0.62 : 0.48);
  const variant = variantOf(item);
  if (variant === 'without-replacement') prior = Math.max(prior, 0.72);
  if (variant === 'rotation' || EASY_VARIANT_PATTERNS.some((pattern) => variant.includes(pattern))) prior = Math.min(prior, 0.24);
  if (variant === 'rational-unique-root') prior = Math.max(prior, 0.94);
  if (variant === 'cone-pyramid') prior = Math.max(prior, 0.98);
  return clamp01(prior);
}

function sourceDifficulty(item) {
  const value = String(item.source_question?.difficulty ?? item.difficulty ?? '').toLowerCase();
  if (value === 'легкий' || value === 'easy') return 0.18;
  if (value === 'складний' || value === 'hard') return 0.82;
  if (value === 'середній' || value === 'medium') return 0.50;
  if (item.answer_type === 'matching') return 0.58;
  if (item.answer_type === 'short') return 0.64;
  return 0.50;
}

function estimateSteps(item) {
  const explicit = Number(item.steps_estimate ?? item.metadata?.steps_estimate);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(4, Math.round(explicit)));

  const text = textOf(item);
  const variant = variantOf(item);
  let steps = item.answer_type === 'matching' ? 3 : item.answer_type === 'short' ? 2 : 1;
  const family = String(item.family ?? '');
  if (['triangle_cosine_nmt', 'similar_triangles_ratio', 'quadratic_inequality_interval', 'word_work_rate'].includes(family)) steps = Math.max(steps, 2);
  if (['circle_rectangle_geometry', 'short_parameter_roots'].includes(family)) steps = Math.max(steps, 3);
  if (family === 'short_stereometry_linked_solids') steps = 4;

  const connectorHits = ['тому', 'звідси', 'далі', 'після цього', 'спочатку', 'отже']
    .filter((token) => text.includes(token)).length;
  if (connectorHits >= 2) steps += 1;
  if (connectorHits >= 4) steps += 1;
  if (HARD_VARIANT_PATTERNS.some((pattern) => variant.includes(pattern))) steps += 1;
  if (item.diagram_type === 'linked_solids') steps += 1;
  return Math.max(1, Math.min(4, steps));
}

function hiddenRelation(item) {
  const text = textOf(item);
  const variant = variantOf(item);
  let score = HIDDEN_RELATION_WORDS.filter((token) => text.includes(token)).length * 0.11;
  if (HARD_VARIANT_PATTERNS.some((pattern) => variant.includes(pattern))) score += 0.28;
  if (variant.includes('parameter') || String(item.family).includes('parameter')) score += 0.22;
  if (item.diagram_type === 'linked_solids') score += 0.28;
  return clamp01(score);
}

function combinedTopics(item) {
  const family = String(item.family ?? '');
  const variant = variantOf(item);
  let score = 0.08;
  if (family === 'advanced_single_choice') score = 0.75;
  if (family === 'short_stereometry_linked_solids') score = 0.95;
  if (family === 'circle_rectangle_geometry') score = Math.max(score, 0.65);
  if (family === 'short_applied' || family === 'word_work_rate') score = Math.max(score, 0.48);
  if (variant.includes('successive') || variant.includes('linked') || variant.includes('cone-pyramid')) score = Math.max(score, 0.72);
  return clamp01(score);
}

function calculationLoad(item) {
  const question = String(item.question ?? '');
  const explanation = String(item.explanation ?? '');
  const numbers = (question.match(/-?\d+(?:[.,]\d+)?/g) ?? []).length;
  const operators = (question.match(/[+−–*/=<>]|\\frac|\\sqrt|\\log|\\sin|\\cos|\\tan|\\int|\^/g) ?? []).length;
  const explOperators = (explanation.match(/[+−–*/=<>]|\\frac|\\sqrt|\\log|\\sin|\\cos|\\tan|\\int|\^/g) ?? []).length;
  return clamp01((numbers * 0.055) + (operators * 0.065) + (explOperators * 0.025));
}

function shapeOfOption(option) {
  const value = String(option ?? '').trim();
  if (/^\\\(.+\\\)$/.test(value)) return 'math';
  if (/^-?\d+(?:[.,]\d+)?(?:°|%|\s*грн)?$/.test(value)) return 'numeric';
  if (/^[([]/.test(value) && /[)\]]$/.test(value)) return 'interval';
  return 'text';
}

function parseNumericOption(option) {
  const cleaned = String(option ?? '')
    .replace(/\\\(|\\\)/g, '')
    .replace(',', '.')
    .replace(/[^0-9.+-]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function distractorStrength(item) {
  if (item.answer_type !== 'choice') return item.answer_type === 'matching' ? 0.72 : 0.48;
  const options = item.options ?? [];
  if (options.length !== 5) return 0.25;

  const shapes = options.map(shapeOfOption);
  const majority = Math.max(...[...new Set(shapes)].map((shape) => shapes.filter((x) => x === shape).length));
  const shapeConsistency = majority / options.length;

  const correct = Number.isInteger(item.correct_index) ? parseNumericOption(options[item.correct_index]) : null;
  const numeric = options.map(parseNumericOption);
  let proximity = 0.45;
  if (correct != null && numeric.every((x) => x != null)) {
    const scale = Math.max(1, Math.abs(correct));
    const distractorDistances = numeric
      .filter((_, index) => index !== item.correct_index)
      .map((value) => Math.abs(value - correct) / scale);
    const close = distractorDistances.filter((distance) => distance <= 0.5).length / 4;
    proximity = 0.25 + close * 0.75;
  }

  return clamp01(shapeConsistency * 0.55 + proximity * 0.45);
}

function visualReasoning(item) {
  if (!item.diagram_svg && !item.visual) return 0;
  const type = String(item.diagram_type ?? item.visual?.diagram_type ?? item.visual?.type ?? '').toLowerCase();
  if (type.includes('linked')) return 0.95;
  if (type.includes('solid') || type.includes('spatial')) return 0.82;
  if (type.includes('graph')) return 0.68;
  if (type.includes('chart')) return 0.42;
  if (type.includes('geometry') || type.includes('triangle') || type.includes('circle') || type.includes('trapezoid')) return 0.64;
  return 0.52;
}

function formulaNonObviousness(item, steps, hidden) {
  const text = textOf(item);
  let score = hidden * 0.58 + ((steps - 1) / 3) * 0.42;
  const explicitHits = EXPLICIT_FORMULA_WORDS.filter((token) => text.includes(token)).length;
  score -= explicitHits * 0.05;
  if (EASY_VARIANT_PATTERNS.some((pattern) => variantOf(item).includes(pattern))) score -= 0.18;
  return clamp01(score);
}

function responseFormat(item) {
  if (item.answer_type === 'matching') return 0.72;
  if (item.answer_type === 'short') return 0.76;
  return 0.28;
}

export function extractComplexityFeatures(item = {}) {
  const steps = estimateSteps(item);
  const hidden = hiddenRelation(item);
  return Object.freeze({
    steps,
    steps_norm: clamp01((steps - 1) / 3),
    hidden_relation: hidden,
    combined_topics: combinedTopics(item),
    calculation_load: calculationLoad(item),
    distractor_strength: distractorStrength(item),
    visual_reasoning: visualReasoning(item),
    formula_nonobviousness: formulaNonObviousness(item, steps, hidden),
    response_format: responseFormat(item),
    family_prior: familyPrior(item),
    intrinsic_prior: sourceDifficulty(item),
  });
}

export function structuralDifficultyScore(features) {
  const weights = Object.freeze({
    steps_norm: 0.20,
    hidden_relation: 0.12,
    combined_topics: 0.08,
    calculation_load: 0.10,
    distractor_strength: 0.08,
    visual_reasoning: 0.08,
    formula_nonobviousness: 0.09,
    response_format: 0.04,
    family_prior: 0.12,
    intrinsic_prior: 0.09,
  });

  let score = 0;
  for (const [field, weight] of Object.entries(weights)) score += clamp01(features[field]) * weight;
  return Math.round(score * 1000) / 10;
}
