import { makeChoice, makeMatching, makeShort } from './builders.js';
import { LETTERS, frac, math, pick, randInt, shuffle, signedTerm, ua } from './utils.js';

function dataChartReading() {
  const labels = pick([
    ['Пн','Вт','Ср','Чт','Пт'],
    ['I','II','III','IV','V'],
    ['А','Б','В','Г','Д'],
  ]);
  const values = shuffle([4,6,8,10,12,14,16,18]).slice(0, labels.length);
  const mode = randInt(0, 1);
  if (mode === 0) {
    const a = randInt(0, 3), b = a + 1;
    const correct = values[a] + values[b];
    return makeChoice('data_chart_reading', {
      topic:'probability_stats', variant:'bar-pair-sum',
      question:`На діаграмі подано кількість учасників за п’ять періодів. Скільки учасників разом було в періоди ${labels[a]} та ${labels[b]}?`,
      correct:ua(correct),
      distractors:[ua(Math.abs(values[a]-values[b])), ua(values[a]), ua(values[b]), ua(correct+2)],
      explanation:`Зчитуємо з діаграми ${values[a]} і ${values[b]} та додаємо: ${values[a]}+${values[b]}=${correct}.`,
      visual:{ type:'bar_chart', diagram_type:'bar_chart', data:{values}, labels:{categories:labels} },
      difficulty:'легкий',
      coreMeta:{steps_estimate:1},
    });
  }
  const max = Math.max(...values); const idx = values.indexOf(max);
  return makeChoice('data_chart_reading', {
    topic:'probability_stats', variant:'bar-maximum',
    question:'На діаграмі подано кількість учасників за п’ять періодів. У який період кількість була найбільшою?',
    correct:labels[idx],
    distractors:labels.filter((_, i) => i !== idx),
    explanation:`Найвищий стовпчик має значення ${max} і відповідає періоду ${labels[idx]}.`,
    visual:{ type:'bar_chart', diagram_type:'bar_chart', data:{values}, labels:{categories:labels} },
    difficulty:'легкий', coreMeta:{steps_estimate:1},
  });
}

function appliedRatioPercent(requiredType) {
  const useShort = requiredType === 'short' || (!requiredType && Math.random() < 0.25);
  if (useShort) {
    const original = pick([240,320,400,480,600,800]);
    const p = pick([20,25,40]);
    const final = original * (100-p)/100;
    return makeShort('applied_ratio_percent', {
      topic:'percents', variant:'reverse-percent',
      question:`Після знижки на ${p}% товар коштує ${ua(final)} грн. Визначте початкову ціну товару.`,
      correctValue:original,
      explanation:`Після знижки залишилося ${100-p}% ціни: ${ua(final)}=${(100-p)/100}x, тому x=${original}.`,
      coreMeta:{steps_estimate:2},
    });
  }
  const base = pick([200,240,320,400,500,600,800]);
  const p = pick([10,15,20,25,30,40]);
  const correct = base*p/100;
  return makeChoice('applied_ratio_percent', {
    topic:'percents', variant:'percent-of-number',
    question:`Знайдіть ${p}% від ${base}.`,
    correct:ua(correct),
    distractors:[ua(base-p), ua(base*p/10), ua(base*(100-p)/100), ua(p)],
    explanation:`${p}% від ${base}: ${base}·${p}/100=${ua(correct)}.`,
    difficulty:'легкий', coreMeta:{steps_estimate:1},
  });
}

function planimetryAngleParallel() {
  const angle = pick([52,58,64,68,72,76]);
  const correct = 180-angle;
  return makeChoice('planimetry_angle_parallel', {
    topic:'planimetry', variant:'trapezoid-same-leg',
    question:`У трапеції ABCD основи BC і AD паралельні. Кут D дорівнює ${angle}°. Знайдіть кут C.`,
    correct:`${correct}°`,
    distractors:[`${angle}°`, `${90-angle/2}°`, `${180-2*angle}°`, `${90+angle/2}°`],
    explanation:`Внутрішні односторонні кути при паралельних основах і бічній стороні CD доповнюють один одного до 180°: ∠C=180°−${angle}°=${correct}°.`,
    visual:{type:'trapezoid',diagram_type:'trapezoid_angle',data:{top:8,bottom:14,height:6,angle}},
    coreMeta:{steps_estimate:1},
  });
}

