# Stage 8 patch manifest

## New files

- `nmt-engine/runtime/constants.js`
- `nmt-engine/runtime/bank-loader.js`
- `nmt-engine/runtime/runtime-index.js`
- `nmt-engine/runtime/training-selector.js`
- `nmt-engine/runtime/mock-selector.js`
- `nmt-engine/runtime/offline-bank-runtime.js`
- `nmt-engine/runtime/index.js`
- `nmt-engine/examples/stage8-smoke-test.js`
- `scripts/build-runtime-bank.js`
- `generated/nmt-question-bank-v1.json`
- `generated/nmt-question-bank-v1.audit.json`
- `STAGE8_RUNTIME_BANK_INTEGRATION.md`
- `STAGE8_AUDIT.md`
- `STAGE8_PATCH_MANIFEST.md`

## Modified files

- `server.js`
- `nmt-engine/index.js`
- `package.json`
- `.env.example`
- `NMT_ENGINE_3_STAGE_STATUS.md`

## Unchanged architecture

- Stage 1 reference dataset remains unchanged.
- Existing training UI question shape remains compatible.
- Existing Mock NMT UI and grading functions remain compatible.
- Gemini is still available for post-answer explanatory help, but is not required to choose or solve bank questions.
