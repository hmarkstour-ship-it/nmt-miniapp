import path from 'node:path';
import { buildQuestionBank, auditQuestionBank, writeJson } from '../nmt-engine/factory/index.js';
import { QUESTION_ENGINE_VERSION } from '../nmt-engine/generation/question-generator.js';
import { VISUAL_ENGINE_VERSION } from '../nmt-engine/visuals/visual-spec.js';

// Several independent seeded builds give us a deep parameter pool, while the
// consolidation pass below prevents the runtime bank from becoming a pile of
// the same skeleton with different numbers.
const builds = [
  { total: 420, seed: 91001 },
  { total: 480, seed: 92017 },
  { total: 540, seed: 93031 },
  { total: 600, seed: 94049 },
  { total: 660, seed: 95063 },
  { total: 720, seed: 96079 },
];

const MAX_PER_SKELETON = 24;
const MAX_PER_VARIANT = 70;
const byHash = new Map();
const skeletonCounts = new Map();
const variantCounts = new Map();
let template = null;
const buildSummaries = [];

for (const config of builds) {
  const bank = buildQuestionBank({ ...config, allowPartial: true });
  template ||= bank;
  buildSummaries.push({ total:config.total, seed:config.seed, item_count:bank.item_count });
  for (const item of bank.items) {
    const hash = item.bank_meta?.content_hash;
    if (!hash || byHash.has(hash)) continue;
    const skeleton = item.question_skeleton || item.question;
    const variant = item.variant_key || item.blueprint_id || 'unknown';
    if ((skeletonCounts.get(skeleton) ?? 0) >= MAX_PER_SKELETON) continue;
    if ((variantCounts.get(variant) ?? 0) >= MAX_PER_VARIANT) continue;
    byHash.set(hash,item);
    skeletonCounts.set(skeleton,(skeletonCounts.get(skeleton) ?? 0)+1);
    variantCounts.set(variant,(variantCounts.get(variant) ?? 0)+1);
  }
}

const items=[...byHash.values()].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
const bank={
  ...template,
  schema_version:'2.0',
  factory_version:11,
  engine_name:'NMT Engine 3.0 Clean Core',
  mode:'runtime_consolidated_diverse',
  seed:null,
  requested_item_count:items.length,
  item_count:items.length,
  core_engine_version:QUESTION_ENGINE_VERSION,
  visual_engine_version:VISUAL_ENGINE_VERSION,
  scope:{topic:null,answer_type:null},
  source_builds:buildSummaries,
  build_stats:{
    source_build_count:builds.length,
    source_item_count:builds.reduce((sum,x)=>sum+x.total,0),
    unique_item_count:items.length,
    max_per_skeleton:MAX_PER_SKELETON,
    max_per_variant:MAX_PER_VARIANT,
    skeleton_count:skeletonCounts.size,
    variant_count:variantCounts.size,
  },
  items,
};

const audit=auditQuestionBank(bank);
if(!audit.valid){ console.error(audit.validationErrors); process.exit(1); }
const out=path.resolve('generated/nmt-question-bank-v1.json');
const auditOut=path.resolve('generated/nmt-question-bank-v1.audit.json');
writeJson(out,bank); writeJson(auditOut,audit);
console.log(`Clean runtime bank built: ${items.length} unique items`);
console.log(`Structural skeletons: ${skeletonCounts.size}`);
console.log(`Variants: ${variantCounts.size}`);
console.log(`Training plain: ${audit.trainingPlainCount}`);
console.log(`Training visual: ${audit.trainingVisualCount}`);
console.log(`Mock slots: ${audit.mockSlotsCovered}/22`);
console.log(`Core v${QUESTION_ENGINE_VERSION}, Visual v${VISUAL_ENGINE_VERSION}`);
