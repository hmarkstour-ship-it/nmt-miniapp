import { makeChoice, makeMatching, makeShort } from './builders.js';
import { LETTERS, frac, math, pick, randInt, shuffle, signedTerm, ua } from './utils.js';

const codeFor = (pool, value) => LETTERS[pool.findIndex((x) => String(x) === String(value))];

function algebraDistribute() {
  const k = pick([2,3,4,5]);
  const a = pick([2,3,4,5,6]);
  const b = pick([1,2,3,4]);
  const constant = -k*a + b;
  return makeChoice('algebra_simplify', {
    topic:'numbers', variant:'distribute-cancel-x',
    question:`Спростіть вираз ${math(`${k}(x-${a})-${k}x+${b}`)}.`,
    correct:ua(constant),
    distractors:[ua(k*a+b), ua(-k*a-b), math(`${k}x${signedTerm(constant)}`), ua(a-b)],
    explanation:`Розкриваємо дужки: ${k}x−${k*a}−${k}x+${b}=${constant}.`,
    difficulty:'легкий', coreMeta:{steps_estimate:2},
  });
}

function algebraFactor() {
  const a = pick([2,3,4,5]);
  const b = pick([2,3,4,6]);
  const c = a*b;
  return makeChoice('algebra_simplify', {
    topic:'numbers', variant:'factor-common-monomial',
    question:`Винесіть спільний множник за дужки у виразі ${math(`${c}x^2+${a}x`)}.`,
    correct:math(`${a}x(${b}x+1)`),
    distractors:[math(`${a}(${b}x+1)`), math(`${a}x(${b}x+x)`), math(`${c}x(x+1)`), math(`x(${c}x+${a}x)`) ],
    explanation:`Обидва доданки мають спільний множник ${a}x: ${c}x²+${a}x=${a}x(${b}x+1).`,
    difficulty:'середній', coreMeta:{steps_estimate:1},
  });
}

function percentIncrease() {
  const base = pick([240,320,400,480,600,800,1200]);
  const p = pick([10,15,20,25,30]);
  const result = base*(100+p)/100;
  return makeChoice('applied_ratio_percent', {
    topic:'percents', variant:'price-increase',
    question:`Ціну товару ${base} грн збільшили на ${p}%. Якою стала нова ціна?`,
    correct:ua(result),
    distractors:[ua(base*p/100), ua(base-result+base), ua(base+p), ua(base*(100-p)/100)],
    explanation:`Збільшення становить ${base}·${p}/100=${ua(base*p/100)} грн, тому нова ціна ${ua(result)} грн.`,
    coreMeta:{steps_estimate:2},
  });
}

function percentRatio() {
  const ratio = pick([[2,3],[3,5],[4,5],[3,4]]);
  const k = pick([10,20,30,40]);
  const a = ratio[0]*k, b = ratio[1]*k;
  const pct = a/b*100;
  return makeChoice('applied_ratio_percent', {
    topic:'percents', variant:'ratio-as-percent',
    question:`Число ${a} становить скільки відсотків від числа ${b}?`,
    correct:`${ua(pct)}%`,
    distractors:[`${ua(100-pct)}%`,`${ua(b/a*100)}%`,`${ua(a/b)}%`,`${ua((b-a)/b*100)}%`],
    explanation:`Шукана частка: ${a}/${b}·100%=${ua(pct)}%.`,
    difficulty:'легкий', coreMeta:{steps_estimate:1},
  });
}

function linearInequalityFlip() {
  const a = pick([2,3,4,5]);
  const bound = pick([-4,-3,-2,1,2,3,4]);
  const b = pick([-5,-3,2,4,6]);
  const c = -a*bound+b;
  const sign = pick(['<','>']);
  const answerSign = sign === '<' ? '>' : '<';
  const correct = answerSign === '<' ? math(`(-\\infty;${bound})`) : math(`(${bound};+\\infty)`);
  const opposite = answerSign === '<' ? math(`(${bound};+\\infty)`) : math(`(-\\infty;${bound})`);
  return makeChoice('linear_inequality_pick', {
    topic:'inequalities', variant:'negative-coefficient-flip',
    question:`Розв’яжіть нерівність ${math(`${-a}x${signedTerm(b)}${sign}${c}`)}.`,
    correct,
    distractors:[opposite, math(`(-\\infty;${-bound})`), math(`(${-bound};+\\infty)`), math(`\\{${bound}\\}`)],
    explanation:`Після перенесення сталої ділимо на від’ємне число ${-a}, тому знак нерівності змінюється. Маємо x${answerSign}${bound}.`,
    coreMeta:{steps_estimate:2},
  });
}

function linearInequalityBothSides() {
  const a = pick([3,4,5,6]);
  const d = pick([1,2]);
  const bound = pick([-3,-2,1,2,3,4]);
  const b = pick([-4,-2,3,5]);
  const c = (a-d)*bound+b;
  const correct = math(`(-\\infty;${bound})`);
  return makeChoice('linear_inequality_pick', {
    topic:'inequalities', variant:'variables-both-sides',
    question:`Розв’яжіть нерівність ${math(`${a}x${signedTerm(b)}<${d}x${signedTerm(c)}`)}.`,
    correct,
    distractors:[math(`(${bound};+\\infty)`), math(`(-\\infty;${-bound})`), math(`\\{${bound}\\}`), math(`[${bound};+\\infty)`) ],
    explanation:`Переносимо члени з x вліво: ${a-d}x<${c-b}. Ділимо на ${a-d}>0 і отримуємо x<${bound}.`,
    coreMeta:{steps_estimate:2},
  });
}

