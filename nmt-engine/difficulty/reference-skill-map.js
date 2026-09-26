const DIRECT_SKILL = Object.freeze({
  data_chart_reading: 'statistics_interpretation',
  applied_ratio_percent: 'percent_ratio',
  planimetry_angle_parallel: 'angles_geometry',
  linear_inequality_pick: 'inequality',
  solid_geometry_concept: 'solid_geometry_general',
  function_graph_transform: 'graph_interpretation_transform',
  probability_counting_basic: 'classical_probability',
  vectors_3d: 'spatial_coordinates_vectors',
  algebra_simplify: 'algebraic_simplification',
  geometry_statements: 'angles_geometry',
  log_exp_equation_interval: 'logarithmic_expression',
  calculus_basic: 'derivative',
  circle_rectangle_geometry: 'circle',
  trig_exact_values: 'trigonometric_expression',
  matching_functions: 'function_properties',
  matching_expressions: 'powers',
  matching_planimetry: 'triangle',
  short_calculus: 'derivative',
  short_applied: 'percent_ratio',
  short_stereometry_linked_solids: 'solid_volume',
  short_parameter_roots: 'parameter_roots',
  quadratic_equation: 'equation',
  systems_linear: 'systems',
  progression_ap: 'progressions',
  powers_roots_transform: 'powers',
  triangle_cosine_nmt: 'triangle',
  circle_inscribed_angle: 'circle',
  similar_triangles_ratio: 'triangle',
  quadratic_inequality_interval: 'inequality',
  word_work_rate: 'numeric_reasoning',
  word_motion: 'numeric_reasoning',
});

const VARIANT_SKILL = Object.freeze({
  'log_exp_equation_interval:basic-log-root': 'log_equation',
  'log_exp_equation_interval:shifted-log': 'log_equation',
  'log_exp_equation_interval:log-inequality': 'logarithmic_expression',
  'calculus_basic:derivative-point': 'derivative',
  'calculus_basic:antiderivative': 'antiderivative_integral',
  'calculus_basic:definite-integral': 'antiderivative_integral',
  'short_calculus:critical-point': 'extrema',
  'short_calculus:derivative-polynomial': 'derivative',
  'short_calculus:integral-linear': 'antiderivative_integral',
  'short_applied:rows-probability': 'classical_probability',
  'short_applied:two-prices': 'percent_ratio',
  'short_applied:family-discounts': 'percent_ratio',
  'matching_planimetry:trapezoid': 'trapezoid',
  'matching_planimetry:isosceles-triangle': 'triangle',
});

export function inferReferenceSkill(item = {}) {
  const family = item.family ?? item.blueprint_id ?? item.source_question?.blueprint_id ?? null;
  const variant = item.variant ?? null;
  if (family && variant && VARIANT_SKILL[`${family}:${variant}`]) return VARIANT_SKILL[`${family}:${variant}`];
  return family ? DIRECT_SKILL[family] ?? null : null;
}

export function mapEngineTopicToReferenceTopic(topic) {
  const key = String(topic ?? '').trim();
  if (['planimetry', 'stereometry'].includes(key)) return 'geometry';
  if (['equations', 'inequalities', 'systems'].includes(key)) return 'equations_inequalities';
  if (['functions', 'progressions', 'calculus'].includes(key)) return 'functions';
  if (key === 'probability_stats') return 'probability_stats';
  if (['numbers', 'percents', 'powers_roots', 'logarithms', 'trigonometry', 'word_problems'].includes(key)) return 'numbers_expressions';
  return null;
}

export function mapAnswerTypeToReferenceFormat(answerType) {
  if (answerType === 'choice') return 'single_choice';
  if (answerType === 'matching') return 'matching';
  if (answerType === 'short') return 'short_answer';
  return null;
}
