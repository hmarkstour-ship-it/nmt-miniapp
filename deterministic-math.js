// Детермінований генератор тренувальних завдань НМТ.
// Математична відповідь та пояснення обчислюються кодом, а не мовною моделлю.

export const GENERATOR_VERSION = 3;

const TOPIC_KEYS = [
  'numbers',
  'percents',
  'powers_roots',
  'logarithms',
  'equations',
  'inequalities',
  'systems',
  'functions',
  'progressions',
  'trigonometry',
  'calculus',
  'probability_stats',
  'planimetry',
  'stereometry',
  'word_problems',
];

const math = (s) => `\\(${s}\\)`;
const display = (s) => `\\[${s}\\]`;
const linearFactor = (root) => root >= 0 ? `(x-${root})` : `(x+${Math.abs(root)})`;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

class Fraction {
  constructor(n, d = 1) {
    if (d === 0) throw new Error('Zero denominator');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }
  add(other) { return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d); }
  sub(other) { return new Fraction(this.n * other.d - other.n * this.d, this.d * other.d); }
  mul(other) { return new Fraction(this.n * other.n, this.d * other.d); }
  div(other) { return new Fraction(this.n * other.d, this.d * other.n); }
  key() { return `${this.n}/${this.d}`; }
  latex() {
    if (this.d === 1) return `${this.n}`;
    if (this.n < 0) return `-\\frac{${Math.abs(this.n)}}{${this.d}}`;
    return `\\frac{${this.n}}{${this.d}}`;
  }
}

function decimalUa(value, digits = 2) {
  let s = Number(value).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return s.replace('.', ',');
}

function numericItem(value, label = null) {
  const n = Number(value);
  return { key: Number.isInteger(n) ? `n:${n}` : `n:${n.toFixed(10)}`, label: label ?? math(decimalUa(n, 4)) };
}

function fractionItem(frac) {
  return { key: `f:${frac.key()}`, label: math(frac.latex()) };
}

function stringItem(key, label) {
  return { key: `s:${key}`, label };
}

function numericDistractors(correct, preferred = []) {
  const values = [
    ...preferred,
    correct + 1,
    correct - 1,
    correct + 2,
    correct - 2,
    -correct,
    correct * 2,
    correct / 2,
  ];
  const seen = new Set([numericItem(correct).key]);
  const out = [];
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const item = numericItem(v);
    if (!seen.has(item.key)) {
      seen.add(item.key);
      out.push(item);
    }
    if (out.length >= 4) break;
  }
  return out;
}

function makeQuestion({ question, correct, distractors, explanation, meta = {} }) {
  const items = [correct];
  const seen = new Set([correct.key]);
  const seenLabels = new Set([correct.label]);
  for (const item of distractors) {
    if (!item || seen.has(item.key) || seenLabels.has(item.label)) continue;
    seen.add(item.key);
    seenLabels.add(item.label);
    items.push(item);
    if (items.length === 5) break;
  }
  if (items.length !== 5) throw new Error(`Not enough unique options: ${question}`);

  const mixed = shuffle(items);
  const correctIndex = mixed.findIndex((x) => x.key === correct.key);

  return {
    question,
    options: mixed.map((x) => x.label),
    correct_index: correctIndex,
    explanation,
    generator_version: GENERATOR_VERSION,
    generator_meta: meta,
  };
}

function genNumbers() {
  const type = choice(['fractions', 'absolute', 'order']);

  if (type === 'fractions') {
    const b = choice([3, 4, 5, 6, 8, 9, 10, 12]);
    const d = choice([3, 4, 5, 6, 8, 9, 10, 12].filter((x) => x !== b));
    const a = randInt(1, b - 1);
    const c = randInt(1, d - 1);
    const f1 = new Fraction(a, b);
    const f2 = new Fraction(c, d);
    const op = Math.random() < 0.5 ? '+' : '-';
    const result = op === '+' ? f1.add(f2) : f1.sub(f2);
    const common = lcm(b, d);
    const n1 = a * (common / b);
    const n2 = c * (common / d);

    const wrongs = [
      new Fraction(op === '+' ? a + c : a - c, b + d),
      new Fraction(op === '+' ? n1 + n2 : n1 - n2, common * 2),
      new Fraction(result.n + 1, result.d),
      new Fraction(result.n - 1, result.d),
      new Fraction(result.n + 2, result.d),
      new Fraction(-result.n, result.d),
      result.n !== 0 ? new Fraction(result.d, result.n) : new Fraction(1, result.d),
    ];

    return makeQuestion({
      question: `Обчисліть ${math(`\\frac{${a}}{${b}} ${op} \\frac{${c}}{${d}}`)}.`,
      correct: fractionItem(result),
      distractors: wrongs.map(fractionItem),
      explanation: [
        `1. Зводимо дроби до спільного знаменника ${math(String(common))}: ${math(`\\frac{${a}}{${b}}=\\frac{${n1}}{${common}}`)}, ${math(`\\frac{${c}}{${d}}=\\frac{${n2}}{${common}}`)}.`,
        `2. Виконуємо дію з чисельниками: ${math(`\\frac{${n1}}{${common}} ${op} \\frac{${n2}}{${common}} = ${result.latex()}`)}.`,
        `3. Отже, правильна відповідь — ${math(result.latex())}.`,
      ].join('\n'),
      meta: { template: 'numbers_fractions' },
    });
  }

  if (type === 'absolute') {
    const a = randInt(-12, -2);
    const b = randInt(1, 12);
    const c = randInt(-8, 8);
    const result = Math.abs(a) + Math.abs(c - b);
    return makeQuestion({
      question: `Обчисліть ${math(`|${a}| + |${c} - ${b}|`)}.`,
      correct: numericItem(result),
      distractors: numericDistractors(result, [Math.abs(a) + c - b, a + Math.abs(c - b), Math.abs(a + c - b), Math.abs(a) + Math.abs(c) - b]),
      explanation: [
        `1. ${math(`|${a}|=${Math.abs(a)}`)}.`,
        `2. ${math(`|${c}-${b}|=|${c - b}|=${Math.abs(c - b)}`)}.`,
        `3. Додаємо: ${math(`${Math.abs(a)}+${Math.abs(c - b)}=${result}`)}.`,
      ].join('\n'),
      meta: { template: 'numbers_absolute' },
    });
  }

  const a = randInt(2, 9);
  const b = randInt(2, 9);
  const c = randInt(2, 8);
  const d = randInt(2, 9);
  const result = a + b * c - d;
  return makeQuestion({
    question: `Обчисліть ${math(`${a}+${b}\\cdot ${c}-${d}`)}.`,
    correct: numericItem(result),
    distractors: numericDistractors(result, [(a + b) * c - d, a + b * (c - d), a + b + c - d]),
    explanation: [
      `1. Спочатку виконуємо множення: ${math(`${b}\\cdot ${c}=${b * c}`)}.`,
      `2. Маємо ${math(`${a}+${b * c}-${d}`)}.`,
      `3. Обчислюємо: ${math(`${a}+${b * c}-${d}=${result}`)}.`,
    ].join('\n'),
    meta: { template: 'numbers_order' },
  });
}

