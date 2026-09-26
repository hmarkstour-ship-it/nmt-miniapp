import path from 'node:path';
import { buildQuestionBank, auditQuestionBank, writeJson } from '../nmt-engine/factory/index.js';

const builds = [
  { total: 120, seed: 73001 },
  { total: 180, seed: 83180 },
  { total: 220, seed: 83220 },
  { total: 260, seed: 83260 },
];

const byHash = new Map();
let template = null;
const buildSummaries = [];

for (const config of builds) {
  const bank = buildQuestionBank(config);
  template ||= bank;
  buildSummaries.push({ total: config.total, seed: config.seed, item_count: bank.item_count });
  for (const item of bank.items) {
    const hash = item.bank_meta?.content_hash;
    if (hash && !byHash.has(hash)) byHash.set(hash, item);
  }
}

const items = [...byHash.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const bank = {
  ...template,
  mode: 'runtime_consolidated',
  seed: null,
  requested_item_count: items.length,
  item_count: items.length,
  scope: { topic: null, answer_type: null },
  source_builds: buildSummaries,
  build_stats: {
    source_build_count: builds.length,
    source_item_count: builds.reduce((sum, x) => sum + x.total, 0),
    unique_item_count: items.length,
    duplicates_removed: builds.reduce((sum, x) => sum + x.total, 0) - items.length,
  },
  items,
};

const audit = auditQuestionBank(bank);
if (!audit.valid) {
  console.error(audit.validationErrors);
  process.exit(1);
}

const out = path.resolve('generated/nmt-question-bank-v1.json');
const auditOut = path.resolve('generated/nmt-question-bank-v1.audit.json');
writeJson(out, bank);
writeJson(auditOut, audit);

console.log(`Stage 8 runtime bank built: ${items.length} unique items`);
console.log(`Training plain: ${audit.trainingPlainCount}`);
console.log(`Training visual: ${audit.trainingVisualCount}`);
console.log(`Mock slots: ${audit.mockSlotsCovered}/22`);
console.log(`Output: ${out}`);
