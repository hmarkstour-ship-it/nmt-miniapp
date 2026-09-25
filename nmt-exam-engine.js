const SCORE_2026 = Object.freeze({
  5: 100, 6: 108, 7: 115, 8: 123, 9: 131, 10: 134, 11: 137,
  12: 140, 13: 143, 14: 145, 15: 147, 16: 148, 17: 149, 18: 150,
  19: 151, 20: 152, 21: 155, 22: 159, 23: 163, 24: 167, 25: 170,
  26: 173, 27: 176, 28: 180, 29: 184, 30: 189, 31: 194, 32: 200,
});

const TOPIC_LABELS = Object.freeze({
  numbers: 'Числа та дроби',
  percents: 'Відсотки',
  powers_roots: 'Степені та корені',
  logarithms: 'Логарифми',
  equations: 'Рівняння',
  systems: 'Системи рівнянь',
  inequalities: 'Нерівності',
  functions: 'Функції',
  progressions: 'Прогресії',
  trigonometry: 'Тригонометрія',
  probability_stats: 'Ймовірність і статистика',
  planimetry: 'Планіметрія',
  stereometry: 'Стереометрія',
  word_problems: 'Текстові задачі',
  derivatives_integrals: 'Похідна та інтеграл',
});

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function fraction(n, d) {
  if (d === 0) throw new Error('Zero denominator');
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return [sign * n / g, Math.abs(d) / g];
}

function math(value) {
  return `\\(${value}\\)`;
}

function uaNumber(value, maxDigits = 4) {
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(maxDigits)).toString().replace('.', ',');
}

function latexNumber(value) {
  return uaNumber(value).replace(',', '{,}');
}

function xMinus(root) {
  const value = -Number(root);
  return `x${value >= 0 ? '+' : ''}${value}`;
}

function quadraticLatex(sumRoots, productRoots) {
  const b = -Number(sumRoots);
  const c = Number(productRoots);
  let out = 'x^2';
  if (b !== 0) {
    if (b === 1) out += '+x';
    else if (b === -1) out += '-x';
    else out += `${b > 0 ? '+' : ''}${b}x`;
  }
  if (c !== 0) out += `${c > 0 ? '+' : ''}${c}`;
  return out;
}

