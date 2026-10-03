import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EXAM_SLOTS } from '../nmt-knowledge.js';
import { OfflineQuestionBankRuntime } from '../nmt-engine/runtime/offline-bank-runtime.js';
import { validateVisualSemantics } from '../nmt-engine/v4/visual/semantic-validator.js';
import { validateRenderedSvg } from '../nmt-engine/visuals/visual-validator.js';

const bank = JSON.parse(fs.readFileSync('generated/nmt-question-bank-v1.json','utf8'));
assert.ok(Array.isArray(bank.items) && bank.items.length >= 1000, 'runtime bank is unexpectedly small');

function stripDelimitedMath(value='') {
  return String(value)
    .replace(/\\\([\s\S]*?\\\)/g,' ')
    .replace(/\\\[[\s\S]*?\\\]/g,' ')
    .replace(/\$\$[\s\S]*?\$\$/g,' ');
}
function balanced(value='') {
  const text=String(value);
  for(const [a,b] of [[/\\\(/g,/\\\)/g],[/\\\[/g,/\\\]/g]]) {
    if((text.match(a)?.length??0)!==(text.match(b)?.length??0)) return false;
  }
  return (text.match(/\$\$/g)?.length??0)%2===0;
}
function unsafe(value='') {
  const outside=stripDelimitedMath(value);
  const rawLatex=/\\(?:frac|dfrac|tfrac|sqrt|left|right|cdot|times|div|log|ln|sin|cos|tan|cot|le|ge|neq|approx|pi|infty|sum|prod|overline|vec|begin|end)\b/.test(outside);
  const legacy=/\bsqrt\s*\(|\blog_[A-Za-z0-9]+\s*\(?|\b[A-Za-z]\s*[+−\-*/^]\s*\(?-?\d|\d\s*\^\s*\d/.test(outside);
  const compactMath=/[A-Za-zА-Яа-яІіЇїЄєҐґ0-9₀-₉ₙₐₑₒₓ][A-Za-zА-Яа-яІіЇїЄєҐґ0-9₀-₉ₙₐₑₒₓ_(){}\[\]+−\-*/·×^=<>≤≥≠:%.,]{1,100}/gu;
  const compact=[...outside.matchAll(compactMath)].some(([token])=>{
    const hasRelationOrPower=/[=<>≤≥≠^√]/u.test(token);
    const hasNumericOperation=/(?:\d[^\s]{0,30}[+−*/·×]|[+−*/·×][^\s]{0,30}\d)/u.test(token);
    const hasSubscriptFormula=/[A-Za-zА-Яа-яІіЇїЄєҐґ][₀-₉ₙₐₑₒₓ]/u.test(token)&&/[=+−*/·×^]/u.test(token);
    return hasRelationOrPower||hasNumericOperation||hasSubscriptFormula;
  });
  return rawLatex||legacy||compact;
}
function fields(q){
  const out=[q.question,...(q.options||[]),q.explanation,...(q.explanation_steps||[]),...(q.left||[]),...(q.match_options||[]).map(x=>x.label)];
  if(q.solution) out.push(q.solution.given,q.solution.find,q.solution.method,q.solution.why,q.solution.answer,...(q.solution.steps||[]));
  return out.filter(x=>typeof x==='string');
}

let visual=0, shortExplanations=0;
const mathErrors=[];
const visualErrors=[];
const explanationErrors=[];
for(const q of bank.items){
  for(const value of fields(q)){
    if(!balanced(value)||unsafe(value)) { mathErrors.push({id:q.id,value}); break; }
  }
  const steps=q.solution?.steps||q.explanation_steps||[];
  if(steps.length<2||steps.length>4) explanationErrors.push({id:q.id,steps:steps.length});
  else shortExplanations++;
  if(q.visual_spec){
    visual++;
    const semantic=validateVisualSemantics(q);
    const svg=validateRenderedSvg(q.diagram_svg,q.visual_spec);
    if(!semantic.ok||!svg.ok) visualErrors.push({id:q.id,semantic:semantic.errors,svg:svg.errors});
  }
}
assert.equal(mathErrors.length,0,`math errors: ${JSON.stringify(mathErrors.slice(0,5))}`);
assert.equal(visualErrors.length,0,`visual errors: ${JSON.stringify(visualErrors.slice(0,5))}`);
assert.equal(explanationErrors.length,0,`explanation step errors: ${JSON.stringify(explanationErrors.slice(0,8))}`);

const runtime=new OfflineQuestionBankRuntime(bank);
const seenTexts=[];
const seenSkeletons=[];
let immediateTopicRepeats=0, immediateSkeletonRepeats=0, exactRepeats=0;
for(let round=0;round<40;round++){
  const batch=runtime.pickTrainingBatch({topic:'mixed',count:5,avoidTexts:seenTexts.slice(0,180),seed:`launch:${round}`});
  assert.ok(batch.length>0,'training selector returned no items');
  for(const q of batch){
    if(seenTexts.includes(q.question)) exactRepeats++;
    if(seenSkeletons[0]&&seenSkeletons[0]===q.question_skeleton) immediateSkeletonRepeats++;
    const prev=seenTexts[0] ? runtime.index.byText.get(seenTexts[0]) : null;
    if(prev?.topic===q.topic) immediateTopicRepeats++;
    seenTexts.unshift(q.question);
    seenSkeletons.unshift(q.question_skeleton);
    if(seenTexts.length>180) seenTexts.pop();
    if(seenSkeletons.length>180) seenSkeletons.pop();
  }
}
assert.equal(exactRepeats,0,'anti-repeat allowed an exact repeat inside 180-item window');
assert.equal(immediateSkeletonRepeats,0,'anti-repeat allowed immediate skeleton repeat');
assert.equal(immediateTopicRepeats,0,'mixed stream allowed immediate topic repeat');

for(let i=0;i<5;i++){
  const mock=runtime.assembleMock(EXAM_SLOTS,{seed:`launch-mock:${i}`,attempts:30});
  assert.equal(mock.questions.length,22,'mock must contain 22 questions');
  assert.deepEqual(mock.questions.map(x=>x.number),Array.from({length:22},(_,j)=>j+1),'mock slots must be 1..22');
}

console.log(JSON.stringify({
  launch_audit:'PASS',
  bank_items:bank.items.length,
  concise_explanations:shortExplanations,
  visual_items:visual,
  exact_repeats_in_200_training_samples:exactRepeats,
  immediate_topic_repeats:immediateTopicRepeats,
  immediate_skeleton_repeats:immediateSkeletonRepeats,
  mock_runs:5,
  mock_questions_per_run:22,
},null,2));
