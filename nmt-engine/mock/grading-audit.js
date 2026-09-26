import { sha256 } from '../factory/content-fingerprint.js';

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/[−–—]/g, '-').replace(/\s+/g, '').replace(/%$/, '').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function expectedRawScore(questions, answers) {
  let raw = 0;
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const answer = answers?.[String(i)] ?? null;
    if (q.type === 'choice') {
      raw += Number(answer) === Number(q.correct_index) ? 1 : 0;
    } else if (q.type === 'matching') {
      const source = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
      for (const row of ['0', '1', '2']) raw += source[row] === q.correct_pairs?.[row] ? 1 : 0;
    } else if (q.type === 'short') {
      const parsed = parseNumber(answer);
      raw += parsed !== null && Math.abs(parsed - Number(q.correct_value)) <= 1e-9 ? 2 : 0;
    }
  }
  return raw;
}

export function auditGradeResult(questions, answers, result, { scoreToScale } = {}) {
  const errors = [];
  const expectedRaw = expectedRawScore(questions, answers);

  if (Number(result?.raw_score) !== expectedRaw) {
    errors.push(`raw_score_mismatch:${result?.raw_score}:${expectedRaw}`);
  }
  if (Number(result?.max_score) !== 32) errors.push(`max_score_mismatch:${result?.max_score}`);
  if (!Array.isArray(result?.review) || result.review.length !== questions.length) {
    errors.push(`review_length_mismatch:${result?.review?.length ?? 'null'}`);
  } else {
    const reviewSum = result.review.reduce((sum, item) => sum + (Number(item?.score_awarded) || 0), 0);
    if (reviewSum !== expectedRaw) errors.push(`review_score_sum_mismatch:${reviewSum}:${expectedRaw}`);
  }

  if (typeof scoreToScale === 'function') {
    const expectedScaled = scoreToScale(expectedRaw);
    if ((result?.scaled_score ?? null) !== expectedScaled) {
      errors.push(`scaled_score_mismatch:${result?.scaled_score}:${expectedScaled}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    expected_raw_score: expectedRaw,
  };
}

export function gradeResultHash({ snapshotHash, answers, result }) {
  return sha256({
    snapshot_hash: snapshotHash,
    answers,
    result: {
      raw_score: result?.raw_score ?? null,
      max_score: result?.max_score ?? null,
      scaled_score: result?.scaled_score ?? null,
      passed_threshold: result?.passed_threshold ?? null,
      weak_topics: result?.weak_topics ?? [],
      review: result?.review ?? [],
    },
  });
}