function systemWeighted() {
  const x = pick([1,2,3,4,5]);
  const y = pick([1,2,3,4]);
  const a = pick([2,3,4]);
  const s1 = a*x+y;
  const s2 = x-y;
  return makeChoice('systems_linear', {
    topic:'systems', variant:'weighted-system-target-difference',
    question:`Розв’яжіть систему ${math(`\\begin{cases}${a}x+y=${s1}\\\\x-y=${s2}\\end{cases}`)}. Знайдіть x+y.`,
    correct:ua(x+y),
    distractors:[ua(x*y),ua(s1+s2),ua(x-y),ua(a*x+y)],
    explanation:`Із другого рівняння y=x−${s2}. Підставляємо в перше, знаходимо x=${x}, y=${y}, тому x+y=${x+y}.`,
    coreMeta:{steps_estimate:3},
  });
}

function progressionFindDifference() {
  const a1 = pick([2,3,4,5,7]);
  const d = pick([2,3,4,5]);
  const n = pick([5,6,7,8]);
  const an = a1+(n-1)*d;
  return makeChoice('progression_ap', {
    topic:'progressions', variant:'find-common-difference',
    question:`В арифметичній прогресії ${math(`a_1=${a1}`)} і ${math(`a_${n}=${an}`)}. Знайдіть різницю d.`,
    correct:ua(d),
    distractors:[ua((an-a1)/n), ua(an-a1), ua(a1+d), ua(an/n)],
    explanation:`aₙ=a₁+(n−1)d, тому d=(${an}−${a1})/${n-1}=${d}.`,
    coreMeta:{steps_estimate:2},
  });
}

function progressionFindIndex() {
  const a1 = pick([1,2,3,4]);
  const d = pick([2,3,4]);
  const n = pick([6,7,8,9,10]);
  const an = a1+(n-1)*d;
  return makeChoice('progression_ap', {
    topic:'progressions', variant:'find-index',
    question:`В арифметичній прогресії a₁=${a1}, d=${d}. Який номер має член, що дорівнює ${an}?`,
    correct:ua(n),
    distractors:[ua(n-1),ua(n+1),ua((an-a1)/d),ua(an/d)],
    explanation:`${an}=${a1}+(n−1)·${d}; звідси n−1=${n-1}, тому n=${n}.`,
    coreMeta:{steps_estimate:2},
  });
}

function powerRootProduct() {
  const a = pick([2,3,5,6]);
  const b = pick([2,3,5,7]);
  const ab = a*b;
  return makeChoice('powers_roots_transform', {
    topic:'powers_roots', variant:'radical-product',
    question:`Спростіть ${math(`\\sqrt{${a}}\\cdot\\sqrt{${b}}`)}.`,
    correct:math(`\\sqrt{${ab}}`),
    distractors:[math(`\\sqrt{${a+b}}`),ua(ab),math(`\\sqrt{${Math.abs(a-b)}}`),ua(a+b)],
    explanation:`Для невід’ємних чисел √a·√b=√(ab), тому отримуємо √${ab}.`,
    difficulty:'легкий', coreMeta:{steps_estimate:1},
  });
}

function powerNegativeExponent() {
  const a = pick([2,3,4,5]);
  const n = pick([2,3,4]);
  return makeChoice('powers_roots_transform', {
    topic:'powers_roots', variant:'negative-exponent',
    question:`Подайте ${math(`${a}^{-${n}}`)} у вигляді дробу.`,
    correct:frac(1,a**n),
    distractors:[ua(-(a**n)),frac(-1,a**n),ua(a**n),frac(1,a*n)],
    explanation:`a^{-n}=1/a^n, тому ${a}^{-${n}}=1/${a**n}.`,
    coreMeta:{steps_estimate:1},
  });
}

function quadraticProductRoots(requiredType) {
  const r1 = pick([-6,-5,-4,-3,-2]);
  const r2 = pick([1,2,3,4,5]);
  const sum = r1+r2, prod=r1*r2;
  const b = -sum;
  const expr=`x^2${signedTerm(b,'x')}${signedTerm(prod)}`;
  if (requiredType === 'short') {
    return makeShort('quadratic_equation', {
      topic:'equations', variant:'larger-root-short',
      question:`Знайдіть більший корінь рівняння ${math(`${expr}=0`)}.`,
      correctValue:r2,
      explanation:`Рівняння має корені ${r1} і ${r2}, тому більший корінь дорівнює ${r2}.`,
      coreMeta:{steps_estimate:2},
    });
  }
  return makeChoice('quadratic_equation', {
    topic:'equations', variant:'roots-product-vieta',
    question:`Знайдіть добуток коренів рівняння ${math(`${expr}=0`)}.`,
    correct:ua(prod),
    distractors:[ua(sum),ua(-prod),ua(b),ua(Math.abs(r2-r1))],
    explanation:`За теоремою Вієта добуток коренів квадратного рівняння дорівнює вільному члену: ${prod}.`,
    coreMeta:{steps_estimate:1},
  });
}

