// The engine. No DOM in this file, and no prose: it takes a graph of passages
// in and hands a new state back. The UI in ../scripts/game.ts renders a state
// and dispatches an answer; it decides nothing.
//
// The one rule everything else hangs off: an answer that collides with
// something already on the record is a lie, and the record wins. What you said
// first stands. You cannot revise it, only be caught revising it.

import {
  CATCH,
  CATCH_FALLBACK,
  CAUGHT,
  RELEASED,
  DEFLECTED,
  type Choice,
  type Claims,
  type Passage,
} from "./story";

export type Graph = Readonly<Record<string, Passage>>;

/** Three marks and the interview is over. */
export const MAX_SUSPICION = 3;

/** One question, one answer, exactly as both were worded. */
export interface TranscriptLine {
  readonly passage: string;
  /** What was asked, verbatim. */
  readonly prompt: string;
  /** What the player said, verbatim. The ending reads these back. */
  readonly said: string;
  /** What saying it put on the record. */
  readonly asserted: Claims;
}

/** Two lines of the transcript that cannot both be true. */
export interface Contradiction {
  /** The claim they collided on. */
  readonly claim: string;
  /** Transcript index of the line that put the claim on the record. */
  readonly earlier: number;
  /** Transcript index of the line that moved it. */
  readonly now: number;
  readonly earlierSaid: string;
  readonly nowSaid: string;
}

export interface State {
  /** The passage currently on screen. */
  readonly at: string;
  readonly claims: Claims;
  readonly transcript: readonly TranscriptLine[];
  readonly contradictions: readonly Contradiction[];
  readonly suspicion: number;
}

export interface Step {
  readonly state: State;
  /** The contradiction this answer landed, if it landed one. */
  readonly caught: Contradiction | null;
}

export function begin(start: string): State {
  return { at: start, claims: {}, transcript: [], contradictions: [], suspicion: 0 };
}

export function isOver(graph: Graph, state: State): boolean {
  return graph[state.at]?.ending !== undefined;
}

/**
 * The first claim in `asserts` that the record already holds differently, or
 * null if the answer is consistent with everything said so far. First one only:
 * one answer is one lie, however many claims it happens to touch.
 */
export function conflicts(claims: Claims, asserts: Claims): string | null {
  for (const [claim, value] of Object.entries(asserts)) {
    const held = claims[claim];
    if (held !== undefined && held !== value) return claim;
  }
  return null;
}

/**
 * Which ending this run gets. `intended` is where the graph was pointing; the
 * two overrides are the whole scoring system.
 */
export function resolveEnding(
  state: Pick<State, "suspicion" | "claims">,
  intended: string,
  fatal = false,
): string {
  // Some answers don't need three strikes. One is enough.
  if (fatal) return CAUGHT;
  // Three marks and nothing else matters.
  if (state.suspicion >= MAX_SUSPICION) return CAUGHT;
  // Walking out clean is only on the table if somebody else can say so, and
  // only if the record never moved. Otherwise the slips land on her.
  if (intended === RELEASED && state.suspicion > 0) return DEFLECTED;
  return intended;
}

/** What the interrogator says when a claim collides, with the words filled in. */
export function catchLine(contradiction: Contradiction): string {
  const template = CATCH[contradiction.claim] ?? CATCH_FALLBACK;
  return template
    .replaceAll("{earlier}", contradiction.earlierSaid)
    .replaceAll("{now}", contradiction.nowSaid);
}

/** Where the record stands after that answer. */
export function answer(graph: Graph, state: State, index: number): Step {
  const here = graph[state.at];
  const choice = here?.choices[index];
  if (!here || !choice || here.ending !== undefined) return { state, caught: null };

  const asserts = choice.asserts ?? {};
  const collided = conflicts(state.claims, asserts);

  const transcript: TranscriptLine[] = [
    ...state.transcript,
    { passage: here.id, prompt: here.text, said: choice.label, asserted: asserts },
  ];

  // Everything new goes on the record. Nothing already on it moves --- that's
  // what makes the collision above findable next time, and the only reason the
  // ending can quote a first answer that the player has since talked past.
  const claims: Record<string, string> = { ...state.claims };
  for (const [claim, value] of Object.entries(asserts)) {
    if (!(claim in claims)) claims[claim] = value;
  }

  let caught: Contradiction | null = null;
  let contradictions = state.contradictions;
  let suspicion = state.suspicion;

  if (collided !== null) {
    const earlier = transcript.findIndex((line) => collided in line.asserted);
    caught = {
      claim: collided,
      earlier,
      now: transcript.length - 1,
      earlierSaid: transcript[earlier].said,
      nowSaid: choice.label,
    };
    contradictions = [...contradictions, caught];
    suspicion = Math.min(MAX_SUSPICION, suspicion + 1);
  }

  const next = { claims, suspicion };
  return {
    state: { at: nextPassage(graph, next, choice), claims, transcript, contradictions, suspicion },
    caught,
  };
}

function nextPassage(
  graph: Graph,
  next: Pick<State, "suspicion" | "claims">,
  choice: Choice,
): string {
  if (choice.fatal === true) return CAUGHT;
  if (next.suspicion >= MAX_SUSPICION) return CAUGHT;
  // The graph's ending edges say which ending this branch was heading for; the
  // resolver says which one the record has earned.
  if (graph[choice.to]?.ending !== undefined) return resolveEnding(next, choice.to);
  return choice.to;
}
