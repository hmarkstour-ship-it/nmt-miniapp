import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { BankDuplicateGuard } from './content-fingerprint.js';
import { toBankItem } from './bank-item.js';
import { FACTORY_VERSION, BANK_SCHEMA_VERSION, DEFAULT_FACTORY_OPTIONS } from './constants.js';
import { QUESTION_ENGINE_VERSION, generateByBlueprint } from '../generation/question-generator.js';
import { VISUAL_ENGINE_VERSION } from '../visuals/visual-spec.js';
import { adaptQuestionEngineItem } from '../integration/question-engine-adapter.js';
import { withSeededRandom, deriveSeed } from './seeded-rng.js';

function requests(total,blueprints){const out=[];for(let i=0;i<total;i++){const bp=blueprints[i%blueprints.length],formats=bp.formats?.length?bp.formats:['choice'];out.push({blueprintId:bp.id,requiredType:formats[Math.floor(i/blueprints.length)%formats.length],index:i})}return out}
export function buildQuestionBank({total=DEFAULT_FACTORY_OPTIONS.total,seed=DEFAULT_FACTORY_OPTIONS.seed,topic=null,answerType=null,maxPerSkeleton=DEFAULT_FACTORY_OPTIONS.maxPerSkeleton,allowPartial=false}={}){
 const blueprints=QUESTION_BLUEPRINTS.filter(bp=>(!topic||topic==='mixed'||bp.topic===topic)&&(!answerType||(bp.formats??[]).includes(answerType)));if(!blueprints.length)throw new Error('No Engine 4 blueprints');
 const guard=new BankDuplicateGuard({maxPerSkeleton}),history=[],items=[],failures=[];const stats={validation:0,duplicate:0,quality:0,other:0};
 for(const req of requests(total,blueprints)){
  let accepted=null;
  for(let attempt=0;attempt<7&&!accepted;attempt++){
   try{
    const s=deriveSeed(seed,'engine4-bank',req.blueprintId,req.requiredType,req.index,attempt);
    const raw=withSeededRandom(s,()=>generateByBlueprint(req.blueprintId,{requiredType:req.requiredType,history:history.slice(-24)}));
    const ev=raw.engine4?.evaluation;if(!ev?.accepted){stats.quality++;continue}
    const dup=guard.inspect(raw);if(!dup.accepted){stats.duplicate++;continue}
    const added=guard.add(raw);if(!added.accepted){stats.duplicate++;continue}
    const normalized=adaptQuestionEngineItem(raw);accepted=toBankItem({raw,normalized,v4:ev,duplicate:added});
   }catch(e){stats.validation++;}
  }
  if(accepted){items.push(accepted);history.push(accepted)}else{failures.push(req);if(!allowPartial)throw new Error(`Engine 4 bank failed ${req.blueprintId}/${req.requiredType}`)}
 }
 return{schema_version:BANK_SCHEMA_VERSION,factory_version:FACTORY_VERSION,engine_name:'NMT Engine 4.0 AI Hybrid',core_engine_version:QUESTION_ENGINE_VERSION,visual_engine_version:VISUAL_ENGINE_VERSION,production_standard:'NMT HARD',mode:'verified_offline_ai_hybrid_bank',seed,requested_item_count:total,item_count:items.length,scope:{topic:topic??'mixed',answer_type:answerType??'all'},build_stats:{failures,rejection_stats:stats,duplicate_guard:guard.snapshot(),blueprint_count:blueprints.length},profiles:blueprints.map(bp=>({id:bp.id,topic:bp.topic,formats:bp.formats??[]})),items};
}
