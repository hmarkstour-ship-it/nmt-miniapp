# Core Replacement Patch Manifest

## New

- `nmt-engine/generation/utils.js`
- `nmt-engine/generation/builders.js`
- `nmt-engine/generation/blueprint-generators.js`
- `nmt-engine/generation/question-generator.js`
- `nmt-engine/generation/index.js`
- `nmt-engine/visuals/renderers/svg-renderers.js`
- `scripts/audit-core-replacement.js`
- `CORE_REPLACEMENT_AUDIT.md`
- `CORE_REPLACEMENT_MANIFEST.md`

## Replaced / rewired

- `question-engine.js` — legacy monolith removed; now compatibility facade
- `nmt-engine/factory/question-factory.js` — direct import from new core generator
- `nmt-engine/factory/blueprint-profiler.js` — direct import from new core generator
- `nmt-engine/families/blueprint-families.js` — families now expose real generators
- `nmt-engine/integration/question-engine-adapter.js` — preserves typed visual specs
- `nmt-engine/factory/bank-item.js` — visual detection supports typed specs
- `nmt-engine/visuals/visual-engine.js` — typed renderer dispatch
- `nmt-engine/visuals/visual-spec.js` — typed visual contract
- `nmt-engine/visuals/visual-validator.js` — typed visual validation
- `nmt-engine/visuals/index.js`
- `nmt-engine/index.js`
- `nmt-engine/README.md`
- `nmt-knowledge.js`
- `package.json`

## Rebuilt data

- `generated/nmt-question-bank-v1.json`
- `generated/nmt-question-bank-v1.audit.json`
