# NMT Engine 3.0 — Stages 2–8

This folder is an additive foundation placed on top of the current project.

## Modules

- `core/` — normalized engine types, registry, deterministic generation context
- `dsl/` — family/variant/item builders
- `families/` — family descriptors built from the current NMT blueprints
- `reference/` — helpers for analyzing the Stage 1 reference dataset
- `solver/` — deterministic solver registry and basic solvers
- `validation/` — schema, answer, distractor, and visual-aware checks
- `visuals/` — normalized visual specs and safe SVG validation
- `diversity/` — fingerprints, similarity, cooldowns, exposure, duplicate detection
- `difficulty/` — continuous 0–100 difficulty model, reference calibration, target controller, parameter policy
- `factory/` — seeded offline generation, profiling, coverage planning, bank validation/auditing
- `runtime/` — Stage 8 offline-bank loading, training selection, Mock NMT assembly, runtime blocklist/use tracking
- `selection/` — candidate filtering/ranking/selection
- `integration/` — adapters to the current `question-engine.js`

The project uses ESM (`"type": "module"` in `package.json`), so every file in this engine uses `import` / `export`.


## Stage 6 — Difficulty Engine

The engine no longer treats `легкий / середній / складний` as a cosmetic label. It scores generated items on a continuous 0–100 scale using a feature vector:

- logical steps
- hidden relations
- combined-topic load
- calculation load
- distractor strength
- visual reasoning
- formula obviousness / non-obviousness
- response format
- family/variant prior
- intrinsic generator prior

The structural score is then calibrated against Stage 1. When a P-value is available, reference hardness is `100 - P`; otherwise the reference difficulty band is used with lower confidence. The current Stage 1 dataset contains 44 P-value records, so psychometric evidence is used where it exists without pretending that every reference item has empirical calibration.

Public app targets remain `легкий`, `середній`, `складний`, but internally the model uses five bands: `easy`, `medium`, `medium_hard`, `hard`, `very_hard`.

Stage 6 remains the difficulty authority; Stage 8 now uses its stored scores during live bank selection.


## Stage 7 — Offline Question Factory

Stage 7 builds validated questions ahead of time instead of generating them in the live request path. Every accepted bank item passes the existing validators plus Stage 5 diversity and Stage 6 difficulty gates, receives deterministic content/skeleton hashes, and is tagged for training/plain-training/visual-training/Mock-NMT compatibility.

Run `npm run nmt:bank:build` to create an individual bank and `npm run nmt:stage7:smoke` for regression verification.


## Stage 8 — Runtime Bank Integration

Stage 8 wires the offline bank into the live server. Training batches, single replacement tasks, the similar-task action, and Mock NMT assembly now read from `generated/nmt-question-bank-v1.json` by default. Runtime generation is an opt-in emergency fallback only.

Run `npm run nmt:bank:runtime-build` to rebuild the consolidated runtime bank and `npm run nmt:stage8:smoke` to verify training selection, 22-slot mock assembly, repeat avoidance, moderation blocking, sanitization, and grading compatibility.
