const SUBSCRIPTS = Object.freeze({
  '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9',
  'ₙ':'n','ₐ':'a','ₑ':'e','ₒ':'o','ₓ':'x',
});

function normalizeLegacyFunctions(expr='') {
  return String(expr)
    .replace(/−/g, '-')
    .replace(/sqrt\s*\(\s*([^()]+?)\s*\)/gi, '\\sqrt{$1}')
    .replace(/√\s*\(\s*([^()]+?)\s*\)/g, '\\sqrt{$1}')
    .replace(/√\s*([A-Za-z0-9]+)/g, '\\sqrt{$1}')
    .replace(/log_([A-Za-z0-9]+)\s*\(\s*([^()]+?)\s*\)/gi, '\\log_{$1}\\left($2\\right)')
    .replace(/log_([A-Za-z0-9]+)\s*([A-Za-z0-9]+)/gi, '\\log_{$1} $2');
}

function latexify(expr='') {
  let out = normalizeLegacyFunctions(expr)
    .replace(/[₀₁₂₃₄₅₆₇₈₉ₙₐₑₒₓ]/g, (ch) => `_{${SUBSCRIPTS[ch] ?? ch}}`)
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
    .replace(/%/g, '\\%');

  out = out.replace(/\b(log|ln|sin|cos|tan|tg)\b/gi, (m) => {
    const key = m.toLowerCase() === 'tg' ? 'tan' : m.toLowerCase();
    return `\\${key}`;
  });

  // Pretty simple standalone fractions. Larger expressions remain valid KaTeX with '/'.
  out = out.replace(/(?<![A-Za-z0-9}])([A-Za-z]|\d+)\s*\/\s*([A-Za-z]|\d+)(?![A-Za-z0-9{])/g,
    (_,a,b) => `\\frac{${a}}{${b}}`);

  return out.replace(/\s+/g, ' ').trim();
}

function wrap(expr){ return `\\(${latexify(expr)}\\)`; }

function createProtector(text){
  const saved=[];
  let out=String(text).replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$/g,(m)=>{
    const key=`«§${saved.length}§»`; saved.push(m); return key;
  });
  const protectReplace=(regex,convert=(m)=>wrap(m))=>{
    out=out.replace(regex,(...args)=>{
      const m=args[0];
      const rendered=convert(m,...args.slice(1,-2));
      if (rendered === m) return m;
      const key=`«§${saved.length}§»`; saved.push(rendered); return key;
    });
  };
  const restore=()=>saved.reduce((acc,value,i)=>acc.replaceAll(`«§${i}§»`,value),out);
  return { get:()=>out, set:(v)=>{out=v}, protectReplace, restore, saved };
}

function compactMathToken(m='') {
  const trailing=(m.match(/[,.!?;]+$/u)||[''])[0];
  const core=trailing?m.slice(0,-trailing.length):m;
  if(core.length<2) return m;
  if(!/[+−\-*/·×^=<>≤≥≠√]/u.test(core)) return m;
  if(!/[A-Za-z0-9₀-₉ₙₐₑₒₓπ]/u.test(core)) return m;
  // Avoid turning ordinary hyphenated Latin words into math.
  if(/^[A-Za-z]{2,}-[A-Za-z]{2,}$/u.test(core)) return m;
  return wrap(core)+(trailing||'');
}

export function formatNmtMathText(value,{option=false}={}){
  if(typeof value!=='string'||!value.trim()) return value;
  const p=createProtector(value);
  const plain=p.get().trim();

  if(option){
    const mathish=/^(?:[-+]?\d+(?:[.,]\d+)?|[A-Za-z][A-Za-z0-9₀-₉]*|[A-Za-z0-9₀-₉_(){}]+(?:\s*[+−\-*/=<>:·×^²³√π]\s*[A-Za-z0-9₀-₉_(){}°%.,]+)+|\d+(?:[.,]\d+)?%|[-+]?\d+(?:[.,]\d+)?√\d+|(?:sqrt|log_|sin|cos|tg|tan)[^\s]+)$/u;
    if(mathish.test(plain) && !plain.includes('«§')) {
      p.set(`«§${p.saved.length}§»`);
      p.saved.push(wrap(plain));
    }
    return p.restore();
  }

  // Specific multi-token constructs first.
  p.protectReplace(/∠[A-ZА-ЯІЇЄ]{1,4}\s*=\s*-?\d+(?:[.,]\d+)?°/gu);
  p.protectReplace(/\b[A-Z]{1,3}\s*:\s*[A-Z]{1,3}\s*=\s*-?\d+(?:[.,]\d+)?\s*:\s*-?\d+(?:[.,]\d+)?/g);
  p.protectReplace(/\bsqrt\s*\([^()]{1,40}\)/gi);
  p.protectReplace(/\blog_[A-Za-z0-9]+\s*\([^()]{1,40}\)/gi);
  p.protectReplace(/\blog_[A-Za-z0-9]+\s*[A-Za-z0-9]+/gi);
  p.protectReplace(/\b(?:ln|sin|cos|tg|tan)\s*\(?[A-Za-z0-9+−\-*/^.,°]+\)?/gi);

  // Whole compact math islands before smaller equation patterns. This is what keeps
  // e.g. 42=6(2·2+5d)/2 in one KaTeX node instead of several broken fragments.
  p.protectReplace(/[A-Za-z0-9₀-₉ₙₐₑₒₓπ√∠][A-Za-z0-9₀-₉ₙₐₑₒₓπ√∠_(){}\[\]+−\-*/·×^=<>≤≥≠:%.,]{1,100}/gu, compactMathToken);

  // Expressions with spaces around operators.
  const atom=String.raw`(?:(?:[A-Za-z][A-Za-z0-9₀-₉]*|\d+(?:[.,]\d+)?|√\d+|π|\([^()]{1,28}\))(?:²|³|\^[A-Za-z0-9]+)?)`;
  const chain=String.raw`${atom}(?:\s*[+−\-*/·×^]\s*${atom})*`;
  const eqRe=new RegExp(`${chain}(?:\\s*(?:=|<|>|≤|≥|≠)\\s*${chain})+`, 'gu');
  p.protectReplace(eqRe,(m)=>wrap(m.trim().replace(/[.;!?]+$/,'')));

  p.protectReplace(/\b(?:\d+)?[a-zA-Z](?:²|³|\^[A-Za-z0-9]+)?(?:\s*[+−\-*/·×^]\s*\(?-?(?:\d+(?:[.,]\d+)?|[a-zA-Z](?:²|³|\^[A-Za-z0-9]+)?)\)?){1,5}\b/g);
  p.protectReplace(/(?<![A-Za-zА-Яа-яІіЇїЄє])(?:-?\d+(?:[.,]\d+)?)(?:\s*[+−\-*/·×^]\s*(?:-?\d+(?:[.,]\d+)?|√\d+)){1,5}(?![A-Za-zА-Яа-яІіЇїЄє])/gu);

  return p.restore();
}

export function formatNmtQuestionPayload({question,options,explanation,solution,left,matchOptions,answerHint}={}){
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
    left:Array.isArray(left)?left.map((x)=>formatNmtMathText(String(x))):left,
    matchOptions:Array.isArray(matchOptions)?matchOptions.map((x)=>formatNmtMathText(String(x),{option:true})):matchOptions,
    answerHint:formatNmtMathText(answerHint),
  };
}
