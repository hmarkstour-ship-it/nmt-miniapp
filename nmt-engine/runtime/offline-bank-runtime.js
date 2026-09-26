import { RuntimeBankIndex } from './runtime-index.js';
import { selectTrainingBatch, selectSimilarTraining } from './training-selector.js';
import { assembleMockExam } from './mock-selector.js';
import { RUNTIME_VERSION } from './constants.js';
import { shouldQuarantine } from '../analytics/policy.js';

export class OfflineQuestionBankRuntime {
  constructor(bank, { bankPath = null } = {}) {
    if (!bank?.items?.length) throw new Error('OfflineQuestionBankRuntime requires a non-empty bank');
    this.bank = bank;
    this.bankPath = bankPath;
    this.index = new RuntimeBankIndex(bank.items);
    this.usage = new Map();
    this.disabledIds = new Set();
    this.calibrations = new Map();
  }

  disable(itemOrId) {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
    if (id && this.index.byId.has(id)) this.disabledIds.add(id);
  }

  disableMany(ids = []) {
    for (const id of ids) this.disable(id);
  }

  enable(itemOrId) {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
    if (id) this.disabledIds.delete(id);
  }


  applyCalibrationRecords(records = [], { autoQuarantine = false } = {}) {
    let applied = 0;
    let quarantined = 0;
    for (const record of records) {
      const id = record?.item_id || record?.offline_bank_id || null;
      const item = id ? this.index.byId.get(id) : null;
      if (!item) continue;
      const calibration = {
        sample_count: Number(record.sample_count) || 0,
        raw_p: record.raw_p == null ? null : Number(record.raw_p),
        smoothed_p: record.smoothed_p == null ? null : Number(record.smoothed_p),
        model_difficulty_score: record.model_difficulty_score == null ? null : Number(record.model_difficulty_score),
        empirical_difficulty_score: record.empirical_difficulty_score == null ? null : Number(record.empirical_difficulty_score),
        blended_difficulty_score: record.blended_difficulty_score == null ? null : Number(record.blended_difficulty_score),
        confidence: record.confidence == null ? null : Number(record.confidence),
        discrimination: record.discrimination == null ? null : Number(record.discrimination),
        discrimination_n: Number(record.discrimination_n) || 0,
        quality_flags: Array.isArray(record.quality_flags) ? record.quality_flags : [],
        status: record.status || 'collecting',
        updated_at: record.updated_at || null,
      };
      item.runtime_calibration = calibration;
      this.calibrations.set(id, calibration);
      applied += 1;
      if (autoQuarantine && shouldQuarantine(calibration)) {
        this.disable(id);
        quarantined += 1;
      }
    }
    return { applied, quarantined };
  }

  markUsed(itemOrId) {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
    if (!id) return;
    this.usage.set(id, (this.usage.get(id) ?? 0) + 1);
  }

  pickTrainingBatch(options = {}) {
    const items = selectTrainingBatch(this.index, { ...options, usage: this.usage, disabledIds: this.disabledIds });
    for (const item of items) this.markUsed(item);
    return items.map((item) => this.decorate(item, {
      mode: 'training',
      requestedDifficulty: options.difficulty ?? 'середній',
    }));
  }

  pickSimilar(original, options = {}) {
    const canonical = original?.id ? (this.index.byId.get(original.id) || original) : original;
    const item = selectSimilarTraining(this.index, canonical, { ...options, usage: this.usage, disabledIds: this.disabledIds });
    if (!item) return null;
    this.markUsed(item);
    return this.decorate(item, {
      mode: 'similar',
      requestedDifficulty: options.difficulty ?? 'середній',
    });
  }

  assembleMock(slots, options = {}) {
    const result = assembleMockExam(this.index, slots, { ...options, usage: this.usage, disabledIds: this.disabledIds });
    for (const item of result.exam) this.markUsed(item);
    return {
      questions: result.exam.map((item) => this.decorate(item, { mode: 'mock' })),
      quality: result.quality,
    };
  }

  decorate(item, { mode, requestedDifficulty = null } = {}) {
    return {
      ...item,
      runtime_source: 'offline_bank',
      runtime_meta: {
        version: RUNTIME_VERSION,
        mode,
        bank_item_id: item.id,
        requested_difficulty: requestedDifficulty,
        stored_difficulty: item.difficulty,
        difficulty_score: item.bank_meta?.difficulty_score ?? null,
        calibrated_difficulty_score: item.runtime_calibration?.blended_difficulty_score ?? null,
        calibration_confidence: item.runtime_calibration?.confidence ?? null,
        calibration_status: item.runtime_calibration?.status ?? null,
      },
    };
  }

  getStats() {
    const active = (item) => !this.disabledIds.has(item.id);
    const slotCoverage = {};
    for (let slot = 1; slot <= 22; slot += 1) {
      slotCoverage[slot] = this.index.mockPool(slot).filter(active).length;
    }

    const topicCounts = {};
    for (const item of this.index.trainingPlain.filter(active)) {
      topicCounts[item.topic] = (topicCounts[item.topic] ?? 0) + 1;
    }

    return {
      runtime_version: RUNTIME_VERSION,
      schema_version: this.bank.schema_version ?? null,
      factory_version: this.bank.factory_version ?? null,
      item_count: this.bank.items.length,
      active_item_count: this.bank.items.filter(active).length,
      training_count: this.index.training.filter(active).length,
      training_plain_count: this.index.trainingPlain.filter(active).length,
      training_visual_count: this.index.trainingVisual.filter(active).length,
      topic_training_plain: topicCounts,
      mock_slot_coverage: slotCoverage,
      disabled_count: this.disabledIds.size,
      calibrated_count: this.calibrations.size,
      calibration_quarantine_count: [...this.calibrations.values()].filter((x) => x?.status === 'quarantine').length,
      bank_path: this.bankPath,
    };
  }
}
