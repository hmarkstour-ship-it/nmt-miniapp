export function buildReferenceIndex(dataset) {
  const questions = Array.isArray(dataset) ? dataset : dataset?.questions;
  if (!Array.isArray(questions)) throw new Error('Reference dataset must contain a questions array');

  const byTopic = new Map();
  const bySkill = new Map();
  const byRepresentation = new Map();
  const bySolutionPath = new Map();

  const push = (map, key, item) => {
    const normalized = key ?? 'unknown';
    if (!map.has(normalized)) map.set(normalized, []);
    map.get(normalized).push(item);
  };

  for (const question of questions) {
    push(byTopic, question.topic, question);
    push(bySkill, question.skill, question);
    push(byRepresentation, question.representation, question);
    push(bySolutionPath, question.solution_path_hint, question);
  }

  return { questions, byTopic, bySkill, byRepresentation, bySolutionPath };
}

export function summarizeReferenceDataset(dataset) {
  const index = buildReferenceIndex(dataset);
  return {
    total: index.questions.length,
    topics: Object.fromEntries([...index.byTopic].map(([key, items]) => [key, items.length])),
    skills: Object.fromEntries([...index.bySkill].map(([key, items]) => [key, items.length])),
    representations: Object.fromEntries([...index.byRepresentation].map(([key, items]) => [key, items.length])),
    solution_paths: Object.fromEntries([...index.bySolutionPath].map(([key, items]) => [key, items.length])),
  };
}
