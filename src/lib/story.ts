// The story graph. This is a STUB: the types are the contract spec/crit-5.test.ts
// asserts against, and the graph below is deliberately empty of everything the
// spec asks for, so the contract tests fail on their assertions rather than on a
// missing module. Filling this in is the week's work.
//
// The tests never read a passage's prose --- only the shape of the graph --- so
// rewrite every word freely. What they hold you to: a reachable loss, a
// reachable ending that isn't a loss, no orphans, no dead ends, and no passage
// more than a dozen choices from an ending.

export interface Choice {
  readonly label: string;
  readonly to: string;
}

export interface Passage {
  readonly id: string;
  readonly text: string;
  readonly choices: readonly Choice[];
  /** Present only on terminal passages. Play stops here. */
  readonly ending?: "win" | "loss" | "finish";
}

export const START = "start";

export const passages: Readonly<Record<string, Passage>> = {
  [START]: {
    id: START,
    text: "",
    choices: [],
  },
};
