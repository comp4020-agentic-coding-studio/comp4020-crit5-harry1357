import { describe, expect, it } from "vitest";
import {
  MAX_SUSPICION,
  answer,
  begin,
  catchLine,
  conflicts,
  isOver,
  resolveEnding,
  type Graph,
  type State,
} from "./interrogation";
import { CAUGHT, DEFLECTED, RELEASED, START, UNVERIFIED, passages } from "./story";

// The engine tests run against a fixture, not against the real interrogation.
// The rule under test is "an answer that collides with the record is a lie",
// and that rule has nothing to do with what anyone in this story says --- so
// the fixture is one question and three re-askings of it in different words,
// which is the shortest graph that can land three marks, plus a last question
// to hold the ending edges.

const AT_HOME = "At home.";
const OUT = "I watched the street go dark.";

const probe = (to: string) => [
  { label: AT_HOME, to, asserts: { location: "home" } },
  { label: OUT, to, asserts: { location: "street" } },
  { label: "I’d have to think about it.", to },
];

const fixture: Graph = {
  q1: { id: "q1", text: "Where were you.", choices: probe("q2") },
  q2: { id: "q2", text: "The lights.", choices: probe("q3") },
  q3: { id: "q3", text: "Ten past ten.", choices: probe("q4") },
  q4: { id: "q4", text: "Say it again.", choices: probe("q5") },
  q5: {
    id: "q5",
    text: "Anything to correct.",
    choices: [
      { label: "No.", to: RELEASED },
      { label: "It was an accident.", to: CAUGHT, fatal: true },
    ],
  },
  [RELEASED]: { id: RELEASED, text: "Go.", choices: [], ending: "win" },
  [DEFLECTED]: { id: DEFLECTED, text: "Go, for now.", choices: [], ending: "finish" },
  [CAUGHT]: { id: CAUGHT, text: "Sit.", choices: [], ending: "loss" },
};

const HOME = 0;
const STREET = 1;
const SILENT = 2;

/** Play a run from the fixture's start, one choice index per question. */
function play(...choices: number[]): State {
  return choices.reduce((state, index) => answer(fixture, state, index).state, begin("q1"));
}

describe("a claim only goes on the record once", () => {
  it("finds nothing to object to in a fresh claim", () => {
    expect(conflicts({}, { location: "home" })).toBeNull();
  });

  it("finds nothing to object to when the answer repeats what's on the record", () => {
    expect(conflicts({ location: "home" }, { location: "home" })).toBeNull();
  });

  it("names the claim when the answer moves it", () => {
    expect(conflicts({ location: "home" }, { location: "street" })).toBe("location");
  });

  it("reports one collision per answer, however many claims it touches", () => {
    const held = { location: "home", knew: "no" };
    expect(conflicts(held, { location: "street", knew: "close" })).toBe("location");
  });
});

describe("answering", () => {
  // The required test, both halves.
  it("an answer that collides with the record is caught and costs a mark", () => {
    const before = play(HOME);
    const { state, caught } = answer(fixture, before, STREET);

    expect(caught, "moving a claim that's already on the record is the lie").not.toBeNull();
    expect(caught?.claim).toBe("location");
    expect(state.contradictions).toHaveLength(1);
    expect(state.suspicion).toBe(before.suspicion + 1);
  });

  it("an answer consistent with the record is neither", () => {
    const before = play(HOME);
    const { state, caught } = answer(fixture, before, HOME);

    expect(caught).toBeNull();
    expect(state.contradictions).toHaveLength(0);
    expect(state.suspicion).toBe(before.suspicion);
  });

  it("an answer that claims nothing can't collide with anything", () => {
    const before = play(HOME);
    const { state, caught } = answer(fixture, before, SILENT);

    expect(caught).toBeNull();
    expect(state.suspicion).toBe(0);
  });

  it("keeps what was said first, so the same lie can be caught twice", () => {
    const twice = play(HOME, STREET, STREET);

    expect(twice.claims.location, "the record is not revisable").toBe("home");
    expect(twice.contradictions).toHaveLength(2);
    expect(twice.suspicion).toBe(2);
  });

  it("records both sides of a contradiction verbatim, and where they sit", () => {
    const state = play(HOME, STREET);
    const [only] = state.contradictions;

    expect(only.earlier).toBe(0);
    expect(only.now).toBe(1);
    expect(only.earlierSaid).toBe(AT_HOME);
    expect(only.nowSaid).toBe(OUT);
  });

  it("records every answer word for word, in the order it was given", () => {
    const state = play(HOME, SILENT, STREET);

    expect(state.transcript.map((line) => line.said)).toEqual([
      AT_HOME,
      "I’d have to think about it.",
      OUT,
    ]);
  });

  it("quotes the player's own words back when it catches one", () => {
    const [only] = play(HOME, STREET).contradictions;
    const line = catchLine(only);

    expect(line, "the catch has to name the contradiction, not gesture at it").toContain(AT_HOME);
    expect(line).toContain(OUT);
    expect(line).not.toContain("{earlier}");
    expect(line).not.toContain("{now}");
  });
});

