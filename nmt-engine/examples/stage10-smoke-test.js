import assert from 'node:assert/strict';
import {
  ANALYTICS_VERSION,
  createTrainingTelemetry,
  createMockTelemetryEvents,
  calibrateItemEvents,
  buildCalibrationSnapshot,
  effectiveDifficultyScore,
  buildUserTopicAnalytics,
} from '../analytics/index.js';

function syntheticItemEvents({ itemId, modelDifficulty, p, n, topic = 'equations', responseMs = 20000 }) {
  const events = [];
  for (let i = 0; i < n; i += 1) {
    const correct = i < Math.round(n * p);
    events.push(createTrainingTelemetry({
      eventKey: `synthetic:${itemId}:${i}`,
      telegramId: 1000 + (i % 20),
      itemId,
      topic,
      blueprintId: `${topic}_synthetic`,
      isCorrect: correct,
      selectedIndex: correct ? 2 : (i % 5),
      responseMs: responseMs + (i % 7) * 1000,
      modelDifficultyScore: modelDifficulty,
      engineVersion: 10,
    }));
    events.at(-1).created_at = new Date(2026, 0, 1 + (i % 20)).toISOString();
  }
  return events;
}

assert.equal(ANALYTICS_VERSION, 10);
const medium = syntheticItemEvents({ itemId: 'item-medium', modelDifficulty: 50, p: 0.50, n: 120 });
const easy = syntheticItemEvents({ itemId: 'item-easy', modelDifficulty: 45, p: 0.96, n: 120, topic: 'numbers' });
const hard = syntheticItemEvents({ itemId: 'item-hard', modelDifficulty: 55, p: 0.10, n: 120, topic: 'geometry' });

const mediumCal = calibrateItemEvents(medium);
assert.ok(mediumCal.sample_count === 120);
assert.ok(mediumCal.blended_difficulty_score > 40 && mediumCal.blended_difficulty_score < 60);
assert.equal(mediumCal.status, 'active');

const easyCal = calibrateItemEvents(easy);
assert.ok(easyCal.quality_flags.includes('suspiciously_easy'));
assert.equal(easyCal.status, 'review');

const hardCal = calibrateItemEvents(hard);
assert.ok(hardCal.quality_flags.includes('suspiciously_hard'));
assert.equal(hardCal.status, 'review');

// Synthetic mock event contract including adjusted ability proxy.
const questions = [{
  id: 'mock-1',
  type: 'choice',
  topic: 'equations',
  blueprint_id: 'eq',
  max_score: 1,
  correct_index: 1,
  engine_version: 10,
  bank_meta: { difficulty_score: 42 },
  runtime_meta: { bank_item_id: 'mock-1' },
}];
const result = { raw_score: 1, max_score: 32, review: [{ score_awarded: 1, max_score: 1 }] };
const mockEvents = createMockTelemetryEvents({ attemptId: 77, telegramId: 5, questions, answers: { 0: 1 }, result });
assert.equal(mockEvents.length, 1);
assert.equal(mockEvents[0].event_key, 'mock:77:0');
assert.equal(mockEvents[0].score_fraction, 1);

const snapshot = buildCalibrationSnapshot([...medium, ...easy, ...hard, ...mockEvents]);
assert.equal(snapshot.item_count, 4);
assert.equal(snapshot.event_count, 361);

const item = { bank_meta: { difficulty_score: 20 }, runtime_calibration: mediumCal };
assert.equal(effectiveDifficultyScore(item), mediumCal.blended_difficulty_score);

const topics = buildUserTopicAnalytics([...medium.slice(0, 10), ...hard.slice(-10)]);
assert.equal(topics.length, 2);
assert.equal(topics[0].topic, 'geometry');
assert.ok(topics[0].mastery < topics[1].mastery);

console.log('Stage 10 smoke test OK');
console.log(JSON.stringify({
  medium: mediumCal,
  easy_flags: easyCal.quality_flags,
  hard_flags: hardCal.quality_flags,
  snapshot_statuses: snapshot.statuses,
  topics,
}, null, 2));