function linearInequality() {
  const a = pick([2,3,4,5]);
  const boundary = pick([-4,-3,-2,1,2,3,4,5]);
  const b = pick([-7,-5,-3,2,4,6]);
  const c = a*boundary+b;
  const dir = Math.random()<0.5 ? '<' : '>';
  const left = `${a}x${signedTerm(b)}`;
  const correct = dir === '<' ? math(`(-\\infty;${boundary})`) : math(`(${boundary};+\\infty)`);
  const opposite = dir === '<' ? math(`(${boundary};+\\infty)`) : math(`(-\\infty;${boundary})`);
  return makeChoice('linear_inequality_pick', {
    topic:'inequalities', variant:'linear-interval',
    question:`Розв’яжіть нерівність ${math(`${left}${dir}${c}`)}.`,
    correct,
    distractors:[opposite, math(`(-\\infty;${-boundary})`), math(`(${ -boundary};+\\infty)`), math(`\\{${boundary}\\}`)],
    explanation:`Переносимо ${b} і ділимо на додатне число ${a}; знак не змінюється. Отримуємо x${dir}${boundary}.`,
    coreMeta:{steps_estimate:2},
  });
}

function solidGeometryConcept() {
  const k = pick([1,2,3,4]);
  const a=2*k,b=2*k,h=k;
  const diagonal=3*k;
  return makeChoice('solid_geometry_concept', {
    topic:'stereometry', variant:'rect-prism-diagonal',
    question:`Ребра прямокутного паралелепіпеда дорівнюють ${a}, ${b} і ${h}. Знайдіть довжину його просторової діагоналі.`,
    correct:ua(diagonal),
    distractors:[ua(a+b+h),ua(Math.sqrt(a*a+b*b)),ua(2*diagonal),ua(a*b*h)],
    explanation:`d=√(a²+b²+h²)=√(${a*a}+${b*b}+${h*h})=√${diagonal*diagonal}=${diagonal}.`,
    visual:{type:'rect_prism',diagram_type:'solid',data:{a,b,h,showDiagonal:true}},
    coreMeta:{steps_estimate:2},
  });
}

function functionGraphTransform() {
  const h=pick([-4,-3,-2,-1,1,2,3,4]); const k=pick([-4,-3,-2,1,2,3,4]);
  const hText=h>=0?`x-${h}`:`x+${Math.abs(h)}`;
  const withGraph=Math.random()<0.55;
  return makeChoice('function_graph_transform', {
    topic:'functions', variant:withGraph?'parabola-vertex-graph':'parabola-vertex-formula',
    question:withGraph
      ? `На координатній площині зображено графік функції ${math(`y=(${hText})^2${signedTerm(k)}`)}. Укажіть координати вершини параболи.`
      : `Укажіть координати вершини параболи ${math(`y=(${hText})^2${signedTerm(k)}`)}.`,
    correct:math(`(${h};${k})`),
    distractors:[math(`(${-h};${k})`),math(`(${h};${-k})`),math(`(${-h};${-k})`),math(`(0;${k})`)],
    explanation:`Форма y=(x−h)²+k має вершину (h;k), отже (${h};${k}).`,
    visual:withGraph?{type:'function_graph',diagram_type:'function_graph',data:{kind:'parabola',h,k}}:null,
    coreMeta:{steps_estimate:1},
  });
}

function probabilityBasic() {
  const red=pick([3,4,5,6]); const blue=pick([2,3,4]); const total=red+blue;
  if (Math.random()<0.5) {
    return makeChoice('probability_counting_basic', {
      topic:'probability_stats', variant:'one-draw',
      question:`У коробці ${red} червоних і ${blue} синіх кульок. Навмання виймають одну кульку. Яка ймовірність того, що вона червона?`,
      correct:frac(red,total),
      distractors:[frac(blue,total),frac(red,blue),frac(1,total),frac(red,total+1)],
      explanation:`Сприятливих результатів ${red}, усіх ${total}; P=${red}/${total}.`,
      coreMeta:{steps_estimate:1},
    });
  }
  const numerator=red*(red-1), denominator=total*(total-1);
  return makeChoice('probability_counting_basic', {
    topic:'probability_stats', variant:'without-replacement',
    question:`У коробці ${red} червоних і ${blue} синіх кульок. Послідовно без повернення виймають дві кульки. Яка ймовірність, що обидві червоні?`,
    correct:frac(numerator,denominator),
    distractors:[frac(red*red,total*total),frac(red,total),frac(red*(red-1),total*total),frac(2*red,total)],
    explanation:`P=${red}/${total}·${red-1}/${total-1}=${frac(numerator,denominator)}.`,
    difficulty:'складний', coreMeta:{steps_estimate:2},
  });
}

