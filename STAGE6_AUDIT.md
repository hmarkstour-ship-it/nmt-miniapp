# Stage 6 Audit — Difficulty Coverage

Audit target: current generator + NMT Engine 3.0 Difficulty Engine.

## Calibration source

- Stage 1 reference records: **462**
- Records with empirical `p_value`: **44**
- Remaining records use the stored difficulty band as a lower-confidence prior.

## Smoke-test result

The Stage 6 test samples all 32 blueprints, verifies scores stay in the `0–100` range, checks reference calibration, and verifies that the combined Stage 5 + Stage 6 selector can pick structurally different easy and hard candidates when such candidates exist.

## Coverage audit

A diagnostic run sampled **2560 generated items** (80 generation attempts for every registered blueprint).

The strongest current families were:

| Family | Typical score | Internal level | Note |
|---|---:|---|---|
| `short_stereometry_linked_solids` | ~78 | hard | genuinely multi-step spatial task |
| `short_parameter_roots` | ~64 | medium_hard / hard | parameter reasoning; strongest variant is rational unique-root |
| `circle_rectangle_geometry` | ~64 | medium_hard | strongest current single-choice family |
| `similar_triangles_ratio` | ~50 | medium_hard | useful medium/upper-medium task |
| `word_work_rate` | ~49 | medium | multi-step but not yet a hard family |

## Important finding

The current `question-engine.js` does **not** yet have full easy/medium/hard coverage for every topic. In particular, many families that were previously returned with the string `difficulty: 'складний'` are structurally closer to medium difficulty according to the new model. For example, the current cosine-theorem generator is usually a direct application of one theorem rather than a true multi-step hidden-relation problem.

This is exactly why Stage 6 exists: the app should not call a problem “hard” merely because a label says so.

## What Stage 7 must solve

The next Offline Question Factory should generate multiple difficulty-specific variants inside each important family. It should use `getParameterPolicy(target)` and reject candidates through `DifficultyController` before they enter the verified bank.

That means Stage 7 should fill the current coverage gaps instead of weakening Stage 6 thresholds just to make every existing family pass.