function genPercents() {
  const type = choice(['percent_of', 'discount', 'increase']);
  const p = choice([10, 15, 20, 25, 30, 40, 50]);

  if (type === 'percent_of') {
    const unit = p === 15 ? 20 : p === 25 ? 4 : p === 10 ? 10 : p === 20 ? 5 : p === 30 ? 10 : p === 40 ? 5 : 2;
    const n = unit * randInt(4, 20);
    const result = n * p / 100;
    return makeQuestion({
      question: `Знайдіть ${math(`${p}\\%`)} від числа ${math(String(n))}.`,
      correct: numericItem(result),
      distractors: numericDistractors(result, [n - result, n * 100 / p, n * p / 10, p / n]),
      explanation: [
        `1. ${math(`${p}\\% = \\frac{${p}}{100}`)}.`,
        `2. Множимо число на відповідну частку: ${math(`${n}\\cdot\\frac{${p}}{100}`)}.`,
        `3. Отримуємо ${math(String(result))}.`,
      ].join('\n'),
      meta: { template: 'percents_of' },
    });
  }

  const base = choice([200, 240, 300, 400, 500, 600, 800, 1000]);
  const delta = base * p / 100;
  const result = type === 'discount' ? base - delta : base + delta;
  const verb = type === 'discount' ? 'знизили' : 'підвищили';
  return makeQuestion({
    question: `Ціну товару ${math(String(base))} грн ${verb} на ${math(`${p}\\%`)}. Якою стала ціна?`,
    correct: numericItem(result, `${decimalUa(result)} грн`),
    distractors: numericDistractors(result, [delta, base + (type === 'discount' ? delta : -delta), base * p / 1000, base]).map((x) => ({ ...x, label: `${x.label.replace(/^\\\(|\\\)$/g, '')} грн` })),
    explanation: [
      `1. Знаходимо ${math(`${p}\\%`)} від ${math(String(base))}: ${math(`${base}\\cdot\\frac{${p}}{100}=${delta}`)} грн.`,
      `2. ${type === 'discount' ? 'Віднімаємо знижку' : 'Додаємо збільшення'}: ${math(`${base}${type === 'discount' ? '-' : '+'}${delta}=${result}`)}.`,
      `3. Нова ціна — ${math(String(result))} грн.`,
    ].join('\n'),
    meta: { template: `percents_${type}` },
  });
}

function genPowersRoots() {
  const type = choice(['sqrt_power', 'power_rule', 'root_product']);
  if (type === 'sqrt_power') {
    const r = randInt(2, 12);
    const base = randInt(2, 4);
    const exp = randInt(2, 4);
    const result = r + base ** exp;
    return makeQuestion({
      question: `Обчисліть ${math(`\\sqrt{${r * r}}+${base}^{${exp}}`)}.`,
      correct: numericItem(result),
      distractors: numericDistractors(result, [r * r + base ** exp, r + base * exp, r - base ** exp]),
      explanation: [
        `1. ${math(`\\sqrt{${r * r}}=${r}`)}.`,
        `2. ${math(`${base}^{${exp}}=${base ** exp}`)}.`,
        `3. Додаємо: ${math(`${r}+${base ** exp}=${result}`)}.`,
      ].join('\n'),
      meta: { template: 'powers_sqrt_power' },
    });
  }

  if (type === 'power_rule') {
    const base = randInt(2, 6);
    const m = randInt(2, 5);
    const n = randInt(1, 4);
    const exponent = m + n;
    const correct = stringItem(`pow:${base}:${exponent}`, math(`${base}^{${exponent}}`));
    const distractors = [
      stringItem(`pow:${base}:${m * n}`, math(`${base}^{${m * n}}`)),
      stringItem(`pow:${base * base}:${exponent}`, math(`${base * base}^{${exponent}}`)),
      stringItem(`pow:${base}:${Math.abs(m - n)}`, math(`${base}^{${Math.abs(m - n)}}`)),
      stringItem(`pow:${base}:${exponent + 1}`, math(`${base}^{${exponent + 1}}`)),
      stringItem(`pow:${base}:${Math.max(0, exponent - 1)}`, math(`${base}^{${Math.max(0, exponent - 1)}}`)),
      stringItem(`n:${base ** m + base ** n}`, math(String(base ** m + base ** n))),
    ];
    return makeQuestion({
      question: `Спростіть вираз ${math(`${base}^{${m}}\\cdot ${base}^{${n}}`)}.`,
      correct,
      distractors,
      explanation: [
        `1. Під час множення степенів з однаковою основою показники додаємо.`,
        `2. ${math(`${base}^{${m}}\\cdot ${base}^{${n}}=${base}^{${m}+${n}}`)}.`,
        `3. Отже, маємо ${math(`${base}^{${exponent}}`)}.`,
      ].join('\n'),
      meta: { template: 'powers_rule' },
    });
  }

  const a = randInt(2, 8);
  const b = randInt(2, 8);
  const result = a * b;
  return makeQuestion({
    question: `Обчисліть ${math(`\\sqrt{${a * a}}\\cdot\\sqrt{${b * b}}`)}.`,
    correct: numericItem(result),
    distractors: numericDistractors(result, [a + b, a * a + b * b, Math.abs(a - b)]),
    explanation: [
      `1. ${math(`\\sqrt{${a * a}}=${a}`)} і ${math(`\\sqrt{${b * b}}=${b}`)}.`,
      `2. Тоді вираз дорівнює ${math(`${a}\\cdot ${b}`)}.`,
      `3. Отримуємо ${math(String(result))}.`,
    ].join('\n'),
    meta: { template: 'powers_root_product' },
  });
}

