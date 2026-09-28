# NMT Engine 3.0 — Core Replacement Audit

## Why this replacement exists

The previous Stage 1–10 package added diversity, difficulty, offline-bank, runtime, mock-exam and analytics layers, but the actual mathematics factory still called the legacy monolithic `question-engine.js`, and the Stage 4 visual engine was not in the generation path.

This replacement fixes that architectural error.

## Runtime generation path now

```text
nmt-engine/generation/blueprint-generators.js
        ↓
structured parameters + exact answer + distractors
        ↓
nmt-engine/visuals/visual-engine.js (when a visual is required)
        ↓
validated raw question
        ↓
Stage 5 diversity + Stage 6 difficulty
        ↓
Stage 7 offline factory
        ↓
generated/nmt-question-bank-v1.json
        ↓
Stage 8 runtime / Stage 9 mock NMT / Stage 10 analytics
```

`question-engine.js` is now only a compatibility facade. It contains no legacy task generators or legacy SVG helper functions.

## Verified facts

- Core family generators: **32/32 blueprints** have real generator functions.
- Generator audit samples: **420** generated and validated across all supported answer formats.
- New visual engine sample checks: **114** visual questions rendered in the audit run.
- Typed visual renderers exercised: bar chart, circle angle, circle/rectangle, function graph, linked solids, rectangular prism, similar triangles, trapezoid, triangle.
- Runtime bank rebuilt from the new core: **690 items**.
- Runtime bank items produced by new core: **690/690**.
- Runtime bank typed visual specs: **226**.
- Legacy visual wrappers in runtime bank: **0**.
- Factory import of legacy `question-engine.js`: **0**.
- Blueprint profiler import of legacy `question-engine.js`: **0**.
- Mock NMT slot coverage: **22/22**.

## Hash proof

Original uploaded legacy `question-engine.js` SHA-256:

`9e91e4f4ff273e541eec93d469f35324dbb87d27ecc4e46bf408396f247103cb`

Core-replacement `question-engine.js` SHA-256:

`59f14c397f42703b5f1ccec4ff2594270cc0ba6995e37f0d3746188a657a2e29`

The file is no longer byte-for-byte the same.

## Regression verification

The following commands pass in this build:

```bash
npm run nmt:stage6:smoke
npm run nmt:stage7:smoke
npm run nmt:stage8:smoke
npm run nmt:stage9:smoke
npm run nmt:stage10:smoke
npm run nmt:core:audit
node --check server.js
node --check public/app.js
node --check public/nmt-exam.js
```

Stage 8 runtime smoke result after the rebuild:

- bank items: 690
- plain training items: 294
- visual training items: 170
- mock slots: 22/22
- 30/30 tested mock seeds assembled successfully

## Important scope note

This fixes the core wiring and replaces the legacy generation path. It does **not** mean the current 32 generator families are the final desired knowledge base. The next quality task is to expand each family/variant against the 462-reference Stage 1 dataset and manually audit generated question quality before scaling the bank to several thousand items.
