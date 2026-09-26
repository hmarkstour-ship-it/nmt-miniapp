import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTION_BLUEPRINTS } from '../../nmt-knowledge.js';
import { generateByBlueprint } from '../../question-engine.js';
import { adaptQuestionEngineItem } from '../integration/question-engine-adapter.js';
import { DiversityEngine } from '../diversity/diversity-engine.js';
import {
  createReferenceDifficultyCalibrator,
  DifficultyController,
  scoreDifficulty,
  selectDifficultyCandidate,
} from '../difficulty/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const dataset = JSON.parse(fs.readFileSync(path.join(projectRoot, 'nmt-reference-dataset-v1.json'), 'utf8'));
const calibrator = createReferenceDifficultyCalibrator(dataset);

if (calibrator.recordCount !== 462) throw new Error(`Expected 462 reference records, got ${calibrator.recordCount}`);
if (calibrator.empiricalRecordCount < 40) throw new Error(`Expected psychometric calibration records, got ${calibrator.empiricalRecordCount}`);

const controller = new DifficultyController({ calibrator, tolerance: 3 });
const samples = [];
for (const blueprint of QUESTION_BLUEPRINTS) {
  for (let i = 0; i < 8; i += 1) {
    const raw = generateByBlueprint(blueprint.id);
    const item = adaptQuestionEngineItem(raw);
    const result = scoreDifficulty(item, { calibrator });
    if (!(result.score >= 0 && result.score <= 100)) throw new Error(`Invalid difficulty score for ${blueprint.id}`);
    samples.push({ item, result });
  }
}

function meanForFamily(family) {
  const rows = samples.filter((row) => row.item.family === family);
  return rows.reduce((sum, row) => sum + row.result.score, 0) / Math.max(1, rows.length);
}

const chartMean = meanForFamily('data_chart_reading');
const triangleCosMean = meanForFamily('triangle_cosine_nmt');
if (!(chartMean < triangleCosMean)) {
  throw new Error(`Difficulty ordering failed: chart=${chartMean.toFixed(1)} triangle=${triangleCosMean.toFixed(1)}`);
}

const mixedCandidates = [];
for (const blueprint of QUESTION_BLUEPRINTS) {
  if (!blueprint.formats?.includes('choice')) continue;
  for (let i = 0; i < 12; i += 1) mixedCandidates.push(adaptQuestionEngineItem(generateByBlueprint(blueprint.id)));
}

const diversityEngine = new DiversityEngine({
  minDiversityScore: 12,
  cooldown: { familyCooldown: 3, variantCooldown: 7, solutionPathCooldown: 3 },
});

const easyPick = selectDifficultyCandidate(mixedCandidates, 'легкий', { controller, diversityEngine, history: [] });
const hardPick = selectDifficultyCandidate(mixedCandidates, 'складний', { controller, diversityEngine, history: [] });

if (!easyPick.accepted) throw new Error(`Easy selector fell back at score ${easyPick.difficulty.difficulty.score}`);
if (!hardPick.accepted) throw new Error(`Hard selector fell back at score ${hardPick.difficulty.difficulty.score}`);
if (easyPick.difficulty.difficulty.score >= hardPick.difficulty.difficulty.score) {
  throw new Error('Difficulty selector did not separate easy and hard candidates');
}

console.log(JSON.stringify({
  ok: true,
  stage: 6,
  referenceRecords: calibrator.recordCount,
  empiricalPValueRecords: calibrator.empiricalRecordCount,
  generatedSamples: samples.length,
  chartDifficultyMean: Math.round(chartMean * 10) / 10,
  triangleCosDifficultyMean: Math.round(triangleCosMean * 10) / 10,
  easySelection: {
    family: easyPick.selected.family,
    variant: easyPick.selected.variant,
    score: easyPick.difficulty.difficulty.score,
    band: easyPick.difficulty.difficulty.band,
  },
  hardSelection: {
    family: hardPick.selected.family,
    variant: hardPick.selected.variant,
    score: hardPick.difficulty.difficulty.score,
    band: hardPick.difficulty.difficulty.band,
  },
}, null, 2));
