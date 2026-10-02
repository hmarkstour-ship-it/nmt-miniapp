const ACTION_LABELS = [
  [/cosine/i, 'теорему косинусів'],
  [/pythag/i, 'теорему Піфагора'],
  [/bisector/i, 'теорему про бісектрису'],
  [/median|apolloni/i, 'формулу медіани'],
  [/area/i, 'формулу площі'],
  [/percent|discount|markup|ratio/i, 'відсоткові співвідношення та пропорції'],
  [/vieta|roots/i, 'теорему Вієта та властивості коренів'],
  [/quadratic/i, 'властивості квадратного рівняння'],
  [/log/i, 'властивості логарифмів'],
  [/derivative/i, 'правила диференціювання'],
  [/integral|primitive/i, 'властивості первісної та інтеграла'],
  [/probab|count/i, 'правила комбінаторики та ймовірності'],
  [/similar/i, 'ознаки та властивості подібності'],
  [/trig|sin|cos|tan/i, 'тригонометричні співвідношення'],
  [/function|graph/i, 'властивості функції та її графіка'],
  [/progress/i, 'формули прогресії'],
  [/system/i, 'методи розв’язування систем рівнянь'],
  [/inequal/i, 'властивості нерівностей'],
];

function cleanText(value='') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function sentenceParts(value='') {
  const normalized = String(value).replace(/\n+/g, ' ').trim();
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+(?=[А-ЯІЇЄA-Z0-9\\])/u)
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractFind(question='') {
  const parts = sentenceParts(question);
  const explicit = parts.findLast?.((x) => /^(знайд|обчисл|визнач|скільки|якою|який|яка|чому|укаж|встанов)/iu.test(x));
  if (explicit) return explicit;
  const match = String(question).match(/((?:Знайдіть|Обчисліть|Визначте|Скільки|Якою|Який|Яка|Укажіть|Встановіть)[\s\S]*)$/iu);
  return cleanText(match?.[1] || 'визначити значення, яке вимагає умова задачі');
}

function extractGiven(question='') {
  const find = extractFind(question);
  const text = cleanText(question).replace(find, '').replace(/[.!?]+\s*$/, '').trim();
  return text || 'Використовуємо всі дані, наведені в умові.';
}

function chooseMethod(genome={}) {
  const source = [genome.concept, ...(genome.solution_path || []), ...(genome.hidden_relations || [])].join(' ');
  const hit = ACTION_LABELS.find(([re]) => re.test(source));
  const label = hit?.[1] || 'зв’язки між величинами з умови та послідовні математичні перетворення';
  return `Використовуємо ${label}, бо цей підхід безпосередньо пов’язує відомі дані з величиною, яку потрібно знайти.`;
}

function splitExplanation(explanation='') {
  const raw=String(explanation).trim();
  const lines=raw.split(/\n+/).map((x)=>x.trim()).filter(Boolean);
  const numbered=lines.filter((x)=>/^\d+[.)]\s+/.test(x));
  if(numbered.length>=2) return lines.map((x)=>x.replace(/^\d+[.)]\s+/, '').trim()).filter(Boolean);
  const sentences = sentenceParts(raw);
  return sentences.length ? sentences : [cleanText(raw)].filter(Boolean);
}

export function buildStructuredSolution({ question, explanation, genome, answerDisplay }) {
  const steps = splitExplanation(explanation);
  return {
    version: 1,
    given: extractGiven(question),
    find: extractFind(question),
    method: chooseMethod(genome),
    steps,
    why: 'Кожен крок використовує лише дані з умови або наслідки вже отриманих співвідношень. Тому знайдене значення безпосередньо відповідає тому, що потрібно визначити в задачі.',
    answer: cleanText(answerDisplay),
  };
}

export function solutionStepsForLegacy(solution) {
  if (!solution) return [];
  return [solution.method, ...(solution.steps || []), `Відповідь: ${solution.answer}`];
}
