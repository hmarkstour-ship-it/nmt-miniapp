import { BAND_CENTERS } from './difficulty-bands.js';
import {
  inferReferenceSkill,
  mapAnswerTypeToReferenceFormat,
  mapEngineTopicToReferenceTopic,
} from './reference-skill-map.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function recordHardness(record) {
  const p = Number(record?.psychometrics?.p_value);
  if (Number.isFinite(p) && p >= 0 && p <= 100) {
    return { score: 100 - p, weight: 1.0, empirical: true };
  }

  const center = BAND_CENTERS[record?.difficulty_band];
  if (Number.isFinite(center)) return { score: center, weight: 0.32, empirical: false };
  return null;
}

function addGroup(map, key, observation) {
  if (!key || !observation) return;
  if (!map.has(key)) map.set(key, { weightedSum: 0, weight: 0, count: 0, empiricalCount: 0 });
  const row = map.get(key);
  row.weightedSum += observation.score * observation.weight;
  row.weight += observation.weight;
  row.count += 1;
  if (observation.empirical) row.empiricalCount += 1;
}

function finalizeGroup(group) {
  if (!group || group.weight <= 0) return null;
  const empiricalShare = group.count ? group.empiricalCount / group.count : 0;
  const confidence = clamp(
    0.20 + Math.min(0.45, Math.log2(group.count + 1) * 0.07) + Math.min(0.35, empiricalShare * 0.8),
    0,
    1,
  );
  return {
    score: group.weightedSum / group.weight,
    confidence,
    count: group.count,
    empiricalCount: group.empiricalCount,
  };
}

export function createReferenceDifficultyCalibrator(dataset) {
  const records = Array.isArray(dataset) ? dataset : dataset?.questions;
  if (!Array.isArray(records)) throw new Error('Reference difficulty calibrator requires dataset.questions');

  const groups = {
    skill: new Map(),
    topicFormat: new Map(),
    representationFormat: new Map(),
    topic: new Map(),
    format: new Map(),
  };

  let empiricalRecords = 0;
  for (const record of records) {
    const observation = recordHardness(record);
    if (!observation) continue;
    if (observation.empirical) empiricalRecords += 1;

    addGroup(groups.skill, record.skill, observation);
    addGroup(groups.topicFormat, `${record.topic}|${record.format}`, observation);
    addGroup(groups.representationFormat, `${record.representation}|${record.format}`, observation);
    addGroup(groups.topic, record.topic, observation);
    addGroup(groups.format, record.format, observation);
  }

  function estimate(item = {}) {
    const topic = mapEngineTopicToReferenceTopic(item.topic);
    const format = mapAnswerTypeToReferenceFormat(item.answer_type);
    const representation = item.representation ?? null;
    const skill = inferReferenceSkill(item);

    const candidates = [
      { label: 'skill', key: skill, group: groups.skill, weight: 0.38 },
      { label: 'topic_format', key: topic && format ? `${topic}|${format}` : null, group: groups.topicFormat, weight: 0.25 },
      { label: 'representation_format', key: representation && format ? `${representation}|${format}` : null, group: groups.representationFormat, weight: 0.14 },
      { label: 'topic', key: topic, group: groups.topic, weight: 0.13 },
      { label: 'format', key: format, group: groups.format, weight: 0.10 },
    ];

    let weightedSum = 0;
    let weightSum = 0;
    let confidenceSum = 0;
    const evidence = [];

    for (const candidate of candidates) {
      if (!candidate.key) continue;
      const summary = finalizeGroup(candidate.group.get(candidate.key));
      if (!summary) continue;
      const effectiveWeight = candidate.weight * summary.confidence;
      weightedSum += summary.score * effectiveWeight;
      weightSum += effectiveWeight;
      confidenceSum += candidate.weight * summary.confidence;
      evidence.push({
        source: candidate.label,
        key: candidate.key,
        score: Math.round(summary.score * 10) / 10,
        confidence: Math.round(summary.confidence * 1000) / 1000,
        count: summary.count,
        empiricalCount: summary.empiricalCount,
      });
    }

    if (weightSum <= 0) return { score: null, confidence: 0, evidence: [] };
    return {
      score: Math.round((weightedSum / weightSum) * 10) / 10,
      confidence: Math.round(clamp(confidenceSum, 0, 1) * 1000) / 1000,
      evidence,
    };
  }

  return Object.freeze({
    recordCount: records.length,
    empiricalRecordCount: empiricalRecords,
    estimate,
  });
}