function vectors3d() {
  const ax=pick([-3,-2,-1,1,2,3]), ay=pick([-3,-2,1,2,3]), az=pick([-2,-1,1,2]);
  const dx=pick([1,2,3]),dy=pick([-3,-2,2,3]),dz=pick([1,2,3]);
  const b=[ax+dx,ay+dy,az+dz];
  return makeChoice('vectors_3d', {
    topic:'stereometry', variant:'vector-coordinates',
    question:`Дано точки ${math(`A(${ax};${ay};${az})`)} і ${math(`B(${b[0]};${b[1]};${b[2]})`)}. Укажіть координати вектора ${math('\\overrightarrow{AB}')}.`,
    correct:math(`(${dx};${dy};${dz})`),
    distractors:[math(`(${-dx};${-dy};${-dz})`),math(`(${b[0]+ax};${b[1]+ay};${b[2]+az})`),math(`(${dx};${-dy};${dz})`),math(`(${ax};${ay};${az})`)],
    explanation:'Координати вектора AB отримуємо відніманням координат A від відповідних координат B.',
    coreMeta:{steps_estimate:1},
  });
}

function algebraSimplify() {
  const a=pick([2,3,4,5]), b=pick([2,3,4]);
  const correct=a-b;
  return makeChoice('algebra_simplify', {
    topic:'numbers', variant:'collect-like-terms',
    question:`Спростіть вираз ${math(`${a}x-${b}x+${2*a}-${2*a}`)}.`,
    correct:math(`${correct===1?'':correct}x`),
    distractors:[math(`${a+b}x`),math(`${a*b}x`),math(`${a}x-${b}`),math(`${correct}x+${2*a}`)],
    explanation:`Зводимо подібні доданки: (${a}−${b})x=${correct}x, а сталі доданки взаємно знищуються.`,
    difficulty:'легкий', coreMeta:{steps_estimate:1},
  });
}

function geometryStatements() {
  const set=pick([
    {
      q:'Укажіть правильне твердження.',
      correct:'Діагоналі прямокутника рівні.',
      wrong:['У будь-якого ромба діагоналі рівні.','У будь-якої трапеції діагоналі перпендикулярні.','Сума кутів трикутника дорівнює 360°.','У будь-якого паралелограма всі кути рівні.'],
      expl:'У прямокутника діагоналі рівні; решта тверджень не є загальними властивостями відповідних фігур.',
    },
    {
      q:'Укажіть правильне твердження про коло.',
      correct:'Радіус, проведений у точку дотику, перпендикулярний до дотичної.',
      wrong:['Будь-яка хорда проходить через центр кола.','Діаметр удвічі менший за радіус.','Усі хорди одного кола рівні.','Дотична перетинає коло у двох точках.'],
      expl:'Властивість дотичної: радіус у точку дотику перпендикулярний до неї.',
    },
  ]);
  return makeChoice('geometry_statements', {
    topic:'planimetry', variant:'property-check', question:set.q,
    correct:set.correct,distractors:set.wrong,explanation:set.expl,
    coreMeta:{steps_estimate:1},
  });
}

function logExpEquationInterval() {
  if (Math.random()<0.5) {
    const base=pick([2,3,5]); const n=pick([2,3]); const value=base**n;
    return makeChoice('log_exp_equation_interval', {
      topic:'logarithms', variant:'log-equation',
      question:`Розв’яжіть рівняння ${math(`\\log_{${base}}x=${n}`)}.`,
      correct:ua(value),
      distractors:[ua(base*n),ua(n**base),ua(value/base),ua(1/value)],
      explanation:`За означенням логарифма x=${base}^${n}=${value}.`,
      coreMeta:{steps_estimate:1},
    });
  }
  const base=pick([2,3]); const root=pick([-2,-1,1,2,3]); const rhs=base**(root+1);
  return makeChoice('log_exp_equation_interval', {
    topic:'logarithms', variant:'exponential-equation',
    question:`Розв’яжіть рівняння ${math(`${base}^{x+1}=${rhs}`)}.`,
    correct:ua(root),
    distractors:[ua(root+1),ua(root-1),ua(-root),ua(rhs-base)],
    explanation:`Оскільки ${rhs}=${base}^{${root+1}}, прирівнюємо показники: x+1=${root+1}, x=${root}.`,
    coreMeta:{steps_estimate:2},
  });
}

function calculusBasic(requiredType) {
  const useShort=requiredType==='short' || (!requiredType && Math.random()<0.25);
  const a=pick([2,3,4]); const b=pick([-4,-2,2,4]); const x0=pick([1,2,3]);
  const value=2*a*x0+b;
  if (useShort) return makeShort('calculus_basic', {
    topic:'calculus',variant:'derivative-value-short',
    question:`Для функції ${math(`f(x)=${a}x^2${signedTerm(b,'x')}+1`)} обчисліть ${math(`f'(${x0})`)}.`,
    correctValue:value,
    explanation:`f'(x)=${2*a}x${signedTerm(b)}. Підставляємо x=${x0}: ${value}.`,
    coreMeta:{steps_estimate:2},
  });
  return makeChoice('calculus_basic', {
    topic:'calculus',variant:'derivative-value',
    question:`Для функції ${math(`f(x)=${a}x^2${signedTerm(b,'x')}+1`)} обчисліть ${math(`f'(${x0})`)}.`,
    correct:ua(value),
    distractors:[ua(a*x0*x0+b*x0+1),ua(2*a+b),ua(2*a*x0),ua(value+2)],
    explanation:`f'(x)=${2*a}x${signedTerm(b)}. Підставляємо x=${x0}: ${value}.`,
    coreMeta:{steps_estimate:2},
  });
}

