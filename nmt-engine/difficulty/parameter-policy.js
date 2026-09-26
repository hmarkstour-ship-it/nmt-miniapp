import { normalizeDifficultyTarget } from './difficulty-bands.js';

const POLICIES = Object.freeze({
  easy: Object.freeze({
    steps: [1, 2],
    hiddenRelationMax: 0.35,
    combinedTopicsMax: 0.35,
    calculationLoadMax: 0.48,
    preferredVisualReasoningMax: 0.60,
    distractorStrength: [0.25, 0.72],
    note: 'Одна основна формула або дія; зв’язок у задачі має бути явним.',
  }),
  medium: Object.freeze({
    steps: [2, 3],
    hiddenRelationMax: 0.68,
    combinedTopicsMax: 0.68,
    calculationLoadMax: 0.72,
    preferredVisualReasoningMax: 0.82,
    distractorStrength: [0.45, 0.90],
    note: '2–3 логічні кроки; допускається проміжний результат або один прихований зв’язок.',
  }),
  hard: Object.freeze({
    steps: [3, 4],
    hiddenRelationMin: 0.42,
    combinedTopicsMin: 0.25,
    calculationLoadMin: 0.40,
    distractorStrength: [0.62, 1.00],
    note: 'Багатокрокове розв’язання, прихований зв’язок/комбінація і сильні правдоподібні дистрактори.',
  }),
});

export function getParameterPolicy(target = 'середній') {
  const normalized = normalizeDifficultyTarget(target);
  const key = normalized.id === 'easy' ? 'easy' : normalized.id === 'hard' || normalized.id === 'very_hard' ? 'hard' : 'medium';
  return { ...POLICIES[key], target: normalized };
}
