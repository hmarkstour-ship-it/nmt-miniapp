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
  return cleanText(match?.[1] || 'Знайти значення, яке вимагає умова.');
}

function extractGiven(question='') {
  const find = extractFind(question);
  const text = cleanText(question).replace(find, '').replace(/[.!?]+\s*$/, '').trim();
  return text || 'Дані наведені в умові.';
}

function humanizeStep(value='') {
  let text = cleanText(value)
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^Використовуємо\s*:?\s*/iu, 'Беремо ')
    .replace(/^Підставляємо\s*:?\s*/iu, 'Маємо ')
    .replace(/^Отримуємо\s*:?\s*/iu, 'Звідси ')
    .replace(/^Обчислюємо\s*:?\s*/iu, 'Рахуємо ')
    .replace(/^Застосовуємо\s*:?\s*/iu, 'Тут працює ')
    .replace(/^За формулою\s*:?\s*/iu, 'Маємо за формулою ')
    .trim();

  if (!text) return '';
  if (!/[.!?)]$/.test(text) && !/\\\)$/.test(text)) text += '.';
  return text;
}

function splitExplanation(explanation='') {
  const raw = String(explanation).trim();
  if (!raw) return [];

  const chunks = raw
    .split(/\n+/)
    .flatMap((x) => sentenceParts(x))
    .map(humanizeStep)
    .filter(Boolean);

  const unique = [];
  for (const chunk of chunks) {
    if (/^Відповідь\s*:/iu.test(chunk)) continue;
    if (!unique.includes(chunk)) unique.push(chunk);
    if (unique.length >= 4) break;
  }
  return unique;
}

function fallbackSteps({ question, answerDisplay }) {
  const find = extractFind(question);
  return [
    humanizeStep(find),
    humanizeStep(`Тому шукане значення — ${cleanText(answerDisplay)}`),
  ].filter(Boolean);
}

export function buildStructuredSolution({ question, explanation, genome, answerDisplay }) {
  let steps = splitExplanation(explanation);
  if (!steps.length) steps = fallbackSteps({ question, answerDisplay });
  if (steps.length === 1 && cleanText(answerDisplay)) {
    steps.push(humanizeStep(`Звідси шукане значення — ${cleanText(answerDisplay)}`));
  }

  // Launch UI intentionally stays concise. We preserve the legacy fields only
  // for backward compatibility, but the product renders `steps` + `answer`.
  return {
    version: 2,
    given: extractGiven(question),
    find: extractFind(question),
    method: steps[0] || '',
    steps: steps.slice(0, 4),
    why: steps.at(-1) || '',
    answer: cleanText(answerDisplay),
  };
}

export function solutionStepsForLegacy(solution) {
  if (!solution) return [];
  return (solution.steps || []).slice(0, 4);
}