function circleRectangleGeometry() {
  const triple=pick([[6,8,10],[8,15,17],[10,24,26],[12,16,20]]);
  const [w,h,d]=triple; const radius=d/2;
  return makeChoice('circle_rectangle_geometry', {
    topic:'planimetry',variant:'rectangle-inscribed-circle',
    question:`Прямокутник зі сторонами ${w} см і ${h} см вписано в коло. Знайдіть радіус цього кола.`,
    correct:ua(radius),
    distractors:[ua(d),ua((w+h)/2),ua(Math.sqrt(w*h)),ua(radius*radius)],
    explanation:`Діагональ вписаного прямокутника є діаметром кола. d=√(${w}²+${h}²)=${d}, тому R=${d}/2=${radius}.`,
    visual:{type:'circle_rectangle',diagram_type:'circle_rectangle',data:{width:w,height:h}},
    difficulty:'складний',coreMeta:{steps_estimate:2},
  });
}

function trigExactValues() {
  const cases=[
    {q:math('\\sin 30^\\circ'),a:math('\\frac12'),d:[math('\\frac{\\sqrt2}{2}'),math('\\frac{\\sqrt3}{2}'),'0','1']},
    {q:math('\\cos 60^\\circ'),a:math('\\frac12'),d:[math('\\frac{\\sqrt2}{2}'),math('\\frac{\\sqrt3}{2}'),'0','1']},
    {q:math('\\sin 45^\\circ'),a:math('\\frac{\\sqrt2}{2}'),d:[math('\\frac12'),math('\\frac{\\sqrt3}{2}'),'0','1']},
    {q:math('\\cos 30^\\circ'),a:math('\\frac{\\sqrt3}{2}'),d:[math('\\frac12'),math('\\frac{\\sqrt2}{2}'),'0','1']},
  ];
  const c=pick(cases);
  return makeChoice('trig_exact_values',{topic:'trigonometry',variant:'exact-value',question:`Обчисліть ${c.q}.`,correct:c.a,distractors:c.d,explanation:'Використовуємо табличні значення тригонометричних функцій для кутів 30°, 45° і 60°.',difficulty:'легкий',coreMeta:{steps_estimate:1}});
}

function advancedSingleChoice() {
  const p=pick([2,3,4]); const q=pick([5,6,7]); const root=p+q;
  const constant=p*q;
  return makeChoice('advanced_single_choice', {
    topic:'mixed',variant:'two-step-rational-model',
    question:`Додатне число x задовольняє рівняння ${math(`\\frac{x-${p}}{${q}}=\\frac{${p}}{x-${q}}`)}. Відомо, що ${math(`x>${q}`)}. Знайдіть x.`,
    correct:ua(root),
    distractors:[ua(q-p),ua(p*q),ua(root+1),ua(q)],
    explanation:`Перемножуємо навхрест: (x−${p})(x−${q})=${constant}. Після розкриття дужок маємо x(x−${root})=0. З умови x>${q} отримуємо x=${root}.`,
    difficulty:'складний',coreMeta:{steps_estimate:3},
  });
}

function matchingFunctions() {
  const m=randInt(1,5); const shift=pick([-5,-4,-3,-2,1,2,3,4,5,6]);
  return makeMatching('matching_functions', {
    topic:'functions',variant:'functions-values-properties',
    question:'Установіть відповідність між функцією (1–3) та її властивістю (А–Д).',
    left:[math(`y=${m}x`),math(`y=${m}x+${shift}`),math(`y=-${m}x+${shift}`)],
    options:['проходить через початок координат','має додатний кутовий коефіцієнт і не проходить через початок','має від’ємний кутовий коефіцієнт','є горизонтальною прямою','не перетинає вісь y'],
    correctPairs:{'0':'А','1':'Б','2':'В'},
    explanation:'Для y=kx+b знак k визначає напрям нахилу, а b — точку перетину з віссю y.',
    coreMeta:{steps_estimate:3},
  });
}

