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

function math(value) {
  return `\\(${value}\\)`;
}

function uaNumber(value, maxDigits = 4) {
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(maxDigits)).toString().replace('.', ',');
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
  while (values.length < 5 && guard++ < 20) {
    values.push(String(randInt(-20, 50)));
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

function makeShort({ topic, question, correctValue, explanation, diagramSvg = null, answerHint = 'Введіть десяткове число' }) {
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
  const w = 320;
  const h = 210;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Прямокутний трикутник" xmlns="http://www.w3.org/2000/svg">
    <defs><style>.g{stroke:#1b1b1f;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}.t{font:600 16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#1b1b1f}.m{font:500 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#55555c}</style></defs>
    <path class="g" d="M55 165 L55 45 L265 165 Z"/>
    <path class="g" d="M55 146 L74 146 L74 165"/>
    <text class="t" x="42" y="184">A</text><text class="t" x="40" y="38">B</text><text class="t" x="272" y="184">C</text>
    <text class="m" x="18" y="108">${labels.ab || `${a}`}</text>
    <text class="m" x="148" y="190">${labels.ac || `${b}`}</text>
    <text class="m" x="164" y="94">${labels.bc || `${c}`}</text>
  </svg>`;
}

function circleSvg(r) {
  return `<svg viewBox="0 0 300 210" role="img" aria-label="Коло з радіусом" xmlns="http://www.w3.org/2000/svg">
    <defs><style>.g{stroke:#1b1b1f;stroke-width:3;fill:none}.t{font:600 16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#1b1b1f}.m{font:500 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#55555c}</style></defs>
    <circle class="g" cx="150" cy="105" r="72"/><circle cx="150" cy="105" r="4" fill="#1b1b1f"/>
    <line class="g" x1="150" y1="105" x2="222" y2="105"/>
    <text class="t" x="139" y="95">O</text><text class="m" x="177" y="96">r = ${r}</text>
  </svg>`;
}

function choiceNumbers() {
  const a = choice([2, 3, 4, 5, 6]);
  const b = choice([3, 4, 5, 7, 8]);
  const numerator = a * b;
  const denominator = choice([2, 3, 4]);
  const offset = randInt(1, 5);
  const correct = numerator / denominator - offset;
  return makeChoice({
    topic: 'numbers',
    question: `Обчисліть значення виразу ${math(`\\frac{${numerator}}{${denominator}}-${offset}`)}.`,
    correct: math(uaNumber(correct).replace(',', '{,}')),
    distractors: [correct + offset, numerator / denominator + offset, numerator / denominator, correct - 1].map(v => math(uaNumber(v).replace(',', '{,}'))),
    explanation: `1. Обчислюємо дріб: ${math(`\\frac{${numerator}}{${denominator}}=${uaNumber(numerator / denominator).replace(',', '{,}')}`)}.\n2. Віднімаємо ${offset}.\n3. Отримуємо ${math(uaNumber(correct).replace(',', '{,}'))}.`,
  });
}

function choicePercent() {
  const base = choice([120, 160, 200, 240, 300, 400]);
  const p = choice([10, 15, 20, 25, 30]);
  const correct = base * p / 100;
  return makeChoice({
    topic: 'percents',
    question: `Знайдіть ${math(`${p}\\%`)} від числа ${math(String(base))}.`,
    correct: math(uaNumber(correct).replace(',', '{,}')),
    distractors: [base - correct, base + correct, p * 100 / base, correct + p].map(v => math(uaNumber(v).replace(',', '{,}'))),
    explanation: `1. ${p}% = ${math(`\\frac{${p}}{100}`)}.\n2. ${math(`${base}\\cdot\\frac{${p}}{100}=${uaNumber(correct).replace(',', '{,}')}`)}.\n3. Отже, відповідь: ${math(uaNumber(correct).replace(',', '{,}'))}.`,
  });
}

function choicePowersRoots() {
  const n = choice([4, 5, 6, 7, 8, 9]);
  const root = choice([4, 5, 6, 7, 8]);
  const correct = n * n - root;
  return makeChoice({
    topic: 'powers_roots',
    question: `Обчисліть ${math(`${n}^{2}-\\sqrt{${root * root}}`)}.`,
    correct: math(String(correct)),
    distractors: [n + root, n * n + root, n - root, correct + 2].map(v => math(String(v))),
    explanation: `1. ${math(`${n}^{2}=${n * n}`)}.\n2. ${math(`\\sqrt{${root * root}}=${root}`)}.\n3. ${math(`${n * n}-${root}=${correct}`)}.`,
  });
}

function choiceLog() {
  const base = choice([2, 3, 4, 5]);
  const exp = choice([2, 3, 4]);
  const value = base ** exp;
  return makeChoice({
    topic: 'logarithms',
    question: `Знайдіть значення ${math(`\\log_{${base}}${value}`)}.`,
    correct: math(String(exp)),
    distractors: [base, value, exp + 1, Math.max(1, exp - 1)].map(v => math(String(v))),
    explanation: `1. За означенням логарифма шукаємо степінь, до якого треба піднести ${base}.\n2. ${math(`${base}^{${exp}}=${value}`)}.\n3. Тому ${math(`\\log_{${base}}${value}=${exp}`)}.`,
  });
}

function choiceEquation() {
  const x = randInt(-6, 8);
  const a = choice([2, 3, 4, 5]);
  const b = randInt(-8, 8);
  const c = a * x + b;
  return makeChoice({
    topic: 'equations',
    question: `Розв'яжіть рівняння ${math(`${a}x${b >= 0 ? '+' : ''}${b}=${c}`)}.`,
    correct: math(String(x)),
    distractors: [x + 1, x - 1, -x, c - b].map(v => math(String(v))),
    explanation: `1. Переносимо вільний член: ${math(`${a}x=${c - b}`)}.\n2. Ділимо на ${a}.\n3. ${math(`x=${x}`)}.`,
  });
}

function choiceSystem() {
  const x = randInt(-3, 7);
  const y = randInt(-3, 7);
  if (x === y) return choiceSystem();
  const sum = x + y;
  const diff = x - y;
  return makeChoice({
    topic: 'systems',
    question: `Розв'яжіть систему ${math(`\\begin{cases}x+y=${sum}\\\\x-y=${diff}\\end{cases}`)}. Знайдіть ${math('x')}.`,
    correct: math(String(x)),
    distractors: [y, sum, diff, x + y].map(v => math(String(v))),
    explanation: `1. Додаємо рівняння системи: ${math(`2x=${sum + diff}`)}.\n2. ${math(`x=\\frac{${sum + diff}}{2}`)}.\n3. Отримуємо ${math(`x=${x}`)}.`,
  });
}

function choiceInequality() {
  const border = randInt(-4, 7);
  const a = choice([2, 3, 4]);
  const b = a * border + choice([1, 2, 3]);
  const rhs = b - a * border;
  // ax + rhs < b -> x < border
  return makeChoice({
    topic: 'inequalities',
    question: `Розв'яжіть нерівність ${math(`${a}x+${rhs}<${b}`)}.`,
    correct: math(`x<${border}`),
    distractors: [math(`x>${border}`), math(`x\\le ${border}`), math(`x\\ge ${border}`), math(`x<${border + 1}`)],
    explanation: `1. ${math(`${a}x<${b - rhs}`)}.\n2. Ділимо обидві частини на додатне число ${a}.\n3. Маємо ${math(`x<${border}`)}.`,
  });
}

function choiceFunction() {
  const k = choice([-3, -2, 2, 3, 4]);
  const b = randInt(-5, 5);
  const x = randInt(-3, 5);
  const correct = k * x + b;
  return makeChoice({
    topic: 'functions',
    question: `Функцію задано формулою ${math(`f(x)=${k}x${b >= 0 ? '+' : ''}${b}`)}. Знайдіть ${math(`f(${x})`)}.`,
    correct: math(String(correct)),
    distractors: [k + x + b, k * x - b, correct + k, correct - 1].map(v => math(String(v))),
    explanation: `1. Підставляємо ${math(`x=${x}`)} у формулу.\n2. ${math(`f(${x})=${k}\\cdot(${x})${b >= 0 ? '+' : ''}${b}`)}.\n3. Отримуємо ${math(String(correct))}.`,
  });
}

function choiceProgression() {
  const a1 = randInt(-2, 8);
  const d = choice([2, 3, 4, 5]);
  const n = choice([5, 6, 7, 8]);
  const correct = a1 + d * (n - 1);
  return makeChoice({
    topic: 'progressions',
    question: `В арифметичній прогресії ${math(`a_1=${a1}`)}, ${math(`d=${d}`)}. Знайдіть ${math(`a_${n}`)}.`,
    correct: math(String(correct)),
    distractors: [a1 + d * n, a1 * d * (n - 1), a1 + d + n, correct - d].map(v => math(String(v))),
    explanation: `1. Використовуємо ${math(`a_n=a_1+d(n-1)`)}.\n2. ${math(`a_${n}=${a1}+${d}\\cdot${n - 1}`)}.\n3. ${math(`a_${n}=${correct}`)}.`,
  });
}

function choiceTrig() {
  const item = choice([
    { q: '\\sin 30^\\circ', v: '\\frac12', ds: ['0', '1', '\\frac{\\sqrt2}{2}', '\\frac{\\sqrt3}{2}'] },
    { q: '\\cos 60^\\circ', v: '\\frac12', ds: ['0', '1', '\\frac{\\sqrt2}{2}', '\\frac{\\sqrt3}{2}'] },
    { q: '\\sin 90^\\circ', v: '1', ds: ['0', '\\frac12', '\\frac{\\sqrt2}{2}', '\\frac{\\sqrt3}{2}'] },
    { q: '\\cos 0^\\circ', v: '1', ds: ['0', '\\frac12', '\\frac{\\sqrt2}{2}', '\\frac{\\sqrt3}{2}'] },
  ]);
  return makeChoice({
    topic: 'trigonometry',
    question: `Знайдіть значення ${math(item.q)}.`,
    correct: math(item.v),
    distractors: item.ds.map(math),
    explanation: `1. Використовуємо табличне значення тригонометричної функції.\n2. ${math(`${item.q}=${item.v}`)}.\n3. Обираємо відповідний варіант.`,
  });
}

function choiceProbability() {
  let red = randInt(2, 6);
  let blue = randInt(2, 6);
  if (blue === red) blue = red === 6 ? 5 : red + 1;
  const total = red + blue;
  const g = gcd(red, total);
  const num = red / g;
  const den = total / g;
  return makeChoice({
    topic: 'probability_stats',
    question: `У коробці ${red} червоних і ${blue} синіх кульок. Навмання виймають одну кульку. Яка ймовірність того, що вона червона?`,
    correct: math(`\\frac{${num}}{${den}}`),
    distractors: [math(`\\frac{${blue}}{${total}}`), math(`\\frac{1}{${total}}`), math(`\\frac{${red}}{${blue}}`), math(`\\frac{${total}}{${red}}`)],
    explanation: `1. Сприятливих результатів: ${red}.\n2. Усього рівноймовірних результатів: ${total}.\n3. ${math(`P=\\frac{${red}}{${total}}=\\frac{${num}}{${den}}`)}.`,
  });
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function choicePlanimetry() {
  const triple = choice([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]]);
  const scale = choice([1, 2]);
  const a = triple[0] * scale;
  const b = triple[1] * scale;
  const c = triple[2] * scale;
  return makeChoice({
    topic: 'planimetry',
    question: `На рисунку зображено прямокутний трикутник ${math('ABC')} з прямим кутом при ${math('A')}. Знайдіть довжину гіпотенузи ${math('BC')}.`,
    correct: math(String(c)),
    distractors: [a + b, Math.abs(a - b), a * b / 2, c + scale].map(v => math(String(v))),
    explanation: `1. За теоремою Піфагора ${math(`BC^2=AB^2+AC^2`)}.\n2. ${math(`BC^2=${a}^2+${b}^2=${c * c}`)}.\n3. ${math(`BC=${c}`)}.`,
    diagramSvg: rightTriangleSvg(a, b, c, { ab: `${a} см`, ac: `${b} см`, bc: '?' }),
  });
}

function choiceCircle() {
  const r = randInt(3, 7);
  const coeff = r * r;
  return makeChoice({
    topic: 'planimetry',
    question: `Радіус круга дорівнює ${math(`${r}\\text{ см}`)}. Знайдіть площу круга.`,
    correct: math(`${coeff}\\pi\\text{ см}^{2}`),
    distractors: [math(`${2 * r}\\pi\\text{ см}^{2}`), math(`${r}\\pi\\text{ см}^{2}`), math(`${2 * coeff}\\pi\\text{ см}^{2}`), math(`${coeff}\\text{ см}^{2}`)],
    explanation: `1. Площа круга: ${math('S=\\pi r^2')}.\n2. ${math(`S=\\pi\\cdot${r}^{2}`)}.\n3. ${math(`S=${coeff}\\pi\\text{ см}^{2}`)}.`,
    diagramSvg: circleSvg(r),
  });
}

function choiceStereometry() {
  const a = randInt(2, 6);
  const b = randInt(2, 6);
  const h = randInt(2, 8);
  const v = a * b * h;
  return makeChoice({
    topic: 'stereometry',
    question: `Основа прямої призми — прямокутник зі сторонами ${math(`${a}\\text{ см}`)} і ${math(`${b}\\text{ см}`)}, висота призми — ${math(`${h}\\text{ см}`)}. Знайдіть об'єм призми.`,
    correct: math(`${v}\\text{ см}^{3}`),
    distractors: [a * b, 2 * (a * b + a * h + b * h), a + b + h, v + a * b].map(x => math(`${x}\\text{ см}^{3}`)),
    explanation: `1. Площа основи: ${math(`S=${a}\\cdot${b}=${a * b}`)}.\n2. ${math('V=S_{осн}H')}.\n3. ${math(`V=${a * b}\\cdot${h}=${v}\\text{ см}^{3}`)}.`,
  });
}

function choiceWordProblem() {
  const price = choice([240, 300, 400, 500, 600, 800]);
  const p = choice([10, 20, 25, 30]);
  const newPrice = price * (100 - p) / 100;
  return makeChoice({
    topic: 'word_problems',
    question: `Товар коштував ${price} грн. Його ціну знизили на ${p}%. Якою стала нова ціна товару?`,
    correct: `${uaNumber(newPrice)} грн`,
    distractors: [`${uaNumber(price * p / 100)} грн`, `${uaNumber(price + price * p / 100)} грн`, `${uaNumber(price - p)} грн`, `${uaNumber(newPrice + p)} грн`],
    explanation: `1. Знижка становить ${math(`${price}\\cdot\\frac{${p}}{100}=${uaNumber(price * p / 100).replace(',', '{,}')}`)} грн.\n2. Віднімаємо її від початкової ціни.\n3. Отримуємо ${uaNumber(newPrice)} грн.`,
  });
}

function matchingPowers() {
  return makeMatching({
    topic: 'powers_roots',
    question: 'Установіть відповідність між виразом (1–3) та його значенням (А–Д).',
    left: [math('2^3'), math('\\sqrt{81}'), math('\\log_2 16')],
    options: [math('4'), math('8'), math('9'), math('16'), math('2')],
    correctPairs: { '0': 'Б', '1': 'В', '2': 'А' },
    explanation: `1. ${math('2^3=8')} → Б.\n2. ${math('\\sqrt{81}=9')} → В.\n3. ${math('\\log_2 16=4')} → А.`,
  });
}

function matchingGeometryFinal() {
  // Інший набір величин гарантує різні відповіді: гіпотенуза, сума катетів, квадрат гіпотенузи.
  const a = 6, b = 8, c = 10;
  return makeMatching({
    topic: 'planimetry',
    question: `На рисунку ${math('\\angle A=90^\\circ')}, ${math('AB=6')}, ${math('AC=8')}. Установіть відповідність між величиною (1–3) та її значенням (А–Д).`,
    left: ['Довжина гіпотенузи BC', 'Сума довжин катетів AB + AC', 'Квадрат довжини гіпотенузи BC²'],
    options: [math('10'), math('14'), math('24'), math('64'), math('100')],
    correctPairs: { '0': 'А', '1': 'Б', '2': 'Д' },
    explanation: `1. ${math('BC=10')} → А.\n2. ${math('AB+AC=6+8=14')} → Б.\n3. ${math('BC^2=10^2=100')} → Д.`,
    diagramSvg: rightTriangleSvg(a, b, c, { ab: '6', ac: '8', bc: '?' }),
  });
}

function matchingTrig() {
  return makeMatching({
    topic: 'trigonometry',
    question: 'Установіть відповідність між виразом (1–3) та його значенням (А–Д).',
    left: [math('\\sin 0^\\circ'), math('\\cos 60^\\circ'), math('\\sin 45^\\circ')],
    options: [math('0'), math('\\frac12'), math('\\frac{\\sqrt2}{2}'), math('\\frac{\\sqrt3}{2}'), math('1')],
    correctPairs: { '0': 'А', '1': 'Б', '2': 'В' },
    explanation: `1. ${math('\\sin0^\\circ=0')} → А.\n2. ${math('\\cos60^\\circ=\\frac12')} → Б.\n3. ${math('\\sin45^\\circ=\\frac{\\sqrt2}{2}')} → В.`,
  });
}

function shortLinear() {
  const x = randInt(-12, 12);
  const a = choice([2, 3, 4, 5]);
  const b = randInt(-10, 10);
  const c = a * x + b;
  return makeShort({
    topic: 'equations',
    question: `Розв'яжіть рівняння ${math(`${a}x${b >= 0 ? '+' : ''}${b}=${c}`)}. У відповідь запишіть значення ${math('x')}.`,
    correctValue: x,
    explanation: `1. ${math(`${a}x=${c - b}`)}.\n2. Ділимо на ${a}.\n3. ${math(`x=${x}`)}.`,
  });
}

function shortPercentDecimal() {
  const base = choice([150, 250, 350, 450]);
  const p = choice([15, 25, 35]);
  const result = base * p / 100;
  return makeShort({
    topic: 'percents',
    question: `Знайдіть ${math(`${p}\\%`)} від числа ${math(String(base))}. У відповідь запишіть лише число.`,
    correctValue: result,
    explanation: `1. ${math(`${p}\\%=\\frac{${p}}{100}`)}.\n2. ${math(`${base}\\cdot\\frac{${p}}{100}=${uaNumber(result).replace(',', '{,}')}`)}.\n3. Відповідь: ${uaNumber(result)}.`,
    answerHint: 'Наприклад: 37,5 або 37.5',
  });
}

function shortGeometry() {
  const a = choice([4, 5, 6]);
  const b = choice([7, 8, 9]);
  const h = choice([3, 4, 5]);
  const result = a * b * h;
  return makeShort({
    topic: 'stereometry',
    question: `Прямокутний паралелепіпед має виміри ${math(String(a))}, ${math(String(b))} і ${math(String(h))}. Знайдіть його об'єм.`,
    correctValue: result,
    explanation: `1. ${math('V=abc')}.\n2. ${math(`V=${a}\\cdot${b}\\cdot${h}`)}.\n3. ${math(`V=${result}`)}.`,
  });
}

function shortNegativeDecimal() {
  // Завжди десятковий результат .5, щоб явно перевірити кому/крапку.
  const correct = choice([-4.5, -3.5, -2.5, 1.5, 2.5]);
  const a = 2;
  const b = randInt(-6, 6);
  const c = a * correct + b;
  return makeShort({
    topic: 'equations',
    question: `Розв'яжіть рівняння ${math(`${a}x${b >= 0 ? '+' : ''}${b}=${uaNumber(c).replace(',', '{,}')}`)}. У відповідь запишіть значення ${math('x')}.`,
    correctValue: correct,
    explanation: `1. Переносимо ${b >= 0 ? b : `(${b})`} в іншу частину рівняння.\n2. ${math(`${a}x=${uaNumber(c - b).replace(',', '{,}')}`)}.\n3. ${math(`x=${uaNumber(correct).replace(',', '{,}')}`)}.`,
    answerHint: 'Можна вводити через кому або крапку',
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
    matchingPowers(),
    matchingGeometryFinal(),
    matchingTrig(),
    shortLinear(),
    shortPercentDecimal(),
    shortGeometry(),
    shortNegativeDecimal(),
  ].map((q, index) => ({ ...q, number: index + 1, id: `nmt-${index + 1}` }));

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
      if (!Array.isArray(q.options) || q.options.length !== 5 || !Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 4) {
        throw new Error(`Invalid choice question ${q.number}`);
      }
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
});
