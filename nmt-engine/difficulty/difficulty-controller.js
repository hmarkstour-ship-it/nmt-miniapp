import {
  difficultyDistance,
  normalizeDifficultyTarget,
  targetFitScore,
} from './difficulty-bands.js';
import { scoreDifficulty } from './difficulty-model.js';

export class DifficultyController {
  constructor({ calibrator = null, tolerance = 0, modelOptions = {} } = {}) {
    this.calibrator = calibrator;
    this.tolerance = Math.max(0, Number(tolerance) || 0);
    this.modelOptions = modelOptions;
  }

  evaluate(item, target = 'середній') {
    const targetProfile = normalizeDifficultyTarget(target);
    const difficulty = scoreDifficulty(item, {
      calibrator: this.calibrator,
      ...this.modelOptions,
    });
    const distance = difficultyDistance(difficulty.score, targetProfile);
    const accepted = difficulty.score >= targetProfile.minScore - this.tolerance
      && difficulty.score <= targetProfile.maxScore + this.tolerance;

    return Object.freeze({
      accepted,
      target: targetProfile,
      difficulty,
      distance: Math.round(distance * 10) / 10,
      fitScore: targetFitScore(difficulty.score, targetProfile),
    });
  }
}
