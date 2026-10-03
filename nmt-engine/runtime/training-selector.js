import { createSeededRandom, deriveSeed } from '../factory/seeded-rng.js';
import { genomeDistance } from '../v4/genome.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function quality(item){return Number(item?.bank_meta?.quality_score??0)}
function novelty(item){return Number(item?.bank_meta?.novelty_score??0)}
function sig(item){return item?.bank_meta?.genome_signature??null}
function structuralSimilarity(a,b){const ga=a?.bank_meta?.genome,gb=b?.bank_meta?.genome;return ga&&gb?1-genomeDistance(ga,gb):0}

function recentSet(items, mapper, limit) {
  return new Set(items.slice(0, limit).map(mapper).filter(Boolean));
}

function strictPool(pool, { recentItems, selected, avoidTexts, ids, level = 0 }) {
  const recentSkeletons = recentSet(recentItems, (x) => x.question_skeleton, level <= 1 ? 16 : 8);
  const recentGenomes = recentSet(recentItems, sig, level <= 1 ? 24 : 10);
  const recentBlueprints = recentSet(recentItems, (x) => x.blueprint_id, level === 0 ? 5 : 2);
  const newestTopic = recentItems[0]?.topic ?? null; // DB history is newest-first.
  const lastSelected = selected.at(-1) ?? null;

  return pool.filter((item) => {
    if (ids.has(item.id)) return false;
    if (avoidTexts.has(item.question)) return false; // exact item/text never repeats inside cooldown window.

    if (level <= 2 && item.question_skeleton && recentSkeletons.has(item.question_skeleton)) return false;
    if (level <= 2 && sig(item) && recentGenomes.has(sig(item))) return false;
    if (level <= 1 && item.blueprint_id && recentBlueprints.has(item.blueprint_id)) return false;

    // Topic rotation is a preference, not a reason to stall the stream.
    if (level === 0 && newestTopic && item.topic === newestTopic) return false;
    if (level <= 1 && lastSelected?.topic && item.topic === lastSelected.topic) return false;
    if (level === 0 && lastSelected?.blueprint_id && item.blueprint_id === lastSelected.blueprint_id) return false;

    return true;
  });
}

function score(item,{avoidTexts,recentItems,selected,usage,random}){
  let s=quality(item)*1.08+novelty(item)*.48;
  if(avoidTexts.has(item.question))s-=1000;

  const recentSkeletons=recentItems.slice(0,30).filter(x=>x.question_skeleton===item.question_skeleton).length;
  const recentGenomes=recentItems.slice(0,40).filter(x=>sig(x)&&sig(x)===sig(item)).length;
  const recentBlueprints=recentItems.slice(0,16).filter(x=>x.blueprint_id===item.blueprint_id).length;
  const recentTopics=recentItems.slice(0,8).filter(x=>x.topic===item.topic).length;

  s-=recentSkeletons*190;
  s-=recentGenomes*220;
  s-=recentBlueprints*72;
  s-=recentTopics*34;

  const recentSim=Math.max(0,...recentItems.slice(0,28).map(x=>structuralSimilarity(item,x)));
  const batchSim=Math.max(0,...selected.map(x=>structuralSimilarity(item,x)));
  s-=recentSim*120+batchSim*170;

  const newest=recentItems[0];
  if(newest?.topic===item.topic)s-=150;
  if(newest?.blueprint_id===item.blueprint_id)s-=220;
  if(selected.at(-1)?.topic===item.topic)s-=180;
  if(selected.some(x=>x.question_skeleton===item.question_skeleton))s-=420;
  if(selected.some(x=>sig(x)&&sig(x)===sig(item)))s-=460;
  if(selected.some(x=>x.blueprint_id===item.blueprint_id))s-=210;

  s-=clamp(usage.get(item.id)??0,0,40)*3.2;
  return s+random()*6;
}

export function selectTrainingBatch(index,{topic='mixed',count=4,visualMode='any',avoidTexts=[],usage=new Map(),seed=Date.now(),disabledIds=new Set()}={}){
  const pool=index.trainingPool({topic,visualMode}).filter(x=>!disabledIds.has(x.id));
  if(!pool.length)return[];

  const avoid=new Set((avoidTexts??[]).filter(Boolean));
  // getRecentQuestions returns newest first, keep that order.
  const recentItems=[];
  for(const t of (avoidTexts??[])){
    const x=index.byText.get(t);
    if(x) recentItems.push(x);
  }

  const wanted=Math.max(1,Math.min(Number(count)||1,pool.length));
  const selected=[],ids=new Set();
  const random=createSeededRandom(deriveSeed(seed,topic,visualMode,avoid.size));

  while(selected.length<wanted){
    let candidates=[];
    // Relax only when the bank cannot satisfy a stricter cooldown. Exact repeats remain blocked at every level.
    for(let level=0;level<=3;level++){
      candidates=strictPool(pool,{recentItems,selected,avoidTexts:avoid,ids,level});
      if(candidates.length) break;
    }
    if(!candidates.length) break;

    const ranked=candidates
      .map(item=>({item,score:score(item,{avoidTexts:avoid,recentItems,selected,usage,random})}))
      .sort((a,b)=>b.score-a.score);
    if(!ranked.length)break;

    const window=Math.min(6,ranked.length);
    const chosen=ranked[Math.floor(random()*window)].item;
    selected.push(chosen);
    ids.add(chosen.id);
  }
  return selected;
}

export function selectSimilarTraining(index,original,{avoidTexts=[],usage=new Map(),seed=Date.now(),visualMode='any',disabledIds=new Set()}={}){
  if(!original)return null;
  const pool=index.trainingPool({topic:original.topic||'mixed',visualMode})
    .filter(x=>!disabledIds.has(x.id)&&x.id!==original.id&&x.question!==original.question);
  if(!pool.length)return null;
  const avoid=new Set([original.question,...(avoidTexts??[])].filter(Boolean));
  const random=createSeededRandom(deriveSeed(seed,'similar',original.id||original.question));
  const ranked=pool
    .filter(item=>!avoid.has(item.question))
    .map(item=>{
      const sameFamily=item.blueprint_id===original.blueprint_id?1:0;
      const sim=structuralSimilarity(item,original);
      const sameGenome=sig(item)&&sig(item)===sig(original)?1:0;
      const use=usage.get(item.id)??0;
      return{item,score:sameFamily*45+sim*30+quality(item)*.55+novelty(item)*.24-sameGenome*160-use*2.5+random()*4};
    })
    .sort((a,b)=>b.score-a.score);
  return ranked[0]?.item??null;
}
