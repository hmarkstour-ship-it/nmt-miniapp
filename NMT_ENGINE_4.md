# NMT Engine 4.0 AI Hybrid

Production standard: **NMT HARD**. There are no user-facing easy/medium/hard modes.

## Runtime pipeline
Reference dataset → Question Genome → constraint-first generator → deterministic model/solver → distractors → semantic visual spec → Hybrid Visual Router → validators → Complexity Gate → Novelty Gate → NMT similarity → Quality Gate → offline bank → runtime selector → Telegram.

## Hybrid visuals
The semantic visual layer can route to SVG, Canvas, Three.js/WebGL, HTML, or TikZ. Telegram always receives a deterministic SVG fallback so the item is readable without extra client dependencies. `visual_bundle.renderer` records the preferred renderer and the semantic payload is preserved for richer clients.

## AI
AI is **offline/advisory**, never the mathematical judge. Configure `NMT_AI_ENDPOINT`, `NMT_AI_MODEL`, and optionally `NMT_AI_KEY`, then run `npm run nmt:v4:ai-review`. Planner/critic/wording/visual-director results are written to `generated/nmt-ai-review-latest.json`. Correct answers still come only from deterministic code.

## Commands
- `npm run nmt:v4:bank` — rebuild verified runtime bank.
- `npm run nmt:v4:audit` — hard audit for core/visual/runtime/bank.
- `npm run nmt:v4:ai-review` — optional offline AI QA.
- `npm start` — run server.

Open the Telegram Mini App URL with `?debug=1` to see Engine 4 metadata on questions.
