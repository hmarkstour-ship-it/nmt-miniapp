import { DEFAULT_DIFFICULTY_MIX } from './constants.js';
import { eligibleBlueprintsForTarget } from './blueprint-profiler.js';

function normalizeMix(mix) {
  const entries = Object.entries(mix ?? DEFAULT_DIFFICULTY_MIX)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => [key, Number(value)]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) throw new Error('Difficulty mix must contain at least one positive weight');
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

function allocateCounts(total, mix) {
  const normalized = normalizeMix(mix);
  const rows = Object.entries(normalized).map(([target, weight]) => {
    const exact = total * weight;
    return { target, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  let assigned = rows.reduce((sum, row) => sum + row.count, 0);
  rows.sort((a, b) => b.remainder - a.remainder || a.target.localeCompare(b.target));

  let cursor = 0;
  while (assigned < total) {
    rows[cursor % rows.length].count += 1;
    cursor += 1;
    assigned += 1;
  }

  return Object.fromEntries(rows.map((row) => [row.target, row.count]));
}

function interleave(groups) {
  const output = [];
  const queues = groups.map((group) => [...group]);
  let remaining = queues.reduce((sum, queue) => sum + queue.length, 0);

  while (remaining > 0) {
    for (const queue of queues) {
      if (!queue.length) continue;
      output.push(queue.shift());
      remaining -= 1;
    }
  }
  return output;
}

function bestAvailableTarget(profile, remaining) {
  const candidates = Object.entries(remaining)
    .filter(([, count]) => count > 0)
    .sort((a, b) => {
      const scoreA = profile.routeScores?.[a[0]] ?? 0;
      const scoreB = profile.routeScores?.[b[0]] ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b[1] - a[1];
    });
  return candidates[0]?.[0] ?? null;
}

export function buildCoveragePlan({
  total,
  profiles,
  difficultyMix = DEFAULT_DIFFICULTY_MIX,
  topic = null,
  answerType = null,
  guaranteeBlueprintCoverage = true,
} = {}) {
  if (!Number.isInteger(total) || total <= 0) throw new Error('total must be a positive integer');
  if (!Array.isArray(profiles) || profiles.length === 0) throw new Error('profiles are required');

  const filtered = profiles.filter((profile) => {
    if ((profile.directEmissionRate ?? 1) <= 0) return false;
    if (topic && topic !== 'mixed' && profile.topic !== topic) return false;
    if (answerType && !profile.answerTypes.includes(answerType)) return false;
    return true;
  });

  if (!filtered.length) throw new Error('No blueprint profiles match the requested scope');

  const counts = allocateCounts(total, difficultyMix);
  const remaining = { ...counts };
  const groups = Object.fromEntries(Object.keys(counts).map((target) => [target, []]));

  // First pass: when the bank is large enough, give every generator family at
  // least one request and route it to the difficulty it can actually produce.
  if (guaranteeBlueprintCoverage && total >= filtered.length) {
    const targets = Object.keys(counts);
    const constrainedFirst = [...filtered].sort((a, b) => {
      const aEligible = targets.filter((target) => (a.routeScores?.[target] ?? 0) >= 0.10).length;
      const bEligible = targets.filter((target) => (b.routeScores?.[target] ?? 0) >= 0.10).length;
      if (aEligible !== bEligible) return aEligible - bEligible;
      const aBest = Math.max(...targets.map((target) => a.routeScores?.[target] ?? 0));
      const bBest = Math.max(...targets.map((target) => b.routeScores?.[target] ?? 0));
      return bBest - aBest || a.id.localeCompare(b.id);
    });

    for (const profile of constrainedFirst) {
      const target = bestAvailableTarget(profile, remaining);
      if (!target) break;
      groups[target].push({
        target,
        blueprintId: profile.id,
        topic: profile.topic,
        expectedType: profile.answerTypes[0] ?? null,
        routeScore: profile.routeScores?.[target] ?? 0,
        coverageSeed: true,
      });
      remaining[target] -= 1;
    }
  }

  // Second pass: fill the rest with round-robin requests from blueprints that
  // profile well for each target. This prevents one family from dominating.
  for (const [target, count] of Object.entries(remaining)) {
    if (count <= 0) continue;
    const eligible = eligibleBlueprintsForTarget(filtered, target);
    if (!eligible.length) throw new Error(`No eligible blueprints for target ${target}`);

    for (let index = 0; index < count; index += 1) {
      const profile = eligible[index % eligible.length];
      groups[target].push({
        target,
        blueprintId: profile.id,
        topic: profile.topic,
        expectedType: profile.answerTypes[0] ?? null,
        routeScore: profile.routeScores?.[target] ?? 0,
        coverageSeed: false,
      });
    }
  }

  const requests = interleave(Object.values(groups));
  if (requests.length !== total) throw new Error(`Coverage planner produced ${requests.length}/${total} requests`);

  return {
    total,
    difficultyCounts: counts,
    requests,
    blueprintCoverageRequested: new Set(requests.map((request) => request.blueprintId)).size,
  };
}
