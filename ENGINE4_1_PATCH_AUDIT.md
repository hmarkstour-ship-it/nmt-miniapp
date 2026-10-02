# NMT Engine 4.1 — Quality & Diversity Patch

## What changed

### 1. Structured Solution Engine
Every generated item now carries a `solution` object with:
- what is given;
- what must be found;
- method and why it applies;
- step-by-step solution;
- why the result answers the exact question;
- final answer.

The Telegram training UI renders this as a structured full review after submission.

### 2. Math / KaTeX formatting
Engine 4.1 adds centralized mathematical formatting for generated text and answer options.
Compact algebra, geometry equalities, ratios and angles are converted into explicit KaTeX delimiters before they enter the offline bank.

### 3. Visual Engine v5
- geometry label placement was improved;
- angle arcs are built from actual ray directions;
- right-triangle altitude is constructed geometrically;
- a dedicated triangle-bisector renderer was added;
- derived/target values were removed from visuals where they could leak an answer;
- a semantic visual validator rejects suspicious answer leakage and invalid angle/length data.

### 4. Endless mixed training
Topic-specific training was removed from the Tests UI.
The Tests tab is now one endless mixed NMT stream.
The backend also forces the training endpoint to `mixed`, so this is not only a frontend change.
The current topic is revealed only in the solution/review after the answer.

### 5. Stronger anti-repeat selector
Runtime now applies stronger penalties for:
- exact question repetition;
- same skeleton;
- same genome signature;
- high structural similarity;
- same topic immediately repeated;
- same blueprint recently repeated;
- repeated topic/blueprint inside one prefetched batch.

### 6. Larger verified bank
Runtime bank rebuilt with wider parameter coverage:
- 1,303 verified items
- 32/32 blueprints
- 107 question skeletons
- 68 genome signatures
- 474 visual items
- 22/22 Mock NMT slots
- average quality score: 91.7

The long-term content target remains 200–300+ verified items per major topic with substantially more structural skeletons. Engine 4.1 adds the runtime behavior needed to prevent the larger bank from feeling repetitive, but additional native skeleton authoring is still a content-expansion task rather than something that should be faked by changing numbers only.

## Versions
- App: 4.1.0
- Core: 41
- Runtime: 41
- Visual Engine: 5
- Bank schema: 4.1

## Audit
`npm run nmt:v4:audit` passes with:
- 32 blueprints
- 1,303 bank items
- 22/22 mock slots
- average quality >= 85
