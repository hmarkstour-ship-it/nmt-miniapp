# NMT Engine 3.0 — Clean Core audit

This build removes the retired runtime path instead of wrapping it.

## Runtime guarantees

- Legacy `question-engine.js`: **deleted**.
- Legacy `deterministic-math.js`: **deleted**.
- `server.js` imports the structured generator directly.
- `nmt-exam-engine.js` now contains only exam grading/sanitization code; its old duplicate generators were removed.
- Visual Engine accepts typed visual specs only. `legacy_svg` is no longer supported.
- Runtime bank loader refuses a bank whose core/visual versions do not match the deployed engine.

## Current versions

- Core generator: **11**
- Visual Engine: **3**
- Runtime: **11**
- Mock lifecycle: **11**
- Bank schema: **2.0**

## Diversity audit

The generator now combines base families with structural alternatives rather than only changing numbers.
A 2,560-question sampling audit produced:

- 32 blueprints
- 95 variant keys
- 84 sampled question skeletons
- 15 typed visual renderer types

The consolidated runtime bank contains:

- 1,206 verified items
- 67 structural skeletons after global skeleton caps
- 76 variant keys
- 654 plain training items
- 233 visual training-compatible items
- coverage for all 22 mock-NMT slots

Run:

```bash
npm run nmt:core:audit
npm run nmt:stage8:smoke
npm run nmt:stage9:smoke
```