function logEquation() {
  const base = pick([2,3,4,5]);
  const power = pick([2,3,4]);
  const shift = pick([1,2,3,4,5]);
  const x = base**power-shift;
  return makeChoice('log_exp_equation_interval', {
    topic:'logarithms', variant:'log-equation-shift',
    question:`Розв’яжіть рівняння ${math(`\\log_${base}(x+${shift})=${power}`)}.`,
    correct:ua(x),
    distractors:[ua(base*power-shift),ua(base**power+shift),ua(power**base-shift),ua(base**power)],
    explanation:`x+${shift}=${base}^${power}=${base**power}, тому x=${x}.`,
    coreMeta:{steps_estimate:2},
  });
}

function exponentialEquation() {
  const base=pick([2,3,5]); const x=pick([2,3,4]); const rhs=base**x;
  return makeChoice('log_exp_equation_interval', {
    topic:'logarithms', variant:'exponential-same-base',
    question:`Знайдіть x, якщо ${math(`${base}^{x+1}=${rhs*base}`)}.`,
    correct:ua(x), distractors:[ua(x+1),ua(x-1),ua(rhs),ua(base*x)],
    explanation:`Праворуч ${rhs*base}=${base}^{${x+1}}, тому показники рівні: x+1=${x+1}, звідси x=${x}.`,
    coreMeta:{steps_estimate:1},
  });
}

function trigTangent() {
  const cases=[
    {a:30,c:math('\\frac{\\sqrt3}{3}'),w:[math('\\sqrt3'),math('\\frac12'),math('\\frac{\\sqrt2}{2}'),'1']},
    {a:45,c:'1',w:[math('\\frac12'),math('\\sqrt3'),math('\\frac{\\sqrt3}{3}'),'0']},
    {a:60,c:math('\\sqrt3'),w:[math('\\frac{\\sqrt3}{3}'),math('\\frac12'),'1','0']},
  ];
  const c=pick(cases);
  return makeChoice('trig_exact_values',{topic:'trigonometry',variant:'tangent-exact',question:`Обчисліть ${math(`\\tan ${c.a}^\\circ`)}.`,correct:c.c,distractors:c.w,explanation:`Використовуємо табличне значення тангенса кута ${c.a}°.`,difficulty:'легкий',coreMeta:{steps_estimate:1}});
}

function trigIdentity() {
  const s = pick([3,4,5,6,8]);
  const denom = 10;
  const cos2 = 1-(s/denom)**2;
  const cos = Math.sqrt(cos2);
  if (!Number.isFinite(cos)) return trigTangent();
  const display = Number(cos.toFixed(6));
  return makeChoice('trig_exact_values',{topic:'trigonometry',variant:'pythagorean-identity',question:`Відомо, що ${math(`\\sin \\alpha=${s}/${denom}`)} і α — гострий кут. Знайдіть ${math('\\cos \\alpha')}.`,correct:ua(display),distractors:[ua(s/denom),ua(1-s/denom),ua(cos2),ua(1/cos)],explanation:`Для гострого кута cos α>0. За тотожністю sin²α+cos²α=1 маємо cos α=√(1−${s*s}/${denom*denom})≈${ua(display)}.`,coreMeta:{steps_estimate:2}});
}

