import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { returning, striking } from "./audio";

// The synthesis itself needs a browser and a pair of ears, and is checked over
// CDP. What is testable here is the decision of *when* a thing sounds --- which
// is pure, and is the difference between typing and a buzz.

describe("what sounds, and what doesn't", () => {
  it("never sounds a space", () => {
    for (const index of [0, 1, 2, 3, 30]) {
      expect(striking(" ", index), "the space bar has no typebar behind it").toBe(false);
    }
  });

  it("never sounds any other whitespace either", () => {
    expect(striking("\n", 0)).toBe(false);
    expect(striking("\t", 0)).toBe(false);
  });

  it("sounds one in every three characters that aren't spaces", () => {
    const sounded = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((index) => striking("a", index));
    expect(sounded).toEqual([0, 3, 6]);
  });

  it("counts the letters, not the positions", () => {
    // "a b c d" typed through: the spaces are silent and don't advance the
    // count, so the strikes land on letters rather than drifting off them.
    const line = "ab cd ef gh";
    const struck: string[] = [];
    let letters = 0;
    for (const character of line) {
      if (striking(character, letters)) struck.push(character);
      if (/\S/u.test(character)) letters += 1;
    }
    expect(struck).toEqual(["a", "d", "g"]);
    expect(struck.some((character) => character === " ")).toBe(false);
  });

  it("keeps a real line well under one sound per character", () => {
    const line = "The power went out on Kestrel Street at ten past ten.";
    let letters = 0;
    let sounds = 0;
    for (const character of line) {
      if (returning(character) || striking(character, letters)) sounds += 1;
      if (/\S/u.test(character)) letters += 1;
    }
    expect(sounds / line.length, "this many sounds per character reads as a buzz").toBeLessThan(0.4);
    expect(sounds, "and a line that sounds nothing at all isn't typing either").toBeGreaterThan(4);
  });
});

describe("the carriage", () => {
  it("goes at the end of a sentence and nowhere else", () => {
    for (const end of [".", "?", "!"]) expect(returning(end)).toBe(true);
    for (const mid of [",", ";", "—", "a", " ", "’"]) expect(returning(mid)).toBe(false);
  });
});

// --- the tape mark's ink ----------------------------------------------------
//
// The contrast sensor in spec/ checks ink on paper. This one can't: the mark is
// fixed to the viewport, so at 1920 it sits on the desk and at 390 --- where
// the page fills the screen --- it sits on the page. One colour, two grounds,
// and CLAUDE.md's standing note is that a token legible on one isn't
// necessarily legible on all of them.

function luminance(hex: string): number {
  const channel = (value: number): number => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function builtCss(): string {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
  return walk(resolve("dist"))
    .filter((path) => path.endsWith(".css"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("the tape mark is visible on both the grounds it lands on", () => {
  const css = builtCss();
  const token = (name: string): string => {
    const found = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
    expect(found, `--${name} is not in the built CSS`).toBeTruthy();
    return (found as RegExpMatchArray)[1];
  };

  // 3:1 is the floor for a graphical control (WCAG 1.4.11), not 4.5.
  for (const ground of ["desk", "paper"]) {
    it(`clears 3:1 on the ${ground}`, () => {
      const ratio = contrast(token("reel"), token(ground));
      expect(
        Number(ratio.toFixed(2)),
        `${token("reel")} on ${token(ground)} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(3);
    });
  }
});