function uniqueStrings(items) {
  const seen = new Set();
  const out = [];
  for (const item of items.map(String)) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function makeChoice({ topic, question, correct, distractors, explanation, diagramSvg = null }) {
  let values = uniqueStrings([correct, ...distractors]);
  let guard = 0;
  while (values.length < 5 && guard++ < 40) {
    values.push(math(String(randInt(-25, 60))));
    values = uniqueStrings(values);
  }
  values = shuffle(values.slice(0, 5));
  const correctIndex = values.indexOf(String(correct));
  if (correctIndex < 0) throw new Error('Choice generator lost correct answer');
  return {
    type: 'choice',
    topic,
    topic_label: TOPIC_LABELS[topic] || topic,
    question,
    options: values,
    correct_index: correctIndex,
    explanation,
    max_score: 1,
    diagram_svg: diagramSvg,
  };
}

function makeMatching({ topic, question, left, options, correctPairs, explanation, diagramSvg = null }) {
  if (left.length !== 3 || options.length !== 5) throw new Error('Matching task must have 3 left and 5 right items');
  return {
    type: 'matching',
    topic,
    topic_label: TOPIC_LABELS[topic] || topic,
    question,
    left,
    match_options: options.map((label, index) => ({ code: LETTERS[index], label })),
    correct_pairs: correctPairs,
    explanation,
    max_score: 3,
    diagram_svg: diagramSvg,
  };
}

function makeShort({ topic, question, correctValue, explanation, diagramSvg = null, answerHint = 'Введіть число' }) {
  return {
    type: 'short',
    topic,
    topic_label: TOPIC_LABELS[topic] || topic,
    question,
    correct_value: Number(correctValue),
    correct_display: uaNumber(Number(correctValue)),
    explanation,
    max_score: 2,
    diagram_svg: diagramSvg,
    answer_hint: answerHint,
  };
}

function rightTriangleSvg(a, b, c, labels = {}) {
  return `<svg viewBox="0 0 340 230" role="img" aria-label="Прямокутний трикутник" xmlns="http://www.w3.org/2000/svg">
    <defs><style>.g{stroke:#202329;stroke-width:3.2;fill:none;stroke-linecap:round;stroke-linejoin:round}.t{font:700 17px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#202329}.m{font:600 15px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#4f5661}.f{fill:#f7f8fb;stroke:#e5e8ee;stroke-width:1.2}</style></defs>
    <rect class="f" x="1" y="1" width="338" height="228" rx="20"/>
    <path class="g" d="M66 177 L66 46 L282 177 Z"/>
    <path class="g" d="M66 156 L87 156 L87 177"/>
    <text class="t" x="51" y="199">A</text><text class="t" x="50" y="38">B</text><text class="t" x="289" y="199">C</text>
    <text class="m" x="18" y="113">${labels.ab || `${a}`}</text>
    <text class="m" x="164" y="205">${labels.ac || `${b}`}</text>
    <text class="m" x="176" y="99">${labels.bc || `${c}`}</text>
  </svg>`;
}

function trapezoidSvg(a, b, h) {
  return `<svg viewBox="0 0 340 230" role="img" aria-label="Трапеція" xmlns="http://www.w3.org/2000/svg">
    <defs><style>.g{stroke:#202329;stroke-width:3.2;fill:none;stroke-linecap:round;stroke-linejoin:round}.t{font:700 17px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#202329}.m{font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#4f5661}.f{fill:#f7f8fb;stroke:#e5e8ee;stroke-width:1.2}</style></defs>
    <rect class="f" x="1" y="1" width="338" height="228" rx="20"/>
    <path class="g" d="M48 178 L292 178 L245 62 L96 62 Z"/>
    <path class="g" stroke-dasharray="6 6" d="M96 62 L96 178"/>
    <path class="g" d="M96 158 L116 158 L116 178"/>
    <text class="t" x="34" y="199">A</text><text class="t" x="294" y="199">B</text><text class="t" x="247" y="54">C</text><text class="t" x="81" y="54">D</text>
    <text class="m" x="159" y="205">${a}</text><text class="m" x="160" y="54">${b}</text><text class="m" x="104" y="124">h = ${h}</text>
  </svg>`;
}

function circleAngleSvg(angle) {
  const cx = 170, cy = 116, r = 78;
  const startDeg = -90 - angle / 2;
  const endDeg = -90 + angle / 2;
  const point = (deg) => {
    const rad = deg * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const a = point(startDeg);
  const c = point(endDeg);
  const b = point(90);
  return `<svg viewBox="0 0 340 230" role="img" aria-label="Коло з центральним та вписаним кутами" xmlns="http://www.w3.org/2000/svg">
    <defs><style>.g{stroke:#202329;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}.r{stroke:#68717d;stroke-width:2.3;fill:none}.t{font:700 17px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#202329}.m{font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#4f5661}.f{fill:#f7f8fb;stroke:#e5e8ee;stroke-width:1.2}</style></defs>
    <rect class="f" x="1" y="1" width="338" height="228" rx="20"/>
    <circle class="g" cx="${cx}" cy="${cy}" r="${r}"/>
    <path class="g" d="M${b.x.toFixed(1)} ${b.y.toFixed(1)} L${a.x.toFixed(1)} ${a.y.toFixed(1)} M${b.x.toFixed(1)} ${b.y.toFixed(1)} L${c.x.toFixed(1)} ${c.y.toFixed(1)}"/>
    <path class="r" d="M${cx} ${cy} L${a.x.toFixed(1)} ${a.y.toFixed(1)} M${cx} ${cy} L${c.x.toFixed(1)} ${c.y.toFixed(1)}"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="#202329"/>
    <text class="t" x="${(a.x - 16).toFixed(1)}" y="${(a.y - 4).toFixed(1)}">A</text><text class="t" x="${(b.x - 6).toFixed(1)}" y="${(b.y + 22).toFixed(1)}">B</text><text class="t" x="${(c.x + 7).toFixed(1)}" y="${(c.y - 4).toFixed(1)}">C</text><text class="t" x="${cx + 7}" y="${cy + 18}">O</text>
    <text class="m" x="${cx - 18}" y="${cy - 20}">${angle}°</text>
  </svg>`;
}

function prismSvg(a, b, h) {
  return `<svg viewBox="0 0 340 240" role="img" aria-label="Прямокутний паралелепіпед" xmlns="http://www.w3.org/2000/svg">
    <defs><style>.g{stroke:#202329;stroke-width:2.8;fill:none;stroke-linecap:round;stroke-linejoin:round}.d{stroke:#8b9199;stroke-width:2;stroke-dasharray:6 6;fill:none}.m{font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#4f5661}.f{fill:#f7f8fb;stroke:#e5e8ee;stroke-width:1.2}</style></defs>
    <rect class="f" x="1" y="1" width="338" height="238" rx="20"/>
    <path class="g" d="M72 174 L230 174 L284 136 L126 136 Z M72 174 L72 72 L230 72 L230 174 M230 72 L284 36 L284 136 M72 72 L126 36 L284 36 M126 36 L126 136"/>
    <path class="d" d="M72 174 L284 36"/>
    <text class="m" x="137" y="197">a = ${a}</text><text class="m" x="248" y="164">b = ${b}</text><text class="m" x="42" y="124">h = ${h}</text>
  </svg>`;
}


function triangleAngleSvg(a, b, angle) {
  const rad = angle * Math.PI / 180;
  const scale = 18;
  const ax = 78, ay = 188;
  const bx = ax + a * scale, by = ay;
  const cx = ax + b * scale * Math.cos(rad), cy = ay - b * scale * Math.sin(rad);
  const midABx = (ax + bx) / 2, midABy = ay + 22;
  const midACx = (ax + cx) / 2 - 20, midACy = (ay + cy) / 2;
  const labelAx = ax - 16, labelAy = ay + 20;
  const labelBx = bx + 8, labelBy = by + 18;
  const labelCx = cx - 3, labelCy = cy - 10;
  return `<svg viewBox="0 0 360 240" role="img" aria-label="Трикутник із заданими сторонами та кутом" xmlns="http://www.w3.org/2000/svg">
    <defs><style>.g{stroke:#202329;stroke-width:3.2;fill:none;stroke-linecap:round;stroke-linejoin:round}.t{font:700 17px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#202329}.m{font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#4f5661}.f{fill:#f7f8fb;stroke:#e5e8ee;stroke-width:1.2}</style></defs>
    <rect class="f" x="1" y="1" width="358" height="238" rx="20"/>
    <path class="g" d="M${ax} ${ay} L${bx.toFixed(1)} ${by.toFixed(1)} L${cx.toFixed(1)} ${cy.toFixed(1)} Z"/>
    <path class="g" d="M${ax + 30} ${ay} A30 30 0 0 ${angle > 90 ? 0 : 0} ${(ax + 30 * Math.cos(rad)).toFixed(1)} ${(ay - 30 * Math.sin(rad)).toFixed(1)}"/>
    <text class="t" x="${labelAx}" y="${labelAy}">A</text><text class="t" x="${labelBx.toFixed(1)}" y="${labelBy.toFixed(1)}">B</text><text class="t" x="${labelCx.toFixed(1)}" y="${labelCy.toFixed(1)}">C</text>
    <text class="m" x="${midABx.toFixed(1)}" y="${midABy.toFixed(1)}">${a}</text><text class="m" x="${midACx.toFixed(1)}" y="${midACy.toFixed(1)}">${b}</text><text class="m" x="${ax + 34}" y="${ay - 22}">${angle}°</text>
  </svg>`;
}

function isoscelesTrapezoidSvg(bigBase, smallBase, leg) {
  return `<svg viewBox="0 0 340 230" role="img" aria-label="Рівнобічна трапеція" xmlns="http://www.w3.org/2000/svg">
    <defs><style>.g{stroke:#202329;stroke-width:3.2;fill:none;stroke-linecap:round;stroke-linejoin:round}.d{stroke:#8b9199;stroke-width:2;stroke-dasharray:6 6;fill:none}.t{font:700 17px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#202329}.m{font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#4f5661}.f{fill:#f7f8fb;stroke:#e5e8ee;stroke-width:1.2}</style></defs>
    <rect class="f" x="1" y="1" width="338" height="228" rx="20"/>
    <path class="g" d="M44 180 L296 180 L244 62 L96 62 Z"/>
    <path class="d" d="M96 62 L96 180 M244 62 L244 180"/>
    <text class="t" x="30" y="202">A</text><text class="t" x="299" y="202">B</text><text class="t" x="246" y="54">C</text><text class="t" x="82" y="54">D</text>
    <text class="m" x="149" y="207">${bigBase}</text><text class="m" x="151" y="54">${smallBase}</text><text class="m" x="65" y="121">${leg}</text>
  </svg>`;
}

function choiceNumbers() {
  const den = choice([6, 8, 10, 12]);
  const n1 = randInt(1, den - 1);
  const n2 = randInt(1, den - 1);
  const whole = randInt(2, 6);
  const sign = choice([-1, 1]);
  const raw = whole + sign * (n1 - n2) / den;
  const [rn, rd] = fraction(whole * den + sign * (n1 - n2), den);
  const correct = rd === 1 ? math(String(rn)) : math(`\\frac{${rn}}{${rd}}`);
  const d1 = math(latexNumber(whole + (n1 + n2) / den));
  const d2 = math(latexNumber(whole - (n1 + n2) / den));
  const d3 = math(latexNumber(raw + 1));
  const d4 = math(latexNumber(raw - 1.5));
  return makeChoice({
    topic: 'numbers',
    question: `Обчисліть значення виразу ${math(`${whole}${sign > 0 ? '+' : '-'}\\left(\\frac{${n1}}{${den}}-\\frac{${n2}}{${den}}\\right)`)}.`,
    correct,
    distractors: [d1, d2, d3, d4],
    explanation: `1. У дужках: ${math(`\\frac{${n1}}{${den}}-\\frac{${n2}}{${den}}=\\frac{${n1 - n2}}{${den}}`)}.\n2. Враховуємо знак перед дужками та об’єднуємо результат із ${whole}.\n3. Після скорочення маємо ${correct}.`,
  });
}

function choicePercent() {
  const original = choice([320, 400, 480, 600, 800, 1200]);
  const down = choice([10, 20, 25]);
  const up = choice([10, 20]);
  const afterDown = original * (100 - down) / 100;
  const final = afterDown * (100 + up) / 100;
  return makeChoice({
    topic: 'percents',
    question: `Ціну товару спочатку знизили на ${down}%, а потім нову ціну підвищили на ${up}%. Початкова ціна — ${original} грн. Якою стала ціна товару?`,
    correct: `${uaNumber(final)} грн`,
    distractors: [`${uaNumber(original * (100 - down + up) / 100)} грн`, `${uaNumber(afterDown)} грн`, `${uaNumber(original * (100 + up) / 100)} грн`, `${uaNumber(final + original * .1)} грн`],
    explanation: `1. Після знижки: ${math(`${original}\\cdot${(100 - down) / 100}=${latexNumber(afterDown)}`)}.\n2. Після підвищення: ${math(`${latexNumber(afterDown)}\\cdot${(100 + up) / 100}=${latexNumber(final)}`)}.\n3. Остаточна ціна — ${uaNumber(final)} грн.`,
  });
}

function choicePowersRoots() {
  const base = choice([2, 3]);
  const p = choice([4, 5, 6]);
  const q = choice([1, 2]);
  const root = choice([4, 9, 16]);
  const value = (base ** (p - q)) / Math.sqrt(root);
  return makeChoice({
    topic: 'powers_roots',
    question: `Обчисліть ${math(`\\frac{${base}^{${p}}:${base}^{${q}}}{\\sqrt{${root}}}`)}.`,
    correct: math(latexNumber(value)),
    distractors: [value * Math.sqrt(root), value * base, value / base, value + 1].map(v => math(latexNumber(v))),
    explanation: `1. ${math(`${base}^{${p}}:${base}^{${q}}=${base}^{${p - q}}`)}.\n2. ${math(`\\sqrt{${root}}=${Math.sqrt(root)}`)}.\n3. Після ділення отримуємо ${math(latexNumber(value))}.`,
  });
}

function choiceLog() {
  const base = choice([2, 3, 5]);
  const a = choice([1, 2, 3]);
  const b = choice([1, 2]);
  const correct = a + b;
  return makeChoice({
    topic: 'logarithms',
    question: `Обчисліть ${math(`\\log_{${base}}${base ** a}+\\log_{${base}}${base ** b}`)}.`,
    correct: math(String(correct)),
    distractors: [a * b, Math.abs(a - b), base + correct, base ** correct].map(v => math(String(v))),
    explanation: `1. ${math(`\\log_{${base}}${base ** a}=${a}`)}.\n2. ${math(`\\log_{${base}}${base ** b}=${b}`)}.\n3. Сума дорівнює ${math(`${a}+${b}=${correct}`)}.`,
  });
}

function choiceEquation() {
  const r1 = randInt(-5, 2);
  const r2 = randInt(3, 8);
  const sum = r1 + r2;
  const prod = r1 * r2;
  return makeChoice({
    topic: 'equations',
    question: `Рівняння ${math(`${quadraticLatex(sum, prod)}=0`)} має два корені. Знайдіть більший корінь.`,
    correct: math(String(r2)),
    distractors: [r1, sum, -prod, r2 + 1].map(v => math(String(v))),
    explanation: `1. Розкладаємо квадратний тричлен: ${math(`(${xMinus(r1)})(${xMinus(r2)})=0`)} (з урахуванням знаків коренів).\n2. Корені: ${math(`x_1=${r1}`)} і ${math(`x_2=${r2}`)}.\n3. Більший корінь — ${math(String(r2))}.`,
  });
}

function choiceSystem() {
  const x = randInt(-3, 6);
  const y = randInt(-4, 5);
  const a = 2, b = 1, c = 1, d = -2;
  const r1 = a * x + b * y;
  const r2 = c * x + d * y;
  const correct = x + y;
  return makeChoice({
    topic: 'systems',
    question: `Розв'яжіть систему ${math(`\\begin{cases}2x+y=${r1}\\\\x-2y=${r2}\\end{cases}`)}. Знайдіть значення ${math('x+y')}.`,
    correct: math(String(correct)),
    distractors: [x, y, x - y, 2 * x + y].map(v => math(String(v))),
    explanation: `1. Розв'язуючи систему, отримуємо ${math(`x=${x}`)} та ${math(`y=${y}`)}.\n2. Потрібно знайти не окремий корінь, а суму.\n3. ${math(`x+y=${x}+(${y})=${correct}`)}.`,
  });
}

function choiceInequality() {
  let r1 = randInt(-5, 0);
  let r2 = randInt(2, 7);
  if (r1 > r2) [r1, r2] = [r2, r1];
  return makeChoice({
    topic: 'inequalities',
    question: `Розв'яжіть нерівність ${math(`(${xMinus(r1)})(${xMinus(r2)})<0`)}.`,
    correct: math(`${r1}<x<${r2}`),
    distractors: [math(`x<${r1}\\;\\text{або}\\;x>${r2}`), math(`${r1}\\le x\\le ${r2}`), math(`x>${r1}`), math(`x<${r2}`)],
    explanation: `1. Нулі добутку: ${math(`x=${r1}`)} і ${math(`x=${r2}`)}.\n2. Старший коефіцієнт додатний, тому добуток від'ємний між коренями.\n3. Отже, ${math(`${r1}<x<${r2}`)}.`,
  });
}

function choiceFunction() {
  const h = randInt(-4, 4);
  const k = randInt(-5, 3);
  return makeChoice({
    topic: 'functions',
    question: `Функцію задано формулою ${math(`f(x)=(${xMinus(h)})^2${k >= 0 ? '+' : ''}${k}`)}. Знайдіть її найменше значення.`,
    correct: math(String(k)),
    distractors: [h, -h, h + k, Math.abs(k)].map(v => math(String(v))),
    explanation: `1. Квадрат ${math(`(${xMinus(h)})^2`)} не може бути від'ємним.\n2. Найменше значення квадрата — 0, воно досягається при ${math(`x=${h}`)}.\n3. Тому найменше значення функції дорівнює ${math(String(k))}.`,
  });
}

function choiceProgression() {
  const a1 = randInt(1, 7);
  const d = choice([2, 3, 4]);
  const n = choice([6, 7, 8, 9]);
  const an = a1 + (n - 1) * d;
  const sum = n * (a1 + an) / 2;
  return makeChoice({
    topic: 'progressions',
    question: `В арифметичній прогресії ${math(`a_1=${a1}`)}, ${math(`d=${d}`)}. Знайдіть суму перших ${n} членів прогресії.`,
    correct: math(String(sum)),
    distractors: [an, n * (a1 + d), sum - d, sum + n].map(v => math(String(v))),
    explanation: `1. ${math(`a_${n}=a_1+(${n}-1)d=${an}`)}.\n2. ${math(`S_${n}=\\frac{${n}(a_1+a_${n})}{2}`)}.\n3. ${math(`S_${n}=\\frac{${n}(${a1}+${an})}{2}=${sum}`)}.`,
  });
}

function choiceTrig() {
  const triple = choice([[3,4,5],[5,12,13],[8,15,17]]);
  const scale = choice([1,2]);
  const a = triple[0] * scale;
  const b = triple[1] * scale;
  const c = triple[2] * scale;
  const correct = a / c;
  const [fn, fd] = fraction(a, c);
  return makeChoice({
    topic: 'trigonometry',
    question: `На рисунку ${math('\\angle A=90^\\circ')}. Знайдіть ${math('\\sin\\angle C')}.`,
    correct: math(`\\frac{${fn}}{${fd}}`),
    distractors: [math(`\\frac{${fraction(b,c)[0]}}{${fraction(b,c)[1]}}`), math(`\\frac{${fraction(a,b)[0]}}{${fraction(a,b)[1]}}`), math(`\\frac{${fraction(c,a)[0]}}{${fraction(c,a)[1]}}`), math(latexNumber(correct + .1))],
    explanation: `1. Для кута ${math('C')} протилежний катет — ${math('AB')}, гіпотенуза — ${math('BC')}.\n2. ${math(`\\sin C=\\frac{AB}{BC}=\\frac{${a}}{${c}}`)}.\n3. Після скорочення маємо ${math(`\\frac{${fn}}{${fd}}`)}.`,
    diagramSvg: rightTriangleSvg(a, b, c, { ab: `${a}`, ac: `${b}`, bc: `${c}` }),
  });
}

function choiceProbability() {
  const red = choice([4, 5, 6]);
  const blue = choice([3, 4, 5]);
  const total = red + blue;
  const numerator = red * (red - 1);
  const denominator = total * (total - 1);
  const [n, d] = fraction(numerator, denominator);
  return makeChoice({
    topic: 'probability_stats',
    question: `У коробці ${red} червоних і ${blue} синіх куль. Навмання послідовно виймають дві кулі без повернення. Яка ймовірність того, що обидві кулі будуть червоними?`,
    correct: math(`\\frac{${n}}{${d}}`),
    distractors: [math(`\\frac{${red}}{${total}}`), math(`\\frac{${red * red}}{${total * total}}`), math(`\\frac{${blue}}{${total}}`), math(`\\frac{${red - 1}}{${total - 1}}`)],
    explanation: `1. Імовірність першої червоної кулі: ${math(`\\frac{${red}}{${total}}`)}.\n2. Після цього лишається ${red - 1} червоних із ${total - 1} куль.\n3. ${math(`\\frac{${red}}{${total}}\\cdot\\frac{${red - 1}}{${total - 1}}=\\frac{${n}}{${d}}`)}.`,
  });
}

function choicePlanimetry() {
  const variant = choice([
    { a: 5, b: 8, angle: 60, side: 7 },
    { a: 3, b: 5, angle: 120, side: 7 },
  ]);
  const { a, b, angle, side } = variant;
  const cosText = angle === 60 ? '\\frac12' : '-\\frac12';
  return makeChoice({
    topic: 'planimetry',
    question: `У трикутнику ${math('ABC')} відомо: ${math(`AB=${a}`)}, ${math(`AC=${b}`)}, ${math(`\\angle A=${angle}^\\circ`)}. Знайдіть довжину ${math('BC')}.`,
    correct: math(String(side)),
    distractors: [a + b, Math.abs(a - b), side + 2, Math.max(1, side - 2)].map(v => math(String(v))),
    explanation: `1. Застосовуємо теорему косинусів: ${math('BC^2=AB^2+AC^2-2\\cdot AB\\cdot AC\\cos A')}.\n2. ${math(`BC^2=${a}^2+${b}^2-2\\cdot${a}\\cdot${b}\\cdot(${cosText})=${side * side}`)}.\n3. ${math(`BC=${side}`)}.`,
    diagramSvg: triangleAngleSvg(a, b, angle),
  });
}

function choiceCircle() {
  const central = choice([80, 100, 120, 140]);
  const inscribed = central / 2;
  return makeChoice({
    topic: 'planimetry',
    question: `Центральний кут, що спирається на ту саму дугу, що й вписаний кут ${math('\\angle ABC')}, дорівнює ${math(`${central}^\\circ`)}. Знайдіть ${math('\\angle ABC')}.`,
    correct: math(`${inscribed}^\\circ`),
    distractors: [central, 180 - central, 90 - inscribed, inscribed + 20].map(v => math(`${v}^\\circ`)),
    explanation: `1. Вписаний кут дорівнює половині центрального кута, який спирається на ту саму дугу.\n2. ${math(`\\angle ABC=\\frac{${central}^\\circ}{2}`)}.\n3. Отже, ${math(`\\angle ABC=${inscribed}^\\circ`)}.`,
    diagramSvg: circleAngleSvg(central),
  });
}

function choiceStereometry() {
  const triples = [[2,3,6,7],[3,4,12,13],[6,8,24,26]];
  const [a,b,h,d] = choice(triples);
  return makeChoice({
    topic: 'stereometry',
    question: `Прямокутний паралелепіпед має виміри ${math(String(a))}, ${math(String(b))} і ${math(String(h))}. Знайдіть довжину його просторової діагоналі.`,
    correct: math(String(d)),
    distractors: [a + b + h, Math.sqrt(a*a+b*b), a*b*h, d - 1].map(v => math(latexNumber(v))),
    explanation: `1. Для просторової діагоналі: ${math('d^2=a^2+b^2+h^2')}.\n2. ${math(`d^2=${a}^2+${b}^2+${h}^2=${d*d}`)}.\n3. ${math(`d=${d}`)}.`,
    diagramSvg: prismSvg(a,b,h),
  });
}

function choiceWordProblem() {
  const t1 = choice([4, 6, 8]);
  const t2 = choice([6, 12, 24]);
  const lcm = Math.abs(t1 * t2) / gcd(t1, t2);
  const rate = 1 / t1 + 1 / t2;
  const time = 1 / rate;
  if (Math.abs(time - Math.round(time * 2) / 2) > 1e-9) return choiceWordProblem();
  return makeChoice({
    topic: 'word_problems',
    question: `Перший майстер виконує роботу за ${t1} год, другий — за ${t2} год. За скільки годин вони виконають цю роботу разом, працюючи з постійною продуктивністю?`,
    correct: `${uaNumber(time)} год`,
    distractors: [`${uaNumber(t1 + t2)} год`, `${uaNumber(Math.abs(t1 - t2))} год`, `${uaNumber(lcm)} год`, `${uaNumber((t1 + t2) / 2)} год`],
    explanation: `1. Продуктивності: ${math(`\\frac1{${t1}}`)} і ${math(`\\frac1{${t2}}`)} роботи за годину.\n2. Разом: ${math(`\\frac1{${t1}}+\\frac1{${t2}}=${latexNumber(rate)}`)} роботи за годину.\n3. Час — обернена величина: ${uaNumber(time)} год.`,
  });
}

function matchingAlgebra() {
  const left = [
    math('\\log_2 32-\\log_2 4'),
    math('\\sqrt{144}-2^3'),
    math('3^2+\\sqrt{49}'),
  ];
  const values = [3, 4, 16];
  const options = [math('3'), math('4'), math('8'), math('12'), math('16')];
  return makeMatching({
    topic: 'powers_roots',
    question: 'Установіть відповідність між виразом (1–3) та його значенням (А–Д).',
    left,
    options,
    correctPairs: { '0': 'А', '1': 'Б', '2': 'Д' },
    explanation: `1. ${math('\\log_2 32-\\log_2 4=5-2=3')} → А.\n2. ${math('\\sqrt{144}-2^3=12-8=4')} → Б.\n3. ${math('3^2+\\sqrt{49}=9+7=16')} → Д.`,
  });
}

// Corrected geometry matching with unique answers.
function matchingGeometryUnique() {
  const a = 6, b = 8, c = 10;
  const area = 24;
  const perimeter = 24;
  // Area and perimeter coincide for 6-8-10, so use altitude to hypotenuse instead of perimeter.
  const altitude = a * b / c; // 4.8
  return makeMatching({
    topic: 'planimetry',
    question: `На рисунку ${math('\\angle A=90^\\circ')}, ${math('AB=6')}, ${math('AC=8')}. Установіть відповідність між величиною (1–3) та її значенням (А–Д).`,
    left: ['Довжина BC', 'Площа трикутника ABC', 'Висота, проведена з вершини A до BC'],
    options: [math('4{,}8'), math('10'), math('14'), math('24'), math('48')],
    correctPairs: { '0': 'Б', '1': 'Г', '2': 'А' },
    explanation: `1. За теоремою Піфагора ${math('BC=10')} → Б.\n2. ${math('S=\\frac{6\\cdot8}{2}=24')} → Г.\n3. Із ${math('S=\\frac{BC\\cdot h}{2}')} маємо ${math('h=\\frac{2\\cdot24}{10}=4{,}8')} → А.`,
    diagramSvg: rightTriangleSvg(a,b,c,{ab:'6',ac:'8',bc:'?'}),
  });
}

function matchingFunctions() {
  return makeMatching({
    topic: 'functions',
    question: 'Установіть відповідність між умовою (1–3) та числовим результатом (А–Д).',
    left: [
      `${math('f(x)=x^2-4x+3')}. Знайдіть ${math('f(2)')}`,
      `${math('g(x)=2x-5')}. Знайдіть нуль функції`,
      `${math('h(x)=2^x')}. Знайдіть ${math('h(3)')}`,
    ],
    options: [math('-1'), math('2{,}5'), math('8'), math('1'), math('4')],
    correctPairs: { '0': 'А', '1': 'Б', '2': 'В' },
    explanation: `1. ${math('f(2)=4-8+3=-1')} → А.\n2. ${math('2x-5=0\\Rightarrow x=2{,}5')} → Б.\n3. ${math('h(3)=2^3=8')} → В.`,
  });
}

function shortQuadratic() {
  const r1 = choice([-4,-3,-2,1]);
  const r2 = choice([3,4,5,6]);
  const sum = r1 + r2;
  const prod = r1 * r2;
  const target = r2 - r1;
  return makeShort({
    topic: 'equations',
    question: `Корені рівняння ${math(`${quadraticLatex(sum, prod)}=0`)} дорівнюють ${math('x_1')} і ${math('x_2')}, де ${math('x_2>x_1')}. Знайдіть ${math('x_2-x_1')}.`,
    correctValue: target,
    explanation: `1. Корені рівняння: ${math(`${r1}`)} і ${math(`${r2}`)}.\n2. Більший корінь — ${math(String(r2))}, менший — ${math(String(r1))}.\n3. ${math(`x_2-x_1=${r2}-(${r1})=${target}`)}.`,
  });
}

function shortPercentReverse() {
  const original = choice([240, 320, 400, 480, 600]);
  const p = choice([20,25]);
  const final = original * (100 - p) / 100;
  return makeShort({
    topic: 'percents',
    question: `Після знижки на ${p}% товар коштує ${uaNumber(final)} грн. Знайдіть початкову ціну товару.`,
    correctValue: original,
    explanation: `1. Після знижки залишилося ${100-p}% початкової ціни.\n2. ${math(`${latexNumber(final)}=${(100-p)/100}x`)}.\n3. ${math(`x=${original}`)} грн.`,
  });
}

function shortGeometry() {
  const variant = choice([
    { big: 14, small: 8, leg: 5, h: 4, area: 44 },
    { big: 18, small: 8, leg: 13, h: 12, area: 156 },
  ]);
  const halfDiff = (variant.big - variant.small) / 2;
  return makeShort({
    topic: 'planimetry',
    question: `Рівнобічна трапеція має основи ${math(String(variant.big))} і ${math(String(variant.small))}, а бічну сторону ${math(String(variant.leg))}. Знайдіть площу трапеції.`,
    correctValue: variant.area,
    explanation: `1. Половина різниці основ: ${math(`\\frac{${variant.big}-${variant.small}}{2}=${halfDiff}`)}.\n2. Із прямокутного трикутника висота ${math(`h=\\sqrt{${variant.leg}^2-${halfDiff}^2}=${variant.h}`)}.\n3. ${math(`S=\\frac{(${variant.big}+${variant.small})\\cdot${variant.h}}{2}=${variant.area}`)}.`,
    diagramSvg: isoscelesTrapezoidSvg(variant.big, variant.small, variant.leg),
  });
}

function shortIntegral() {
  const a = choice([1,2,3]);
  const b = choice([2,4,6]);
  const upper = choice([2,3]);
  // ∫0^u (a x + b) dx = a*u^2/2 + b*u
  const value = a * upper * upper / 2 + b * upper;
  return makeShort({
    topic: 'derivatives_integrals',
    question: `Обчисліть ${math(`\\int_0^{${upper}}(${a}x+${b})\\,dx`)}.`,
    correctValue: value,
    explanation: `1. Первісна: ${math(`F(x)=\\frac{${a}}{2}x^2+${b}x`)}.\n2. Обчислюємо ${math(`F(${upper})-F(0)`)}.\n3. Отримуємо ${math(latexNumber(value))}.`,
  });
}

export function generateNmtExam() {
  const questions = [
    choiceNumbers(),
    choicePercent(),
    choicePowersRoots(),
    choiceLog(),
    choiceEquation(),
    choiceSystem(),
    choiceInequality(),
    choiceFunction(),
    choiceProgression(),
    choiceTrig(),
    choiceProbability(),
    choicePlanimetry(),
    choiceCircle(),
    choiceStereometry(),
    choiceWordProblem(),
    matchingAlgebra(),
    matchingGeometryUnique(),
    matchingFunctions(),
    shortQuadratic(),
    shortPercentReverse(),
    shortGeometry(),
    shortIntegral(),
  ].map((q, index) => ({ ...q, number: index + 1, id: `nmt-${index + 1}`, engine_version: 2 }));

  validateNmtExam(questions);
  return questions;
}

export function validateNmtExam(questions) {
  if (!Array.isArray(questions) || questions.length !== 22) throw new Error('NMT exam must contain 22 questions');
  const types = questions.map(q => q.type);
  if (types.filter(x => x === 'choice').length !== 15) throw new Error('NMT exam must contain 15 choice questions');
  if (types.filter(x => x === 'matching').length !== 3) throw new Error('NMT exam must contain 3 matching questions');
  if (types.filter(x => x === 'short').length !== 4) throw new Error('NMT exam must contain 4 short-answer questions');

  let max = 0;
  for (const q of questions) {
    max += q.max_score;
    if (!q.question || !q.topic) throw new Error(`Invalid question ${q.number}`);
    if (q.type === 'choice') {
      if (!Array.isArray(q.options) || q.options.length !== 5 || !Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 4) throw new Error(`Invalid choice question ${q.number}`);
      if (new Set(q.options).size !== 5) throw new Error(`Duplicate choice options ${q.number}`);
    }
    if (q.type === 'matching') {
      if (!Array.isArray(q.left) || q.left.length !== 3 || !Array.isArray(q.match_options) || q.match_options.length !== 5) throw new Error(`Invalid matching question ${q.number}`);
      const values = Object.values(q.correct_pairs || {});
      if (values.length !== 3 || new Set(values).size !== 3) throw new Error(`Invalid matching pairs ${q.number}`);
    }
    if (q.type === 'short' && !Number.isFinite(q.correct_value)) throw new Error(`Invalid short answer ${q.number}`);
  }
  if (max !== 32) throw new Error(`NMT max score must be 32, got ${max}`);
  return true;
}

export function sanitizeExamQuestions(questions) {
  return questions.map((q) => {
    const copy = { ...q };
    delete copy.correct_index;
    delete copy.correct_pairs;
    delete copy.correct_value;
    delete copy.correct_display;
    delete copy.explanation;
    return copy;
  });
}

export function parseNumericAnswer(input) {
  if (input === null || input === undefined) return null;
  let value = String(input)
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '')
    .replace(/%$/, '')
    .replace(',', '.');

  if (!value) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeMatchingAnswer(answer) {
  const obj = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
  return {
    '0': typeof obj['0'] === 'string' ? obj['0'] : null,
    '1': typeof obj['1'] === 'string' ? obj['1'] : null,
    '2': typeof obj['2'] === 'string' ? obj['2'] : null,
  };
}

function displayAnswer(q, answer) {
  if (q.type === 'choice') {
    const i = Number(answer);
    return Number.isInteger(i) && q.options[i] ? `${LETTERS[i]} · ${q.options[i]}` : 'Не відповіли';
  }
  if (q.type === 'matching') {
    const normalized = normalizeMatchingAnswer(answer);
    return ['0', '1', '2'].map((k, index) => `${index + 1}–${normalized[k] || '—'}`).join(', ');
  }
  const parsed = parseNumericAnswer(answer);
  return parsed === null ? 'Не відповіли' : uaNumber(parsed);
}

function correctAnswerDisplay(q) {
  if (q.type === 'choice') return `${LETTERS[q.correct_index]} · ${q.options[q.correct_index]}`;
  if (q.type === 'matching') return ['0', '1', '2'].map((k, index) => `${index + 1}–${q.correct_pairs[k]}`).join(', ');
  return q.correct_display;
}

export function gradeNmtExam(questions, answers = {}) {
  validateNmtExam(questions);
  let rawScore = 0;
  const review = [];
  const weak = new Map();

  for (let index = 0; index < questions.length; index++) {
    const q = questions[index];
    const answer = answers?.[String(index)] ?? null;
    let awarded = 0;
    let correct = false;
    let pairResults = null;

    if (q.type === 'choice') {
      correct = Number(answer) === q.correct_index;
      awarded = correct ? 1 : 0;
    } else if (q.type === 'matching') {
      const normalized = normalizeMatchingAnswer(answer);
      pairResults = ['0', '1', '2'].map((k) => ({
        row: Number(k) + 1,
        selected: normalized[k],
        correct: q.correct_pairs[k],
        is_correct: normalized[k] === q.correct_pairs[k],
      }));
      awarded = pairResults.filter(x => x.is_correct).length;
      correct = awarded === 3;
    } else if (q.type === 'short') {
      const parsed = parseNumericAnswer(answer);
      correct = parsed !== null && Math.abs(parsed - q.correct_value) <= 1e-9;
      awarded = correct ? 2 : 0;
    }

    rawScore += awarded;
    if (awarded < q.max_score) {
      const item = weak.get(q.topic) || { topic: q.topic, label: q.topic_label, lost: 0, count: 0 };
      item.lost += q.max_score - awarded;
      item.count += 1;
      weak.set(q.topic, item);
    }

    review.push({
      number: q.number,
      type: q.type,
      topic: q.topic,
      topic_label: q.topic_label,
      question: q.question,
      options: q.options || null,
      left: q.left || null,
      match_options: q.match_options || null,
      diagram_svg: q.diagram_svg || null,
      user_answer: displayAnswer(q, answer),
      correct_answer: correctAnswerDisplay(q),
      is_correct: correct,
      score_awarded: awarded,
      max_score: q.max_score,
      pair_results: pairResults,
      explanation: q.explanation,
    });
  }

  const scaled = SCORE_2026[rawScore] ?? null;
  const weakTopics = [...weak.values()].sort((a, b) => b.lost - a.lost || b.count - a.count);
  return {
    raw_score: rawScore,
    max_score: 32,
    scaled_score: scaled,
    passed_threshold: rawScore >= 5,
    weak_topics: weakTopics,
    review,
  };
}

export function scoreToScale(rawScore) {
  return SCORE_2026[Number(rawScore)] ?? null;
}

export const NMT_EXAM_META = Object.freeze({
  year: 2026,
  questions: 22,
  choice: 15,
  matching: 3,
  short: 4,
  maxRawScore: 32,
  durationMinutes: 60,
  minimumRawForScale: 5,
  generatorVersion: 2,
});
