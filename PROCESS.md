# Process overview

A reading-guide to how *Record of Interview* came together. Five commits, in the
order the work actually happened: engine, story, room, sensor, harness.

## What I built

A branching interrogation where the mechanic is staying consistent with your own
story. Every answer puts a claim on the record; later questions ask for the same
claim in different words; an answer that moves one gets caught, quoted back, and
costs a mark. Three marks and you are charged. At every ending the interrogator
reads the whole transcript back in your own words, with the contradictions
circled against each other in red. Eleven questions a run, four endings, and no
instructions anywhere — the opening screen is the first question.

## The moments that mattered

### 1. Putting the rule where the tests could reach it, and the prose where they couldn't

The published contract is a graph of `{ id, text, choices, ending? }`, which
says nothing about claims or suspicion. The obvious move was to bolt the claim
logic onto the graph. Instead the graph stayed content-only and additive
(`asserts`, `reply`, `fatal` are all optional), and every decision moved into
`interrogation.ts`, which takes the graph as an argument rather than importing
it. That last detail is what let the required test run against a four-question
fixture instead of the real interrogation — so I can rewrite any passage and the
engine tests cannot go red for a reason that isn't about the engine.

How I knew: `spec/crit-5.test.ts` went green on the graph commit without the
engine commit being touched, and vice versa.

[`2f54614...9611cd0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-harry1357/compare/2f54614...9611cd0)

### 2. The probe was lying, and every assertion still read plausibly

Scripting a playthrough over CDP, I waited for `#choices button` to exist after
each click. It always did — the *old* list is still in the DOM for the 110ms it
spends fading out. So the probe clicked the dying button, the app's own re-entry
guard swallowed it, and the run sat one step behind while reporting confident
numbers. It surfaced as "the long line never appeared", which looks exactly like
a broken typewriter.

The fix was in the probe, not the page: tag the current list, then wait for one
without the tag. What I did instead of just adding a sleep was write down *why*
the wrong wait looked right, in `CLAUDE.md`, next to the crit-4 note about
screenshots of viewports that were never tested. Same failure shape: a sensor
that reports success because it never looked.

Then I used it. Sampling the typed line every 70ms gave 16 growing prefixes —
evidence the typewriter types — and a click mid-line finished the whole beat
within 120ms.

[`846e6b3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-harry1357/commit/846e6b3)

### 3. A green check that was never looking, and the sensor that replaced it

`a11y.test.ts` disables axe's `color-contrast` rule, correctly: jsdom has no
layout, so every node comes back "incomplete" and an enabled rule is coverage
you don't have. I had read that note in `CLAUDE.md` and still shipped
`--ink-faint` at **3.01:1**, because it looked fine in a screenshot.

The routine fix is to darken the token. The one I took was to write
`spec/contrast.test.ts`, which reads the custom properties back out of the CSS
the *build emitted* and does the WCAG maths on the pairs the stylesheet claims.
I verified it red before green — restoring `#8a8171` fails it by name, token
and ratio — because a sensor I haven't seen fail is a sensor I don't trust.

It also asserts the *gap* between the transcript ink and the option ink. Both
can clear 4.5:1 and still have collapsed into each other, which would silently
destroy the one thing separating "on the page" from "about to be said", and
nothing else in the suite would notice.

[`d22d82e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-harry1357/commit/d22d82e)

### 4. "Always visible" is a claim about a scrolled page

The brief asks for a suspicion indicator that is always visible. Mine sat in the
file header and passed every check — at load. Two screens into a transcript it
had scrolled away, and no test I had could see that, because they all measure a
page that has never moved.

I caught it by reading the probe's own output rather than its assertions: the
run recorded `headVisible` at every step, and it was only true because I had
already made the header sticky. So I made the check standing — the scripted
playthrough now reports header visibility after every one of the eight answers,
at 390x844 as well as 1920x1080.

[`09d1972`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-harry1357/commit/09d1972)

## What the checks cover, and what they don't

`pnpm check` is green: 61 tests over 6 files. The graph contract, the engine
rule, the invariants, axe, and the palette.

Not covered, and verified by hand in Chrome over CDP instead: that the typewriter
types and a click skips it, that all four endings are reachable, that restarting
clears the record and the marks, that there is no horizontal overflow at 390px,
and that the reduced-motion path renders everything immediately. Those runs are
in the moments above.

Not covered by anything, and for the crit: whether the first contradiction is
discoverable, whether the pacing earns five minutes, and whether the voice holds.