function genLogarithms() {
  const type = choice(['value', 'sum', 'equation']);
  const base = choice([2, 3, 4, 5, 10]);

  if (type === 'value') {
    const k = randInt(1, base === 10 ? 3 : 4);
    const arg = base ** k;
    return makeQuestion({
      question: `Обчисліть ${math(`\\log_{${base}} ${arg}`)}.`,
      correct: numericItem(k),
      distractors: numericDistractors(k, [base, arg, k + base]),
      explanation: [
        `1. За означенням ${math(`\\log_{${base}} ${arg}=x`)} означає ${math(`${base}^{x}=${arg}`)}.`,
        `2. Оскільки ${math(`${base}^{${k}}=${arg}`)}, то ${math(`x=${k}`)}.`,
        `3. Відповідь: ${math(String(k))}.`,
      ].join('\n'),
      meta: { template: 'logs_value' },
    });
  }

  if (type === 'sum') {
    const m = randInt(1, 3);
    const n = randInt(1, 3);
    const a = base ** m;
    const b = base ** n;
    const result = m + n;
    return makeQuestion({
      question: `Обчисліть ${math(`\\log_{${base}} ${a}+\\log_{${base}} ${b}`)}.`,
      correct: numericItem(result),
      distractors: numericDistractors(result, [m * n, Math.abs(m - n), a + b]),
      explanation: [
        `1. ${math(`\\log_{${base}} ${a}=${m}`)}, бо ${math(`${base}^{${m}}=${a}`)}.`,
        `2. ${math(`\\log_{${base}} ${b}=${n}`)}.`,
        `3. Додаємо: ${math(`${m}+${n}=${result}`)}.`,
      ].join('\n'),
      meta: { template: 'logs_sum' },
    });
  }

  const k = randInt(1, base === 10 ? 3 : 4);
  const result = base ** k;
  return makeQuestion({
    question: `Розв'яжіть рівняння ${math(`\\log_{${base}} x=${k}`)}.`,
    correct: numericItem(result),
    distractors: numericDistractors(result, [base * k, k ** base, base + k]),
    explanation: [
      `1. За означенням логарифма ${math(`\\log_{${base}} x=${k}`)} рівносильне ${math(`x=${base}^{${k}}`)}.`,
      `2. Обчислюємо ${math(`${base}^{${k}}=${result}`)}.`,
      `3. Отже, ${math(`x=${result}`)}.`,
    ].join('\n'),
    meta: { template: 'logs_equation' },
  });
}

function genEquations() {
  const type = choice(['linear', 'quadratic_sum', 'fractional']);
  if (type === 'linear') {
    const x = randInt(-8, 10);
    const a = choice([2, 3, 4, 5, 6, 7]);
    const b = randInt(-12, 12);
    const c = a * x + b;
    return makeQuestion({
      question: `Розв'яжіть рівняння ${math(`${a}x${b >= 0 ? '+' : ''}${b}=${c}`)}.`,
      correct: numericItem(x),
      distractors: numericDistractors(x, [c - b, (c + b) / a, -x]),
      explanation: [
        `1. Переносимо вільний член: ${math(`${a}x=${c}-${b >= 0 ? b : `(${b})`}=${a * x}`)}.`,
        `2. Ділимо обидві частини на ${math(String(a))}.`,
        `3. Отримуємо ${math(`x=${x}`)}.`,
      ].join('\n'),
      meta: { template: 'equations_linear' },
    });
  }

  if (type === 'quadratic_sum') {
    let r1 = randInt(-7, 6);
    let r2 = randInt(-6, 8);
    if (r2 === r1) r2 += 2;
    const b = -(r1 + r2);
    const c = r1 * r2;
    const sum = r1 + r2;
    return makeQuestion({
      question: `Знайдіть суму коренів рівняння ${math(`x^{2}${b >= 0 ? '+' : ''}${b}x${c >= 0 ? '+' : ''}${c}=0`)}.`,
      correct: numericItem(sum),
      distractors: numericDistractors(sum, [c, -c, b, -b + 1]),
      explanation: [
        `1. Для рівняння ${math(`x^{2}+bx+c=0`)} за теоремою Вієта сума коренів дорівнює ${math(`-b`)}.`,
        `2. Тут коефіцієнт при ${math('x')} дорівнює ${math(String(b))}.`,
        `3. Тому сума коренів: ${math(`${-b}`)}.`,
      ].join('\n'),
      meta: { template: 'equations_quadratic_sum' },
    });
  }

  const x = randInt(2, 12);
  const d = choice([2, 3, 4, 5]);
  const b = randInt(-5, 7);
  const rhs = x / d + b;
  if (!Number.isInteger(rhs) && !Number.isInteger(x / d)) return genEquations();
  return makeQuestion({
    question: `Розв'яжіть рівняння ${math(`\\frac{x}{${d}}${b >= 0 ? '+' : ''}${b}=${rhs}`)}.`,
    correct: numericItem(x),
    distractors: numericDistractors(x, [(rhs - b), (rhs + b) * d, rhs * d]),
    explanation: [
      `1. Переносимо число ${math(String(b))}: ${math(`\\frac{x}{${d}}=${rhs - b}`)}.`,
      `2. Множимо обидві частини на ${math(String(d))}.`,
      `3. Отримуємо ${math(`x=${x}`)}.`,
    ].join('\n'),
    meta: { template: 'equations_fractional' },
  });
}

