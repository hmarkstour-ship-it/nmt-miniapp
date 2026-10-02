function latexify(expr='') {
  return String(expr)
    .replace(/∠/g, '\\angle ')
    .replace(/π/g, '\\pi ')
    .replace(/≤/g, '\\le ')
    .replace(/≥/g, '\\ge ')
    .replace(/≠/g, '\\ne ')
    .replace(/·/g, '\\cdot ')
    .replace(/×/g, '\\times ')
    .replace(/²/g, '^{2}')
    .replace(/³/g, '^{3}')
    .replace(/°/g, '^{\\circ}')
    .replace(/%/g, '\\%')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrap(expr){return `\\(${latexify(expr)}\\)`;}

function createProtector(text){
  const saved=[];
  let out=String(text).replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$/g,(m)=>{
    const key=`«§${saved.length}§»`; saved.push(m); return key;
  });
  const protectReplace=(regex,convert=(m)=>wrap(m))=>{
    out=out.replace(regex,(...args)=>{
      const m=args[0]; const rendered=convert(m,...args.slice(1,-2));
      const key=`«§${saved.length}§»`; saved.push(rendered); return key;
    });
  };
  const restore=()=>saved.reduce((acc,value,i)=>acc.replaceAll(`«§${i}§»`,value),out);
  return {get:()=>out,set:(v)=>{out=v},protectReplace,restore,saved};
}

export function formatNmtMathText(value,{option=false}={}){
  if(typeof value!=='string'||!value.trim()) return value;
  const p=createProtector(value);
  const plain=p.get().trim();

  if(option){
    const mathish=/^(?:[-+]?\d+(?:[.,]\d+)?|[A-Za-z][A-Za-z0-9₀-₉]*|[A-Za-z0-9₀-₉()]+(?:\s*[+−\-*/=<>:·×^²³√π]\s*[A-Za-z0-9₀-₉()°%.,]+)+|\d+(?:[.,]\d+)?%|[-+]?\d+(?:[.,]\d+)?√\d+)$/u;
    if(mathish.test(plain) && !plain.includes('«§')) p.set(`«§${p.saved.length}§»`),p.saved.push(wrap(plain));
    return p.restore();
  }

  // Geometric angle statement.
  p.protectReplace(/∠[A-ZА-ЯІЇЄ]{1,4}\s*=\s*-?\d+(?:[.,]\d+)?°/gu);

  // Compact ratio first (no prose colon): AB:AC=2:3.
  p.protectReplace(/\b[A-Z]{1,3}:[A-Z]{1,3}\s*=\s*-?\d+(?:[.,]\d+)?:-?\d+(?:[.,]\d+)?/g);

  // Compact equations/inequalities. Colons are intentionally excluded so prose like `x=3: y=...` stays two formulas.
  const atom=String.raw`(?:(?:[A-Za-z][A-Za-z0-9₀-₉]*|\d+(?:[.,]\d+)?|√\d+|π|\([^()]{1,24}\))(?:²|³|\^\d+)?)`;
  const chain=String.raw`${atom}(?:\s*[+−\-*/·×^]\s*${atom})*`;
  const eqRe=new RegExp(`${chain}(?:\\s*(?:=|≤|≥|≠)\\s*${chain})+`, 'gu');
  p.protectReplace(eqRe,(m)=>wrap(m.trim().replace(/[.;!?]+$/,'')));

  // Standalone compact algebraic expression, e.g. x-(23), x^2-5x+6.
  p.protectReplace(/\b[a-zA-Z](?:\s*[+−\-*/·×^]\s*\(?-?\d+(?:[.,]\d+)?\)?){1,4}\b/g);
  // Simple named functions.
  p.protectReplace(/\b(?:log|ln|sin|cos|tg|tan)\s*\(?[A-Za-z0-9+−\-*/^.,]+\)?/gi);

  return p.restore();
}

export function formatNmtQuestionPayload({question,options,explanation,solution}={}){
  const formattedSolution=solution?{
    ...solution,
    given:formatNmtMathText(solution.given),
    find:formatNmtMathText(solution.find),
    method:formatNmtMathText(solution.method),
    steps:(solution.steps||[]).map((x)=>formatNmtMathText(x)),
    why:formatNmtMathText(solution.why),
    answer:formatNmtMathText(solution.answer,{option:true}),
  }:solution;
  return {
    question:formatNmtMathText(question),
    options:Array.isArray(options)?options.map((x)=>formatNmtMathText(String(x),{option:true})):options,
    explanation:formatNmtMathText(explanation),
    solution:formattedSolution,
  };
}
