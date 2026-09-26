import { MAX_SHORT_ANSWER_LENGTH } from './constants.js';

function normalizeChoice(question, answer) {
  if (answer === null || answer === undefined || answer === '') return null;
  const value = Number(answer);
  if (!Number.isInteger(value)) return null;
  const count = Array.isArray(question?.options) ? question.options.length : 0;
  return value >= 0 && value < count ? value : null;
}

function normalizeMatching(question, answer) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return {};
  const allowed = new Set((question?.match_options ?? []).map((x) => String(x?.code ?? '')));
  const out = {};
  const used = new Set();

  for (const row of ['0', '1', '2']) {
    const code = typeof answer[row] === 'string' ? answer[row].trim() : '';
    if (!code || !allowed.has(code) || used.has(code)) continue;
    out[row] = code;
    used.add(code);
  }
  return out;
}

function normalizeShort(answer) {
  if (answer === null || answer === undefined) return '';
  return String(answer).trim().slice(0, MAX_SHORT_ANSWER_LENGTH);
}

export function normalizeMockAnswer(question, answer) {
  if (!question) return null;
  if (question.type === 'choice') return normalizeChoice(question, answer);
  if (question.type === 'matching') return normalizeMatching(question, answer);
  if (question.type === 'short') return normalizeShort(answer);
  return null;
}

export function normalizeMockAnswers(questions = [], answers = {}) {
  const source = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const out = {};
  for (let i = 0; i < questions.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(source, String(i))) continue;
    out[String(i)] = normalizeMockAnswer(questions[i], source[String(i)]);
  }
  return out;
}

export function applyAnswerRevision({
  questions,
  answers = {},
  revisions = {},
  index,
  answer,
  revision,
}) {
  const i = Number(index);
  const nextRevision = Number(revision);
  if (!Number.isInteger(i) || i < 0 || i >= questions.length) {
    return { accepted: false, reason: 'invalid_index', answers, revisions };
  }
  if (!Number.isInteger(nextRevision) || nextRevision < 1) {
    return { accepted: false, reason: 'invalid_revision', answers, revisions };
  }

  const key = String(i);
  const previousRevision = Number(revisions?.[key]) || 0;
  if (nextRevision <= previousRevision) {
    return {
      accepted: false,
      stale: true,
      reason: 'stale_revision',
      previous_revision: previousRevision,
      answers,
      revisions,
    };
  }

  return {
    accepted: true,
    stale: false,
    reason: null,
    previous_revision: previousRevision,
    answers: {
      ...(answers && typeof answers === 'object' ? answers : {}),
      [key]: normalizeMockAnswer(questions[i], answer),
    },
    revisions: {
      ...(revisions && typeof revisions === 'object' ? revisions : {}),
      [key]: nextRevision,
    },
  };
}