function genInequalities() {
  const type = choice(['linear', 'quadratic']);
  if (type === 'linear') {
    const boundary = choice([-6,-5,-4,-3,-2,-1,1,2,3,4,5,6,7,8]);
    const a = choice([2, 3, 4, 5]);
    const b = randInt(-10, 10);
    const c = a * boundary + b;
    const sign = Math.random() < 0.5 ? '<' : '>';
    const correct = stringItem(`${sign}${boundary}`, math(`x${sign}${boundary}`));
    const distractors = [
      stringItem(`${sign === '<' ? '>' : '<'}${boundary}`, math(`x${sign === '<' ? '>' : '<'}${boundary}`)),
      stringItem(`${sign}=${boundary}`, math(`x${sign === '<' ? '\\le' : '\\ge'}${boundary}`)),
      stringItem(`${sign}${-boundary}`, math(`x${sign}${-boundary}`)),
      stringItem(`${sign}${boundary + 1}`, math(`x${sign}${boundary + 1}`)),
      stringItem(`${sign}${boundary - 1}`, math(`x${sign}${boundary - 1}`)),
      stringItem(`${sign === '<' ? '<=' : '>='}:${boundary + 1}`, math(`x${sign === '<' ? '\\le' : '\\ge'}${boundary + 1}`)),
    ];
    return makeQuestion({
      question: `Розв'яжіть нерівність ${math(`${a}x${b >= 0 ? '+' : ''}${b}${sign}${c}`)}.`,
      correct,
      distractors,
      explanation: [
        `1. Переносимо ${math(String(b))}: ${math(`${a}x${sign}${c - b}`)}.`,
        `2. Ділимо на додатне число ${math(String(a))}, тому знак нерівності не змінюється.`,
        `3. Маємо ${math(`x${sign}${boundary}`)}.`,
      ].join('\n'),
      meta: { template: 'inequalities_linear' },
    });
  }

  let r1 = randInt(-6, 2);
  let r2 = randInt(3, 9);
  if (r1 >= r2) [r1, r2] = [r2 - 3, r2];
  const correct = stringItem(`interval:${r1}:${r2}`, math(`${r1}<x<${r2}`));
  const distractors = [
    stringItem(`outside:${r1}:${r2}`, math(`x<${r1}\\;\\text{або}\\;x>${r2}`)),
    stringItem(`closed:${r1}:${r2}`, math(`${r1}\\le x\\le ${r2}`)),
    stringItem(`left:${r1}`, math(`x<${r1}`)),
    stringItem(`right:${r2}`, math(`x>${r2}`)),
  ];
  return makeQuestion({
    question: `Розв'яжіть нерівність ${math(`${linearFactor(r1)}${linearFactor(r2)}<0`)}.`,
    correct,
    distractors,
    explanation: [
      `1. Нулі множників: ${math(`x=${r1}`)} і ${math(`x=${r2}`)}.`,
      `2. Добуток двох лінійних множників з додатним старшим коефіцієнтом від'ємний між коренями.`,
      `3. Отже, ${math(`${r1}<x<${r2}`)}.`,
    ].join('\n'),
    meta: { template: 'inequalities_quadratic' },
  });
}

function genSystems() {
  const x = randInt(-5, 7);
  const y = randInt(-5, 7);
  const a = choice([1, 2, 3]);
  const b = choice([1, 2, 3]);
  const c = choice([1, 2, 3]);
  let d = choice([1, 2, 3, 4]);
  if (a * d === b * c) d += 1;
  const e = a * x + b * y;
  const f = c * x + d * y;
  const result = x + y;
  return makeQuestion({
    question: `Система ${math(`\\begin{cases}${a}x+${b}y=${e}\\\\${c}x+${d}y=${f}\\end{cases}`)} має розв'язок ${math('(x;y)')}. Знайдіть ${math('x+y')}.`,
    correct: numericItem(result),
    distractors: numericDistractors(result, [x * y, x - y, y - x]),
    explanation: [
      `1. Підставлянням або методом додавання розв'язуємо систему.`,
      `2. Отримуємо ${math(`x=${x}`)} та ${math(`y=${y}`)}.`,
      `3. Тоді ${math(`x+y=${x}+${y}=${result}`)}.`,
    ].join('\n'),
    meta: { template: 'systems_linear', solution: [x, y] },
  });
}

function genFunctions() {
  const type = choice(['evaluate', 'vertex', 'domain']);
  if (type === 'evaluate') {
    const a = choice([-2, -1, 1, 2, 3]);
    const b = randInt(-5, 5);
    const c = randInt(-8, 8);
    const x0 = randInt(-3, 4);
    const result = a * x0 * x0 + b * x0 + c;
    return makeQuestion({
      question: `Функцію задано формулою ${math(`f(x)=${a}x^{2}${b >= 0 ? '+' : ''}${b}x${c >= 0 ? '+' : ''}${c}`)}. Знайдіть ${math(`f(${x0})`)}.`,
      correct: numericItem(result),
      distractors: numericDistractors(result, [a * x0 + b * x0 + c, a * x0 * x0 + b + c, a + b + c]),
      explanation: [
        `1. Підставляємо ${math(`x=${x0}`)} у формулу функції.`,
        `2. ${math(`f(${x0})=${a}\\cdot(${x0})^{2}${b >= 0 ? '+' : ''}${b}\\cdot(${x0})${c >= 0 ? '+' : ''}${c}`)}.`,
        `3. Після обчислення отримуємо ${math(String(result))}.`,
      ].join('\n'),
      meta: { template: 'functions_evaluate' },
    });
  }

  if (type === 'vertex') {
    const a = choice([1, 2, -1, -2]);
    const xv = randInt(-4, 5);
    const b = -2 * a * xv;
    const c = randInt(-6, 8);
    return makeQuestion({
      question: `Знайдіть абсцису вершини параболи ${math(`y=${a}x^{2}${b >= 0 ? '+' : ''}${b}x${c >= 0 ? '+' : ''}${c}`)}.`,
      correct: numericItem(xv),
      distractors: numericDistractors(xv, [-xv, b / (2 * a), b]),
      explanation: [
        `1. Для ${math(`y=ax^{2}+bx+c`)} абсциса вершини дорівнює ${math(`x_{0}=-\\frac{b}{2a}`)}.`,
        `2. Підставляємо ${math(`a=${a}`)}, ${math(`b=${b}`)}.`,
        `3. ${math(`x_{0}=-\\frac{${b}}{2\\cdot ${a}}=${xv}`)}.`,
      ].join('\n'),
      meta: { template: 'functions_vertex' },
    });
  }

  const a = randInt(-6, 8);
  const correct = stringItem(`exclude:${a}`, math(`x\\ne ${a}`));
  const distractors = [
    stringItem(`eq:${a}`, math(`x=${a}`)),
    stringItem(`neq:${-a}`, math(`x\\ne ${-a}`)),
    stringItem(`gt:${a}`, math(`x>${a}`)),
    stringItem(`lt:${a}`, math(`x<${a}`)),
    stringItem(`eq:${-a}`, math(`x=${-a}`)),
    stringItem(`all`, 'усі дійсні числа'),
  ];
  return makeQuestion({
    question: `Укажіть область визначення функції ${math(`f(x)=\\frac{1}{x-${a}}`)}.`,
    correct,
    distractors,
    explanation: [
      `1. Знаменник дробу не може дорівнювати нулю.`,
      `2. Тому ${math(`x-${a}\\ne 0`)}.`,
      `3. Отже, ${math(`x\\ne ${a}`)}.`,
    ].join('\n'),
    meta: { template: 'functions_domain' },
  });
}

