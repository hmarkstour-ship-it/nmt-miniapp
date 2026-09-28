import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { QUESTION_BLUEPRINTS } from '../nmt-knowledge.js';
import {
  generateByBlueprint,
  validateQuestion,
  generateExamQuestions,
} from '../nmt-engine/generation/question-generator.js';
import { createBlueprintFamilyRegistry } from '../nmt-engine/families/blueprint-families.js';

const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
const factorySource = fs.readFileSync('nmt-engine/factory/question-factory.js', 'utf8');
const profilerSource = fs.readFileSync('nmt-engine/factory/blueprint-profiler.js', 'utf8');
const facadeSource = fs.readFileSync('question-engine.js', 'utf8');
const bank = JSON.parse(fs.readFileSync('generated/nmt-question-bank-v1.json', 'utf8'));

assert.ok(!factorySource.includes("../../question-engine.js"), 'factory still depends on old question-engine path');
assert.ok(!profilerSource.includes("../../question-engine.js"), 'profiler still depends on old question-engine path');
assert.ok(facadeSource.includes('nmt-engine/generation/question-generator.js'), 'question-engine.js is not the new compatibility facade');

const registry = createBlueprintFamilyRegistry();
assert.equal(registry.size, QUESTION_BLUEPRINTS.length, 'family registry coverage mismatch');
for (const bp of QUESTION_BLUEPRINTS) assert.equal(typeof registry.get(bp.id)?.generate, 'function', `family ${bp.id} has no generator`);

let generated = 0;
let generatedVisual = 0;
const visualTypes = new Set();
for (const bp of QUESTION_BLUEPRINTS) {
  for (const type of bp.formats) {
    for (let i = 0; i < 12; i += 1) {
      const q = generateByBlueprint(bp.id, { requiredType: type });
      assert.ok(validateQuestion(q), `invalid ${bp.id}/${type}`);
      assert.equal(q.blueprint_id, bp.id);
      assert.equal(q.type, type);
      assert.equal(q.core_meta?.source, 'nmt-engine3-core');
      generated += 1;
      if (q.visual_spec) {
        generatedVisual += 1;
        visualTypes.add(q.visual_spec.type);
        assert.equal(q.visual_spec.metadata?.renderer, 'nmt-engine3-visual-engine-v2');
        assert.ok(q.diagram_svg?.startsWith('<svg'));
      }
    }
  }
}

for (let i = 0; i < 30; i += 1) {
  const exam = generateExamQuestions();
  assert.equal(exam.length, 22);
  assert.equal(exam.filter((q) => q.type === 'choice').length, 15);
  assert.equal(exam.filter((q) => q.type === 'matching').length, 3);
  assert.equal(exam.filter((q) => q.type === 'short').length, 4);
}

assert.ok(bank.items.length >= 600, 'runtime bank unexpectedly small');
assert.equal(bank.items.filter((q) => q.core_meta?.source === 'nmt-engine3-core').length, bank.items.length, 'runtime bank contains legacy-generated items');
const bankVisuals = bank.items.filter((q) => q.visual_spec);
assert.ok(bankVisuals.length > 100, 'runtime bank lacks visual inventory');
assert.equal(bankVisuals.filter((q) => q.visual_spec?.metadata?.renderer === 'nmt-engine3-visual-engine-v2').length, bankVisuals.length, 'runtime bank contains legacy visuals');
assert.equal(bankVisuals.filter((q) => q.visual_spec?.type === 'legacy_svg').length, 0, 'legacy SVG wrapper remains in runtime bank');

const summary = {
  ok: true,
  coreVersion: 7,
  familyCount: registry.size,
  generatedChecks: generated,
  generatedVisualChecks: generatedVisual,
  generatedVisualTypes: [...visualTypes].sort(),
  runtimeBankItems: bank.items.length,
  runtimeCoreItems: bank.items.filter((q) => q.core_meta?.source === 'nmt-engine3-core').length,
  runtimeVisualItems: bankVisuals.length,
  runtimeLegacyVisualItems: bankVisuals.filter((q) => q.visual_spec?.type === 'legacy_svg').length,
  factoryLegacyGeneratorImport: factorySource.includes('../../question-engine.js'),
  profilerLegacyGeneratorImport: profilerSource.includes('../../question-engine.js'),
  questionEngineFacadeHash: hash(facadeSource),
};
console.log(JSON.stringify(summary, null, 2));
