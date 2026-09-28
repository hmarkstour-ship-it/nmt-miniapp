import { EXAM_SLOTS, QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { CORE_ENGINE_VERSION, questionSkeleton, validateQuestion } from './builders.js';
import { GENERATORS } from './blueprint-generators.js';
import { pick, shuffle, randInt } from './utils.js';

export const QUESTION_ENGINE_VERSION = CORE_ENGINE_VERSION;
const BLUEPRINTS = new Map(QUESTION_BLUEPRINTS.map((x) => [x.id, x]));

const TRAINING_BY_TOPIC = Object.freeze({
  numbers:['algebra_simplify','powers_roots_transform'],
  percents:['applied_ratio_percent'],
  powers_roots:['powers_roots_transform','algebra_simplify'],
  logarithms:['log_exp_equation_interval'],
  equations:['quadratic_equation'],
  inequalities:['linear_inequality_pick','quadratic_inequality_interval'],
  systems:['systems_linear'], functions:['function_graph_transform'], progressions:['progression_ap'],
  trigonometry:['trig_exact_values'], calculus:['calculus_basic'],
  probability_stats:['data_chart_reading','probability_counting_basic'],
  planimetry:['planimetry_angle_parallel','triangle_cosine_nmt','circle_inscribed_angle','similar_triangles_ratio','geometry_statements','circle_rectangle_geometry'],
  stereometry:['solid_geometry_concept','vectors_3d'],
  word_problems:['applied_ratio_percent','word_work_rate','word_motion'],
});
const TRAINING_ALL = Object.values(TRAINING_BY_TOPIC).flat();

export { questionSkeleton, validateQuestion };

export function generateByBlueprint(id, { requiredType = null } = {}) {
  const fn = GENERATORS[id];
  if (!fn) throw new Error(`Unknown blueprint ${id}`);
  const bp = BLUEPRINTS.get(id);
  if (requiredType && bp && !(bp.formats ?? []).includes(requiredType)) {
    throw new Error(`Blueprint ${id} does not support ${requiredType}`);
  }
  const question = fn(requiredType);
  if (question.blueprint_id !== id) throw new Error(`Generator ${id} emitted ${question.blueprint_id}`);
  if (requiredType && question.type !== requiredType) throw new Error(`Generator ${id} emitted ${question.type}, expected ${requiredType}`);
  if (!validateQuestion(question)) throw new Error(`Generator ${id} emitted invalid question`);
  return question;
}

function tooSimilar(candidate, avoidList=[]) {
  const skeleton = candidate.question_skeleton ?? questionSkeleton(candidate.question);
  return avoidList.some((item) => questionSkeleton(typeof item === 'string' ? item : (item?.question ?? '')) === skeleton);
}

export function generateTrainingChoice(topic='mixed', difficulty='середній', avoidList=[]) {
  const raw = topic === 'mixed' ? TRAINING_ALL : (TRAINING_BY_TOPIC[topic] ?? TRAINING_ALL);
  const pool = shuffle(raw);
  let fallback = null;
  for (let i=0; i<100; i+=1) {
    const id = pool[i % pool.length] ?? pick(raw);
    const q = generateByBlueprint(id, {requiredType:'choice'});
    if (!fallback) fallback = q;
    if (tooSimilar(q, avoidList)) continue;
    return {...q, difficulty};
  }
  return {...fallback, difficulty};
}

export function validateExamQuestions(qs) {
  if (!Array.isArray(qs) || qs.length !== 22) throw new Error('Exam must contain 22 questions');
  if (qs.filter(q=>q.type==='choice').length !== 15) throw new Error('Need 15 choice');
  if (qs.filter(q=>q.type==='matching').length !== 3) throw new Error('Need 3 matching');
  if (qs.filter(q=>q.type==='short').length !== 4) throw new Error('Need 4 short');
  if (qs.reduce((sum,q)=>sum+q.max_score,0) !== 32) throw new Error('Need max score 32');
  qs.forEach((q,i)=>{ if(!validateQuestion(q)) throw new Error(`Invalid question ${i+1}`); });
  return true;
}

export function generateExamQuestions() {
  const usedVariants = new Set();
  const questions = EXAM_SLOTS.map((slot) => {
    let q = null;
    for (let attempt=0; attempt<40; attempt+=1) {
      const compatible = slot.blueprint_ids.filter((id) => (BLUEPRINTS.get(id)?.formats ?? []).includes(slot.type));
      const id = pick(compatible.length ? compatible : slot.blueprint_ids);
      const candidate = generateByBlueprint(id, {requiredType:slot.type});
      if (slot.type === 'choice' && usedVariants.has(candidate.variant_key)) continue;
      q = candidate; break;
    }
    if (!q) {
      const id = slot.blueprint_ids.find((bpId) => (BLUEPRINTS.get(bpId)?.formats ?? []).includes(slot.type));
      q = generateByBlueprint(id, {requiredType:slot.type});
    }
    usedVariants.add(q.variant_key);
    return {...q, number:slot.slot, id:`nmt3-${slot.slot}-${Date.now()}-${randInt(100,999)}`};
  });
  validateExamQuestions(questions);
  return questions;
}
