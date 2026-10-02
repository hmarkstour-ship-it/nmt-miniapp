import { createSeededRandom, deriveSeed } from '../factory/seeded-rng.js';
import { genomeDistance } from '../v4/genome.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function quality(item){return Number(item?.bank_meta?.quality_score??0)}
function novelty(item){return Number(item?.bank_meta?.novelty_score??0)}
function sig(item){return item?.bank_meta?.genome_signature??null}
function structuralSimilarity(a,b){const ga=a?.bank_meta?.genome,gb=b?.bank_meta?.genome;return ga&&gb?1-genomeDistance(ga,gb):0}
function score(item,{avoidTexts,recentItems,selected,usage,random}){
 let s=quality(item)*1.05+novelty(item)*.45;
 if(avoidTexts.has(item.question))s-=220;
 const sk=item.question_skeleton; if(sk&&recentItems.some(x=>x.question_skeleton===sk))s-=165;
 const gs=sig(item); if(gs&&recentItems.some(x=>sig(x)===gs))s-=190;
 const recentSim=Math.max(0,...recentItems.map(x=>structuralSimilarity(item,x)));
 const batchSim=Math.max(0,...selected.map(x=>structuralSimilarity(item,x)));
 s-=recentSim*72+batchSim*118;

 // Endless mixed stream: aggressively rotate topics/families so the user does not
 // feel that the app is serving one template with different numbers.
 const last1=recentItems.at(-1), last3=recentItems.slice(-3), last8=recentItems.slice(-8);
 if(last1?.topic===item.topic)s-=95;
 s-=last3.filter(x=>x.topic===item.topic).length*38;
 s-=last8.filter(x=>x.blueprint_id===item.blueprint_id).length*44;
 s-=selected.filter(x=>x.topic===item.topic).length*92;
 s-=selected.filter(x=>x.blueprint_id===item.blueprint_id).length*115;

 s-=clamp(usage.get(item.id)??0,0,40)*2.8;
 return s+random()*7;
}
export function selectTrainingBatch(index,{topic='mixed',count=4,visualMode='any',avoidTexts=[],usage=new Map(),seed=Date.now(),disabledIds=new Set()}={}){
 const pool=index.trainingPool({topic,visualMode}).filter(x=>!disabledIds.has(x.id)); if(!pool.length)return[];
 const avoid=new Set((avoidTexts??[]).filter(Boolean)); const recent=[]; for(const t of avoid){const x=index.byText.get(t);if(x)recent.push(x)}
 const wanted=Math.max(1,Math.min(Number(count)||1,pool.length)),selected=[],ids=new Set();
 const random=createSeededRandom(deriveSeed(seed,topic,visualMode,avoid.size));
 while(selected.length<wanted){const ranked=pool.filter(x=>!ids.has(x.id)).map(item=>({item,score:score(item,{avoidTexts:avoid,recentItems:recent,selected,usage,random})})).sort((a,b)=>b.score-a.score);if(!ranked.length)break;const window=Math.min(8,ranked.length);const chosen=ranked[Math.floor(random()*window)].item;selected.push(chosen);ids.add(chosen.id)}
 return selected;
}
export function selectSimilarTraining(index,original,{avoidTexts=[],usage=new Map(),seed=Date.now(),visualMode='any',disabledIds=new Set()}={}){
 if(!original)return null;const pool=index.trainingPool({topic:original.topic||'mixed',visualMode}).filter(x=>!disabledIds.has(x.id)&&x.id!==original.id&&x.question!==original.question);if(!pool.length)return null;
 const avoid=new Set([original.question,...(avoidTexts??[])].filter(Boolean));const random=createSeededRandom(deriveSeed(seed,'similar',original.id||original.question));
 const ranked=pool.map(item=>{const sameFamily=item.blueprint_id===original.blueprint_id?1:0;const sim=structuralSimilarity(item,original);const sameGenome=sig(item)&&sig(item)===sig(original)?1:0;const seen=avoid.has(item.question)?1:0;const use=usage.get(item.id)??0;return{item,score:sameFamily*52+sim*28+quality(item)*.55+novelty(item)*.22-sameGenome*100-seen*150-use*2+random()*5}}).sort((a,b)=>b.score-a.score);return ranked[0]?.item??null;
}
