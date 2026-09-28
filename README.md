# NMT Math Mini App — Clean Core v11

Telegram Mini App for NMT mathematics practice.

## Current runtime

- Core generator: v11
- Visual Engine: v3
- Offline runtime: v11
- Mock lifecycle: v11
- Reference dataset: 462 NMT reference records
- Runtime bank: 1,206 verified items

The retired `question-engine.js` and `deterministic-math.js` paths are removed.
The server imports `nmt-engine/generation/question-generator.js` directly.
The bank loader refuses an old bank with a mismatched core or visual version.

## Checks

```bash
npm install
npm run nmt:core:audit
npm run nmt:stage8:smoke
npm run nmt:stage9:smoke
npm start
```

`GET /api/knowledge/meta` exposes `core_engine_version`, `visual_engine_version`, and `runtime_version`, so a deployment can be verified without guessing.