describe("the resolver", () => {
  const clean = { suspicion: 0, claims: {} };

  // The third strike is the fail state the brief requires, and it outranks
  // wherever the story was pointing.
  it("picks the caught ending at three marks, whatever the graph intended", () => {
    const doomed = { suspicion: MAX_SUSPICION, claims: {} };

    expect(resolveEnding(doomed, RELEASED)).toBe(CAUGHT);
    expect(resolveEnding(doomed, UNVERIFIED)).toBe(CAUGHT);
    expect(resolveEnding(doomed, DEFLECTED)).toBe(CAUGHT);
  });

  it("lets a clean record through to the ending the story was heading for", () => {
    expect(resolveEnding(clean, RELEASED)).toBe(RELEASED);
    expect(resolveEnding(clean, UNVERIFIED)).toBe(UNVERIFIED);
  });

  it("won't clear a record that moved, even once", () => {
    expect(resolveEnding({ suspicion: 1, claims: {} }, RELEASED)).toBe(DEFLECTED);
  });

  it("ends it on the answer that ends it, at no marks at all", () => {
    expect(resolveEnding(clean, RELEASED, true)).toBe(CAUGHT);
  });
});

describe("playing to the end of the fixture", () => {
  it("three collisions end the interview where the player stands", () => {
    const state = play(HOME, STREET, STREET, STREET);

    expect(state.suspicion).toBe(MAX_SUSPICION);
    expect(state.at, "the third mark doesn't wait for the last question").toBe(CAUGHT);
    expect(isOver(fixture, state)).toBe(true);
  });

  it("a record that never moved reaches the ending it was heading for", () => {
    const state = play(HOME, HOME, SILENT, SILENT, 0);

    expect(state.suspicion).toBe(0);
    expect(state.at).toBe(RELEASED);
    expect(isOver(fixture, state)).toBe(true);
  });

  it("stops taking answers once it's over", () => {
    const over = play(HOME, HOME, SILENT, SILENT, 0);
    const { state, caught } = answer(fixture, over, 0);

    expect(state).toBe(over);
    expect(caught).toBeNull();
  });
});

// --- and one thing about the real story ------------------------------------

describe("the interrogation teaches its own rule early", () => {
  // Not a test of the prose --- a test that the shape which does the teaching
  // is still there. Something in the opening three questions has to pull at a
  // claim the opening question put on the record, or nothing ever demonstrates
  // what a contradiction is.
  it("an early question re-probes a claim the opening put on the record", () => {
    const opened = new Set(
      passages[START].choices.flatMap((choice) => Object.keys(choice.asserts ?? {})),
    );
    expect(opened.size, "the opening question puts nothing on the record").toBeGreaterThan(0);

    const early: string[] = [];
    let at = passages[START].choices[0]?.to;
    for (let hop = 0; hop < 2 && at !== undefined; hop += 1) {
      const passage = passages[at];
      if (!passage) break;
      early.push(...passage.choices.flatMap((choice) => Object.keys(choice.asserts ?? {})));
      at = passage.choices[0]?.to;
    }

    expect(
      early.filter((claim) => opened.has(claim)),
      "nothing within two questions pulls at the opening claim, so the first mark lands unexplained",
    ).not.toEqual([]);
  });

  it("every claim an answer can move has a catch line written for the collision", () => {
    const asserted = new Set(
      Object.values(passages).flatMap((passage) =>
        passage.choices.flatMap((choice) => Object.keys(choice.asserts ?? {})),
      ),
    );
    for (const claim of asserted) {
      const stub = { claim, earlier: 0, now: 1, earlierSaid: "a", nowSaid: "b" };
      expect(catchLine(stub), `nothing to say when "${claim}" moves`).toContain("a");
    }
  });
});
