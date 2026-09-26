# NMT Engine 3.0 — Stage 7 Audit

Audit target: `generated/nmt-question-bank-stage7-sample.json`

Build configuration:

- 120 requested items
- seed `73001`
- difficulty mix 34% easy / 46% medium / 20% hard
- offline generation only

## Result

- Bank validation: **PASS**
- Generated items: **120 / 120**
- Unique exact content hashes: **120 / 120**
- Unique structural skeleton hashes: **42**
- Maximum reuse of one skeleton: **10**
- Direct blueprint families represented: **31 / 31**
- NMT mock slots with compatible items: **22 / 22**
- Topic groups represented: **15**

## Formats

- single choice: **71**
- matching: **12**
- short answer: **37**

## Difficulty

- легкий: **41**
- середній: **55**
- складний: **24**

All stored public difficulty labels passed the Stage 6 target range before acceptance.

Internal bands:

- easy: **40**
- medium: **48**
- medium_hard: **11**
- hard: **21**

Average Stage 6 difficulty score: **41.8 / 100**.

## Visual / training compatibility

- tasks containing a visual: **38**
- plain single-choice training tasks: **50**
- visual single-choice training tasks: **21**

The bank therefore supports a single shared source while allowing a future plain training selector to exclude diagram tasks.

## Choice answer-position distribution

- option 0: 18
- option 1: 11
- option 2: 14
- option 3: 15
- option 4: 13

No fixed correct-answer position is used.

## Diversity

Average Stage 5 diversity score for accepted sample items: **82.5 / 100**.

The factory also recorded rejected candidates during construction, including difficulty misses, recent structural collisions, and exact content duplicates. Those rejects are expected: Stage 7 deliberately over-generates candidates and stores only candidates that pass the configured gates.

## Regression checks

Passed:

```bash
node nmt-engine/examples/smoke-test.js
node nmt-engine/examples/stage6-smoke-test.js
node nmt-engine/examples/stage6-coverage-audit.js
node nmt-engine/examples/stage7-smoke-test.js
```

The Stage 7 smoke test additionally rebuilds the same bank configuration twice and verifies identical content-hash order for the same seed.
