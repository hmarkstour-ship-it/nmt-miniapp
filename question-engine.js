// Compatibility facade. The legacy monolithic generator was removed.
// All generation now runs through NMT Engine 3.0 structured family generators.
export {
  QUESTION_ENGINE_VERSION,
  generateByBlueprint,
  generateTrainingChoice,
  generateExamQuestions,
  validateQuestion,
  validateExamQuestions,
  questionSkeleton,
} from './nmt-engine/generation/question-generator.js';
