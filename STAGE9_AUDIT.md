# NMT Engine 3.0 — Stage 9 Audit

Audit target: Stage 9 Mock NMT attempt contract on top of the Stage 8 runtime bank.

## Regression status

All existing engine smoke tests pass after Stage 9:

- Stage 6 Difficulty Engine: **PASS**
- Stage 7 Offline Question Factory: **PASS**
- Stage 8 Runtime Bank Integration: **PASS**
- Stage 9 Mock NMT Engine: **PASS**
- `node --check server.js`: **PASS**
- `node --check public/nmt-exam.js`: **PASS**

Stage 6 still sees:

- 462 Stage 1 reference records;
- 44 empirical P-value records.

Stage 1 protected files are byte-for-byte unchanged from the Stage 8 package. The consolidated Stage 8 runtime bank and its audit file are also byte-for-byte unchanged.

Stage 8 still sees:

- 646 runtime-bank items;
- 323 plain training items;
- 182 visual training items;
- all 22 Mock NMT slots covered;
- 30/30 tested mock seeds producing 30 distinct signatures.

## Stage 9 smoke result

Test attempt:

- 22 questions;
- 22 unique bank IDs;
- 15 choice + 3 matching + 4 short-answer via the existing Stage 8 assembler;
- assembly diversity issues: 0 in the smoke variant;
- unique families in the smoke variant: 22;
- perfect answer set: 32/32 raw;
- scaled score: 200/200.

## Integrity checks

Passed:

- a question snapshot survives JSON serialization/deserialization with the same SHA-256 hash;
- changing a stored correct answer changes the snapshot hash and invalidates the contract;
- all 22 question IDs must remain unique;
- correct answers/explanations are absent from the active client payload;
- result hashes are deterministic for the same snapshot + answers + result.

## Autosave checks

Passed:

- valid answers are normalized by question type;
- invalid choice indices become `null`;
- duplicate/invalid matching codes are discarded;
- short-answer whitespace is normalized;
- answer revision 2 is accepted;
- a later-arriving revision 1 is rejected as stale and cannot overwrite revision 2.

## Timer checks

Passed:

- server-side remaining-time calculation returns 1800 seconds at the halfway point of a 60-minute attempt;
- an attempt is expired immediately after `expires_at`;
- Stage 9 server code refuses post-expiry answer mutation and finalizes from server-stored answers.

## Grading checks

Passed:

- the existing grader returns 32 raw / 200 scaled for a perfect attempt;
- the independent Stage 9 audit recomputes the same raw score;
- intentionally corrupting the reported raw score is detected by the audit.

## Runtime boot check

The server was booted locally with database/auth/AI environment variables intentionally blank.

Result:

- the 646-item Stage 8 offline bank loaded;
- the server started successfully;
- no Stage 9 import/syntax/runtime initialization error occurred.

A real Postgres-backed HTTP lifecycle (`start → autosave → resume → expire/finish`) cannot be executed in this build environment without a configured `DATABASE_URL`. The migration and transaction paths are included and syntax-checked, but should also be exercised against the deployment database before production release.
