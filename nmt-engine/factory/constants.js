export const FACTORY_VERSION = 11;
export const BANK_SCHEMA_VERSION = '2.0';

export const DEFAULT_DIFFICULTY_MIX = Object.freeze({
  'легкий': 0.34,
  'середній': 0.46,
  'складний': 0.20,
});

export const DEFAULT_FACTORY_OPTIONS = Object.freeze({
  total: 120,
  seed: 73001,
  profileSamplesPerBlueprint: 18,
  candidateBatchSize: 12,
  maxAttemptsPerRequest: 90,
  diversityHistoryWindow: 4,
  maxPerSkeleton: 24,
  strictDifficulty: true,
  strictDiversity: true,
});
