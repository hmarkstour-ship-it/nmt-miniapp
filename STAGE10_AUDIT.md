# NMT Engine 3.0 — Stage 10 Audit

Audit target: Calibration + Analytics on top of the Stage 9 Mock NMT Engine.

## Regression status

All engine smoke tests pass after Stage 10:

- Stage 6 Difficulty Engine: **PASS**
- Stage 7 Offline Question Factory: **PASS**
- Stage 8 Runtime Bank Integration: **PASS**
- Stage 9 Mock NMT Engine: **PASS**
- Stage 10 Calibration + Analytics: **PASS**
- `node --check server.js`: **PASS**
- `node --check public/app.js`: **PASS**
- `node --check public/nmt-exam.js`: **PASS**
- `node --check scripts/rebuild-stage10-calibration.js`: **PASS**

The server was also booted with DB/auth/AI variables intentionally disabled. The 646-item Stage 8 bank loaded and the server initialized without a Stage 10 import/runtime error.

## Protected artifacts

Compared with the Stage 9 package:

- `nmt-reference-dataset-v1.json`: **UNCHANGED** (`710c155ce3bbfaeb`…)
- `nmt-reference-dataset-v1-schema.json`: **UNCHANGED** (`ef339020096fb861`…)
- `STAGE1_AUDIT.md`: **UNCHANGED** (`ac980476bfbd5c8c`…)
- `build_dataset.py`: **UNCHANGED** (`e647c61b61fa9169`…)
- `generated/nmt-question-bank-v1.json`: **UNCHANGED** (`7e8d076813d2f0a2`…)
- `generated/nmt-question-bank-v1.audit.json`: **UNCHANGED** (`b1e7f271a647c047`…)

## Stage 10 synthetic calibration checks

The smoke test verifies:

- a 120-attempt item with 50% success remains near difficulty 50 and status `active`;
- a 120-attempt item with ~96% success is flagged `suspiciously_easy`;
- a 120-attempt item with ~10% success is flagged `suspiciously_hard`;
- Bayesian smoothing and model/empirical blending are deterministic;
- training telemetry normalizes selected option and response time;
- mock telemetry uses deterministic idempotent event keys;
- one-point mock telemetry receives an adjusted ability proxy;
- a multi-item calibration snapshot is deterministic;
- runtime difficulty policy prefers confident calibration and otherwise falls back to Stage 6;
- topic analytics distinguish a synthetic 0% topic from a synthetic 100% topic.

## Safety properties

- Stage 10 does not edit `correct_index`, `correct_pairs`, `correct_value`, solver output or Stage 9 result hashes.
- Empirical difficulty affects ranking only.
- Small samples are shrunk toward the Stage 6 prior.
- Empirical influence is capped.
- Automatic quarantine is disabled by default.
- Telemetry writes for Mock NMT are idempotent by attempt/question index.
- Training answer writes are idempotent when the Stage 10 client answer ID is supplied.

## What could not be verified here

No production `DATABASE_URL` was used. Therefore this build environment did **not** execute the Postgres migrations against the live database and did not calculate real-user item calibration.

After deployment, run the app once so `initDb()` creates the Stage 10 tables, collect real telemetry, then run:

```bash
npm run nmt:stage10:calibrate
```

Review `review`/`quarantine` items before enabling `NMT_STAGE10_AUTO_QUARANTINE=true`.
