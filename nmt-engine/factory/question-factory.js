import { generateByBlueprint, validateQuestion } from '../generation/question-generator.js';
import { adaptQuestionEngineItem } from '../integration/question-engine-adapter.js';
import { validateGeneratedItem } from '../validation/generation-validator.js';
import { evaluateV4Candidate } from '../v4/candidate-factory.js';
import { withSeededRandom, deriveSeed } from './seeded-rng.js';

export class OfflineQuestionFactory {
  constructor({seed=74001,maxAttemptsPerRequest=80,diversityHistoryWindow=80}={}){
    this.seed=seed;this.maxAttemptsPerRequest=maxAttemptsPerRequest;this.diversityHistoryWindow=diversityHistoryWindow;this.sequence=0;
  }
  makeCandidate(blueprintId,requiredType,requestIndex,attemptIndex,history){
    const seed=deriveSeed(this.seed,'v4',blueprintId,requiredType??'auto',requestIndex,attemptIndex,this.sequence++);
    try{
      const raw=withSeededRandom(seed,()=>generateByBlueprint(blueprintId,{requiredType,history:history.slice(-this.diversityHistoryWindow)}));
      if(!validateQuestion(raw)) return {ok:false,raw,seed,reason:'question_validation'};
      const normalized=adaptQuestionEngineItem(raw);
      const validation=validateGeneratedItem(normalized);
      const v4=raw.engine4?.evaluation ?? evaluateV4Candidate(raw,{history:history.slice(-this.diversityHistoryWindow)});
      return {ok:validation.ok&&v4.accepted,raw,normalized,validation,v4,seed,reason:validation.ok?(v4.accepted?null:'v4_quality_gate'):'normalized_validation'};
    }catch(err){return {ok:false,raw:null,seed,reason:String(err?.message??err)};}
  }
  generate({blueprintId,requiredType=null,history=[],duplicateGuard,requestIndex=0}={}){
    const rejectionStats={validation:0,duplicate:0,quality:0,other:0};
    let best=null;
    for(let attempt=0;attempt<this.maxAttemptsPerRequest;attempt++){
      const c=this.makeCandidate(blueprintId,requiredType,requestIndex,attempt,history);
      if(!c.ok){if(String(c.reason).includes('quality'))rejectionStats.quality++;else rejectionStats.validation++;continue;}
      const dup=duplicateGuard.inspect(c.raw);
      if(!dup.accepted){rejectionStats.duplicate++;continue;}
      const score=c.v4?.quality?.overall??0;
      if(!best||score>(best.v4?.quality?.overall??0))best={...c,duplicate:dup,attempts:attempt+1};
      if(score>=90 && (c.v4?.novelty?.score??0)>=60) return {...best,accepted:true,rejectionStats};
    }
    return best?{...best,accepted:true,rejectionStats}:{accepted:false,raw:null,normalized:null,v4:null,rejectionStats};
  }
}
