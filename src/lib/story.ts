// The interrogation, as a graph.
//
// This file is content. It holds no logic: the claim store, the contradiction
// check, the suspicion counter and the ending resolver all live in
// ./interrogation.ts, which reads this graph and never writes to it. Rewrite
// every word here and the engine, its tests, and spec/crit-5.test.ts all still
// hold --- they only ever look at the shape.
//
// The shape spec/crit-5.test.ts asserts is `Choice { label, to }` and
// `Passage { id, text, choices, ending? }`. Everything else below is optional
// and additive: `asserts` is what an answer puts on the record, `reply` is the
// beat the interrogator gives before the next question, `fatal` is the one
// answer that ends the interview whatever the count says.

/** A claim is a single fact the player has committed to, on the record. */
export type ClaimValue = string;
export type Claims = Readonly<Record<string, ClaimValue>>;

export interface Choice {
  readonly label: string;
  readonly to: string;
  /** What saying this puts on the record. Saying it twice differently is a lie. */
  readonly asserts?: Claims;
  /** The interrogator's beat before the next question. */
  readonly reply?: string;
  /** Ends the interview on the spot, whatever the suspicion count is. */
  readonly fatal?: boolean;
}

export interface Passage {
  readonly id: string;
  readonly text: string;
  readonly choices: readonly Choice[];
  /** Present only on terminal passages. Play stops here. */
  readonly ending?: "win" | "loss" | "finish";
  /** Endings only: what gets stamped across the finished report. */
  readonly stamp?: string;
  /** Endings only: what the interrogator says after reading the record back. */
  readonly close?: string;
}

export const START = "opening";

export const CAUGHT = "caught";
export const RELEASED = "released";
export const DEFLECTED = "deflected";
export const UNVERIFIED = "unverified";

/**
 * What the interrogator says when an answer collides with one already on the
 * record, keyed by the claim that collided. `{earlier}` and `{now}` are the
 * player's own words, verbatim --- the collision is always quoted back, never
 * described.
 */
export const CATCH: Readonly<Record<string, string>> = {
  location:
    "No.\nEarlier it was “{earlier}”\nNow it’s “{now}”\nI’ll write both down. One of them is going to embarrass you.",
  knew: "You’ve moved him.\n“{earlier}” — that was you, a few minutes ago.\nNow he’s “{now}”\nPeople revise the dead. I’ve never seen it done this fast.",
  time: "“{earlier}”\nAnd then “{now}”\nBoth of those are on the tape now. I can play you the tape.",
  spoke:
    "You said “{earlier}”\nThen “{now}”\nThe phone company doesn’t change its story halfway through.",
  inside:
    "“{earlier}”\nThen “{now}”\nPick one. I’d rather you picked it than me.",
  quarrel:
    "“{earlier}”\nNow “{now}”\nMemory is a strange thing. Yours especially.",
  dana: "“{earlier}”\nAnd now “{now}”\nShe’s two doors down, giving her own version of this. Without being told.",
  danaSpan:
    "You gave me “{earlier}”\nNow it’s “{now}”\nShe’ll only be able to give me one of those.",
};

/** Used when a claim collides and nothing more specific has been written for it. */
export const CATCH_FALLBACK =
  "“{earlier}”\n“{now}”\nI’ll leave both in and let somebody else decide which one you meant.";

