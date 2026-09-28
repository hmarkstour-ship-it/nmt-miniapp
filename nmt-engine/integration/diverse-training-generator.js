import { generateTrainingChoice, validateQuestion } from '../generation/question-generator.js';
import { adaptQuestionEngineItem } from './question-engine-adapter.js';
import { DiversityEngine } from '../diversity/diversity-engine.js';
import { SessionHistory } from '../diversity/session-history.js';
import { selectCandidate } from '../selection/candidate-selector.js';
import { validateGeneratedItem } from '../validation/generation-validator.js';

export function createDiverseTrainingSession({
  maxHistory = 100,
  candidateCount = 18,
  diversityOptions = {},
} = {}) {
  const history = new SessionHistory(maxHistory);
  const diversityEngine = new DiversityEngine(diversityOptions);

  function generate(topic = 'mixed', difficulty = 'середній') {
    const candidates = [];
    let guard = 0;

    while (candidates.length < candidateCount && guard < candidateCount * 5) {
      guard += 1;
      const raw = generateTrainingChoice(topic, difficulty, []);
      if (!validateQuestion(raw)) continue;
      const normalized = adaptQuestionEngineItem(raw);
      const validation = validateGeneratedItem(normalized);
      if (!validation.ok) continue;
      candidates.push(normalized);
    }

    if (candidates.length === 0) throw new Error('Could not create any valid training candidates');

    const selection = selectCandidate(candidates, history.recent(), diversityEngine);
    history.add(selection.selected);

    return {
      question: {
        ...selection.selected.source_question,
        diversity: {
          score: selection.evaluation.diversityScore,
          accepted: selection.evaluation.accepted,
          fallback: selection.usedFallback,
          fingerprint: selection.selected.fingerprint,
        },
      },
      normalized: selection.selected,
      evaluation: selection.evaluation,
      usedFallback: selection.usedFallback,
    };
  }

  return {
    generate,
    history,
    diversityEngine,
    reset() { history.clear(); },
  };
}