function genProgressions() {
  const type = choice(['arith_n', 'arith_sum', 'geom_n']);
  if (type === 'arith_n') {
    const a1 = randInt(-5, 12);
    const d = choice([-4, -3, -2, 2, 3, 4, 5]);
    const n = randInt(4, 9);
    const result = a1 + (n - 1) * d;
    return makeQuestion({
      question: `В арифметичній прогресії ${math(`a_{1}=${a1}`)}, ${math(`d=${d}`)}. Знайдіть ${math(`a_{${n}}`)}.`,
      correct: numericItem(result),
      distractors: numericDistractors(result, [a1 + n * d, a1 + (n - 2) * d, a1 * d]),
      explanation: [
        `1. Формула ${math(`n`)}-го члена: ${math(`a_{n}=a_{1}+(n-1)d`)}.`,
        `2. Підставляємо: ${math(`a_{${n}}=${a1}+(${n}-1)\\cdot(${d})`)}.`,
        `3. Отримуємо ${math(String(result))}.`,
      ].join('\n'),
      meta: { template: 'progressions_arith_n' },
    });
  }

  if (type === 'arith_sum') {
    const a1 = randInt(1, 10);
    const d = randInt(1, 5);
    const n = choice([4, 5, 6, 8, 10]);
    const an = a1 + (n - 1) * d;
    const result = n * (a1 + an) / 2;
    return makeQuestion({
      question: `В арифметичній прогресії ${math(`a_{1}=${a1}`)}, ${math(`d=${d}`)}. Знайдіть суму перших ${math(String(n))} членів.`,
      correct: numericItem(result),
      distractors: numericDistractors(result, [n * (a1 + d) / 2, a1 + an, n * an]),
      explanation: [
        `1. Знаходимо ${math(`a_{${n}}=${a1}+(${n}-1)\\cdot ${d}=${an}`)}.`,
        `2. Використовуємо ${math(`S_{n}=\\frac{n(a_{1}+a_{n})}{2}`)}.`,
        `3. ${math(`S_{${n}}=\\frac{${n}(${a1}+${an})}{2}=${result}`)}.`,
      ].join('\n'),
      meta: { template: 'progressions_arith_sum' },
    });
  }

  const b1 = choice([1, 2, 3, 4]);
  const q = choice([2, 3, 4]);
  const n = randInt(3, 6);
  const result = b1 * q ** (n - 1);
  return makeQuestion({
    question: `У геометричній прогресії ${math(`b_{1}=${b1}`)}, ${math(`q=${q}`)}. Знайдіть ${math(`b_{${n}}`)}.`,
    correct: numericItem(result),
    distractors: numericDistractors(result, [b1 * q ** n, b1 + (n - 1) * q, b1 * q * (n - 1)]),
    explanation: [
      `1. Формула ${math(`n`)}-го члена: ${math(`b_{n}=b_{1}q^{n-1}`)}.`,
      `2. ${math(`b_{${n}}=${b1}\\cdot ${q}^{${n - 1}}`)}.`,
      `3. Отримуємо ${math(String(result))}.`,
    ].join('\n'),
    meta: { template: 'progressions_geom_n' },
  });
}

function genTrigonometry() {
  const type = choice(['standard', 'pythagorean_identity']);
  if (type === 'standard') {
    const data = choice([
      { expr: '\\sin 30^{\\circ}', val: new Fraction(1, 2) },
      { expr: '\\cos 60^{\\circ}', val: new Fraction(1, 2) },
      { expr: '\\sin 90^{\\circ}', val: new Fraction(1, 1) },
      { expr: '\\cos 0^{\\circ}', val: new Fraction(1, 1) },
      { expr: '\\tan 45^{\\circ}', val: new Fraction(1, 1) },
    ]);
    const correct = fractionItem(data.val);
    const distractors = [
      fractionItem(new Fraction(0, 1)),
      fractionItem(new Fraction(1, 2)),
      stringItem('sqrt2/2', math('\\frac{\\sqrt{2}}{2}')),
      stringItem('sqrt3/2', math('\\frac{\\sqrt{3}}{2}')),
      numericItem(2),
    ].filter((x) => x.key !== correct.key);
    return makeQuestion({
      question: `Обчисліть ${math(data.expr)}.`,
      correct,
      distractors,
      explanation: [
        `1. Використовуємо табличне значення тригонометричної функції.`,
        `2. ${math(`${data.expr}=${data.val.latex()}`)}.`,
        `3. Це і є правильна відповідь.`,
      ].join('\n'),
      meta: { template: 'trig_standard' },
    });
  }

  const triple = choice([[3, 4, 5], [5, 12, 13], [8, 15, 17]]);
  const [a, b, c] = triple;
  const useSin = Math.random() < 0.5;
  const given = useSin ? new Fraction(a, c) : new Fraction(b, c);
  const result = useSin ? new Fraction(b, c) : new Fraction(a, c);
  const givenName = useSin ? '\\sin' : '\\cos';
  const targetName = useSin ? '\\cos' : '\\sin';
  return makeQuestion({
    question: `Нехай ${math(`0^{\\circ}<\\alpha<90^{\\circ}`)} і ${math(`${givenName}\\alpha=${given.latex()}`)}. Знайдіть ${math(`${targetName}\\alpha`)}.`,
    correct: fractionItem(result),
    distractors: [
      fractionItem(given),
      fractionItem(new Fraction(c, b)),
      fractionItem(new Fraction(Math.abs(b - a), c)),
      fractionItem(new Fraction(a + b, c)),
    ],
    explanation: [
      `1. Використовуємо тотожність ${math('\\sin^{2}\\alpha+\\cos^{2}\\alpha=1')}.`,
      `2. Для гострого кута шукане значення додатне.`,
      `3. Із трійки ${math(`${a}-${b}-${c}`)} отримуємо ${math(`${targetName}\\alpha=${result.latex()}`)}.`,
    ].join('\n'),
    meta: { template: 'trig_identity' },
  });
}

