# Record of Interview

A short browser game for COMP4020 crit 5. A man is dead at the foot of a
stairwell, you are the one in the chair, and everything you say is typed onto
the file in front of you.

Static site: HTML, CSS and TypeScript on Astro, built to `dist/` and deployed to
GitHub Pages. No backend, no image assets — the desk grain, the paper fibre and
the ink-bleed on the stamps are all drawn in CSS and SVG.

## What's where

| Path | What it is |
| --- | --- |
| `src/lib/story.ts` | The graph: passages, answers, what each answer puts on the record, and what the interrogator says when two of them collide. Content only, no logic. |
| `src/lib/interrogation.ts` | The engine: claim store, collision check, suspicion counter, transcript, ending resolver. No DOM. |
| `src/lib/interrogation.test.ts` | The engine's own tests, against a fixture graph rather than the real story, so rewriting a passage can't turn them red. |
| `src/scripts/game.ts` | The room. Renders a state, dispatches an answer, decides nothing. |
| `src/styles/global.css` | The desk and the page. |
| `spec/` | What the checks are for — see `spec/README.md`. |

## Working in here

```sh
mise install         # the tested Node and pnpm for this template
pnpm install
pnpm dev             # local dev server
pnpm check           # typecheck, build, lint, and every test
pnpm check:evidence  # the process-evidence check CI runs before shipping
pnpm build           # produce dist/, which is what deploys
```

CI runs the same roster plus a links check, a secret scan, and the deploy —
none of which run while the repo is private. `pnpm check` is the faster loop
either way.

## The checks

`spec/invariants.test.ts` and `spec/a11y.test.ts` came with the harness.
`spec/crit-5.test.ts` is this brief's contract and retires with it.
`spec/contrast.test.ts` is new this week and carries forward: axe cannot compute
contrast under jsdom, so nothing was checking the palette until it existed.