function matchingExpressions() {
  const a=randInt(2,6);
  const exponents=pick([[0,1,2],[0,2,3],[1,2,3],[0,1,3]]);
  const left=exponents.map((e)=>math(`${a}^${e}`));
  const vals=exponents.map((e)=>a**e);
  const options=['(−∞;0]','(0;2]','(2;6]','(6;20]','(20;+∞)'];
  const code=(v)=> v<=0?'А':v<=2?'Б':v<=6?'В':v<=20?'Г':'Д';
  const prompt=pick([
    'Узгодьте вираз (1–3) з проміжком (А–Д), якому належить його значення.',
    'Для кожного виразу (1–3) виберіть проміжок (А–Д), що містить його числове значення.',
  ]);
  return makeMatching('matching_expressions', {
    topic:'powers_roots',variant:`powers-intervals-${exponents.join('')}`,
    question:prompt,
    left,options,correctPairs:{'0':code(vals[0]),'1':code(vals[1]),'2':code(vals[2])},
    explanation:`Значення виразів: ${vals.join(', ')}.`,coreMeta:{steps_estimate:3},
  });
}

function matchingPlanimetry() {
  const top=pick([4,6,8]); const bottom=top+pick([4,6]); const h=pick([4,5,6]);
  const mid=(top+bottom)/2; const area=(top+bottom)*h/2;
  const values=[mid,h,area];
  let pool=[mid,h,area,top+bottom,Math.abs(bottom-top)];
  pool=[...new Set(pool.map(String))];
  while(pool.length<5) pool.push(String(Number(pool.at(-1))+1));
  pool=shuffle(pool.slice(0,5)); const code=(v)=>LETTERS[pool.indexOf(String(v))];
  return makeMatching('matching_planimetry', {
    topic:'planimetry',variant:'trapezoid-measures',
    question:'На рисунку зображено трапецію. Установіть відповідність між величиною (1–3) та її значенням (А–Д).',
    left:['Довжина середньої лінії','Висота трапеції','Площа трапеції'],
    options:pool.map(ua),correctPairs:{'0':code(mid),'1':code(h),'2':code(area)},
    explanation:`Середня лінія (${top}+${bottom})/2=${mid}; висота ${h}; площа (${top}+${bottom})·${h}/2=${area}.`,
    visual:{type:'trapezoid',diagram_type:'planimetry_matching',data:{top,bottom,height:h}},coreMeta:{steps_estimate:3},
  });
}

function shortCalculus() {
  const a=2*randInt(1,5); const upper=randInt(2,6); const b=randInt(1,6);
  const val=a*upper*upper/2+b*upper;
  return makeShort('short_calculus', {
    topic:'calculus',variant:'definite-integral-linear',
    question:`Обчисліть ${math(`\\int_0^{${upper}}(${a}x+${b})\\,dx`)}.`,
    correctValue:val,
    explanation:`Первісна F(x)=${a/2}x²+${b}x. F(${upper})−F(0)=${ua(val)}.`,
    coreMeta:{steps_estimate:2},
  });
}

function shortApplied() {
  const base=pick([600,800,1000,1200,1400,1500,1600,1800,2000]); const d1=pick([5,10,15,20]); const d2=pick([20,25,30,35,40]);
  const total=base+base*(1-d1/100)+base*(1-d2/100);
  return makeShort('short_applied', {
    topic:'word_problems',variant:'successive-ticket-discounts',
    question:`Три квитки коштують по ${base} грн. На другий квиток надають знижку ${d1}%, а на третій — ${d2}%. Скільки гривень потрібно заплатити разом?`,
    correctValue:total,
    explanation:`Перший: ${base}; другий: ${ua(base*(1-d1/100))}; третій: ${ua(base*(1-d2/100))}. Разом ${ua(total)} грн.`,
    coreMeta:{steps_estimate:3},
  });
}

function shortStereo() {
  const k=randInt(1,9); const r=3*k; const h=4*k;
  const [num,den]=pick([[1,2],[2,3],[3,4]]);
  const prismHeight=pick([2,3,4])*k;
  const axial=2*r*h;
  const baseArea=axial*num/den;
  const answer=baseArea*prismHeight;
  return makeShort('short_stereometry_linked_solids', {
    topic:'stereometry',variant:`linked-cylinder-prism-${num}-${den}`,
    question:`На схемі подано циліндр і пряму призму. Радіус основи циліндра дорівнює ${r}, його висота — ${h}. Площа основи призми становить ${math(`\\frac{${num}}{${den}}`)} площі осьового перерізу циліндра, а висота призми дорівнює ${prismHeight}. Обчисліть об’єм призми.`,
    correctValue:answer,
    explanation:`Осьовий переріз циліндра: 2rh=${axial}. Площа основи призми =${num}/${den}·${axial}=${baseArea}. Об’єм = ${baseArea}·${prismHeight}=${answer}.`,
    visual:{type:'linked_solids',diagram_type:'linked_solids',data:{radius:r,height:h}},
    coreMeta:{steps_estimate:4},
  });
}

