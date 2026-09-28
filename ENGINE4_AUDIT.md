# NMT Engine 4.0 AI Hybrid — Production Audit

## Runtime guarantees
- Core generator version: 40
- Runtime version: 40
- Visual Engine version: 4
- Production standard: NMT HARD
- User-facing easy/medium/hard modes: removed from active runtime selection
- Legacy `question-engine.js`: absent
- Legacy difficulty-band runtime: removed
- Offline bank is mandatory; runtime does not need AI or live generation for normal sessions

## Generator
- 32 native production blueprints
- Question Genome v1 on every generated item
- constraint-first structured generation
- deterministic answer generation
- distractors from modeled mistakes
- Candidate Factory + Complexity Gate + Novelty Gate + NMT similarity + Quality Gate

## Visual system
- Semantic Visual Spec
- preferred renderers: SVG, Canvas, Three.js/WebGL, TikZ
- Telegram-safe deterministic SVG fallback
- Visual Engine metadata attached to every visual item
- Debug metadata available with `?debug=1`

## AI integration
Optional offline/advisory layer only:
- AI planner
- AI critic
- AI wording editor
- AI visual director

AI never owns the mathematical answer. Configure `NMT_AI_ENDPOINT`, `NMT_AI_MODEL`, and optionally `NMT_AI_KEY`, then run `npm run nmt:v4:ai-review`.

## Verified runtime bank
Latest included build:
- 739 items
- 32/32 blueprints represented
- 95 structural skeletons
- 67 genome signatures
- 265 visual items
- renderer mix includes SVG / Canvas / Three.js / TikZ
- average quality score: 91.7
- average novelty score: 71.9
- average complexity score: 87.9
- all 22 Mock NMT slots covered

## Audit command
```bash
npm run nmt:v4:audit
```

Last audit passed:
- Core 40
- Visual 4
- Runtime 40
- 32 blueprints
- 22/22 mock slots
