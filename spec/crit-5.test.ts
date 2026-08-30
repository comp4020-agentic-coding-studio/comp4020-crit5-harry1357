import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { START, passages } from "../src/lib/story";
import type { Passage } from "../src/lib/story";

// C5 "A game" --- https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/
//
// These assert the CONTRACT, not the implementation: the story is a graph of
// passages and choices, and every claim below is about the shape of that graph
// rather than about any particular passage's prose. Rewrite the whole story and
// these still hold; swap Astro for something else and they still hold.
//
// The spec lines a person judges --- whether the opening screen *invites* the
// first move, whether the writing earns five minutes --- are named in
// spec/README.md. No test here pretends to cover them.

// --- the graph -------------------------------------------------------------

const ids = Object.keys(passages);

/** Passages reachable from START, by breadth-first walk. */
function reachable(): Set<string> {
  const seen = new Set<string>([START]);
  const queue = [START];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const choice of passages[id]?.choices ?? []) {
      if (!seen.has(choice.to)) {
        seen.add(choice.to);
        queue.push(choice.to);
      }
    }
  }
  return seen;
}

/** Fewest choices from `id` to any ending, or Infinity if it can't reach one. */
function stepsToEnding(id: string): number {
  const seen = new Set<string>([id]);
  let frontier = [id];
  let depth = 0;
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const current of frontier) {
      const passage = passages[current];
      if (!passage) continue;
      if (passage.ending) return depth;
      for (const choice of passage.choices) {
        if (!seen.has(choice.to)) {
          seen.add(choice.to);
          next.push(choice.to);
        }
      }
    }
    frontier = next;
    depth += 1;
  }
  return Number.POSITIVE_INFINITY;
}

const endings = (id: string): Passage["ending"] => passages[id]?.ending;

describe("the story graph is well formed", () => {
  it("has a start passage", () => {
    expect(passages[START], `START names "${START}", which isn't a passage`).toBeTruthy();
  });

  it("every choice points at a passage that exists", () => {
    for (const id of ids) {
      for (const choice of passages[id].choices) {
        expect(
          passages[choice.to],
          `"${id}" offers "${choice.label}" -> "${choice.to}", which doesn't exist`,
        ).toBeTruthy();
      }
    }
  });

  it("every passage is reachable from the start", () => {
    const live = reachable();
    const orphans = ids.filter((id) => !live.has(id));
    expect(orphans, "unreachable passages are writing nobody will ever read").toEqual([]);
  });

  it("has no dead ends that aren't endings", () => {
    const stuck = ids.filter((id) => passages[id].choices.length === 0 && !passages[id].ending);
    expect(stuck, "a passage with no choices and no ending strands the player").toEqual([]);
  });
});

describe("it can be lost", () => {
  // The spec line: "a wrong move is possible, and play ends somewhere --- a
  // win, a loss or a finish". A story you cannot lose is a brochure.
  it("at least one reachable ending is a loss", () => {
    const losses = [...reachable()].filter((id) => endings(id) === "loss");
    expect(losses.length, "no reachable loss: nothing is at stake").toBeGreaterThan(0);
  });

  it("at least one reachable ending is not a loss", () => {
    const wins = [...reachable()].filter(
      (id) => endings(id) === "win" || endings(id) === "finish",
    );
    expect(wins.length, "every path loses: the player can't succeed").toBeGreaterThan(0);
  });

  it("the losing ending takes a real choice to reach", () => {
    // Losing on the opening screen isn't a wrong *move*, it's a trapdoor.
    const losses = [...reachable()].filter((id) => endings(id) === "loss");
    expect(
      losses.includes(START),
      "the opening screen is itself a loss: play ends before the player chooses",
    ).toBe(false);
  });
});

describe("a stranger reaches an ending inside five minutes", () => {
  // A mechanical proxy for the human line: no path wanders forever, and the
  // shortest one isn't so short that there was never a game.
  const MAX_CHOICES_TO_ENDING = 12;

  it("every reachable passage can still reach an ending", () => {
    const stranded = [...reachable()].filter((id) => stepsToEnding(id) === Number.POSITIVE_INFINITY);
    expect(stranded, "these passages loop forever with no way out").toEqual([]);
  });

  it("no passage is more than a dozen choices from an ending", () => {
    for (const id of reachable()) {
      expect(stepsToEnding(id), `"${id}" is a long way from any ending`).toBeLessThanOrEqual(
        MAX_CHOICES_TO_ENDING,
      );
    }
  });

  it("the shortest run through the story is more than a couple of clicks", () => {
    const shortest = stepsToEnding(START);
    // Infinity would satisfy "> 2" on its own, so rule it out first.
    expect(Number.isFinite(shortest), "no ending is reachable from the start at all").toBe(true);
    expect(shortest, "the fastest ending arrives before the game does").toBeGreaterThan(2);
  });
});

// --- no instructions, on screen or off -------------------------------------

const DIST = resolve("dist");

function builtFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? builtFiles(path) : [path];
  });
}

// Phrases that only ever appear when a page is explaining itself. Deliberately
// phrase-shaped, not word-shaped: prose may legitimately say "rules" or
// "control", but "how to play" is always a tutorial.
const TUTORIAL = [
  /how to play/i,
  /\binstructions?\b/i,
  /\bhow it works\b/i,
  /\bobjective\s*:/i,
  /\byour goal is\b/i,
  /\bthe rules are\b/i,
  /\buse the (arrow|wasd)\b/i,
  /\bpress (the )?(space|enter|arrow)/i,
  /\bclick (here )?to (start|begin|play)/i,
  /\btutorial\b/i,
  /\bgetting started\b/i,
];

describe("it teaches itself", () => {
  const pages = builtFiles()
    .filter((path) => path.endsWith(".html"))
    .map((path) => ({
      name: relative(DIST, path).split(sep).join("/"),
      text: new JSDOM(readFileSync(path, "utf8")).window.document.body.textContent ?? "",
    }));

  it("built at least one page to check", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  for (const { name, text } of pages) {
    it(`${name} explains nothing`, () => {
      const found = TUTORIAL.filter((pattern) => pattern.test(text)).map(String);
      expect(found, "the opening screen has to do this work, not a paragraph").toEqual([]);
    });
  }

  it("the README doesn't stand in for the missing tutorial", () => {
    // "no instructions anywhere, on screen or off" --- the README is off-screen.
    const readme = readFileSync(resolve("README.md"), "utf8");
    const found = TUTORIAL.filter((pattern) => pattern.test(readme)).map(String);
    expect(found, "explaining the game in the README is still explaining it").toEqual([]);
  });
});
