export const ANALYTICS_VERSION = 10;
export const CALIBRATION_SCHEMA_VERSION = 'nmt-calibration-v1';

export const DEFAULT_CALIBRATION_CONFIG = Object.freeze({
  priorStrength: 12,
  confidenceHalfLife: 40,
  maxEmpiricalWeight: 0.85,
  minQualitySample: 40,
  minExtremeSample: 80,
  minDiscriminationSample: 30,
  quarantineNegativeDiscrimination: -0.08,
  reviewNegativeDiscrimination: 0.02,
  suspiciousEasyP: 0.95,
  suspiciousHardP: 0.15,
  slowResponseMs: 180000,
  fastResponseMs: 1800,
});
