import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A sensor, not a contract test: it carries forward, whatever next week asks.
//
// CLAUDE.md already says axe cannot judge contrast under jsdom --- no layout,
// no cascade, so `color-contrast` returns "incomplete" for every node and an
// enabled rule looks like coverage that isn't there. That left the palette
// checked by eye, which is how --ink-faint shipped this week at 3.01:1 and
// looked fine to me in a screenshot.
//
// So: read the tokens back out of the CSS the build actually emitted, and do
// the arithmetic. Reading the built file rather than the source means a value
// that gets minified, overridden or dropped fails here too, and renaming a
// token fails loudly instead of quietly skipping.

const DIST = resolve("dist");

function builtCss(): string {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
  return walk(DIST)
    .filter((path) => path.endsWith(".css"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

const css = builtCss();

/** The value of a custom property as the build emitted it. */
function token(name: string): string {
  const found = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`));
  expect(found, `--${name} is not in the built CSS under that name`).toBeTruthy();
  return (found as RegExpMatchArray)[1];
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const full =
    hex.length === 4
      ? `#${[1, 2, 3].map((i) => hex[i].repeat(2)).join("")}`
      : hex;
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// Each row is a claim the stylesheet makes: this ink is used for this kind of
// text on this ground. WCAG AA is 4.5:1 for body text, 3:1 for large text and
// for the graphics a control's meaning depends on.
const CLAIMS: ReadonlyArray<readonly [string, string, string, number]> = [
  ["--ink on --paper (the transcript)", "ink", "paper", 4.5],
  ["--ink-soft on --paper (the case tab)", "ink-soft", "paper", 4.5],
  ["--ink-faint on --paper (the file's own metadata)", "ink-faint", "paper", 4.5],
  ["--ink-option on --paper (what you're about to say)", "ink-option", "paper", 4.5],
  ["--red on --paper (marks, and the status stamp)", "red", "paper", 3],
  ["--ink on --paper-shade (an option under the pointer)", "ink", "paper-shade", 4.5],
];

describe("the palette, since axe can't", () => {
  it("found the built stylesheet to read", () => {
    expect(css.length, "no CSS in dist/ --- run the build first").toBeGreaterThan(500);
  });

  for (const [what, foreground, background, floor] of CLAIMS) {
    it(`${what} clears ${floor}:1`, () => {
      const ratio = contrast(token(foreground), token(background));
      expect(
        Number(ratio.toFixed(2)),
        `${token(foreground)} on ${token(background)} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(floor);
    });
  }

  it("keeps the two inks far enough apart to read as two registers", () => {
    // The answers are meant to look like they aren't on the page yet. If the
    // option ink drifts to the transcript ink, that distinction is gone --- and
    // nothing else in the suite would notice.
    const record = contrast(token("ink"), token("paper"));
    const options = contrast(token("ink-option"), token("paper"));
    expect(record - options, "the option ink has collapsed into the record ink").toBeGreaterThan(2);
  });
});
