import { EXAM_SLOTS, QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { CORE_ENGINE_VERSION, questionSkeleton, validateQuestion } from './builders.js';
import { pick, shuffle, randInt } from './utils.js';
import { generateEngine4Question, supportsEngine4Blueprint } from '../v4/engine.js';

export const QUESTION_ENGINE_VERSION = CORE_ENGINE_VERSION;
const BLUEPRINTS = new Map(QUESTION_BLUEPRINTS.map((x) => [x.id, x]));

const TRAINING_BY_TOPIC = Object.freeze({
  numbers:['algebra_simplify','powers_roots_transform'],
  percents:['applied_ratio_percent'],
  powers_roots:['powers_roots_transform','algebra_simplify'],
  logarithms:['log_exp_equation_interval'],
  equations:['quadratic_equation','short_parameter_roots'],
  inequalities:['linear_inequality_pick','quadratic_inequality_interval'],
  systems:['systems_linear'], functions:['function_graph_transform'], progressions:['progression_ap'],
  trigonometry:['trig_exact_values'], calculus:['calculus_basic','short_calculus'],
  probability_stats:['data_chart_reading','probability_counting_basic'],
  planimetry:['planimetry_angle_parallel','triangle_cosine_nmt','circle_inscribed_angle','similar_triangles_ratio','geometry_statements','circle_rectangle_geometry'],
  stereometry:['solid_geometry_concept','vectors_3d','short_stereometry_linked_solids'],
  word_problems:['applied_ratio_percent','word_work_rate','word_motion','short_applied'],
});
const TRAINING_ALL = [...new Set(Object.values(TRAINING_BY_TOPIC).flat())];

export { questionSkeleton, validateQuestion };

export function generateByBlueprint(id, { requiredType = null, history = [] } = {}) {
  const bp = BLUEPRINTS.get(id);
  if (!bp) throw new Error(`Unknown blueprint ${id}`);
  if (requiredType && !(bp.formats ?? []).includes(requiredType)) throw new Error(`Blueprint ${id} does not support ${requiredType}`);
  if (!supportsEngine4Blueprint(id)) throw new Error(`Blueprint ${id} has not been ported to NMT Engine 4`);
  const q = generateEngine4Question(id, { requiredType, history, candidateCount:3 });
  if (q.blueprint_id !== id) throw new Error(`Engine 4 ${id} emitted ${q.blueprint_id}`);
  if (requiredType && q.type !== requiredType) throw new Error(`Engine 4 ${id} emitted ${q.type}, expected ${requiredType}`);
  if (!validateQuestion(q)) throw new Error(`Engine 4 ${id} emitted invalid question`);
  return q;
}

function tooSimilar(candidate, avoidList=[]) {
  const skeleton = candidate.question_skeleton ?? questionSkeleton(candidate.question);
  return avoidList.some((item) => questionSkeleton(typeof item === 'string' ? item : (item?.question ?? '')) === skeleton);
}

// Difficulty is intentionally accepted only for API compatibility. Engine 4 has
// a single production standard: NMT HARD. Every emitted item already passed the
// internal Complexity Gate and Quality Gate.
export function generateTrainingChoice(topic='mixed', _difficulty='NMT HARD', avoidList=[]) {
  const raw = topic === 'mixed' ? TRAINING_ALL : (TRAINING_BY_TOPIC[topic] ?? TRAINING_ALL);
  const pool = shuffle(raw.filter((id)=>(BLUEPRINTS.get(id)?.formats ?? []).includes('choice')));
  let fallback = null;
  for (let i=0; i<120; i+=1) {
    const id = pool[i % pool.length] ?? pick(pool);
    const q = generateByBlueprint(id, {requiredType:'choice', history:avoidList});
    if (!fallback) fallback = q;
    if (tooSimilar(q, avoidList)) continue;
    return {...q, difficulty:'NMT HARD'};
  }
  return {...fallback, difficulty:'NMT HARD'};
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
  const history=[];
  const questions = EXAM_SLOTS.map((slot) => {
    let q = null;
    for (let attempt=0; attempt<60; attempt+=1) {
      const compatible = slot.blueprint_ids.filter((id) => (BLUEPRINTS.get(id)?.formats ?? []).includes(slot.type));
      const id = pick(compatible.length ? compatible : slot.blueprint_ids);
      const candidate = generateByBlueprint(id, {requiredType:slot.type,history});
      if (usedVariants.has(candidate.variant_key) && attempt < 30) continue;
      q = candidate; break;
    }
    if (!q) {
      const id = slot.blueprint_ids.find((bpId) => (BLUEPRINTS.get(bpId)?.formats ?? []).includes(slot.type));
      q = generateByBlueprint(id, {requiredType:slot.type,history});
    }
    usedVariants.add(q.variant_key);
    history.push(q);
    return {...q, difficulty:'NMT HARD', number:slot.slot, id:`nmt4-${slot.slot}-${Date.now()}-${randInt(100,999)}`};
  });
  validateExamQuestions(questions);
  return questions;
}
