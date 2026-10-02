function flattenScalars(value, out=[]) {
  if (value == null) return out;
  if (Array.isArray(value)) { for (const v of value) flattenScalars(v,out); return out; }
  if (typeof value === 'object') { for (const v of Object.values(value)) flattenScalars(v,out); return out; }
  if (['string','number','boolean'].includes(typeof value)) out.push(String(value));
  return out;
}

function normalize(v='') {
  return String(v).replace(/\\\(|\\\)|\\\[|\\\]|\\%|\s+/g,'').replace(',', '.').trim();
}

export function validateVisualSemantics(question) {
  const spec = question?.visual_spec;
  if (!spec) return { ok:true, errors:[], answerLeak:false };
  const errors=[];
  const d=spec.data??{};

  const positiveKeys=['left','right','base','a','b','c','width','height','radius','diameter','top','bottom'];
  for(const k of positiveKeys){
    const v=d[k];
    if(v!==''&&v!=null&&typeof v==='number'&&v<=0) errors.push(`non_positive_${k}`);
  }
  for(const k of ['angle','central']){
    const v=Number(d[k]);
    if(d[k]!=null && (!Number.isFinite(v)||v<=0||v>=180)) errors.push(`invalid_${k}`);
  }

  const answer = question.type==='choice'
    ? question.options?.[question.correct_index]
    : question.correct_display ?? question.correct_value;
  const ans=normalize(answer);
  let answerLeak=false;
  if(ans && ans.length>=1){
    const questionText=normalize(question.question);
    const scalars=flattenScalars(d).map(normalize).filter(Boolean);
    // If the target answer appears in the visual data but was not itself given in the wording,
    // the figure can accidentally reveal the answer.
    if(scalars.includes(ans) && !questionText.includes(ans)){
      answerLeak=true;
      errors.push('visual_answer_leak');
    }
  }

  return {ok:errors.length===0,errors,answerLeak};
}