function shortParameter() {
  if (Math.random()<0.5) {
    const p=pick([2,3,4,5]);
    return makeShort('short_parameter_roots', {
      topic:'equations',variant:'quadratic-discriminant',
      question:`Визначте значення параметра a, за якого рівняння ${math(`x^2-${2*p}x+a=0`)} має єдиний корінь.`,
      correctValue:p*p,
      explanation:`Єдиний корінь маємо при D=0: (${2*p})²−4a=0, тому a=${p*p}.`,
      coreMeta:{steps_estimate:2},
    });
  }
  const c=pick([-4,-3,-2,2,3,4]); let d=pick([-6,-5,-1,1,5,6]); if(d===c)d+=1;
  const cTerm=c<0?`(x+${Math.abs(c)})`:`(x-${c})`; const dTerm=d<0?`(x+${Math.abs(d)})`:`(x-${d})`;
  return makeShort('short_parameter_roots', {
    topic:'equations',variant:'rational-unique-root',
    question:`Визначте суму всіх значень параметра ${math('a')}, за кожного з яких рівняння ${math(`\\frac{(x-a)${cTerm}}{${dTerm}}=0`)} має єдиний розв’язок.`,
    correctValue:c+d,
    explanation:`Нулі чисельника: a і ${c}; значення ${d} заборонене ОДЗ. Єдиний допустимий корінь маємо при a=${c} або a=${d}. Сума ${c+d}.`,
    coreMeta:{steps_estimate:3},
  });
}

function quadraticEquation(requiredType) {
  const r1=pick([-5,-4,-3,-2,1]); const r2=pick([2,3,4,5,6]); const sum=r1+r2, prod=r1*r2;
  const b=-sum; const expr=`x^2${signedTerm(b,'x')}${signedTerm(prod)}`;
  if (requiredType==='short' || (!requiredType && Math.random()<0.2)) {
    return makeShort('quadratic_equation',{topic:'equations',variant:'root-difference-short',question:`Корені рівняння ${math(`${expr}=0`)} дорівнюють x₁<x₂. Знайдіть x₂−x₁.`,correctValue:r2-r1,explanation:`Корені ${r1} і ${r2}; різниця ${r2-r1}.`,coreMeta:{steps_estimate:2}});
  }
  return makeChoice('quadratic_equation',{topic:'equations',variant:'roots-sum',question:`Знайдіть суму коренів рівняння ${math(`${expr}=0`)}.`,correct:ua(sum),distractors:[ua(prod),ua(-sum),ua(Math.abs(r2-r1)),ua(b)],explanation:`За теоремою Вієта сума коренів дорівнює −b=${sum}.`,coreMeta:{steps_estimate:1}});
}

function systemsLinear() {
  const x=pick([1,2,3,4]); const y=pick([2,3,4,5]); const s=x+y, d=x-y;
  return makeChoice('systems_linear', {
    topic:'systems',variant:'sum-difference-system',
    question:`Розв’яжіть систему ${math(`\\begin{cases}x+y=${s}\\\\x-y=${d}\\end{cases}`)}. Знайдіть добуток xy.`,
    correct:ua(x*y),distractors:[ua(s*d),ua(x+y),ua(x-y),ua(x*x+y*y)],
    explanation:`Додаємо рівняння: 2x=${2*x}, x=${x}; тоді y=${y}. Добуток xy=${x*y}.`,coreMeta:{steps_estimate:2},
  });
}

function progressionAp() {
  const a1=pick([2,3,4,5]); const d=pick([2,3,4]); const n=pick([6,7,8,9]); const an=a1+(n-1)*d;
  if(Math.random()<0.5){
    return makeChoice('progression_ap',{topic:'progressions',variant:'nth-term',question:`В арифметичній прогресії a₁=${a1}, d=${d}. Знайдіть a${n}.`,correct:ua(an),distractors:[ua(a1+n*d),ua(a1+(n-2)*d),ua(n*d),ua(a1*n)],explanation:`aₙ=a₁+(n−1)d=${a1}+${n-1}·${d}=${an}.`,coreMeta:{steps_estimate:1}});
  }
  const sum=n*(a1+an)/2;
  return makeChoice('progression_ap',{topic:'progressions',variant:'sum-first-n',question:`В арифметичній прогресії a₁=${a1}, d=${d}. Знайдіть суму перших ${n} членів.`,correct:ua(sum),distractors:[ua(n*(a1+an)),ua(a1+an),ua(an*n),ua(sum-d)],explanation:`a${n}=${an}; Sₙ=n(a₁+aₙ)/2=${n}·(${a1}+${an})/2=${sum}.`,coreMeta:{steps_estimate:2}});
}

