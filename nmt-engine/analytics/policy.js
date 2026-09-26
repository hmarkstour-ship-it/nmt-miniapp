import { clamp } from './statistics.js';

export function effectiveDifficultyScore(item) {
  const calibration = item?.runtime_calibration || item?.calibration || null;
  const calibrated = Number(calibration?.blended_difficulty_score);
  const confidence = Number(calibration?.confidence);
  if (Number.isFinite(calibrated) && Number.isFinite(confidence) && confidence >= 0.15) {
    return clamp(calibrated, 0, 100);
  }
  const stored = Number(item?.bank_meta?.difficulty_score);
  return Number.isFinite(stored) ? clamp(stored, 0, 100) : 50;
}

export function shouldQuarantine(calibration) {
  return calibration?.status === 'quarantine';
}
