import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { createVisualSpec, renderVisual } from '../visuals/index.js';
import { LETTERS, randInt, shuffle, ua, uniqueStrings } from './utils.js';

export const CORE_ENGINE_VERSION = 40;
const BLUEPRINTS = new Map(QUESTION_BLUEPRINTS.map((x) => [x.id, x]));
const LABELS = Object.freeze({
  numbers:'Числа та дроби', percents:'Відсотки та пропорції', powers_roots:'Степені та корені', logarithms:'Логарифми',
  equations:'Рівняння', inequalities:'Нерівності', systems:'Системи рівнянь', functions:'Функції та графіки',
  progressions:'Прогресії', trigonometry:'Тригонометрія', calculus:'Похідна та інтеграл', probability_stats:'Ймовірність і статистика',
  planimetry:'Планіметрія', stereometry:'Стереометрія', word_problems:'Текстові задачі', mixed:'Змішані завдання НМТ',
});

export function questionSkeleton(text='') {
  return String(text).toLowerCase()
    .replace(/\\\([\s\S]*?\\\)/g, ' <math> ')
    .replace(/\d+(?:[.,]\d+)?/g, '#')
    .replace(/\s+/g, ' ').trim();
}

function meta(blueprintId, variant, extra = {}) {
  const bp = BLUEPRINTS.get(blueprintId) ?? {};
  return {
    blueprint_id: blueprintId,
    variant_key: `${blueprintId}:${variant}`,
    subtopic: bp.subtopic ?? null,
    skill: bp.skill ?? null,
    source_confidence: bp.source_confidence ?? 2,
    engine_version: CORE_ENGINE_VERSION,
    core_meta: {
      source: 'nmt-engine4-ai-hybrid',
      core_version: CORE_ENGINE_VERSION,
      model: 'question-genome-constraint-first-independent-solver',
      ...extra,
    },
  };
}

function attachVisual(visualInput) {
  if (!visualInput) return { visual_spec: null, diagram_svg: null };
  const spec = visualInput.type ? createVisualSpec(visualInput) : visualInput;
  return { visual_spec: spec, diagram_svg: renderVisual(spec) };
}

export function makeChoice(blueprintId, {
  topic, variant='base', question, correct, distractors, explanation,
  visual=null, difficulty='NMT HARD', coreMeta={},
}) {
  let options = uniqueStrings([correct, ...(distractors ?? [])]);
  let guard = 0;
  while (options.length < 5 && guard++ < 80) options = uniqueStrings([...options, ua(randInt(-50, 150))]);
  options = shuffle(options.slice(0, 5));
  const correctIndex = options.indexOf(String(correct));
  if (correctIndex < 0) throw new Error('Correct choice was lost');
  return {
    type:'choice', topic, topic_label:LABELS[topic] ?? topic, difficulty, question,
    options, correct_index:correctIndex, explanation, max_score:1,
    ...attachVisual(visual), question_skeleton:questionSkeleton(question),
    ...meta(blueprintId, variant, coreMeta),
  };
}

export function makeMatching(blueprintId, {
  topic, variant='base', question, left, options, correctPairs, explanation,
  visual=null, coreMeta={},
}) {
  return {
    type:'matching', topic, topic_label:LABELS[topic] ?? topic, difficulty:'NMT HARD', question,
    left, match_options:options.map((label, i) => ({ code:LETTERS[i], label:String(label) })),
    correct_pairs:correctPairs, explanation, max_score:3,
    ...attachVisual(visual), question_skeleton:questionSkeleton(question),
    ...meta(blueprintId, variant, coreMeta),
  };
}

export function makeShort(blueprintId, {
  topic, variant='base', question, correctValue, explanation,
  visual=null, answerHint='Введи число', coreMeta={},
}) {
  return {
    type:'short', topic, topic_label:LABELS[topic] ?? topic, difficulty:'NMT HARD', question,
    correct_value:Number(correctValue), correct_display:ua(correctValue), explanation,
    max_score:2, answer_hint:answerHint,
    ...attachVisual(visual), question_skeleton:questionSkeleton(question),
    ...meta(blueprintId, variant, coreMeta),
  };
}

export function validateQuestion(q) {
  if (!q || !q.question || !q.topic || !q.blueprint_id) return false;
  if (q.visual_spec && (!q.diagram_svg || q.visual_spec.metadata?.renderer !== 'nmt-engine4-hybrid-visual-v4')) return false;
  if (q.type === 'choice') return Array.isArray(q.options) && q.options.length === 5 && new Set(q.options).size === 5 && Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 5 && typeof q.explanation === 'string' && q.explanation.length > 0;
  if (q.type === 'matching') return Array.isArray(q.left) && q.left.length === 3 && Array.isArray(q.match_options) && q.match_options.length === 5 && new Set(q.match_options.map(x => x.label)).size === 5 && Object.values(q.correct_pairs ?? {}).length === 3;
  if (q.type === 'short') return Number.isFinite(q.correct_value);
  return false;
}
