import { extractComplexityFeatures, structuralDifficultyScore } from './complexity-features.js';
import { clampDifficultyScore, scoreToDifficultyBand } from './difficulty-bands.js';

export function scoreDifficulty(item, {
  calibrator = null,
  maxReferenceWeight = 0.30,
} = {}) {
  const features = extractComplexityFeatures(item);
  const structuralScore = structuralDifficultyScore(features);
  const reference = calibrator?.estimate ? calibrator.estimate(item) : { score: null, confidence: 0, evidence: [] };

  let referenceWeight = 0;
  if (Number.isFinite(reference.score)) {
    referenceWeight = Math.min(maxReferenceWeight, 0.08 + (reference.confidence ?? 0) * 0.22);
  }

  const score = clampDifficultyScore(
    structuralScore * (1 - referenceWeight) + (Number.isFinite(reference.score) ? reference.score * referenceWeight : 0),
  );
  const rounded = Math.round(score * 10) / 10;

  return Object.freeze({
    score: rounded,
    band: scoreToDifficultyBand(rounded),
    structuralScore,
    referenceScore: Number.isFinite(reference.score) ? reference.score : null,
    referenceWeight: Math.round(referenceWeight * 1000) / 1000,
    referenceConfidence: reference.confidence ?? 0,
    features,
    calibrationEvidence: reference.evidence ?? [],
  });
}
