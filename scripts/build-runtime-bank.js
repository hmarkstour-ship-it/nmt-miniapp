import path from 'node:path';
import { buildQuestionBank, auditQuestionBank, writeJson } from '../nmt-engine/factory/index.js';
import { QUESTION_ENGINE_VERSION } from '../nmt-engine/generation/question-generator.js';
import { VISUAL_ENGINE_VERSION } from '../nmt-engine/visuals/visual-spec.js';

const builds=[
  {total:260,seed:41001},{total:280,seed:42017},{total:300,seed:43031},{total:320,seed:44049},
];
const MAX_PER_SKELETON=18,MAX_PER_VARIANT=54,MAX_PER_GENOME=22;
const byHash=new Map(),skeletonCounts=new Map(),variantCounts=new Map(),genomeCounts=new Map();let template=null;const summaries=[];
for(const config of builds){const bank=buildQuestionBank({...config,allowPartial:true});template||=bank;summaries.push({...config,item_count:bank.item_count});for(const item of bank.items){const h=item.bank_meta?.content_hash,sk=item.bank_meta?.skeleton_hash,v=item.variant_key||item.blueprint_id,g=item.bank_meta?.genome_signature;if(!h||byHash.has(h))continue;if((skeletonCounts.get(sk)||0)>=MAX_PER_SKELETON)continue;if((variantCounts.get(v)||0)>=MAX_PER_VARIANT)continue;if(g&&(genomeCounts.get(g)||0)>=MAX_PER_GENOME)continue;byHash.set(h,item);skeletonCounts.set(sk,(skeletonCounts.get(sk)||0)+1);variantCounts.set(v,(variantCounts.get(v)||0)+1);if(g)genomeCounts.set(g,(genomeCounts.get(g)||0)+1)}}
const items=[...byHash.values()].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
const bank={...template,schema_version:'4.0',factory_version:40,engine_name:'NMT Engine 4.0 AI Hybrid',production_standard:'NMT HARD',mode:'runtime_verified_ai_hybrid',seed:null,requested_item_count:items.length,item_count:items.length,core_engine_version:QUESTION_ENGINE_VERSION,visual_engine_version:VISUAL_ENGINE_VERSION,source_builds:summaries,build_stats:{source_build_count:builds.length,unique_item_count:items.length,max_per_skeleton:MAX_PER_SKELETON,max_per_variant:MAX_PER_VARIANT,max_per_genome:MAX_PER_GENOME,skeleton_count:skeletonCounts.size,variant_count:variantCounts.size,genome_count:genomeCounts.size},items};
const audit=auditQuestionBank(bank);if(!audit.valid){console.error(audit.validationErrors.slice(0,30));process.exit(1)}
writeJson(path.resolve('generated/nmt-question-bank-v1.json'),bank);writeJson(path.resolve('generated/nmt-question-bank-v1.audit.json'),audit);
console.log(`NMT Engine 4 runtime bank: ${items.length}`);console.log(`Blueprints: ${Object.keys(audit.byBlueprint).length}`);console.log(`Skeletons: ${audit.uniqueSkeletonCount}; genomes: ${audit.uniqueGenomeCount}`);console.log(`Visual: ${audit.visualCount}; renderers: ${JSON.stringify(audit.byRenderer)}`);console.log(`Quality avg: ${audit.averageQualityScore}; novelty avg: ${audit.averageNoveltyScore}; complexity avg: ${audit.averageComplexityScore}`);console.log(`Mock slots: ${audit.mockSlotsCovered}/22`);