function genCalculus() {
  const type = choice(['derivative_value', 'integral']);
  if (type === 'derivative_value') {
    const a = choice([1, 2, 3, -1, -2]);
    const b = randInt(-6, 6);
    const c = randInt(-5, 5);
    const x0 = randInt(-3, 4);
    const result = 2 * a * x0 + b;
    return makeQuestion({
      question: `Функція ${math(`f(x)=${a}x^{2}${b >= 0 ? '+' : ''}${b}x${c >= 0 ? '+' : ''}${c}`)}. Знайдіть ${math(`f'(${x0})`)}.`,
      correct: numericItem(result),
      distractors: numericDistractors(result, [a * x0 + b, 2 * a + b, a * x0 * x0 + b]),
      explanation: [
        `1. ${math(`f'(x)=${2 * a}x${b >= 0 ? '+' : ''}${b}`)}.`,
        `2. Підставляємо ${math(`x=${x0}`)}.`,
        `3. ${math(`f'(${x0})=${2 * a}\\cdot(${x0})${b >= 0 ? '+' : ''}${b}=${result}`)}.`,
      ].join('\n'),
      meta: { template: 'calculus_derivative' },
    });
  }

  const k = choice([2, 4, 6, 8]);
  const m = choice([1, 2, 3, 4]);
  const result = k * m * m / 2;
  return makeQuestion({
    question: `Обчисліть визначений інтеграл ${math(`\\int_{0}^{${m}} ${k}x\\,dx`)}.`,
    correct: numericItem(result),
    distractors: numericDistractors(result, [k * m, k * m * m, m * m / 2]),
    explanation: [
      `1. Первісна для ${math(`${k}x`)}: ${math(`${k / 2}x^{2}`)}.`,
      `2. Підставляємо межі: ${math(`\\left.${k / 2}x^{2}\\right|_{0}^{${m}}`)}.`,
      `3. Отримуємо ${math(String(result))}.`,
    ].join('\n'),
    meta: { template: 'calculus_integral' },
  });
}

function genProbabilityStats() {
  const type = choice(['mean', 'probability', 'combinations']);
  if (type === 'mean') {
    const mean = randInt(3, 12);
    const offsets = choice([[-2, -1, 0, 1, 2], [-4, -2, 0, 2, 4], [-3, -1, 0, 1, 3]]);
    const values = offsets.map((o) => mean + o);
    return makeQuestion({
      question: `Знайдіть середнє арифметичне чисел ${values.map((v) => math(String(v))).join(', ')}.`,
      correct: numericItem(mean),
      distractors: numericDistractors(mean, [values[0], values.at(-1), values.reduce((a, b) => a + b, 0)]),
      explanation: [
        `1. Додаємо числа: ${math(`${values.join('+')}=${values.reduce((a, b) => a + b, 0)}`)}.`,
        `2. Кількість чисел — ${math(String(values.length))}.`,
        `3. Ділимо суму на кількість: ${math(`${values.reduce((a, b) => a + b, 0)}:${values.length}=${mean}`)}.`,
      ].join('\n'),
      meta: { template: 'stats_mean' },
    });
  }

  if (type === 'probability') {
    const red = randInt(2, 8);
    let blue = randInt(2, 8);
    if (blue === red) blue = blue === 8 ? 7 : blue + 1;
    const total = red + blue;
    const result = new Fraction(red, total);
    return makeQuestion({
      question: `У коробці ${math(String(red))} червоних і ${math(String(blue))} синіх кульок. Навмання виймають одну кульку. Яка ймовірність того, що вона буде червоною?`,
      correct: fractionItem(result),
      distractors: [
        fractionItem(new Fraction(blue, total)),
        fractionItem(new Fraction(red, blue)),
        fractionItem(new Fraction(1, total)),
        fractionItem(new Fraction(total - 1, total)),
        fractionItem(new Fraction(red + 1, total)),
        fractionItem(new Fraction(Math.max(1, red - 1), total)),
        fractionItem(new Fraction(blue, red)),
        fractionItem(new Fraction(red, total + 1)),
        fractionItem(new Fraction(red + blue, total + 1)),
        fractionItem(new Fraction(red + 2, total + 2)),
      ],
      explanation: [
        `1. Усього кульок: ${math(`${red}+${blue}=${total}`)}.`,
        `2. Сприятливих результатів — ${math(String(red))}.`,
        `3. Ймовірність: ${math(`P=\\frac{${red}}{${total}}=${result.latex()}`)}.`,
      ].join('\n'),
      meta: { template: 'probability_simple' },
    });
  }

  const n = randInt(4, 8);
  const result = n * (n - 1) / 2;
  return makeQuestion({
    question: `Скількома способами можна вибрати двох учнів із ${math(String(n))} учнів?`,
    correct: numericItem(result),
    distractors: numericDistractors(result, [n * (n - 1), n + 2, n ** 2]),
    explanation: [
      `1. Порядок вибору двох учнів не має значення.`,
      `2. Використовуємо ${math(`C_{${n}}^{2}=\\frac{${n}(${n}-1)}{2}`)}.`,
      `3. Отримуємо ${math(String(result))} способів.`,
    ].join('\n'),
    meta: { template: 'combinations_choose2' },
  });
}

