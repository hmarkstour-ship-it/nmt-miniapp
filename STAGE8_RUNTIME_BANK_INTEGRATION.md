# NMT Engine 3.0 — Stage 8: Runtime Bank Integration

## Goal

Stage 8 connects the validated Stage 7 offline question bank to the live application.

The important runtime rule is now:

> Training and Mock NMT select prebuilt, validated questions from one offline bank. They do not generate a new mathematical task while the student is waiting.

The old deterministic generator remains in the codebase only as an explicit emergency fallback and is **disabled by default**.

## Runtime source

Default bank:

```text
generated/nmt-question-bank-v1.json
```

The Stage 8 consolidated runtime bank is built from four deterministic Stage 7 builds and deduplicated by SHA-256 content hash.

Current runtime bank:

- 646 valid unique questions;
- 505 single-choice;
- 44 matching;
- 97 short-answer;
- 323 plain single-choice tasks for ordinary training;
- 182 visual single-choice tasks;
- all 22 Mock NMT slots covered.

The bank can be rebuilt reproducibly with:

```bash
npm run nmt:bank:runtime-build
```

## Training flow

`POST /api/questions-batch` and `POST /api/generate-question` now use `OfflineQuestionBankRuntime`.

Selection considers:

- selected topic;
- requested difficulty target;
- Stage 6 continuous difficulty score;
- recent question history;
- structural similarity from Stage 5 fingerprints;
- current batch diversity;
- runtime exposure/use count;
- plain/visual training policy.

By default:

```env
NMT_TRAINING_VISUAL_MODE=plain
```

so the ordinary training screen uses tasks without diagrams, while the same bank still stores visual tasks for other modes.

The stored Stage 6 difficulty is not overwritten just because the UI requested another label. The API also returns `requested_difficulty` separately.

## Mock NMT flow

`POST /api/nmt/start` no longer calls the live exam generator in normal operation.

Stage 8 assembles 22 questions from the same offline bank according to `EXAM_SLOTS`:

- 1–15: single choice;
- 16–18: matching;
- 19–22: short answer.

The selector:

- fills scarce slots first;
- never reuses the same bank item twice inside one exam;
- penalizes repeated families/variants;
- uses Stage 6 difficulty fit for the slot position;
- checks Stage 5 structural diversity;
- tries several candidate exam assemblies and keeps the best one;
- avoids bank item IDs from the user's recent Mock NMT attempts when inventory permits.

The final 22-question object stays compatible with the existing grading and UI code.

## Similar task button

The `similar` mode of `/api/explain-more` now also selects another verified item from the offline bank first. It no longer creates a new mathematical question at request time unless emergency fallback is explicitly enabled.

AI can still be used for explanatory help (`simple` / `why_wrong`), but it does not determine the answer to bank questions.

## Moderation / reports

Static JSON does not mean a bad item is impossible to disable.

When an offline item is served in training, it is lazily mapped to the existing Postgres `question_bank` table using its stable `nmt3-...` ID and content hash.

Stage 8 adds:

- `offline_bank_id`;
- `content_hash`;
- `factory_version`.

When an item reaches the existing report threshold and is marked inactive in Postgres, its offline bank ID is also disabled in the in-memory runtime selector. On server startup, previously disabled offline IDs are loaded back into the runtime blocklist.

## Environment variables

```env
NMT_OFFLINE_BANK_PATH=generated/nmt-question-bank-v1.json
NMT_RUNTIME_FALLBACK=false
NMT_TRAINING_VISUAL_MODE=plain
```

`NMT_RUNTIME_FALLBACK=false` is intentional. With the default configuration, missing bank inventory returns an error instead of silently generating a new unreviewed task.

## Files

Stage 8 runtime modules:

```text
nmt-engine/runtime/
├─ constants.js
├─ bank-loader.js
├─ runtime-index.js
├─ training-selector.js
├─ mock-selector.js
├─ offline-bank-runtime.js
└─ index.js
```

Other Stage 8 files/changes:

```text
scripts/build-runtime-bank.js
nmt-engine/examples/stage8-smoke-test.js
generated/nmt-question-bank-v1.json
generated/nmt-question-bank-v1.audit.json
server.js
.env.example
package.json
```

## Verification

```bash
npm run nmt:stage6:smoke
npm run nmt:stage7:smoke
npm run nmt:stage8:smoke
node --check server.js
```

Stage 8 also has an HTTP smoke check: with database/auth variables intentionally empty, the training endpoints were started locally and returned only `source: "offline-bank"` questions from runtime version 8.
