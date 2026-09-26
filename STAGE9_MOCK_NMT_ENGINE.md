# NMT Engine 3.0 — Stage 9: Mock NMT Engine

## Goal

Stage 8 connected the offline question bank to the live app and proved that a valid 22-question mock can be assembled from the shared bank.

Stage 9 turns that path into a production attempt engine. The important rule is now:

> A Mock NMT attempt is an immutable, versioned snapshot. Its questions, timer, autosaves and final grade are controlled by the server, and the same attempt can be safely resumed or retried without silently changing its variant.

## What Stage 9 adds

### 1. Immutable attempt snapshot

Every new attempt stores:

- `mock_engine_version = 9`;
- Stage 8 `runtime_version`;
- bank schema/factory versions;
- exact 22-question JSON snapshot;
- SHA-256 `question_snapshot_hash`;
- assembly metadata and hashed assembly seed;
- exact expiry time.

The snapshot hash includes the grading-critical fields, including correct answers. A stored attempt whose questions no longer match the original hash is rejected instead of being graded.

This means rebuilding `generated/nmt-question-bank-v1.json` cannot change an exam that a student already started.

### 2. Server-authoritative timer

The 60-minute limit is no longer only a browser countdown.

The database stores `expires_at`. The server:

- calculates remaining time from the attempt record;
- refuses answer changes after expiry;
- automatically finalizes an expired attempt from the answers that reached the server before the deadline;
- returns an expired result on resume;
- re-syncs the browser timer when the app becomes visible again.

Changing the local device clock does not extend the attempt.

### 3. Idempotent start

The client creates a `clientSessionId` for a start request.

The database has a unique `(telegram_id, client_session_id)` index. If the network drops after the server creates the attempt, retrying the same request returns the same attempt instead of creating another 22-question variant.

The assembly seed is derived from the user/session pair, so one start session is stable.

### 4. Revision-safe autosave

Each question has its own answer revision.

If two autosave requests arrive out of order, the older revision is ignored. This prevents an older network response from overwriting a newer choice/typed value.

Stored fields:

- `answer_revisions`;
- `last_saved_at`;
- attempt-level `revision`.

### 5. Server-side answer normalization

The server normalizes answers before storage/grading:

- choice: only a valid option index;
- matching: only valid answer codes, with duplicate codes removed;
- short answer: trimmed bounded string.

The final answer map is normalized again immediately before grading.

### 6. Independent grading audit

`gradeNmtExam()` remains the official grader used by the app.

Stage 9 independently recomputes the raw score and checks:

- raw score;
- 32-point maximum;
- result review length;
- sum of awarded review points;
- 100–200 scale conversion.

A mismatch aborts finalization instead of persisting an inconsistent result.

A second SHA-256 `result_hash` binds:

- the immutable question snapshot;
- final normalized answers;
- final grading result.

### 7. Idempotent finish

Finishing the same attempt more than once returns the already stored result. Concurrent finalization is protected by a database row lock.

### 8. Correct-answer isolation

The database snapshot contains the full questions needed for deterministic grading, but active-attempt API payloads still pass through `sanitizeExamQuestions()`.

Before finish, the client does not receive:

- `correct_index`;
- `correct_pairs`;
- `correct_value`;
- `correct_display`;
- `explanation`.

## Stage 9 module

```text
nmt-engine/mock/
├─ constants.js
├─ snapshot.js
├─ answers.js
├─ lifecycle.js
├─ grading-audit.js
├─ contract.js
└─ index.js
```

Integration files:

```text
server.js
public/nmt-exam.js
nmt-engine/index.js
nmt-engine/examples/stage9-smoke-test.js
package.json
```

## Database migration

`initDb()` adds Stage 9 fields to `nmt_exam_attempts` with `IF NOT EXISTS`, so an existing Stage 8 database can be upgraded in place.

New columns:

```text
mock_engine_version
runtime_version
bank_schema_version
factory_version
question_snapshot_hash
result_hash
expires_at
last_saved_at
answer_revisions
revision
assembly_meta
client_session_id
```

It also creates the partial unique client-session index.

Old in-progress Stage 8 attempts are not mixed with Stage 9. They are abandoned when encountered; a Stage 9 attempt with a broken snapshot is marked invalid.

## Verification

```bash
npm run nmt:stage6:smoke
npm run nmt:stage7:smoke
npm run nmt:stage8:smoke
npm run nmt:stage9:smoke
node --check server.js
node --check public/nmt-exam.js
```

The Stage 9 smoke test covers snapshot integrity, mutation detection, answer normalization, out-of-order autosaves, server timer math, perfect grading, independent grading audit, result hashing and active-payload answer isolation.