function derivativeAtPoint(requiredType) {
  const a=pick([1,2,3,4]); const b=pick([-5,-3,-1,2,4]); const x0=pick([-2,-1,1,2,3]);
  const value=2*a*x0+b;
  if(requiredType==='short') return makeShort('calculus_basic',{topic:'calculus',variant:'derivative-at-point-short',question:`Для функції ${math(`f(x)=${a}x^2${signedTerm(b,'x')}`)} знайдіть ${math(`f'(${x0})`)}.`,correctValue:value,explanation:`f'(x)=${2*a}x${signedTerm(b)}; f'(${x0})=${value}.`,coreMeta:{steps_estimate:2}});
  return makeChoice('calculus_basic',{topic:'calculus',variant:'derivative-at-point',question:`Для функції ${math(`f(x)=${a}x^2${signedTerm(b,'x')}`)} знайдіть ${math(`f'(${x0})`)}.`,correct:ua(value),distractors:[ua(a*x0*x0+b*x0),ua(2*a+b),ua(a*x0+b),ua(value+2*a)],explanation:`f'(x)=${2*a}x${signedTerm(b)}; підставляємо x=${x0} і отримуємо ${value}.`,coreMeta:{steps_estimate:2}});
}

function chartAverage() {
  const labels=pick([['Пн','Вт','Ср','Чт','Пт'],['I','II','III','IV','V']]);
  const base=pick([4,6,8,10]);
  const values=[base,base+2,base+4,base+6,base+8];
  const avg=values.reduce((s,x)=>s+x,0)/values.length;
  return makeChoice('data_chart_reading',{topic:'probability_stats',variant:'chart-average',question:'На графіку наведено значення показника за п’ять періодів. Знайдіть середнє арифметичне цих п’яти значень.',correct:ua(avg),distractors:[ua(values[2]),ua(values.at(-1)-values[0]),ua(values.reduce((s,x)=>s+x,0)),ua(avg+2)],explanation:`Сума значень ${values.reduce((s,x)=>s+x,0)}, тому середнє дорівнює ${values.reduce((s,x)=>s+x,0)}/5=${avg}.`,visual:{type:'line_chart',diagram_type:'line_chart',data:{values},labels:{categories:labels}},coreMeta:{steps_estimate:2}});
}

function chartThreshold() {
  const labels=['А','Б','В','Г','Д']; const values=shuffle([3,5,7,9,11]); const threshold=pick([6,8,10]);
  const count=values.filter(x=>x>=threshold).length;
  return makeChoice('data_chart_reading',{topic:'probability_stats',variant:'chart-threshold-count',question:`На діаграмі подано п’ять значень. Скільки з них не менші за ${threshold}?`,correct:ua(count),distractors:[ua(5-count),ua(Math.max(...values)),ua(Math.min(...values)),ua(count+1)],explanation:`Підраховуємо стовпчики зі значенням ≥${threshold}. Їх ${count}.`,visual:{type:'bar_chart',diagram_type:'bar_chart',data:{values,layout:'compact'},labels:{categories:labels}},coreMeta:{steps_estimate:1}});
}

function probabilityComplement() {
  const total=pick([10,12,15,20]); const bad=pick([1,2,3,4]); const good=total-bad;
  return makeChoice('probability_counting_basic',{topic:'probability_stats',variant:'complement-event',question:`Серед ${total} однаково ймовірних результатів ${bad} є несприятливими. Яка ймовірність сприятливого результату?`,correct:frac(good,total),distractors:[frac(bad,total),frac(1,total),frac(good,total+1),frac(total-good,good)],explanation:`Сприятливих результатів ${total}−${bad}=${good}, тому P=${good}/${total}.`,coreMeta:{steps_estimate:1}});
}

function probabilityCounting() {
  const n=pick([5,6,7,8]); const k=2; const combos=n*(n-1)/2;
  return makeChoice('probability_counting_basic',{topic:'probability_stats',variant:'choose-two-count',question:`Із ${n} учнів потрібно вибрати двох представників. Скількома способами це можна зробити?`,correct:ua(combos),distractors:[ua(n*(n-1)),ua(n+2),ua(n*n),ua(n*(n-1)/2+1)],explanation:`Порядок неважливий, тому кількість способів C_${n}^2=${n}·${n-1}/2=${combos}.`,difficulty:'середній',coreMeta:{steps_estimate:2}});
}

function vectorLength() {
  const dx=pick([1,2,3,4]); const dy=pick([2,3,4]); const dz=pick([1,2,3]);
  const sq=dx*dx+dy*dy+dz*dz;
  const correct=Number.isInteger(Math.sqrt(sq))?ua(Math.sqrt(sq)):math(`\\sqrt{${sq}}`);
  return makeChoice('vectors_3d',{topic:'stereometry',variant:'vector-length',question:`Знайдіть довжину вектора ${math(`\\vec a=(${dx};${dy};${dz})`)}.`,correct,distractors:[ua(dx+dy+dz),math(`\\sqrt{${dx*dx+dy*dy}}`),ua(sq),math(`\\sqrt{${dx+dy+dz}}`)],explanation:`|a|=√(${dx}²+${dy}²+${dz}²)=√${sq}.`,coreMeta:{steps_estimate:1}});
}

function vectorMidpoint() {
  const ax=pick([-4,-2,0,2]); const ay=pick([-2,0,2,4]); const az=pick([-4,-2,0,2]);
  const dx=pick([2,4,6]); const dy=pick([2,4,6]); const dz=pick([2,4,6]);
  const bx=ax+dx,by=ay+dy,bz=az+dz; const mx=ax+dx/2,my=ay+dy/2,mz=az+dz/2;
  return makeChoice('vectors_3d',{topic:'stereometry',variant:'midpoint-3d',question:`Точки ${math(`A(${ax};${ay};${az})`)} і ${math(`B(${bx};${by};${bz})`)} — кінці відрізка. Укажіть координати його середини.`,correct:math(`(${mx};${my};${mz})`),distractors:[math(`(${dx};${dy};${dz})`),math(`(${ax+bx};${ay+by};${az+bz})`),math(`(${mx};${-my};${mz})`),math(`(${ax};${ay};${az})`)],explanation:'Координати середини відрізка дорівнюють середнім арифметичним відповідних координат його кінців.',coreMeta:{steps_estimate:1}});
}

function functionLineGraph() {
  const slope=pick([-3,-2,2,3]); const intercept=pick([-4,-2,1,3,5]);
  return makeChoice('function_graph_transform',{topic:'functions',variant:'line-y-intercept-graph',question:`На координатній площині зображено графік функції ${math(`y=${slope}x${signedTerm(intercept)}`)}. У якій точці графік перетинає вісь y?`,correct:math(`(0;${intercept})`),distractors:[math(`(${intercept};0)`),math(`(0;${-intercept})`),math(`(${slope};${intercept})`),math(`(1;${slope+intercept})`)],explanation:`На осі y маємо x=0, тому y=${intercept}. Точка перетину — (0;${intercept}).`,visual:{type:'function_graph',diagram_type:'function_graph',data:{kind:'line',slope,intercept,xMin:-5,xMax:5}},coreMeta:{steps_estimate:1}});
}

function functionZero() {
  const h=pick([-3,-2,-1,1,2,3]); const k=pick([1,4,9]); const root=Math.sqrt(k); const r1=h-root, r2=h+root;
  const hText=h>=0?`x-${h}`:`x+${Math.abs(h)}`;
  return makeChoice('function_graph_transform',{topic:'functions',variant:'parabola-zero',question:`Знайдіть більший нуль функції ${math(`y=(${hText})^2-${k}`)}.`,correct:ua(r2),distractors:[ua(r1),ua(h),ua(k),ua(-r2)],explanation:`(${hText})²=${k}, тому x=${h}±${root}. Більший нуль дорівнює ${r2}.`,coreMeta:{steps_estimate:2}});
}

function planimetryParallelogram() {
  const a=pick([18,22,27,31,36]); const b=pick([25,33,41,47]); const acute=a+b;
  return makeChoice('planimetry_angle_parallel',{topic:'planimetry',variant:'parallelogram-diagonal-angles',question:`У паралелограмі ABCD проведено діагональ AC. Відомо, що ${math(`\\angle CAD=${a}^\\circ`)} і ${math(`\\angle ACD=${b}^\\circ`)}. Знайдіть гострий кут паралелограма.`,correct:`${acute}°`,distractors:[`${180-acute}°`,`${Math.abs(b-a)}°`,`${a}°`,`${b}°`],explanation:`У трикутнику ACD кут ADC=180°−${a}°−${b}°=${180-acute}°. Суміжний з ним гострий кут паралелограма дорівнює ${acute}°.`,visual:{type:'parallelogram_diagonal',diagram_type:'parallelogram_diagonal',data:{a,b}},coreMeta:{steps_estimate:2}});
}

function planimetryParallelLines() {
  const alpha=pick([38,42,47,53,61,67]); const beta=180-alpha;
  return makeChoice('planimetry_angle_parallel',{topic:'planimetry',variant:'parallel-lines-transversal',question:`Дві паралельні прямі перетинає січна. Один із внутрішніх односторонніх кутів дорівнює ${alpha}°. Знайдіть другий.`,correct:`${beta}°`,distractors:[`${alpha}°`,`${90-alpha}°`,`${180-2*alpha}°`,`${90+alpha}°`],explanation:`Внутрішні односторонні кути при паралельних прямих у сумі дають 180°, тому другий кут ${beta}°.`,visual:{type:'parallel_lines',diagram_type:'parallel_lines',data:{angle:alpha}},coreMeta:{steps_estimate:1}});
}

function solidCubeSurface() {
  const a=pick([2,3,4,5,6]); const area=6*a*a;
  return makeChoice('solid_geometry_concept',{topic:'stereometry',variant:'cube-surface-area',question:`Ребро куба дорівнює ${a} см. Знайдіть площу повної поверхні куба.`,correct:ua(area),distractors:[ua(a**3),ua(4*a*a),ua(6*a),ua(3*a*a)],explanation:`Куб має 6 квадратних граней площею a² кожна, тому S=6a²=${area}.`,visual:{type:'cube',diagram_type:'solid',data:{a}},coreMeta:{steps_estimate:1}});
}

function solidPrismVolume() {
  const a=pick([3,4,5]); const b=pick([2,3,4]); const h=pick([5,6,8]); const volume=a*b*h;
  return makeChoice('solid_geometry_concept',{topic:'stereometry',variant:'rect-prism-volume',question:`Виміри прямокутного паралелепіпеда дорівнюють ${a} см, ${b} см і ${h} см. Знайдіть його об’єм.`,correct:ua(volume),distractors:[ua(2*(a*b+a*h+b*h)),ua(a+b+h),ua(a*b),ua(volume*2)],explanation:`V=abh=${a}·${b}·${h}=${volume}.`,visual:{type:'rect_prism',diagram_type:'solid',data:{a,b,h,showDiagonal:false}},difficulty:'легкий',coreMeta:{steps_estimate:1}});
}

function triangleArea() {
  const a=pick([4,6,8,10]); const b=pick([5,7,9]); const angle=pick([30,60]); const sin=angle===30?0.5:Math.sqrt(3)/2; const area=a*b*sin/2;
  const correct=angle===60 ? math(`${a*b/4}\\sqrt3`) : ua(area);
  return makeChoice('triangle_cosine_nmt',{topic:'planimetry',variant:'triangle-area-two-sides-angle',question:`Дві сторони трикутника дорівнюють ${a} см і ${b} см, а кут між ними — ${angle}°. Знайдіть площу трикутника.`,correct,distractors:[ua(a*b),ua(a+b),angle===60?math(`${a*b/2}\\sqrt3`):ua(a*b/2),ua(Math.abs(a-b))],explanation:`S=ab·sinγ/2. Підставляємо a=${a}, b=${b}, γ=${angle}°.`,visual:{type:'triangle_sides',diagram_type:'triangle_area',data:{left:b,right:a,base:'',angle}},coreMeta:{steps_estimate:2}});
}

function trianglePythagorean() {
  const triples=pick([[3,4,5],[5,12,13],[6,8,10],[8,15,17]]); const [a,b,c]=triples;
  return makeChoice('triangle_cosine_nmt',{topic:'planimetry',variant:'right-triangle-hypotenuse',question:`Катети прямокутного трикутника дорівнюють ${a} см і ${b} см. Знайдіть гіпотенузу.`,correct:ua(c),distractors:[ua(a+b),ua(Math.abs(b-a)),ua(a*b),ua(c*c)],explanation:`За теоремою Піфагора c=√(${a}²+${b}²)=${c}.`,visual:{type:'right_triangle',diagram_type:'right_triangle',data:{a,b,c:'?'}},difficulty:'легкий',coreMeta:{steps_estimate:1}});
}

function circleDiameter() {
  const diameter=pick([8,10,12,14,16]); const radius=diameter/2;
  return makeChoice('circle_inscribed_angle',{topic:'planimetry',variant:'diameter-radius',question:`Діаметр кола дорівнює ${diameter} см. Знайдіть радіус кола.`,correct:ua(radius),distractors:[ua(diameter*2),ua(diameter),ua(radius*radius),ua(Math.PI*diameter)],explanation:`Радіус удвічі менший за діаметр: R=${diameter}/2=${radius}.`,visual:{type:'circle_diameter',diagram_type:'circle_diameter',data:{diameter}},difficulty:'легкий',coreMeta:{steps_estimate:1}});
}

function circleThales() {
  return makeChoice('circle_inscribed_angle',{topic:'planimetry',variant:'thales-diameter-angle',question:'Точки A і C — кінці діаметра кола, точка B лежить на колі. Знайдіть кут ABC.',correct:'90°',distractors:['45°','60°','120°','180°'],explanation:'Вписаний кут, що спирається на діаметр (півколо), є прямим.',visual:{type:'circle_diameter',diagram_type:'circle_diameter_angle',data:{showPoint:true}},coreMeta:{steps_estimate:1}});
}

function similarAreaRatio() {
  const k=pick([2,3,4]); const small=pick([3,4,5]); const big=small*k; const ratio=k*k;
  return makeChoice('similar_triangles_ratio',{topic:'planimetry',variant:'similar-area-ratio',question:`Відповідні сторони двох подібних трикутників дорівнюють ${small} см і ${big} см. У скільки разів площа більшого трикутника більша за площу меншого?`,correct:ua(ratio),distractors:[ua(k),ua(2*k),ua(k**3),ua(big-small)],explanation:`Площі подібних фігур відносяться як квадрати коефіцієнта подібності: ${k}²=${ratio}.`,visual:{type:'similar_triangles',diagram_type:'similar_triangles',data:{bigBase:big,smallBase:small}},coreMeta:{steps_estimate:2}});
}

function circleRectangleArea() {
  const triples=pick([[6,8,10],[8,15,17],[12,16,20]]); const [w,h,d]=triples; const area=w*h; const radius=d/2;
  return makeChoice('circle_rectangle_geometry',{topic:'planimetry',variant:'rectangle-area-from-radius-side',question:`Прямокутник вписано в коло радіуса ${radius} см. Одна сторона прямокутника дорівнює ${w} см. Знайдіть площу прямокутника.`,correct:ua(area),distractors:[ua(w*d),ua(radius*w),ua(d*h),ua(w*w)],explanation:`Діагональ прямокутника дорівнює діаметру кола: d=${d}. За теоремою Піфагора друга сторона √(${d}²−${w}²)=${h}. Площа ${w}·${h}=${area}.`,visual:{type:'circle_rectangle',diagram_type:'circle_rectangle',data:{width:w,height:h}},difficulty:'складний',coreMeta:{steps_estimate:3}});
}

function quadraticInequalityFactorized() {
  const r1=pick([-5,-4,-3,-2,-1]); const r2=pick([1,2,3,4,5]);
  const strict=Math.random()<0.5; const symbol=strict?'>':'>=';
  const correct=strict?math(`(-\\infty;${r1})\\cup(${r2};+\\infty)`):math(`(-\\infty;${r1}]\\cup[${r2};+\\infty)`);
  return makeChoice('quadratic_inequality_interval',{topic:'inequalities',variant:'factorized-positive',question:`Розв’яжіть нерівність ${math(`(x${r1<0?`+${-r1}`:`-${r1}`})(x-${r2})${symbol}0`)}.`,correct,distractors:[strict?math(`(${r1};${r2})`):math(`[${r1};${r2}]`),math(`(${r2};+\\infty)`),math(`(-\\infty;${r1})`),math(`\\{${r1};${r2}\\}`)],explanation:`Добуток двох лінійних множників додатний поза коренями ${r1} і ${r2}.`,coreMeta:{steps_estimate:2}});
}

function workTank() {
  const fill=pick([6,8,10,12]); const drain=fill*2; const rate=1/fill-1/drain; const time=1/rate;
  return makeChoice('word_work_rate',{topic:'word_problems',variant:'fill-and-drain',question:`Перша труба наповнює резервуар за ${fill} год, а друга спорожнює повний резервуар за ${drain} год. За скільки годин наповниться порожній резервуар, якщо відкрити обидві труби?`,correct:ua(time),distractors:[ua(fill+drain),ua((fill+drain)/2),ua(drain-fill),ua(fill/2)],explanation:`Сумарна продуктивність 1/${fill}−1/${drain}=1/${time}, тому потрібен час ${time} год.`,difficulty:'складний',coreMeta:{steps_estimate:2}});
}

function workPart() {
  const t=pick([8,10,12]); const hours=pick([2,3,4]); const part=hours/t;
  return makeChoice('word_work_rate',{topic:'word_problems',variant:'work-fraction',question:`Майстер виконує всю роботу за ${t} год. Яку частину роботи він виконає за ${hours} год за сталої продуктивності?`,correct:frac(hours,t),distractors:[frac(t-hours,t),frac(1,hours),frac(hours,t+hours),frac(t,hours)],explanation:`За 1 год майстер виконує 1/${t} роботи, за ${hours} год — ${hours}/${t}.`,difficulty:'легкий',coreMeta:{steps_estimate:1}});
}

function motionCatchUp() {
  const slow=pick([40,50,60]); const fast=slow+pick([20,30,40]); const delay=pick([1,2]); const lead=slow*delay; const time=lead/(fast-slow);
  return makeChoice('word_motion',{topic:'word_problems',variant:'catch-up',question:`Автомобіль рухається зі швидкістю ${slow} км/год. Через ${delay} год з того самого пункту в тому самому напрямку виїхав другий автомобіль зі швидкістю ${fast} км/год. Через скільки годин після виїзду другого автомобіля він наздожене перший?`,correct:ua(time),distractors:[ua(lead/fast),ua(delay+time),ua(lead/(fast+slow)),ua(fast-slow)],explanation:`Фора першого: ${slow}·${delay}=${lead} км. Відносна швидкість ${fast}-${slow}=${fast-slow} км/год, тому час ${lead}/${fast-slow}=${time} год.`,difficulty:'середній',coreMeta:{steps_estimate:2}});
}

function motionAverageSpeed() {
  const v1=pick([40,60,80]); const v2=pick([60,80,100]); const t1=pick([1,2,3]); const t2=pick([1,2,3]); const dist=v1*t1+v2*t2; const avg=dist/(t1+t2);
  return makeChoice('word_motion',{topic:'word_problems',variant:'average-speed-time-weighted',question:`Автомобіль їхав ${t1} год зі швидкістю ${v1} км/год, а потім ${t2} год зі швидкістю ${v2} км/год. Знайдіть середню швидкість за весь час руху.`,correct:ua(avg),distractors:[ua((v1+v2)/2),ua(dist),ua(v1+v2),ua(dist/(t1*t2))],explanation:`Загальна відстань ${dist} км, загальний час ${t1+t2} год. Середня швидкість ${dist}/${t1+t2}=${ua(avg)} км/год.`,coreMeta:{steps_estimate:2}});
}

function advancedAbsolute() {
  const a=pick([2,3,4,5]); const b=pick([1,2,3]);
  const x=a+b;
  return makeChoice('advanced_single_choice',{topic:'mixed',variant:'absolute-linear',question:`Відомо, що ${math(`x>${a}`)}. Розв’яжіть рівняння ${math(`|x-${a}|=${b}`)}.`,correct:ua(x),distractors:[ua(a-b),ua(b-a),ua(a*b),ua(a)],explanation:`За умови x>${a} модуль розкривається як x−${a}. Отже x−${a}=${b}, x=${x}.`,coreMeta:{steps_estimate:2}});
}

function matchingFunctionsZeros() {
  const funcs=[
    {f:math('y=x-2'),z:'2'},
    {f:math('y=2x+6'),z:'−3'},
    {f:math('y=x+1'),z:'−1'},
  ];
  const pool=shuffle(['−3','−2','−1','1','2']);
  return makeMatching('matching_functions',{topic:'functions',variant:'match-linear-zero',question:'Установіть відповідність між функцією (1–3) та її нулем (А–Д).',left:funcs.map(x=>x.f),options:pool,correctPairs:{'0':codeFor(pool,funcs[0].z),'1':codeFor(pool,funcs[1].z),'2':codeFor(pool,funcs[2].z)},explanation:'Нуль функції y=kx+b знаходимо з рівняння kx+b=0.',coreMeta:{steps_estimate:3}});
}

function matchingExpressionsValues() {
  const left=[math('2^3'),math('\\sqrt{49}'),math('3^2-1')]; const vals=['8','7','8'];
  // Ensure unique targets by change third
  left[2]=math('3^2+1'); vals[2]='10';
  const pool=shuffle(['6','7','8','9','10']);
  return makeMatching('matching_expressions',{topic:'powers_roots',variant:'exact-expression-values',question:'Установіть відповідність між виразом (1–3) та його значенням (А–Д).',left,options:pool,correctPairs:{'0':codeFor(pool,'8'),'1':codeFor(pool,'7'),'2':codeFor(pool,'10')},explanation:'Обчислюємо кожен вираз окремо: 8, 7 і 10.',coreMeta:{steps_estimate:3}});
}

function matchingPlanimetryShapes() {
  const pool=shuffle(['180°','360°','90°','2πR','πR²']);
  return makeMatching('matching_planimetry',{topic:'planimetry',variant:'shape-properties',question:'Установіть відповідність між величиною (1–3) та формулою або значенням (А–Д).',left:['Сума кутів трикутника','Сума кутів чотирикутника','Довжина кола радіуса R'],options:pool,correctPairs:{'0':codeFor(pool,'180°'),'1':codeFor(pool,'360°'),'2':codeFor(pool,'2πR')},explanation:'Сума кутів трикутника — 180°, чотирикутника — 360°, довжина кола — 2πR.',coreMeta:{steps_estimate:3}});
}

function shortCalculusDerivative() {
  const a=pick([2,3,4]); const x0=pick([1,2,3]); const b=pick([-3,-1,2,4]); const value=3*a*x0*x0+b;
  return makeShort('short_calculus',{topic:'calculus',variant:'cubic-derivative-at-point',question:`Для функції ${math(`f(x)=${a}x^3${signedTerm(b,'x')}`)} обчисліть ${math(`f'(${x0})`)}.`,correctValue:value,explanation:`f'(x)=${3*a}x²${signedTerm(b)}; f'(${x0})=${value}.`,coreMeta:{steps_estimate:2}});
}

function shortAppliedMixture() {
  const price1=pick([40,50,60]); const price2=pick([80,90,100]); const kg1=pick([2,3,4]); const kg2=pick([1,2,3]); const total=price1*kg1+price2*kg2;
  return makeShort('short_applied',{topic:'word_problems',variant:'weighted-purchase-total',question:`Купили ${kg1} кг товару по ${price1} грн за кілограм і ${kg2} кг іншого товару по ${price2} грн за кілограм. Скільки гривень заплатили разом?`,correctValue:total,explanation:`Загальна вартість: ${price1}·${kg1}+${price2}·${kg2}=${total} грн.`,coreMeta:{steps_estimate:2}});
}

function shortStereoCube() {
  const a=pick([2,3,4,5,6]); return makeShort('short_stereometry_linked_solids',{topic:'stereometry',variant:'cube-volume-short',question:`Ребро куба дорівнює ${a} см. Обчисліть його об’єм у кубічних сантиметрах.`,correctValue:a**3,explanation:`V=a³=${a}³=${a**3}.`,visual:{type:'cube',diagram_type:'solid',data:{a}},coreMeta:{steps_estimate:1}});
}

function shortParameterLinear() {
  const root=pick([-4,-3,-2,2,3,4]); const c=pick([2,3,4,5]); const a=c*root;
  return makeShort('short_parameter_roots',{topic:'equations',variant:'parameter-root-linear',question:`За якого значення параметра p число ${root} є коренем рівняння ${math(`${c}x-p=0`)}?`,correctValue:a,explanation:`Підставляємо x=${root}: ${c}·(${root})−p=0, тому p=${a}.`,coreMeta:{steps_estimate:1}});
}

export const EXPANDED_GENERATORS = Object.freeze({
  algebra_simplify:[algebraDistribute, algebraFactor],
  applied_ratio_percent:[percentIncrease, percentRatio],
  linear_inequality_pick:[linearInequalityFlip, linearInequalityBothSides],
  systems_linear:[systemWeighted],
  progression_ap:[progressionFindDifference, progressionFindIndex],
  powers_roots_transform:[powerRootProduct, powerNegativeExponent],
  quadratic_equation:[quadraticProductRoots],
  log_exp_equation_interval:[logEquation, exponentialEquation],
  trig_exact_values:[trigTangent, trigIdentity],
  calculus_basic:[derivativeAtPoint],
  data_chart_reading:[chartAverage, chartThreshold],
  probability_counting_basic:[probabilityComplement, probabilityCounting],
  vectors_3d:[vectorLength, vectorMidpoint],
  function_graph_transform:[functionLineGraph, functionZero],
  planimetry_angle_parallel:[planimetryParallelogram, planimetryParallelLines],
  solid_geometry_concept:[solidCubeSurface, solidPrismVolume],
  triangle_cosine_nmt:[triangleArea, trianglePythagorean],
  circle_inscribed_angle:[circleDiameter, circleThales],
  similar_triangles_ratio:[similarAreaRatio],
  circle_rectangle_geometry:[circleRectangleArea],
  quadratic_inequality_interval:[quadraticInequalityFactorized],
  word_work_rate:[workTank, workPart],
  word_motion:[motionCatchUp, motionAverageSpeed],
  advanced_single_choice:[advancedAbsolute],
  matching_functions:[matchingFunctionsZeros],
  matching_expressions:[matchingExpressionsValues],
  matching_planimetry:[matchingPlanimetryShapes],
  short_calculus:[shortCalculusDerivative],
  short_applied:[shortAppliedMixture],
  short_stereometry_linked_solids:[shortStereoCube],
  short_parameter_roots:[shortParameterLinear],
});
