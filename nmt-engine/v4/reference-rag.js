import fs from 'node:fs';
import path from 'node:path';

let cache = null;

function loadDataset(datasetPath = path.resolve('nmt-reference-dataset-v1.json')) {
  if (cache) return cache;
  const parsed = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  cache = parsed.questions ?? [];
  return cache;
}

function tokens(s='') {
  return new Set(String(s).toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, ' ').split(/\s+/).filter((x)=>x.length>2));
}
function jaccard(a,b){const A=tokens(a),B=tokens(b);const u=new Set([...A,...B]);if(!u.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/u.size;}

export function retrieveReferenceExamples({ topic, subtopic = '', skill = '', concept = '', limit = 8 } = {}) {
  return loadDataset().map((q) => {
    let score = 0;
    if (q.topic === topic) score += 5;
    if (subtopic && q.subtopic === subtopic) score += 3;
    score += jaccard(`${skill} ${concept}`, `${q.skill ?? ''} ${q.solution_path_hint ?? ''}`) * 3;
    if (q.classification_confidence === 'high') score += .3;
    return { q, score };
  }).sort((a,b)=>b.score-a.score).slice(0, limit).map(({q}) => ({
    id:q.id, year:q.year, topic:q.topic, subtopic:q.subtopic, skill:q.skill,
    format:q.format, representation:q.representation, solution_path_hint:q.solution_path_hint,
    steps_estimate:q.steps_estimate, raw_text:q.raw_text, text_skeleton:q.text_skeleton,
  }));
}

export function nmtSimilarityHeuristic(question, genome, references = []) {
  let score = 68;
  if (String(question?.question ?? '').length >= 55) score += 5;
  if (String(question?.question ?? '').length <= 360) score += 5;
  if ((genome?.steps ?? 0) >= 3) score += 6;
  if ((genome?.hidden_relations ?? []).length) score += 5;
  if (references.some((r)=>r.topic === genome?.topic)) score += 5;
  if (references.some((r)=>r.representation === genome?.representation)) score += 3;
  if (question?.type === 'choice' && question?.options?.length === 5) score += 3;
  return Math.min(100, score);
}
