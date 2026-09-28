import assert from 'node:assert/strict';
import fs from 'node:fs';
import { QUESTION_BLUEPRINTS } from '../nmt-knowledge.js';
import { QUESTION_ENGINE_VERSION, generateByBlueprint, questionSkeleton } from '../nmt-engine/generation/question-generator.js';
import { VISUAL_ENGINE_VERSION } from '../nmt-engine/visuals/visual-spec.js';
import { RUNTIME_VERSION } from '../nmt-engine/runtime/constants.js';

assert.equal(fs.existsSync('question-engine.js'), false, 'legacy question-engine.js still exists');
assert.equal(fs.existsSync('deterministic-math.js'), false, 'legacy deterministic-math.js still exists');
assert.equal(QUESTION_ENGINE_VERSION, 11);
assert.equal(VISUAL_ENGINE_VERSION, 3);
assert.equal(RUNTIME_VERSION, 11);

const sourceFiles = [
  'server.js', 'nmt-exam-engine.js',
  'nmt-engine/factory/question-factory.js',
  'nmt-engine/runtime/mock-selector.js',
  'nmt-engine/mock/contract.js',
  'nmt-engine/integration/diverse-training-generator.js',
];
for (const file of sourceFiles) {
  const source=fs.readFileSync(file,'utf8');
  assert.ok(!source.includes('question-engine.js'), `${file} still references question-engine.js`);
  assert.ok(!source.includes('deterministic-math.js'), `${file} still references deterministic-math.js`);
}

let generated=0, visual=0;
const variants=new Set(), skeletons=new Set(), visualTypes=new Set();
for (const bp of QUESTION_BLUEPRINTS) {
  const localVariants=new Set(), localSkeletons=new Set();
  for (let i=0;i<80;i+=1) {
    const type=bp.formats.length===1?bp.formats[0]:null;
    const q=generateByBlueprint(bp.id,{requiredType:type});
    generated += 1;
    localVariants.add(q.variant_key);
    localSkeletons.add(questionSkeleton(q.question));
    variants.add(q.variant_key); skeletons.add(questionSkeleton(q.question));
    if(q.visual_spec){
      visual += 1;
      visualTypes.add(q.visual_spec.type);
      assert.equal(q.visual_spec.metadata.renderer,'nmt-engine4-visual-engine-v3');
      assert.ok(q.diagram_svg.startsWith('<svg'));
    }
  }
  assert.ok(localVariants.size >= 1, `${bp.id} has no variant`);
}

const bank=JSON.parse(fs.readFileSync('generated/nmt-question-bank-v1.json','utf8'));
assert.equal(bank.core_engine_version,11);
assert.equal(bank.visual_engine_version,3);
assert.ok(bank.items.length >= 900,'runtime bank is too small');
assert.ok((bank.build_stats?.skeleton_count ?? 0) >= 60,'runtime bank has too few structural skeletons');
assert.ok((bank.build_stats?.variant_count ?? 0) >= 70,'runtime bank has too few variants');
for(const q of bank.items){
  assert.equal(q.engine_version,11);
  if(q.visual_spec){
    assert.equal(q.visual_spec.metadata?.renderer,'nmt-engine4-visual-engine-v3');
    assert.notEqual(q.visual_spec.type,'legacy_svg');
  }
}

console.log(JSON.stringify({
  ok:true,
  coreEngineVersion:QUESTION_ENGINE_VERSION,
  visualEngineVersion:VISUAL_ENGINE_VERSION,
  runtimeVersion:RUNTIME_VERSION,
  blueprints:QUESTION_BLUEPRINTS.length,
  generatedSamples:generated,
  sampleVariants:variants.size,
  sampleSkeletons:skeletons.size,
  visualSamples:visual,
  visualTypes:[...visualTypes].sort(),
  runtimeBankItems:bank.items.length,
  runtimeSkeletons:bank.build_stats.skeleton_count,
  runtimeVariants:bank.build_stats.variant_count,
},null,2));
