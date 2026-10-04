import {
  QUESTION_ENGINE_VERSION,
  generateExamQuestions,
  validateExamQuestions,
} from './nmt-engine/generation/question-generator.js';

const SCORE_2026 = Object.freeze({
  5:100,6:108,7:115,8:123,9:131,10:134,11:137,12:140,13:143,14:145,15:147,16:148,
  17:149,18:150,19:151,20:152,21:155,22:159,23:163,24:167,25:170,26:173,27:176,28:180,
  29:184,30:189,31:194,32:200,
});

const LETTERS = ['А','Б','В','Г','Д'];

const MATCH_CODE_ALIASES = Object.freeze({
  A:'А', B:'Б', C:'В', D:'Г', E:'Д',
  'А':'А', 'Б':'Б', 'В':'В', 'Г':'Г', 'Д':'Д',
});

function canonicalMatchCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return MATCH_CODE_ALIASES[code] || code;
}

function matchOptionByCode(question, code) {
  const target = canonicalMatchCode(code);
  return (question?.match_options || []).find((option) => canonicalMatchCode(option?.code) === target) || null;
}

function splitMatchingExplanation(question) {
  const raw = String(question?.explanation || '').trim();
  if (!raw) return [];
  const chunks = raw.split(/\s*;\s*/).map((part) => part.trim()).filter(Boolean);
  return chunks.length >= 3 ? chunks.slice(0, 3) : [];
}

function matchingPairExplanations(question, pairResults = []) {
  const chunks = splitMatchingExplanation(question);
  return ['0','1','2'].map((key, index) => {
    const rawCorrect = question?.correct_pairs?.[key];
    const option = matchOptionByCode(question, rawCorrect);
    const code = option?.code || canonicalMatchCode(rawCorrect);
    const label = option?.label || '';
    const left = question?.left?.[index] || `Пункт ${index + 1}`;
    const explanation = chunks[index]
      || `Для пункту ${index + 1} правильна відповідність — ${code}${label ? ` (${label})` : ''}.`;
    const result = pairResults[index] || null;
    return {
      row: index + 1,
      left,
      correct: code,
      correct_label: label,
      selected: result?.selected ?? null,
      is_correct: !!result?.is_correct,
      explanation,
    };
  });
}

function uaNumber(value, maxDigits = 6) {
  if (Number.isInteger(value)) return String(value);
  return Number(Number(value).toFixed(maxDigits)).toString().replace('.', ',');
}

export function generateNmtExam() {
  const questions = generateExamQuestions();
  validateNmtExam(questions);
  return questions;
}

export function validateNmtExam(questions) {
  return validateExamQuestions(questions);
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
    return ['0','1','2'].map((k,index)=>`${index+1}–${normalized[k] || '—'}`).join(', ');
  }
  const parsed = parseNumericAnswer(answer);
  return parsed === null ? 'Не відповіли' : uaNumber(parsed);
}

function correctAnswerDisplay(q) {
  if (q.type === 'choice') return `${LETTERS[q.correct_index]} · ${q.options[q.correct_index]}`;
  if (q.type === 'matching') return ['0','1','2'].map((k,index)=>{
    const option = matchOptionByCode(q, q.correct_pairs[k]);
    return `${index+1}–${option?.code || canonicalMatchCode(q.correct_pairs[k])}`;
  }).join(', ');
  return q.correct_display ?? uaNumber(q.correct_value);
}

export function gradeNmtExam(questions, answers = {}) {
  validateNmtExam(questions);
  let rawScore = 0;
  const review = [];
  const weak = new Map();

  for (let index = 0; index < questions.length; index += 1) {
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
      pairResults = ['0','1','2'].map((k) => {
        const option = matchOptionByCode(q, q.correct_pairs[k]);
        const correctCode = option?.code || canonicalMatchCode(q.correct_pairs[k]);
        return {
          row:Number(k)+1,
          selected:normalized[k],
          correct:correctCode,
          is_correct:canonicalMatchCode(normalized[k]) === canonicalMatchCode(correctCode),
        };
      });
      awarded = pairResults.filter((x)=>x.is_correct).length;
      correct = awarded === 3;
    } else if (q.type === 'short') {
      const parsed = parseNumericAnswer(answer);
      correct = parsed !== null && Math.abs(parsed - q.correct_value) <= 1e-9;
      awarded = correct ? 2 : 0;
    }

    rawScore += awarded;
    if (awarded < q.max_score) {
      const item = weak.get(q.topic) || {topic:q.topic,label:q.topic_label,lost:0,count:0};
      item.lost += q.max_score-awarded;
      item.count += 1;
      weak.set(q.topic,item);
    }

    review.push({
      number:q.number,
      type:q.type,
      topic:q.topic,
      topic_label:q.topic_label,
      question:q.question,
      options:q.options || null,
      left:q.left || null,
      match_options:q.match_options || null,
      diagram_svg:q.diagram_svg || null,
      user_answer:displayAnswer(q,answer),
      correct_answer:correctAnswerDisplay(q),
      is_correct:correct,
      score_awarded:awarded,
      max_score:q.max_score,
      pair_results:pairResults,
      pair_explanations:q.type === 'matching' ? matchingPairExplanations(q, pairResults) : null,
      explanation:Array.isArray(q.explanation_steps) && q.explanation_steps.length ? q.explanation_steps : q.explanation,
    });
  }

  return {
    raw_score:rawScore,
    max_score:32,
    scaled_score:SCORE_2026[rawScore] ?? null,
    passed_threshold:rawScore >= 5,
    weak_topics:[...weak.values()].sort((a,b)=>b.lost-a.lost || b.count-a.count),
    review,
  };
}

export function scoreToScale(rawScore) {
  return SCORE_2026[Number(rawScore)] ?? null;
}

export const NMT_EXAM_META = Object.freeze({
  year:2026,
  questions:22,
  choice:15,
  matching:3,
  short:4,
  maxRawScore:32,
  durationMinutes:60,
  minimumRawForScale:5,
  generatorVersion:QUESTION_ENGINE_VERSION,
});
