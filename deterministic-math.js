import { QUESTION_ENGINE_VERSION, generateTrainingChoice, validateQuestion } from './question-engine.js';
export const GENERATOR_VERSION = QUESTION_ENGINE_VERSION;
export function generateDeterministicQuestion(topic='mixed', difficulty='середній', avoidList=[]){
  return generateTrainingChoice(topic,difficulty,avoidList);
}
export function validateDeterministicQuestion(question){return validateQuestion(question) && question.type==='choice';}
