# The spec

Every deliverable's spec — what the markers consider when they judge whether
your work matches what was required — is published on the course website, and
this repo's name tells you which one applies: the course API maps repo prefixes
to deliverables, and the `start` course skill walks your agent through pulling
the right one. The brief poses the problem; the spec is the fixed contract. Read
both on the site before you plan or build.

The checks in this directory come in two kinds:

## Invariants (shipped, always on)

`invariants.test.ts` asserts things that are true of any good website, however
you build it and whatever the week's brief asks: a navigation landmark, exactly
one top-level heading, a document language, a real title, a meta description, an
`og:image` card, a mobile viewport, and alt text on images. They run against the
**built** site (`dist/`), so they check what actually ships. Keep them green;
don't delete them.

The description and the card are what a link to your site looks like when
someone shares it. The card check is presence only: a path that doesn't resolve
shows up in the course gallery, not as a red check, so look at the deployed head
when you add pages.

## Your spec tests (yours to write)

Turning the week's published spec into tests is your work, not the template's.
Some spec lines are mechanically checkable — assert those here, in your own test
file alongside the supplied ones (any `spec/*.test.ts` runs with `pnpm check`).
Some lines only a person can judge; leave those to the crit. There is no minimum
count: select the checks that protect your work's real promises, and test the
**contracts** — what the page must do, not how you built it — so the tests
survive a change of approach, or of stack.

Two kinds end up in here, and they have different lifespans:

- **contract tests** answer this week's published spec. They retire with the
  brief they answer, so they stay behind when the week does.
- **sensors** assert a standard you hold the agent to whatever the brief is. A
  sensor is harness, the same as a rule in `CLAUDE.md`, so it comes with you
  into next week's repo. Catching a recurring failure once and wiring it into
  `check` is the skilled move; re-prompting until it passes is the routine one.

By the end of semester the sensors you've accumulated are the clearest record
you have of what you've taught yourself to check for — worth citing in
`PROCESS.md` the week each one lands.

A green suite here is backpressure, not a mark: your tutor verifies what you
deployed against the published spec at the crit, and keeping your own tests
green is how you arrive with no surprises.

## This week: C5, "A game"

`crit-5.test.ts` is the contract test — it retires with this brief.
`a11y.test.ts` is a sensor, carried forward from crit 4.

How C5's seven spec lines were sorted:

| Spec line | Where it's answered |
| --- | --- |
| deployed and live at its Pages URL by the cutoff | CI `deploy` + the `ship` skill; nothing local can prove it |
| it can be lost — a wrong move, and play ends somewhere | **tested** — a reachable loss, a reachable non-loss, and no instant trapdoor |
| it teaches itself — no instructions on screen or off | **half tested** — the absence of tutorial prose is asserted over built `dist/` *and* `README.md`; whether the opening screen **invites** the first move is human-judged |
| a stranger reaches an ending inside five minutes | **proxied** — every passage reaches an ending within 12 choices, and the shortest run is longer than 2. Whether the writing *earns* those five minutes is human-judged |
| one rule has a focused automated test | satisfied by this file; the second half of the line — a change that came from **playing** — is process evidence, cited in `PROCESS.md` |
| the repo shows the process | `pnpm check:evidence` — commits, `PROCESS.md`, `reflections/crit-5.md` |
| you can account for how you directed the work | the crit itself; no test reaches it |

The graph tests import `../src/lib/story`, which doesn't exist yet. **They start
red on purpose** — red-to-green across the week is the work, and the commits
that turn each one green are what `PROCESS.md` should cite.

The contract they assume, so the tests survive a rewrite of every passage:

```ts
export interface Choice { readonly label: string; readonly to: string; }
export interface Passage {
  readonly id: string;
  readonly text: string;
  readonly choices: readonly Choice[];
  readonly ending?: "win" | "loss" | "finish";
}
export const START: string;
export const passages: Readonly<Record<string, Passage>>;
```
