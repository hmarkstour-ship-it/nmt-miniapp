# NMT Math Mini App — NMT Engine 4.0 AI Hybrid

Telegram Mini App for hard NMT-style mathematics practice.

Active runtime: **NMT Engine 4.0 AI Hybrid**.

- one production standard: `NMT HARD`
- 32 native blueprints
- Question Genome + constraint-first generation
- deterministic answers and validators
- offline verified question bank
- novelty / NMT similarity / quality gates
- semantic hybrid visuals with SVG Telegram fallback
- optional offline AI planner / critic / wording / visual review
- anti-repeat runtime and 22-slot Mock NMT assembly

See `NMT_ENGINE_4.md` and `ENGINE4_AUDIT.md`.

## Verify

```bash
npm install
npm run nmt:v4:audit
npm start
```

Add `?debug=1` to the Telegram Mini App URL to show Engine 4 metadata on questions.
