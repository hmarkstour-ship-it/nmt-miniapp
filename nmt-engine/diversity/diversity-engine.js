import { CooldownManager } from './cooldown-manager.js';
import { ExposureController } from './exposure-controller.js';
import { calculateDiversityScore } from './diversity-score.js';
import { isExactStructuralDuplicate, findNearDuplicate } from './duplicate-detector.js';

export class DiversityEngine {
  constructor({
    minDiversityScore = 24,
    nearDuplicateThreshold = 0.86,
    cooldown = {},
    exposure = {},
  } = {}) {
    this.minDiversityScore = minDiversityScore;
    this.nearDuplicateThreshold = nearDuplicateThreshold;
    this.cooldownManager = new CooldownManager(cooldown);
    this.exposureController = new ExposureController(exposure);
  }

  evaluate(candidate, history = []) {
    const exactDuplicate = isExactStructuralDuplicate(candidate, history);
    const nearDuplicate = findNearDuplicate(candidate, history, this.nearDuplicateThreshold);
    const cooldown = this.cooldownManager.check(candidate, history);
    const exposure = this.exposureController.check(candidate, history);
    const diversityScore = calculateDiversityScore(candidate, history);
    const reasons = [];

    if (exactDuplicate) reasons.push('exact_structural_duplicate');
    if (nearDuplicate) reasons.push(`near_duplicate:${nearDuplicate.score.toFixed(3)}`);
    if (!cooldown.ok) reasons.push(...cooldown.reasons.map((reason) => `cooldown:${reason}`));
    if (!exposure.ok) reasons.push(...exposure.reasons.map((reason) => `exposure:${reason}`));
    if (diversityScore < this.minDiversityScore) reasons.push(`low_diversity_score:${diversityScore}`);

    return {
      accepted: reasons.length === 0,
      diversityScore,
      reasons,
      nearDuplicateScore: nearDuplicate?.score ?? null,
      cooldown,
      exposure,
    };
  }
}