function powersRootsTransform() {
  if(Math.random()<0.5){const a=pick([2,3,5]); const n=pick([4,5,6]); return makeChoice('powers_roots_transform',{topic:'powers_roots',variant:'power-laws',question:`Спростіть ${math(`\\frac{${a}^{${n}}\\cdot${a}^2}{${a}^3}`)}.`,correct:math(`${a}^{${n-1}}`),distractors:[math(`${a}^{${n+5}}`),math(`${a}^{${n-5}}`),math(`${a}^{${n}}`),math(`${a}^{${n-2}}`)],explanation:'Показники степенів при множенні додаємо, при діленні віднімаємо: n+2−3=n−1.',coreMeta:{steps_estimate:1}});}
  const a=pick([2,3,4,5]); const n=pick([2,3,5]);
  return makeChoice('powers_roots_transform',{topic:'powers_roots',variant:'extract-square',question:`Спростіть ${math(`\\sqrt{${a*a*n}}`)}.`,correct:math(`${a}\\sqrt{${n}}`),distractors:[math(`${a*n}`),math(`${a*a}\\sqrt{${n}}`),math(`\\sqrt{${a*n}}`),math(`${n}\\sqrt{${a}}`)],explanation:`Виносимо повний квадрат ${a*a}: √(${a*a}·${n})=${a}√${n}.`,coreMeta:{steps_estimate:1}});
}

function triangleCosine() {
  const cfg=pick([
    {a:5,b:7,angle:60,c2:39},{a:5,b:5,angle:60,c2:25},{a:6,b:8,angle:60,c2:52},{a:7,b:8,angle:60,c2:57},
  ]);
  const c=Math.sqrt(cfg.c2); const correct=Number.isInteger(c)?ua(c):math(`\\sqrt{${cfg.c2}}`);
  return makeChoice('triangle_cosine_nmt', {
    topic:'planimetry',variant:'cosine-theorem',
    question:`У трикутнику дві сторони дорівнюють ${cfg.a} см і ${cfg.b} см, а кут між ними — ${cfg.angle}°. Знайдіть третю сторону.`,
    correct,
    distractors:[math(`\\sqrt{${cfg.a*cfg.a+cfg.b*cfg.b}}`),ua(cfg.a+cfg.b),math(`\\sqrt{${cfg.c2+cfg.a*cfg.b}}`),ua(Math.abs(cfg.a-cfg.b))],
    explanation:`За теоремою косинусів c²=${cfg.a}²+${cfg.b}²−2·${cfg.a}·${cfg.b}·cos60°=${cfg.c2}.`,
    visual:{type:'triangle_sides',diagram_type:'triangle_cosine',data:{left:cfg.b,right:cfg.a,base:'?',angle:cfg.angle}},
    coreMeta:{steps_estimate:2},
  });
}

function circleInscribedAngle() {
  const central=pick([80,100,120,140,160]); const inscribed=central/2;
  return makeChoice('circle_inscribed_angle', {
    topic:'planimetry',variant:'central-inscribed',
    question:`Центральний кут AOC, що спирається на дугу AC, дорівнює ${central}°. Знайдіть вписаний кут ABC, який спирається на ту саму дугу.`,
    correct:`${inscribed}°`,distractors:[`${central}°`,`${180-central}°`,`${90-inscribed}°`,`${180-inscribed}°`],
    explanation:`Вписаний кут, що спирається на ту саму дугу, дорівнює половині центрального: ${central}/2=${inscribed}°.`,
    visual:{type:'circle_angle',diagram_type:'circle_angle',data:{central}},coreMeta:{steps_estimate:1},
  });
}

function similarTriangles() {
  const bigBase=pick([9,12,15]); const smallBase=bigBase*2/3; const smallSide=pick([4,6,8]); const bigSide=smallSide*bigBase/smallBase;
  return makeChoice('similar_triangles_ratio', {
    topic:'planimetry',variant:'similar-scale',
    question:`Два прямокутні трикутники подібні. Відповідні основи дорівнюють ${bigBase} см і ${smallBase} см. Відповідний катет меншого трикутника дорівнює ${smallSide} см. Знайдіть відповідний катет більшого трикутника.`,
    correct:ua(bigSide),distractors:[ua(smallSide*smallBase/bigBase),ua(bigBase-smallBase+smallSide),ua(smallSide+bigBase/smallBase),ua(bigSide+smallSide)],
    explanation:`Коефіцієнт подібності більшого до меншого: ${bigBase}/${smallBase}=${bigBase/smallBase}. Отже катет ${smallSide}·${bigBase/smallBase}=${bigSide}.`,
    visual:{type:'similar_triangles',diagram_type:'similar_triangles',data:{bigBase,smallBase}},difficulty:'складний',coreMeta:{steps_estimate:2},
  });
}