export const passages: Readonly<Record<string, Passage>> = {
  // --- the record opens ----------------------------------------------------

  [START]: {
    id: START,
    text: "Thursday night. Nine to midnight.\nWhere were you.",
    choices: [
      { label: "At home.", to: "the-name", asserts: { location: "home" }, reply: "Home." },
      {
        label: "Out walking. I don’t sleep much.",
        to: "the-name",
        asserts: { location: "street" },
        reply: "Walking.",
      },
      {
        label: "The Anchor. On Wharf Street.",
        to: "the-name",
        asserts: { location: "bar" },
        reply: "The Anchor.",
      },
    ],
  },

  "the-name": {
    id: "the-name",
    text: "Ellis Vance.\nWhat was he to you.",
    choices: [
      {
        label: "A name on a mailbox.",
        to: "the-lights",
        asserts: { knew: "no" },
        reply: "A name.",
      },
      {
        label: "We’d spoken. Nothing past that.",
        to: "the-lights",
        asserts: { knew: "some" },
        reply: "Spoken.",
      },
      {
        label: "We were close. A long time ago.",
        to: "the-lights",
        asserts: { knew: "close" },
        reply: "Close. Once.",
      },
    ],
  },

  // The pair the whole thing turns on. Whatever went on the record at
  // `opening` gets pulled at here, one question later, while it's still warm.
  "the-lights": {
    id: "the-lights",
    text: "The power went out on Kestrel Street at ten past ten.\nFour blocks. Forty minutes.\nYou’d remember that.",
    choices: [
      {
        label: "I was asleep by then.",
        to: "who-else",
        asserts: { location: "home" },
        reply: "Asleep.",
      },
      {
        label: "I watched it go. The whole street at once.",
        to: "who-else",
        asserts: { location: "street" },
        reply: "You watched it.",
      },
      {
        label: "The Anchor runs its own generator. Nobody looked up.",
        to: "who-else",
        asserts: { location: "bar" },
        reply: "A generator.",
      },
    ],
  },

  // The fork. Nothing can collide here --- it's the first time anyone asks ---
  // so the branch is always taken clean. Alone is quiet and unverifiable.
  // Reyes can clear you, and can sink you.
  "who-else": {
    id: "who-else",
    text: "Was anyone with you.",
    choices: [
      { label: "No. On my own.", to: "a-no-one", asserts: { alibi: "alone" }, reply: "On your own." },
      {
        label: "Dana Reyes was with me.",
        to: "w-dana",
        asserts: { alibi: "witness" },
        reply: "Dana Reyes.",
      },
    ],
  },

  // --- alone ---------------------------------------------------------------

  "a-no-one": {
    id: "a-no-one",
    text: "Nobody saw you. Nobody rang.\nThat isn’t a problem.\nIt’s just thin.",
    choices: [
      { label: "I don’t keep an audience.", to: "a-hours", reply: "No. I don’t suppose you do." },
      {
        label: "I rang my sister. Late.",
        to: "a-hours",
        asserts: { phone: "sister" },
        reply: "Your sister. We’ll ask her.",
      },
      {
        label: "The man below me had his television up. I could hear it through the floor.",
        to: "a-hours",
        asserts: { phone: "neighbour", location: "home" },
        reply: "Through the floor.",
      },
    ],
  },

  "a-hours": {
    id: "a-hours",
    text: "What time did you turn in.",
    choices: [
      {
        label: "Before ten. I was in bed by the news.",
        to: "a-the-call",
        asserts: { time: "early", location: "home" },
        reply: "By the news.",
      },
      { label: "After one.", to: "a-the-call", asserts: { time: "late" }, reply: "One in the morning." },
      { label: "I don’t watch the clock.", to: "a-the-call", reply: "No. Nobody does." },
    ],
  },

  "a-the-call": {
    id: "a-the-call",
    text: "There’s a call from his phone to yours.\nThursday. Eight forty.",
    choices: [
      {
        label: "I didn’t pick it up.",
        to: "a-building",
        asserts: { spoke: "no" },
        reply: "It rang ninety seconds.",
      },
      {
        label: "We spoke. Two minutes, maybe.",
        to: "a-building",
        asserts: { spoke: "yes", knew: "some" },
        reply: "Two minutes.",
      },
      {
        label: "That number isn’t mine.",
        to: "a-building",
        asserts: { spoke: "denied" },
        reply: "It’s on the bill in front of me.\nWe’ll come back to it.",
      },
    ],
  },

  "a-building": {
    id: "a-building",
    text: "Nine Kestrel Street.\nWhen were you last inside it.",
    choices: [
      { label: "Never been in it.", to: "a-march", asserts: { inside: "no" }, reply: "Never." },
      {
        label: "Years ago. Before he moved up a floor.",
        to: "a-march",
        asserts: { inside: "yes", knew: "close" },
        reply: "You knew which floor.",
      },
      {
        label: "Thursday. Early evening, before nine.",
        to: "a-march",
        asserts: { inside: "yes" },
        reply: "Thursday.\nThank you. That’s the first thing tonight that cost you something.",
      },
    ],
  },

  "a-march": {
    id: "a-march",
    text: "March the ninth.\nYou and he argued in the entryway.\nSomebody wrote it down.",
    choices: [
      {
        label: "We disagreed about money.",
        to: "a-stairwell",
        asserts: { quarrel: "money", knew: "close" },
        reply: "Money.",
      },
      {
        label: "I don’t remember an argument.",
        to: "a-stairwell",
        asserts: { quarrel: "none" },
        reply: "It was loud enough to write down.",
      },
      {
        label: "That wasn’t me.",
        to: "a-stairwell",
        asserts: { quarrel: "none", knew: "no" },
        reply: "Wasn’t it.",
      },
    ],
  },

  "a-stairwell": {
    id: "a-stairwell",
    text: "He came down eleven steps.\nThe doctor says he was helped.",
    choices: [
      { label: "Then find who helped him.", to: "a-last", reply: "That’s the idea." },
      {
        label: "Stairs are stairs. He drank.",
        to: "a-last",
        asserts: { knew: "some" },
        reply: "You know what he drank.",
      },
      {
        label: "I wasn’t in that building Thursday.",
        to: "a-last",
        asserts: { inside: "no" },
        reply: "All right.",
      },
    ],
  },

  "a-last": {
    id: "a-last",
    text: "Last thing.\nYou’ve been steady. Most people aren’t.\nAnything you want to correct.",
    choices: [
      { label: "No.", to: UNVERIFIED },
      { label: "You’ve had me here four hours.", to: UNVERIFIED },
      { label: "It was an accident.", to: CAUGHT, fatal: true },
    ],
  },

  // --- Reyes ---------------------------------------------------------------

  "w-dana": {
    id: "w-dana",
    text: "Dana Reyes.\nShe’ll say the same thing.",
    choices: [
      { label: "She will.", to: "w-where", asserts: { dana: "firm" }, reply: "Good." },
      { label: "Ask her.", to: "w-where", reply: "We have." },
      {
        label: "She might not have the times right.",
        to: "w-where",
        asserts: { dana: "hedged" },
        reply: "Times are all I’ve got.",
      },
    ],
  },

  "w-where": {
    id: "w-where",
    text: "Where was she.",
    choices: [
      {
        label: "With me. The whole stretch.",
        to: "w-her-account",
        asserts: { danaSpan: "all" },
        reply: "The whole stretch.",
      },
      {
        label: "She came by around eleven.",
        to: "w-her-account",
        asserts: { danaSpan: "late", time: "late" },
        reply: "Eleven.",
      },
      {
        label: "In and out. She has a dog.",
        to: "w-her-account",
        asserts: { danaSpan: "partial" },
        reply: "In and out.",
      },
    ],
  },

  "w-her-account": {
    id: "w-her-account",
    text: "She told the officer on the door she left at nine.",
    choices: [
      { label: "Then she’s wrong.", to: "w-building", reply: "One of you is." },
      {
        label: "She has it late. It was later than that.",
        to: "w-building",
        asserts: { danaSpan: "all" },
        reply: "Later.",
      },
      {
        label: "Nine. Yes. That’s about right.",
        to: "w-building",
        asserts: { danaSpan: "early" },
        reply: "About right.",
      },
    ],
  },

  "w-building": {
    id: "w-building",
    text: "Nine Kestrel Street.\nWhen were you last inside it.",
    choices: [
      { label: "Never been in it.", to: "w-the-call", asserts: { inside: "no" }, reply: "Never." },
      {
        label: "Years ago. Before he moved up a floor.",
        to: "w-the-call",
        asserts: { inside: "yes", knew: "close" },
        reply: "You knew which floor.",
      },
      {
        label: "Thursday. Dana waited outside.",
        to: "w-the-call",
        asserts: { inside: "yes", danaSpan: "partial" },
        reply: "Outside.",
      },
    ],
  },

  "w-the-call": {
    id: "w-the-call",
    text: "There’s a call from his phone to yours.\nThursday. Eight forty.\nReyes didn’t mention it.",
    choices: [
      {
        label: "I didn’t pick it up.",
        to: "w-march",
        asserts: { spoke: "no" },
        reply: "It rang ninety seconds.",
      },
      {
        label: "We spoke. Two minutes, maybe.",
        to: "w-march",
        asserts: { spoke: "yes", knew: "some" },
        reply: "Two minutes.",
      },
      {
        label: "She wouldn’t have been there yet.",
        to: "w-march",
        asserts: { danaSpan: "late" },
        reply: "No. She wouldn’t.",
      },
    ],
  },

  "w-march": {
    id: "w-march",
    text: "March the ninth.\nYou and he argued in the entryway.\nReyes was there for that one too.",
    choices: [
      {
        label: "We disagreed about money.",
        to: "w-last",
        asserts: { quarrel: "money", knew: "close" },
        reply: "Money.",
      },
      {
        label: "I don’t remember an argument.",
        to: "w-last",
        asserts: { quarrel: "none" },
        reply: "It was loud enough to write down.",
      },
      {
        label: "Ask Dana about March.",
        to: "w-last",
        asserts: { dana: "firm" },
        reply: "I intend to.",
      },
    ],
  },

  "w-last": {
    id: "w-last",
    text: "He came down eleven steps. The doctor says he was helped.\nLast thing.\nAnything you want to correct.",
    choices: [
      { label: "No.", to: RELEASED },
      { label: "Dana’s memory isn’t what it was.", to: DEFLECTED },
      { label: "It was an accident.", to: CAUGHT, fatal: true },
    ],
  },

  // --- endings -------------------------------------------------------------

  [CAUGHT]: {
    id: CAUGHT,
    text: "All right. Let’s stop.\nI’ll read it back. Not for you — for the file.",
    choices: [],
    ending: "loss",
    stamp: "CHARGED",
    close:
      "Three times you moved.\nThat isn’t nerves. Nerves shake. They don’t rearrange.\nSomebody will be in shortly with a form.\nStay sitting. It’s warmer in here than where you’re going.",
  },

  [RELEASED]: {
    id: RELEASED,
    text: "Hm.\nLet me read it back.",
    choices: [],
    ending: "win",
    stamp: "RELEASED",
    close:
      "It holds. Everywhere I pushed, it held.\nReyes said it the same way you did, in a different room, without being told what you’d said.\nThat’s the part I can’t argue with.\nSign at the desk. Take your coat — it’s cold, and I’m not offering you a lift.",
  },

  [DEFLECTED]: {
    id: DEFLECTED,
    text: "Hm.\nLet me read it back.",
    choices: [],
    ending: "finish",
    stamp: "PENDING",
    close:
      "It mostly holds. Where it doesn’t, it leans on Dana Reyes.\nShe’s still down the hall. She’s been down there a while now.\nYou can go.\nI’d think about whether you’re going to ring her tonight, and I’d think about what that looks like on the phone bill.",
  },

  [UNVERIFIED]: {
    id: UNVERIFIED,
    text: "Hm.\nLet me read it back.",
    choices: [],
    ending: "finish",
    stamp: "UNRESOLVED",
    close:
      "There’s nothing in there I can prove is a lie.\nThere’s nothing in there I can check, either. You were alone. Alone is only a word.\nSo you’ll go home, and this stays open on my desk, where I can see it.\nDon’t leave the city. That isn’t a threat. It’s paperwork.",
  },
};
