import { analyzeComplexity } from './complexity-gate.js';
import { retrieveReferenceExamples, nmtSimilarityHeuristic } from './reference-rag.js';
import { noveltyScore } from './novelty.js';
import { computeQualityScore } from './quality-score.js';
import { visualQualityHeuristic } from './visual/hybrid-router.js';
import { genomeSignature } from './genome.js';
import { validateQuestion } from '../generation/builders.js';
import { NOVELTY_MIN, QUALITY_MIN } from './constants.js';

function distractorQuality(q){
  if(q.type!=='choice') return 92;
  const opts=q.options??[]; if(opts.length!==5||new Set(opts).size!==5) return 0;
  const correct=opts[q.correct_index];
  let score=88;
  if(opts.every((x)=>String(x).trim().length>0)) score+=4;
  if(opts.filter((x)=>x===correct).length===1) score+=4;
  return Math.min(100,score);
}
function wordingQuality(q){const s=String(q.question??'').trim();let score=80;if(s.length>=55&&s.length<=330)score+=10;if(/[?？.]$/.test(s))score+=3;if(!/\bлегк|прост/i.test(s))score+=3;return Math.min(100,score);}

export function evaluateV4Candidate(question,{history=[]}={}){
  const genome=question.genome??question.core_meta?.genome??question.coreMeta?.genome??question?.core_meta?.genome??question?.core_meta;
  const actualGenome=question.genome ?? question?.core_meta?.genome ?? question?.coreMeta?.genome ?? question?.core_meta?.genome ?? question?.genome;
  if(!actualGenome) return {accepted:false,reason:'missing_genome',quality:{overall:0}};
  const mathOk=validateQuestion(question);
  const complexity=analyzeComplexity(actualGenome);
  const refs=retrieveReferenceExamples({topic:actualGenome.topic,subtopic:actualGenome.subtopic,concept:actualGenome.concept});
  const nmt=nmtSimilarityHeuristic(question,actualGenome,refs);
  const novelty=noveltyScore({question,genome:actualGenome},history);
  const visual=visualQualityHeuristic(question.visual_bundle);
  const quality=computeQualityScore({math:mathOk?100:0,nmt,novelty:novelty.score,visual,distractors:distractorQuality(question),wording:wordingQuality(question),complexity});
  return {accepted:mathOk&&complexity.accepted&&novelty.score>=NOVELTY_MIN&&quality.overall>=QUALITY_MIN,mathOk,complexity,nmt_similarity:nmt,novelty,visual_quality:visual,quality,references:refs.map(r=>r.id),genome_signature:genomeSignature(actualGenome)};
}

export function selectBestV4Candidate(candidates,{history=[]}={}){
  const evaluated=candidates.map((question)=>({question,evaluation:evaluateV4Candidate(question,{history})}));
  evaluated.sort((a,b)=>{
    if(a.evaluation.accepted!==b.evaluation.accepted)return Number(b.evaluation.accepted)-Number(a.evaluation.accepted);
    return b.evaluation.quality.overall-a.evaluation.quality.overall || b.evaluation.novelty.score-a.evaluation.novelty.score;
  });
  return {selected:evaluated[0]?.question??null,evaluation:evaluated[0]?.evaluation??null,evaluated};
}
