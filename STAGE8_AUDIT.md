# NMT Engine 3.0 — Stage 8 Audit

Audit target: `generated/nmt-question-bank-v1.json` + Stage 8 runtime selectors.

## Runtime bank

- Bank validation: **PASS**
- Items: **646**
- Unique exact content hashes: **646 / 646**
- Direct-emitting blueprints represented: **31 / 31**
- Mock NMT slots covered: **22 / 22**
- Difficulty mismatches: **0**
- Unique structural skeleton hashes: **49**

### Formats

- choice: **505**
- matching: **44**
- short: **97**

### Stored public difficulty

- легкий: **256**
- середній: **288**
- складний: **102**

### Training compatibility

- plain choice: **323**
- visual choice: **182**
- topic groups represented: **15**

Every public training topic can supply a four-question plain buffer in the Stage 8 smoke test.

### Mock slot inventory

Every slot has compatible offline inventory. The narrowest slots are matching slots 16 and 17 with 3 unique compatible items each; other slots have larger pools.

## Runtime integration checks

Passed:

- training batch uses only bank items;
- training batch contains no duplicate item IDs;
- `plain` mode returns no diagram tasks;
- recent-history selection moves to other rows when inventory is available;
- disabled/moderated item IDs are excluded;
- 30 different Mock NMT seeds produced 30 distinct 22-question signatures;
- every generated mock passed the existing `validateExamQuestions` validator;
- every generated mock contained exactly 15 choice + 3 matching + 4 short-answer tasks;
- no item ID was reused inside one mock;
- a second test avoided all 22 item IDs from the immediately previous mock in the tested build;
- feeding all correct answers into the existing grader produced **32 raw / 200 scaled**;
- sanitized exam payloads contained no correct answers or explanations.

## Regression checks

Passed:

```bash
npm run nmt:stage6:smoke
npm run nmt:stage7:smoke
npm run nmt:stage8:smoke
node --check server.js
```

Stage 6 regression result still sees 462 Stage 1 reference records and 44 empirical P-value records.

## HTTP runtime check

The server was launched locally with Telegram, database and Gemini variables intentionally blank. The offline bank loaded successfully with 646 items, and:

- `/api/questions-batch` returned four offline-bank questions;
- `/api/generate-question` returned an offline-bank question;
- no live question generator was needed.

Mock NMT HTTP persistence still requires Postgres and Telegram authentication because attempts are stored in `nmt_exam_attempts`; its assembly/grading path is covered by the Stage 8 module smoke test.
