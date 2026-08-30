import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import type { AxeResults, RunOptions } from "axe-core";

// Nothing in the starter measures accessibility, so this is the sensor.
//
// axe runs inside the jsdom realm rather than against it, which spares the
// dance of shimming a dozen browser globals onto globalThis. It catches
// structural problems: landmarks, labels, roles, heading order, duplicate ids.
//
// It cannot catch contrast. jsdom has no layout and no cascade, so every node
// comes back "incomplete" for `color-contrast` and an enabled rule would look
// like coverage that isn't there. That rule is off here; check the palette
// arithmetically, or in a real browser, once this week's tokens exist.

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core"), "utf8");
const html = readFileSync(resolve("dist/index.html"), "utf8");

interface AxeWindow {
  axe: { run(context: Document, options: RunOptions): Promise<AxeResults> };
}

let results: AxeResults;

beforeAll(async () => {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/",
    virtualConsole,
  });
  dom.window.eval(axeSource);
  const { axe } = dom.window as unknown as AxeWindow;
  results = await axe.run(dom.window.document, {
    rules: { "color-contrast": { enabled: false } },
  });
}, 60_000);

describe("accessibility: axe over the built page", () => {
  it("actually inspected the page", () => {
    // A green run and a run that silently loaded nothing look identical from
    // the outside. This is the sensor on the sensor: if the page stops being
    // parsed, or axe stops being injected, the count collapses and this fails
    // instead of quietly reporting all-clear.
    expect(
      results.passes.length,
      "axe found almost nothing to check --- it probably never saw the page",
    ).toBeGreaterThan(20);
  });

  it("reports no violations", () => {
    const summary = results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes
          .map((node) => node.target.join(" "))
          .join("\n  ")}`,
    );
    expect(summary).toEqual([]);
  });

  it("puts every heading, including the h1, inside a landmark", () => {
    // A full-bleed hero dropped between <header> and <main> passes every other
    // check and still strands the h1 outside a region.
    const offenders = results.violations
      .concat(results.incomplete)
      .filter((result) => result.id === "region");
    expect(offenders.map((result) => result.id)).toEqual([]);
  });
});
