import { round } from './statistics.js';

export function buildUserTopicAnalytics(events = [], { priorStrength = 6, priorMastery = 0.5 } = {}) {
  const byTopic = new Map();
  for (const event of events) {
    if (!Number.isFinite(Number(event?.score_fraction))) continue;
    const topic = event?.topic || 'mixed';
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push(event);
  }

  return [...byTopic.entries()].map(([topic, rows]) => {
    const scoreSum = rows.reduce((sum, e) => sum + Number(e.score_fraction), 0);
    const attempts = rows.length;
    const posterior = (scoreSum + priorStrength * priorMastery) / (attempts + priorStrength);
    const recent = [...rows]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 12);
    const recentAvg = recent.length
      ? recent.reduce((sum, e) => sum + Number(e.score_fraction), 0) / recent.length
      : posterior;
    const mastery = posterior * 0.72 + recentAvg * 0.28;
    return {
      topic,
      attempts,
      mastery: Math.round(mastery * 100),
      accuracy: Math.round((scoreSum / attempts) * 100),
      confidence: round(attempts / (attempts + 20), 4),
      last_activity_at: rows.map((e) => e.created_at).filter(Boolean).sort().at(-1) || null,
    };
  }).sort((a, b) => a.mastery - b.mastery || b.attempts - a.attempts);
}
