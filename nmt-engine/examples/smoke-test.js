import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTrainingChoice, generateExamQuestions, validateQuestion, validateExamQuestions } from '../../question-engine.js';
import { createBlueprintFamilyRegistry } from '../families/blueprint-families.js';
import { adaptQuestionEngineItem } from '../integration/question-engine-adapter.js';
import { createDiverseTrainingSession } from '../integration/diverse-training-generator.js';
import { auditExamDiversity } from '../integration/exam-diversity-audit.js';
import { validateGeneratedItem } from '../validation/generation-validator.js';
import { summarizeReferenceDataset } from '../reference/reference-index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const datasetPath = path.join(projectRoot, 'nmt-reference-dataset-v1.json');
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const referenceSummary = summarizeReferenceDataset(dataset);
if (referenceSummary.total !== 462) throw new Error(`Expected 462 Stage 1 records, got ${referenceSummary.total}`);

const registry = createBlueprintFamilyRegistry();
if (registry.size < 20) throw new Error(`Blueprint registry unexpectedly small: ${registry.size}`);

const raw = generateTrainingChoice('mixed', 'середній', []);
if (!validateQuestion(raw)) throw new Error('Existing question engine produced an invalid training question');
const normalized = adaptQuestionEngineItem(raw);
const validation = validateGeneratedItem(normalized);
if (!validation.ok) throw new Error(`Normalized item invalid: ${validation.errors.join('; ')}`);

const session = createDiverseTrainingSession({
  candidateCount: 12,
  diversityOptions: {
    minDiversityScore: 18,
    cooldown: { familyCooldown: 4, variantCooldown: 10, solutionPathCooldown: 4 },
  },
});

for (let i = 0; i < 6; i += 1) {
  const result = session.generate('mixed', 'середній');
  if (!validateQuestion(result.question)) throw new Error(`Diverse training item ${i + 1} invalid`);
}

const exam = generateExamQuestions();
validateExamQuestions(exam);
const audit = auditExamDiversity(exam);

console.log(JSON.stringify({
  ok: true,
  stage1Records: referenceSummary.total,
  blueprintFamilies: registry.size,
  trainingHistory: session.history.length,
  examQuestions: exam.length,
  examNearDuplicatePairs: audit.issueCount,
}, null, 2));
