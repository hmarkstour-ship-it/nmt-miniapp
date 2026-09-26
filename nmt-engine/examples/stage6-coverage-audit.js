import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { generateByBlueprint } from '../../question-engine.js';
import { adaptQuestionEngineItem } from '../integration/question-engine-adapter.js';
import { createReferenceDifficultyCalibrator, scoreDifficulty } from '../difficulty/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const dataset = JSON.parse(fs.readFileSync(path.join(projectRoot, 'nmt-reference-dataset-v1.json'), 'utf8'));
const calibrator = createReferenceDifficultyCalibrator(dataset);

const rows = [];
for (const blueprint of QUESTION_BLUEPRINTS) {
  for (let i = 0; i < 80; i += 1) {
    const raw = generateByBlueprint(blueprint.id);
    const item = adaptQuestionEngineItem(raw);
    const difficulty = scoreDifficulty(item, { calibrator });
    rows.push({
      requestedBlueprint: blueprint.id,
      family: item.family,
      variant: item.variant,
      topic: item.topic,
      answerType: item.answer_type,
      score: difficulty.score,
      band: difficulty.band,
    });
  }
}

const byFamily = new Map();
for (const row of rows) {
  if (!byFamily.has(row.family)) byFamily.set(row.family, []);
  byFamily.get(row.family).push(row);
}

const summary = [...byFamily].map(([family, items]) => ({
  family,
  topic: items[0].topic,
  answerType: items[0].answerType,
  variants: [...new Set(items.map((item) => item.variant))].sort(),
  min: Math.min(...items.map((item) => item.score)),
  mean: Math.round((items.reduce((sum, item) => sum + item.score, 0) / items.length) * 10) / 10,
  max: Math.max(...items.map((item) => item.score)),
  hardShare: Math.round(items.filter((item) => item.score >= 56).length / items.length * 1000) / 10,
})).sort((a, b) => b.mean - a.mean);

console.log(JSON.stringify({
  referenceRecords: calibrator.recordCount,
  empiricalPValueRecords: calibrator.empiricalRecordCount,
  sampledItems: rows.length,
  families: summary,
}, null, 2));