function genPlanimetry() {
  const type = choice(['right_triangle', 'rectangle', 'circle']);
  if (type === 'right_triangle') {
    const triple = choice([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15]]);
    const scale = choice([1, 1, 2]);
    const a = triple[0] * scale;
    const b = triple[1] * scale;
    const c = triple[2] * scale;
    return makeQuestion({
      question: `Катети прямокутного трикутника дорівнюють ${math(String(a))} см і ${math(String(b))} см. Знайдіть гіпотенузу.`,
      correct: numericItem(c, `${c} см`),
      distractors: numericDistractors(c, [a + b, Math.abs(a - b), a * b / 2, c + 2]).map((x) => ({ ...x, label: `${x.label.replace(/^\\\(|\\\)$/g, '')} см` })),
      explanation: [
        `1. За теоремою Піфагора ${math(`c^{2}=a^{2}+b^{2}`)}.`,
        `2. ${math(`c^{2}=${a}^{2}+${b}^{2}=${c * c}`)}.`,
        `3. Тому ${math(`c=${c}`)} см.`,
      ].join('\n'),
      meta: { template: 'planimetry_pythagoras' },
    });
  }

  if (type === 'rectangle') {
    const a = randInt(3, 12);
    const b = randInt(3, 12);
    const result = a * b;
    return makeQuestion({
      question: `Сторони прямокутника дорівнюють ${math(String(a))} см і ${math(String(b))} см. Знайдіть його площу.`,
      correct: numericItem(result, `${result} см²`),
      distractors: numericDistractors(result, [2 * (a + b), a + b, 2 * a * b]).map((x) => ({ ...x, label: `${x.label.replace(/^\\\(|\\\)$/g, '')} см²` })),
      explanation: [
        `1. Площа прямокутника: ${math(`S=ab`)}.`,
        `2. ${math(`S=${a}\\cdot ${b}`)}.`,
        `3. Отримуємо ${math(`S=${result}`)} см².`,
      ].join('\n'),
      meta: { template: 'planimetry_rectangle' },
    });
  }

  const r = randInt(2, 8);
  const coeff = r * r;
  const correct = stringItem(`pi:${coeff}`, math(`${coeff}\\pi`));
  const distractors = [
    stringItem(`pi:${2 * r}`, math(`${2 * r}\\pi`)),
    stringItem(`pi:${r}`, math(`${r}\\pi`)),
    stringItem(`n:${coeff}`, math(String(coeff))),
    stringItem(`pi:${2 * coeff}`, math(`${2 * coeff}\\pi`)),
    stringItem(`pi:${coeff + r}`, math(`${coeff + r}\\pi`)),
    stringItem(`pi:${Math.max(1, coeff - r)}`, math(`${Math.max(1, coeff - r)}\\pi`)),
    stringItem(`pi:${coeff + 1}`, math(`${coeff + 1}\\pi`)),
  ];
  return makeQuestion({
    question: `Радіус круга дорівнює ${math(String(r))} см. Знайдіть його площу.`,
    correct,
    distractors,
    explanation: [
      `1. Площа круга: ${math(`S=\\pi r^{2}`)}.`,
      `2. Підставляємо ${math(`r=${r}`)}.`,
      `3. ${math(`S=\\pi\\cdot ${r}^{2}=${coeff}\\pi`)} см².`,
    ].join('\n'),
    meta: { template: 'planimetry_circle' },
  });
}

function genStereometry() {
  const type = choice(['box', 'cube_surface', 'cylinder']);
  if (type === 'box') {
    const a = randInt(2, 8);
    const b = randInt(2, 8);
    const c = randInt(2, 8);
    const result = a * b * c;
    return makeQuestion({
      question: `Виміри прямокутного паралелепіпеда: ${math(String(a))} см, ${math(String(b))} см і ${math(String(c))} см. Знайдіть його об'єм.`,
      correct: numericItem(result, `${result} см³`),
      distractors: numericDistractors(result, [a + b + c, 2 * (a * b + b * c + a * c), a * b + c]).map((x) => ({ ...x, label: `${x.label.replace(/^\\\(|\\\)$/g, '')} см³` })),
      explanation: [
        `1. Об'єм прямокутного паралелепіпеда: ${math(`V=abc`)}.`,
        `2. ${math(`V=${a}\\cdot ${b}\\cdot ${c}`)}.`,
        `3. ${math(`V=${result}`)} см³.`,
      ].join('\n'),
      meta: { template: 'stereometry_box' },
    });
  }

  if (type === 'cube_surface') {
    const a = randInt(2, 9);
    const result = 6 * a * a;
    return makeQuestion({
      question: `Ребро куба дорівнює ${math(String(a))} см. Знайдіть площу повної поверхні куба.`,
      correct: numericItem(result, `${result} см²`),
      distractors: numericDistractors(result, [a ** 3, 4 * a * a, 6 * a]).map((x) => ({ ...x, label: `${x.label.replace(/^\\\(|\\\)$/g, '')} см²` })),
      explanation: [
        `1. Куб має 6 рівних квадратних граней.`,
        `2. Площа однієї грані: ${math(`a^{2}=${a}^{2}=${a * a}`)}.`,
        `3. Повна площа: ${math(`6a^{2}=6\\cdot ${a * a}=${result}`)} см².`,
      ].join('\n'),
      meta: { template: 'stereometry_cube_surface' },
    });
  }

  const r = randInt(2, 6);
  const h = randInt(2, 10);
  const coeff = r * r * h;
  return makeQuestion({
    question: `Радіус основи циліндра дорівнює ${math(String(r))} см, висота — ${math(String(h))} см. Знайдіть об'єм циліндра.`,
    correct: stringItem(`pi:${coeff}`, math(`${coeff}\\pi`)),
    distractors: [
      stringItem(`pi:${r * h}`, math(`${r * h}\\pi`)),
      stringItem(`pi:${2 * r * h}`, math(`${2 * r * h}\\pi`)),
      stringItem(`pi:${r * r}`, math(`${r * r}\\pi`)),
      stringItem(`pi:${coeff + r}`, math(`${coeff + r}\\pi`)),
      stringItem(`pi:${Math.max(1, coeff - r)}`, math(`${Math.max(1, coeff - r)}\\pi`)),
      stringItem(`n:${coeff}`, math(String(coeff))),
    ],
    explanation: [
      `1. Об'єм циліндра: ${math(`V=\\pi r^{2}h`)}.`,
      `2. Підставляємо ${math(`r=${r}`)}, ${math(`h=${h}`)}.`,
      `3. ${math(`V=\\pi\\cdot ${r}^{2}\\cdot ${h}=${coeff}\\pi`)} см³.`,
    ].join('\n'),
    meta: { template: 'stereometry_cylinder' },
  });
}

