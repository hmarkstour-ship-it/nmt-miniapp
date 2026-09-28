import { createGenome } from '../genome.js';
import { makeChoice, makeShort, makeMatching } from '../../generation/builders.js';
import { optimizeSemanticLayout } from '../visual/layout-optimizer.js';
import { buildHybridVisual } from '../visual/hybrid-router.js';

export const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];
export const ri = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
export const ua = (x) => Number.isInteger(Number(x)) ? String(Number(x)) : String(Number(x).toFixed(2)).replace('.',',');
export const math = (s) => `\\(${s}\\)`;
export const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a||1};

function baseCoreMeta(genome, extra={}) {
  return {
    source:'nmt-engine4-ai-hybrid',
    core_version:40,
    model:'question-genome-constraint-first-independent-solver',
    genome,
    genome_version:genome.version,
    nmt_hard:true,
    ...extra,
  };
}

function attachHybrid(visualSpec, genome, preferredRenderer='svg') {
  if (!visualSpec) return { visual:null, visualBundle:null };
  const optimized = optimizeSemanticLayout(visualSpec);
  const hybrid = buildHybridVisual({
    spec:optimized.spec,
    preferredRenderer,
    intent:{
      kind: genome.visual_topology?.includes('3d') ? 'solid_3d' : (genome.visual_topology?.includes('chart') ? 'plot_dense' : 'geometry_2d'),
      precision: preferredRenderer === 'tikz' ? 'publication' : 'normal',
      interactive: preferredRenderer === 'threejs',
    },
  });
  return { visual:hybrid.visual_spec, visualBundle:hybrid.visual_bundle };
}

export function choiceFromModel({ blueprintId, topic, variant, question, correct, distractors, explanation, genome, visualSpec=null, preferredRenderer='svg', coreMeta={} }) {
  const { visual, visualBundle } = attachHybrid(visualSpec, genome, preferredRenderer);
  const q = makeChoice(blueprintId,{topic,variant,question,correct,distractors,explanation,visual,coreMeta:baseCoreMeta(genome,{...coreMeta,visual_bundle:visualBundle})});
  if (visualBundle) q.visual_bundle = visualBundle;
  q.genome = genome;
  return q;
}

export function shortFromModel({ blueprintId, topic, variant, question, correctValue, explanation, genome, visualSpec=null, preferredRenderer='svg', coreMeta={} }) {
  const { visual, visualBundle } = attachHybrid(visualSpec, genome, preferredRenderer);
  const q=makeShort(blueprintId,{topic,variant,question,correctValue,explanation,visual,coreMeta:baseCoreMeta(genome,{...coreMeta,visual_bundle:visualBundle})});
  if(visualBundle)q.visual_bundle=visualBundle;
  q.genome=genome;
  return q;
}

export function matchingFromModel({ blueprintId, topic, variant, question, left, options, correctPairs, explanation, genome, visualSpec=null, preferredRenderer='svg', coreMeta={} }) {
  const { visual, visualBundle } = attachHybrid(visualSpec, genome, preferredRenderer);
  const q=makeMatching(blueprintId,{topic,variant,question,left,options,correctPairs,explanation,visual,coreMeta:baseCoreMeta(genome,{...coreMeta,visual_bundle:visualBundle})});
  if(visualBundle)q.visual_bundle=visualBundle;
  q.genome=genome;
  return q;
}

export { createGenome };
