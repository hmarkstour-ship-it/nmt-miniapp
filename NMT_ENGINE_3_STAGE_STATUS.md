# NMT Engine 3.0 — Stage 1–10 status

## Stage 1 — Reference Dataset

Present and protected. The reference dataset contains 462 records, including 132 visual records.

## Stage 2 — Core Engine / DSL / Families

Present under `nmt-engine/core`, `nmt-engine/dsl`, `nmt-engine/families`, and `nmt-engine/reference`.

## Stage 3 — Solver / Validator

Present under `nmt-engine/solver` and `nmt-engine/validation`.

## Stage 4 — Visual Engine

Present under `nmt-engine/visuals`.

## Stage 5 — Diversity Engine

Present under `nmt-engine/diversity`, `nmt-engine/selection`, and `nmt-engine/integration`.

## Stage 6 — Difficulty Engine

Provides deterministic 0–100 structural difficulty, bands, Stage 1 reference calibration and difficulty-aware candidate selection.

## Stage 7 — Offline Question Factory

Provides reproducible bulk generation, validation, duplicate control and one shared bank contract for training + mock NMT.

## Stage 8 — Runtime Bank Integration

The live app uses `generated/nmt-question-bank-v1.json` instead of generating mathematics while the user waits.

Current bank after the Core Replacement rebuild:

- 690 validated unique items;
- 294 plain training items;
- 170 visual training items;
- all 22 Mock NMT slots covered;
- 690/690 rows originate from the new structured core generator;
- 226 rows contain typed visual specs rendered by Visual Engine v2;
- 0 runtime visual rows use the legacy SVG wrapper.

## Stage 9 — Mock NMT Engine

Provides immutable 22-question attempt snapshots, server timer, revision-safe autosave, idempotent start/finish, grading audit and result hashes.

## Stage 10 — Calibration + Analytics

Present under `nmt-engine/analytics` and integrated into training answers, Mock NMT finalization and Stage 8 selectors.

Stage 10 adds:

- normalized item-level telemetry;
- idempotent training telemetry IDs;
- Bayesian empirical item difficulty;
- bounded model/empirical blending;
- mock-based discrimination signal;
- response-time and option-selection statistics;
- quality flags + review/quarantine statuses;
- calibration-aware training and mock selection;
- per-user topic mastery analytics;
- reproducible Postgres calibration rebuild job;
- optional runtime quarantine, OFF by default.

## Verification

```bash
npm run nmt:stage6:smoke
npm run nmt:stage7:smoke
npm run nmt:stage8:smoke
npm run nmt:stage9:smoke
npm run nmt:stage10:smoke
node --check server.js
node --check public/app.js
node --check public/nmt-exam.js
```

All commands above pass in the Stage 10 build environment.

## Engine roadmap status

The planned NMT Engine 3.0 stages 1–10 are now implemented in code.

The remaining work is operational rather than a new correctness stage: deploy Stage 10 migrations, collect real usage data, run calibration periodically, review flagged items, and tune thresholds only from sufficiently large samples.


## Core Replacement (post-Stage-10 correction)

The previous Stage 1–10 architecture still routed the offline factory through the legacy monolithic `question-engine.js`, while the Stage 4 visual engine was not actually used by generated questions. This has now been corrected.

- `nmt-engine/generation/` is the actual source of generated mathematics.
- `question-engine.js` is only a compatibility facade.
- Stage 7 factory and blueprint profiler import the new generator directly.
- Visual questions emit a typed `visual_spec` and are rendered through Visual Engine v2.
- The runtime bank was rebuilt from the corrected path.
- Use `npm run nmt:core:audit` to verify the wiring.
