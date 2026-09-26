# NMT Engine 3.0 — Stage 10: Calibration + Analytics

## Goal

Stages 1–9 make correctness deterministic and runtime delivery stable. Stage 10 adds the feedback loop that can learn from real student attempts **without changing the mathematical truth pipeline**.

The key rule is:

> Empirical data may influence difficulty, exposure and quality review, but it never changes the stored correct answer, solver result or grading contract.

## What Stage 10 adds

### 1. Unified item telemetry

A new `nmt_item_events` table receives one normalized row per answered bank item.

Training events include:

- offline bank item ID;
- topic / blueprint;
- correct vs wrong;
- selected choice index;
- response time;
- Stage 6 model difficulty.

Mock NMT events include:

- immutable attempt ID + question index;
- partial score for matching tasks;
- normalized score fraction `0..1`;
- an adjusted ability proxy based on the rest of the exam;
- the same item/topic/blueprint metadata.

Mock event keys are deterministic (`mock:<attempt>:<index>`), so re-finalizing an attempt cannot double-count telemetry.

Training requests now send a `clientAnswerId`; `user_answers` has a unique per-user index for it. A repeated network request therefore cannot increment progress or analytics twice.

### 2. Bayesian difficulty calibration

`nmt-engine/analytics/calibration.js` combines the existing Stage 6 model score with observed performance.

For each item:

- `raw_p` = observed mean score fraction;
- the Stage 6 score is converted into a prior success probability;
- a Beta-style prior with strength 12 smooths small samples;
- empirical difficulty is `100 × (1 - smoothed_p)`;
- confidence grows with sample size;
- empirical weight is capped at 85%;
- `blended_difficulty_score` is used by runtime selection when confidence is sufficient.

This prevents 3–5 early answers from suddenly reclassifying an item.

### 3. Discrimination signal

Mock attempts provide an adjusted ability proxy that excludes the item being evaluated as much as possible from the total-score proxy.

Stage 10 computes a Pearson item-score/ability correlation when enough mock observations exist. Negative discrimination is treated as a quality signal, not as proof that the item is wrong.

### 4. Quality flags

Current automatic flags:

- `insufficient_data`;
- `suspiciously_easy`;
- `suspiciously_hard`;
- `weak_discrimination`;
- `negative_discrimination`;
- `fast_guessing_signal`;
- `slow_response_signal`.

Status values:

- `collecting` — not enough data yet;
- `active` — no current quality warning;
- `review` — human review recommended;
- `quarantine` — severe empirical warning.

**Auto-quarantine is OFF by default.** To enable it deliberately:

```env
NMT_STAGE10_AUTO_QUARANTINE=true
```

Even with this switch enabled, Stage 10 only removes a flagged item from runtime selection. It does not edit its answer or content.

### 5. Calibration-aware runtime

Stage 8 selectors now call `effectiveDifficultyScore(item)`.

If an item has sufficiently confident Stage 10 calibration, the selector uses the blended empirical/model score. Otherwise it falls back to the immutable Stage 6 bank score.

Both training and 22-slot mock assembly use the same rule.

### 6. User learning analytics

The profile API now also returns `learning_analytics` based on normalized item events.

Per topic it reports:

- attempts;
- posterior mastery estimate;
- raw accuracy;
- confidence;
- last activity time.

A recency component gives the last 12 responses some extra weight while the Bayesian prior prevents tiny samples from looking certain.

### 7. Offline calibration rebuild

After real traffic has produced telemetry, run:

```bash
npm run nmt:stage10:calibrate
```

The job:

1. reads `nmt_item_events`;
2. rebuilds all item metrics deterministically;
3. upserts `nmt_item_calibration`;
4. records a row in `nmt_calibration_runs`;
5. exports a non-user-level snapshot to `generated/nmt-stage10-calibration-latest.json`.

On the next server boot, calibration rows are loaded into the Stage 8 runtime.

## Stage 10 files

```text
nmt-engine/analytics/
├─ constants.js
├─ statistics.js
├─ telemetry.js
├─ quality-flags.js
├─ calibration.js
├─ policy.js
├─ user-analytics.js
└─ index.js

scripts/rebuild-stage10-calibration.js
nmt-engine/examples/stage10-smoke-test.js
```

## Database additions

```text
nmt_item_events
nmt_item_calibration
nmt_calibration_runs
```

`user_answers` also gains:

```text
client_answer_id
selected_index
response_ms
```

## Important production note

The code path is implemented and synthetic calibration tests pass, but this package does **not** contain real empirical difficulty conclusions yet. Those only become meaningful after the deployed app collects a sufficiently large number of genuine attempts and the calibration rebuild is run.
