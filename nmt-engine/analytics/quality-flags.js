import { DEFAULT_CALIBRATION_CONFIG } from './constants.js';

export function evaluateQualityFlags(metrics, config = DEFAULT_CALIBRATION_CONFIG) {
  const flags = [];
  const n = Number(metrics?.sample_count) || 0;
  const p = Number(metrics?.raw_p);
  const discrimination = Number(metrics?.discrimination);
  const discriminationN = Number(metrics?.discrimination_n) || 0;
  const medianMs = Number(metrics?.median_response_ms);

  if (n < config.minQualitySample) flags.push('insufficient_data');

  if (n >= config.minExtremeSample && Number.isFinite(p)) {
    if (p >= config.suspiciousEasyP) flags.push('suspiciously_easy');
    if (p <= config.suspiciousHardP) flags.push('suspiciously_hard');
  }

  if (discriminationN >= config.minDiscriminationSample && Number.isFinite(discrimination)) {
    if (discrimination < config.quarantineNegativeDiscrimination) flags.push('negative_discrimination');
    else if (discrimination < config.reviewNegativeDiscrimination) flags.push('weak_discrimination');
  }

  if (n >= config.minQualitySample && Number.isFinite(medianMs)) {
    if (medianMs <= config.fastResponseMs && Number.isFinite(p) && p < 0.55) flags.push('fast_guessing_signal');
    if (medianMs >= config.slowResponseMs) flags.push('slow_response_signal');
  }

  return flags;
}

export function calibrationStatus(flags = [], sampleCount = 0) {
  const set = new Set(flags);
  if (set.has('negative_discrimination')) return 'quarantine';
  if (set.has('suspiciously_easy') || set.has('suspiciously_hard') || set.has('weak_discrimination')) return 'review';
  if (Number(sampleCount) < DEFAULT_CALIBRATION_CONFIG.minQualitySample) return 'collecting';
  return 'active';
}
