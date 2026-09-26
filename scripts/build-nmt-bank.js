import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildQuestionBank,
  auditQuestionBank,
  writeJson,
} from '../nmt-engine/factory/index.js';

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function num(name, fallback) {
  const value = Number(arg(name, fallback));
  return Number.isFinite(value) ? value : fallback;
}

const total = Math.max(1, Math.floor(num('total', 120)));
const seed = Math.floor(num('seed', 73001));
const topic = arg('topic', null);
const answerType = arg('type', null);
const outName = arg('out', 'generated/nmt-question-bank-v1.json');
const easy = num('easy', 0.34);
const medium = num('medium', 0.46);
const hard = num('hard', 0.20);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.resolve(root, outName);
const auditPath = outPath.replace(/\.json$/i, '.audit.json');

console.log(`Stage 7: building ${total} offline questions (seed=${seed})...`);
const bank = buildQuestionBank({
  total,
  seed,
  topic,
  answerType,
  difficultyMix: {
    'легкий': easy,
    'середній': medium,
    'складний': hard,
  },
});
const audit = auditQuestionBank(bank);

writeJson(outPath, bank);
writeJson(auditPath, audit);

console.log(`Bank: ${outPath}`);
console.log(`Audit: ${auditPath}`);
console.log(`Items: ${bank.item_count}`);
console.log(`Valid: ${audit.valid}`);
console.log(`Types: ${JSON.stringify(audit.byType)}`);
console.log(`Difficulty: ${JSON.stringify(audit.byDifficulty)}`);
console.log(`Unique skeletons: ${audit.uniqueSkeletonCount}`);
console.log(`Direct blueprints: ${audit.representedDirectBlueprintCount}/${audit.directBlueprintCount}`);
console.log(`Difficulty mismatches: ${audit.difficultyMismatchCount}`);
console.log(`Mock slots covered: ${audit.mockSlotsCovered}/22`);
