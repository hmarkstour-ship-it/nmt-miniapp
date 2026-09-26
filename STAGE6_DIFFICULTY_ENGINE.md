# NMT Engine 3.0 — Stage 6: Difficulty Engine

## Goal

Make difficulty a measurable property of the mathematical task instead of a label copied onto a generated question.

The old runtime can currently generate a question and then return it with the requested `difficulty` string. That means the label itself does not guarantee that the mathematical structure changed. Stage 6 adds a separate correctness layer that scores the task first and can reject candidates that do not fit the requested level.

## Difficulty vector

Each normalized item is evaluated by:

1. logical step count;
2. hidden relations / non-explicit dependencies;
3. combined-topic load;
4. calculation load;
5. distractor strength;
6. visual reasoning load;
7. formula non-obviousness;
8. response format burden;
9. family / variant prior;
10. the generator's intrinsic difficulty prior.

The result is a continuous `difficulty.score` from 0 to 100 plus an internal band:

- `easy`
- `medium`
- `medium_hard`
- `hard`
- `very_hard`

The user-facing targets stay:

- `легкий` — primarily one direct formula/action;
- `середній` — usually 2–3 logical steps, possibly one intermediate result or hidden relation;
- `складний` — multi-step reasoning, stronger hidden relation/combination and stronger distractors.

## Stage 1 calibration

`reference-calibrator.js` reads the 462 reference tasks from Stage 1.

If `psychometrics.p_value` exists, hardness is derived as `100 - p_value`. There are currently 44 such records. For records without P-values, the stored reference difficulty band is used with lower statistical weight.

Calibration evidence is aggregated by:

- mapped reference skill;
- reference topic + answer format;
- representation + answer format;
- topic;
- answer format.

The reference prior is intentionally capped so that broad historical statistics cannot override the actual structure of a generated task.

## Files

`nmt-engine/difficulty/`

- `difficulty-bands.js`
- `reference-skill-map.js`
- `complexity-features.js`
- `reference-calibrator.js`
- `difficulty-model.js`
- `difficulty-controller.js`
- `parameter-policy.js`
- `candidate-selector.js`
- `difficulty-audit.js`
- `index.js`

Tests / diagnostics:

- `nmt-engine/examples/stage6-smoke-test.js`
- `nmt-engine/examples/stage6-coverage-audit.js`

## Important Stage 6 behavior

`DifficultyController.evaluate(item, target)` returns:

- whether the task fits the requested level;
- score 0–100;
- internal band;
- distance from the target range;
- target fit score;
- full feature vector;
- Stage 1 calibration evidence.

`selectDifficultyCandidate(...)` can combine the Stage 6 fit score with the Stage 5 Diversity Engine. This is the bridge needed by the next offline question factory, but Stage 6 does not modify the live UI/API yet.

## Verification

Run:

```bash
node nmt-engine/examples/smoke-test.js
node nmt-engine/examples/stage6-smoke-test.js
node nmt-engine/examples/stage6-coverage-audit.js
```