function quadraticInequality() {
  const r1=pick([-4,-3,-2,-1]); const r2=pick([1,2,3,4,5]);
  const b=-(r1+r2),c=r1*r2; const expr=`x^2${signedTerm(b,'x')}${signedTerm(c)}`;
  const strict=Math.random()<0.5; const sign=pick(['<','>']); const op=`${sign}${strict?'':'='}0`;
  let correct, distractors;
  if(sign==='<'){
    correct=strict?math(`(${r1};${r2})`):math(`[${r1};${r2}]`);
    distractors=[strict?math(`(-\\infty;${r1})\\cup(${r2};+\\infty)`):math(`(-\\infty;${r1}]\\cup[${r2};+\\infty)`),math(`(${r2};+\\infty)`),math(`(-\\infty;${r1})`),math(`\\{${r1};${r2}\\}`)];
  } else {
    correct=strict?math(`(-\\infty;${r1})\\cup(${r2};+\\infty)`):math(`(-\\infty;${r1}]\\cup[${r2};+\\infty)`);
    distractors=[strict?math(`(${r1};${r2})`):math(`[${r1};${r2}]`),math(`(${r2};+\\infty)`),math(`(-\\infty;${r1})`),math(`\\{${r1};${r2}\\}`)];
  }
  return makeChoice('quadratic_inequality_interval',{topic:'inequalities',variant:'sign-interval',question:`Розв’яжіть нерівність ${math(`${expr}${op}`)}.`,correct,distractors,explanation:`Нулі квадратного тричлена: ${r1} і ${r2}. Старший коефіцієнт додатний, тому знак «+» поза коренями і «−» між ними.`,difficulty:'складний',coreMeta:{steps_estimate:2}});
}

function workRate() {
  const pair=pick([[6,12,4],[8,24,6],[10,15,6],[12,24,8]]); const [a,b,t]=pair;
  return makeChoice('word_work_rate',{topic:'word_problems',variant:'joint-work',question:`Перший виконавець виконує роботу за ${a} год, другий — за ${b} год. За скільки годин вони виконають цю роботу разом?`,correct:ua(t),distractors:[ua(a+b),ua((a+b)/2),ua(Math.abs(b-a)),ua(Math.min(a,b)/2)],explanation:`Спільна продуктивність 1/${a}+1/${b}=1/${t}. Отже час ${t} год.`,difficulty:'складний',coreMeta:{steps_estimate:2}});
}

function wordMotion() {
  const v1=pick([40,50,60,70]); const v2=pick([60,70,80,90]); const t=pick([2,3,4]); const dist=(v1+v2)*t;
  return makeChoice('word_motion',{topic:'word_problems',variant:'opposite-motion',question:`Два автомобілі одночасно виїхали з одного пункту в протилежних напрямках зі швидкостями ${v1} км/год і ${v2} км/год. Яка відстань буде між ними через ${t} год?`,correct:ua(dist),distractors:[ua(Math.abs(v2-v1)*t),ua((v1+v2)+t),ua(v1*v2),ua(dist/t)],explanation:`Швидкість віддалення ${v1}+${v2}=${v1+v2} км/год. За ${t} год: ${v1+v2}·${t}=${dist} км.`,coreMeta:{steps_estimate:2}});
}

export const GENERATORS = Object.freeze({
  data_chart_reading:dataChartReading,
  applied_ratio_percent:appliedRatioPercent,
  planimetry_angle_parallel:planimetryAngleParallel,
  linear_inequality_pick:linearInequality,
  solid_geometry_concept:solidGeometryConcept,
  function_graph_transform:functionGraphTransform,
  probability_counting_basic:probabilityBasic,
  vectors_3d:vectors3d,
  algebra_simplify:algebraSimplify,
  geometry_statements:geometryStatements,
  log_exp_equation_interval:logExpEquationInterval,
  calculus_basic:calculusBasic,
  circle_rectangle_geometry:circleRectangleGeometry,
  trig_exact_values:trigExactValues,
  advanced_single_choice:advancedSingleChoice,
  matching_functions:matchingFunctions,
  matching_expressions:matchingExpressions,
  matching_planimetry:matchingPlanimetry,
  short_calculus:shortCalculus,
  short_applied:shortApplied,
  short_stereometry_linked_solids:shortStereo,
  short_parameter_roots:shortParameter,
  quadratic_equation:quadraticEquation,
  systems_linear:systemsLinear,
  progression_ap:progressionAp,
  powers_roots_transform:powersRootsTransform,
  triangle_cosine_nmt:triangleCosine,
  circle_inscribed_angle:circleInscribedAngle,
  similar_triangles_ratio:similarTriangles,
  quadratic_inequality_interval:quadraticInequality,
  word_work_rate:workRate,
  word_motion:wordMotion,
});
