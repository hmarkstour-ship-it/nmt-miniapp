# NMT Engine 3.0 — Stage 7: Offline Question Factory

## Goal

Stage 7 moves question creation out of the live request path. Instead of generating a new task while a student is waiting, the engine can build a validated question bank in advance.

Every candidate passes through the existing NMT Engine layers:

1. `question-engine.js` creates a raw candidate from a blueprint;
2. Stage 3 validates the raw/normalized task and answer structure;
3. Stage 5 checks recent structural diversity;
4. Stage 6 measures real difficulty and checks the requested target;
5. Stage 7 rejects exact content duplicates and limits repeated skeletons;
6. only accepted tasks are written to the bank.

The result is a single offline bank that can later serve both training and Mock NMT.

## Unified bank

Each stored item keeps the current runtime question format, so Stage 8+ can integrate it without rewriting the UI model.

`bank_meta.usage` marks where a task can be used:

- `training` — any single-choice task;
- `training_plain` — single-choice task without a diagram;
- `training_visual` — single-choice task with a diagram;
- `mock` — task can be used by the future Mock NMT selector.

This lets the project keep one database even when a simple training mode wants only non-visual tasks.

## Difficulty

The default build mix is:

- 34% `легкий`;
- 46% `середній`;
- 20% `складний`.

The requested label is stored only after Stage 6 confirms that the generated mathematical structure falls inside that target range. Stage 7 does not make a task harder by merely changing a label.

## Diversity and duplicate control

There are two separate controls:

- Stage 5 compares structural fingerprints over a recent history window, preventing the same family/variant/solution path from appearing too close together;
- Stage 7 computes SHA-256 content and skeleton hashes, rejects exact content duplicates, and limits how many times the same parameterized skeleton can appear in a bank.

The factory uses a short structural history instead of treating every repeated family as permanently invalid. This is important for a large offline bank where the same NMT skill must appear many times with different parameters.

## Reproducible builds

The legacy generators use `Math.random()`. Stage 7 wraps synchronous generation in a seeded PRNG, so the same factory seed and configuration produce the same sequence of question content hashes.

Default seed: `73001`.

## Blueprint profiling and routing

Before building the bank, Stage 7 samples each blueprint and records:

- emitted question type;
- variants;
- visual share;
- min/mean/max Stage 6 difficulty;
- acceptance/fit score for `легкий`, `середній`, `складний`;
- whether the blueprint emits its own ID or acts as a dispatcher.

The current `advanced_single_choice` blueprint is a dispatcher that returns questions from other concrete generators, so the bank contains 31 direct-emitting blueprint families even though `nmt-knowledge.js` contains 32 blueprint definitions.

The coverage planner tries to seed every direct generator when the requested bank is large enough and then fills the remaining quota by difficulty-aware round robin.

## Files

`nmt-engine/factory/`

- `constants.js`
- `seeded-rng.js`
- `content-fingerprint.js`
- `blueprint-profiler.js`
- `coverage-planner.js`
- `question-factory.js`
- `bank-item.js`
- `bank-builder.js`
- `bank-validator.js`
- `bank-audit.js`
- `bank-io.js`
- `index.js`

CLI:

- `scripts/build-nmt-bank.js`

Verification:

- `nmt-engine/examples/stage7-smoke-test.js`

Sample output:

- `generated/nmt-question-bank-stage7-sample.json`
- `generated/nmt-question-bank-stage7-sample.audit.json`

## Build commands

Default 120-item sample:

```bash
npm run nmt:bank:build
```

Custom bank:

```bash
node scripts/build-nmt-bank.js --total=500 --seed=73001 --easy=0.34 --medium=0.46 --hard=0.20 --out=generated/nmt-bank-500.json
```

Topic-only bank:

```bash
node scripts/build-nmt-bank.js --total=120 --topic=planimetry --out=generated/planimetry-bank.json
```

Smoke test:

```bash
npm run nmt:stage7:smoke
```

## Important

Stage 7 is still offline infrastructure. It does **not** replace the current live routes or UI yet. The generated bank is ready for the next integration stage, where training sessions and Mock NMT will select questions from the validated bank instead of generating them on demand.
