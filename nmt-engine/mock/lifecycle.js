import { MOCK_ATTEMPT_STATUSES } from './constants.js';

export function attemptExpiry(startedAt, durationSeconds) {
  const startMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startMs)) throw new Error('Invalid attempt started_at');
  return new Date(startMs + Math.max(0, Number(durationSeconds) || 0) * 1000);
}

export function remainingSeconds({ startedAt, expiresAt = null, durationSeconds, now = Date.now() }) {
  const endMs = expiresAt
    ? new Date(expiresAt).getTime()
    : attemptExpiry(startedAt, durationSeconds).getTime();
  if (!Number.isFinite(endMs)) return 0;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
}

export function isAttemptExpired(args) {
  return remainingSeconds(args) <= 0;
}

export function canAcceptAnswer({ status, ...timing }) {
  return status === MOCK_ATTEMPT_STATUSES.IN_PROGRESS && !isAttemptExpired(timing);
}