function genWordProblems() {
  const type = choice(['motion', 'work', 'price']);
  if (type === 'motion') {
    const speed = choice([40, 50, 60, 70, 80, 90]);
    const time = randInt(2, 5);
    const distance = speed * time;
    return makeQuestion({
      question: `Автомобіль рухався зі сталою швидкістю ${math(String(speed))} км/год протягом ${math(String(time))} год. Яку відстань він подолав?`,
      correct: numericItem(distance, `${distance} км`),
      distractors: numericDistractors(distance, [speed + time, speed / time, distance + speed]).map((x) => ({ ...x, label: `${x.label.replace(/^\\\(|\\\)$/g, '')} км` })),
      explanation: [
        `1. Використовуємо формулу ${math(`s=vt`)}.`,
        `2. ${math(`s=${speed}\\cdot ${time}`)}.`,
        `3. Отримуємо ${math(String(distance))} км.`,
      ].join('\n'),
      meta: { template: 'word_motion' },
    });
  }

  if (type === 'work') {
    const pair = choice([[6, 3], [8, 8], [12, 6], [4, 4], [10, 5]]);
    const [t1, t2] = pair;
    const rate = new Fraction(1, t1).add(new Fraction(1, t2));
    const totalTime = new Fraction(1, 1).div(rate);
    return makeQuestion({
      question: `Перший працівник виконує роботу сам за ${math(String(t1))} год, другий — за ${math(String(t2))} год. За скільки годин вони виконають цю роботу разом?`,
      correct: fractionItem(totalTime),
      distractors: [
        fractionItem(new Fraction(t1 + t2, 1)),
        fractionItem(new Fraction(Math.abs(t1 - t2) || 1, 1)),
        fractionItem(new Fraction(t1 * t2, 1)),
        fractionItem(new Fraction(Math.min(t1, t2), 2)),
        fractionItem(new Fraction(t1, 1)),
        fractionItem(new Fraction(t2, 1)),
        fractionItem(new Fraction(t1 + t2, 2)),
      ],
      explanation: [
        `1. Продуктивності: ${math(`\\frac{1}{${t1}}`)} і ${math(`\\frac{1}{${t2}}`)} роботи за годину.`,
        `2. Разом: ${math(`\\frac{1}{${t1}}+\\frac{1}{${t2}}=${rate.latex()}`)} роботи за годину.`,
        `3. Час — обернена величина: ${math(`${totalTime.latex()}`)} год.`,
      ].join('\n'),
      meta: { template: 'word_work' },
    });
  }

  const price = choice([200, 300, 400, 500, 600, 800]);
  const p = choice([10, 20, 25, 30]);
  const result = price * (100 - p) / 100;
  return makeQuestion({
    question: `Товар коштував ${math(String(price))} грн. Після знижки ${math(`${p}\\%`)} знайдіть нову ціну.`,
    correct: numericItem(result, `${result} грн`),
    distractors: numericDistractors(result, [price * p / 100, price + price * p / 100, price - p]).map((x) => ({ ...x, label: `${x.label.replace(/^\\\(|\\\)$/g, '')} грн` })),
    explanation: [
      `1. Розмір знижки: ${math(`${price}\\cdot\\frac{${p}}{100}=${price * p / 100}`)} грн.`,
      `2. Віднімаємо знижку від початкової ціни.`,
      `3. ${math(`${price}-${price * p / 100}=${result}`)} грн.`,
    ].join('\n'),
    meta: { template: 'word_discount' },
  });
}

const GENERATORS = {
  numbers: genNumbers,
  percents: genPercents,
  powers_roots: genPowersRoots,
  logarithms: genLogarithms,
  equations: genEquations,
  inequalities: genInequalities,
  systems: genSystems,
  functions: genFunctions,
  progressions: genProgressions,
  trigonometry: genTrigonometry,
  calculus: genCalculus,
  probability_stats: genProbabilityStats,
  planimetry: genPlanimetry,
  stereometry: genStereometry,
  word_problems: genWordProblems,
};

export function generateDeterministicQuestion(topicKey = 'mixed', difficulty = 'середній', avoidList = []) {
  const actualTopic = topicKey === 'mixed' ? choice(TOPIC_KEYS) : (GENERATORS[topicKey] ? topicKey : 'numbers');
  const generate = GENERATORS[actualTopic];
  const avoid = new Set((avoidList || []).map((x) => String(x).trim()));

  let last = null;
  for (let i = 0; i < 40; i++) {
    const q = generate();
    q.generator_meta = { ...(q.generator_meta || {}), actual_topic: actualTopic, requested_topic: topicKey, difficulty };
    last = q;
    if (!avoid.has(q.question.trim())) return q;
  }
  return last;
}

export function validateDeterministicQuestion(q) {
  return Boolean(
    q &&
    typeof q.question === 'string' && q.question.trim() &&
    Array.isArray(q.options) && q.options.length === 5 &&
    new Set(q.options).size === 5 &&
    Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 5 &&
    typeof q.explanation === 'string' && q.explanation.includes('1.') &&
    Number(q.generator_version) === GENERATOR_VERSION
  );
}
