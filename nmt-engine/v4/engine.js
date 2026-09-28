import { ENGINE4_NATIVE_BLUEPRINTS, ENGINE4_VERSION } from './constants.js';
import * as F from './families/index.js';
import { selectBestV4Candidate } from './candidate-factory.js';
import { createAIProviderFromEnv } from './ai/provider.js';

const REGISTRY = Object.freeze({
  data_chart_reading: () => F.generateDataChartV4(),
  applied_ratio_percent: (t) => F.generatePercentagesV4(t),
  planimetry_angle_parallel: () => F.generateParallelV4(),
  linear_inequality_pick: () => F.generateLinearInequalityV4(),
  solid_geometry_concept: () => F.generateSolidConceptV4(),
  function_graph_transform: () => F.generateFunctionsV4(),
  probability_counting_basic: () => F.generateProbabilityV4(),
  vectors_3d: () => F.generateVectorsV4(),
  algebra_simplify: () => F.generateAlgebraSimplifyV4(),
  geometry_statements: () => F.generateGeometryStatementsV4(),
  log_exp_equation_interval: () => F.generateLogV4(),
  calculus_basic: (t) => F.generateCalculusV4(t),
  circle_rectangle_geometry: () => F.generateCircleV4('circle_rectangle_geometry'),
  trig_exact_values: () => F.generateTrigV4(),
  advanced_single_choice: () => F.generateAdvancedV4(),
  matching_functions: () => F.generateMatchingFunctionsV4(),
  matching_expressions: () => F.generateMatchingExpressionsV4(),
  matching_planimetry: () => F.generateMatchingPlanimetryV4(),
  short_calculus: () => F.generateShortCalculusV4(),
  short_applied: () => F.generateShortAppliedV4(),
  short_stereometry_linked_solids: () => F.generateShortLinkedSolidsV4(),
  short_parameter_roots: () => F.generateShortParameterV4(),
  quadratic_equation: (t) => F.generateQuadraticV4(t),
  systems_linear: () => F.generateSystemsV4(),
  progression_ap: () => F.generateProgressionV4(),
  powers_roots_transform: () => F.generatePowersV4(),
  triangle_cosine_nmt: () => F.generateTrianglesV4(),
  circle_inscribed_angle: () => F.generateCircleV4('circle_inscribed_angle'),
  similar_triangles_ratio: () => F.generateSimilarTrianglesV4(),
  quadratic_inequality_interval: () => F.generateQuadraticIneqV4(),
  word_work_rate: () => F.generateWorkV4(),
  word_motion: () => F.generateMotionV4(),
});

const native = new Set(ENGINE4_NATIVE_BLUEPRINTS);
export function supportsEngine4Blueprint(id){return native.has(id) && typeof REGISTRY[id] === 'function';}
export function engine4BlueprintIds(){return [...native];}

function generateOne(id, requiredType=null) {
  const fn = REGISTRY[id];
  if (!fn) throw new Error(`NMT Engine 4 has no native generator for ${id}`);
  return fn(requiredType);
}

export function generateEngine4Question(id,{requiredType=null,history=[],candidateCount=3}={}){
  if(!supportsEngine4Blueprint(id)) throw new Error(`Unsupported Engine 4 blueprint: ${id}`);
  const candidates=[]; const failures=[];
  for(let i=0;i<candidateCount;i++){
    try{
      const q=generateOne(id,requiredType);
      q.engine4={version:ENGINE4_VERSION,mode:'native-genome',candidate_index:i};
      candidates.push(q);
    }catch(err){failures.push(String(err?.message??err));}
  }
  if(!candidates.length) throw new Error(`Engine 4 failed to generate ${id}: ${failures.slice(0,5).join('; ')}`);
  const pick=selectBestV4Candidate(candidates,{history});
  if(!pick.selected || !pick.evaluation?.accepted){
    const best=pick.evaluation;
    throw new Error(`Engine 4 quality gate rejected ${id}: ${JSON.stringify({quality:best?.quality?.overall,complexity:best?.complexity?.score,novelty:best?.novelty?.score,nmt:best?.nmt_similarity,reason:best?.reason})}`);
  }
  pick.selected.engine4={...pick.selected.engine4,evaluation:pick.evaluation,candidate_count:candidates.length};
  return pick.selected;
}

export async function createEngine4AIContext(){return {provider:createAIProviderFromEnv(),version:ENGINE4_VERSION};}
