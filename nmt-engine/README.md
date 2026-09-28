# NMT Engine 4.0 AI Hybrid

Active production modules:

- `v4/` — Question Genome, NMT HARD Complexity Gate, Candidate Factory, Novelty/Quality scoring, reference RAG, optional AI review.
- `generation/` — native deterministic generators for all 32 production blueprints.
- `solver/` — deterministic math helpers.
- `validation/` — structural/answer/distractor validation.
- `visuals/` — typed semantic Visual Engine v4 and SVG fallbacks.
- `factory/` — verified offline bank build.
- `runtime/` — no-live-generation runtime selection, anti-repeat and Mock NMT assembly.
- `mock/` — immutable attempt lifecycle and grading integrity.
- `analytics/` — telemetry and empirical calibration.

There are no easy/medium/hard production modes. Every bank item must pass the `NMT HARD` complexity gate.
Legacy difficulty-band modules and retired Stage 6–10 smoke files were removed from this build.
