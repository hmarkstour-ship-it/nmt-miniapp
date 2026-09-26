# Stage 10 Patch Manifest

Base: `nmt-math-miniapp-stage1-9.zip`

## Added

```text
nmt-engine/analytics/constants.js
nmt-engine/analytics/statistics.js
nmt-engine/analytics/telemetry.js
nmt-engine/analytics/quality-flags.js
nmt-engine/analytics/calibration.js
nmt-engine/analytics/policy.js
nmt-engine/analytics/user-analytics.js
nmt-engine/analytics/index.js
nmt-engine/examples/stage10-smoke-test.js
scripts/rebuild-stage10-calibration.js
STAGE10_CALIBRATION_ANALYTICS.md
STAGE10_AUDIT.md
STAGE10_PATCH_MANIFEST.md
```

## Modified

```text
server.js
public/app.js
nmt-engine/index.js
nmt-engine/runtime/training-selector.js
nmt-engine/runtime/mock-selector.js
nmt-engine/runtime/offline-bank-runtime.js
package.json
.env.example
NMT_ENGINE_3_STAGE_STATUS.md
```

## Intentionally unchanged

- Stage 1 reference dataset and audit;
- Stage 2–7 correctness/generation engines;
- Stage 8 646-item runtime bank and bank audit;
- Stage 9 immutable snapshot / grading contract;
- official 22-slot matrix;
- NMT score conversion table.
