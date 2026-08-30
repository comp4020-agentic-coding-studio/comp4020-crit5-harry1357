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
// beat before the next question, `fatal` is the one answer that ends the
// interview whatever the count says, `callback` quotes something the player
// said several questions ago without it costing anything, and `pressure` marks
// a question he leans on --- how hard depends on how many marks are already
// down.

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

/**
 * Something the player said a while ago, read back at them on the way into a
 * question. `{said}` is filled from the transcript, so it is always their own
 * words. It costs nothing --- it is the record being tracked, not caught.
 */
export interface Callback {
  /** Which claim to look up. Skipped silently if nothing on the record set it. */
  readonly claim: string;
  readonly line: string;
}

export interface Passage {
  readonly id: string;
  readonly text: string;
  readonly choices: readonly Choice[];
  /** Present only on terminal passages. Play stops here. */
  readonly ending?: "win" | "loss" | "finish";
  /** Endings only: what gets stamped across the finished report. */
  readonly stamp?: string;
  /** Endings only: what he says after reading the record back. */
  readonly close?: string;
  readonly callback?: Callback;
  /** He puts a line in before this one, pitched at the current mark count. */
  readonly pressure?: boolean;
}

export const START = "opening";

export const CAUGHT = "caught";
export const RELEASED = "released";
export const DEFLECTED = "deflected";
export const UNVERIFIED = "unverified";

/**
 * How the transcript opens. Stating the record is the first thing anyone does
 * in that room, and it is the only place the player is told who they are.
 */
export const PREAMBLE =
  "Interview commences oh two forty. Case four four seven one, K.\n" +
  "Ellis Vance, of nine Kestrel Street, found Thursday night at the foot of his own stairs.\n" +
  "You’re not under arrest. You’re helping.";

/**
 * What he sounds like between questions, by how many marks are on the file.
 * Nothing about the sets is interchangeable: at nothing he has all night and
 * wants you to feel it, at one the asides stop, at two he has stopped being
 * polite about the time.
 */
export const REGISTER: readonly (readonly string[])[] = [
  [
    "Take your time.\nNobody’s waiting on this room.",
    "There’s tea, if you want it. It isn’t good.",
    "You’re doing better than most.\nMost people talk too much.",
    "I’ve got until six.\nSo have you.",
  ],
  [
    "We’ll keep going.\nWe’re past the easy part of it now.",
    "Straight answers from here.\nIt’s quicker for both of us.",
    "I’ve stopped being curious.\nNow I’m only checking.",
    "Don’t fill the silence.\nI don’t mind it.",
  ],
  [
    "Slower.\nI want to hear you decide.",
    "Careful.\nI mean that as a courtesy.",
    "No.\nThink first, then answer.",
    "Look at me when you say the next one.",
  ],
];

/**
 * What he says when an answer collides with one already on the record, keyed by
 * the claim that collided. `{earlier}` and `{now}` are the player's own words,
 * verbatim --- the collision is always quoted back, never described.
 */
export const CATCH: Readonly<Record<string, string>> = {
  location:
    "No.\nEarlier it was “{earlier}”\nNow it’s “{now}”\nI’ll write both down. One of them is going to embarrass you.",
  knew: "You’ve moved him.\n“{earlier}” — that was you, and not long ago.\nNow he’s “{now}”\nPeople revise the dead. I’ve never seen it done this quickly.",
  alibi:
    "“{earlier}”\nAnd now “{now}”\nOne of those has somebody in it. The other doesn’t.",
  time: "“{earlier}”\nThen “{now}”\nBoth of those are on the tape.\nI can play you the tape, if it would help.",
  spoke:
    "“{earlier}”\nThen “{now}”\nThe phone company doesn’t change its story halfway through an evening.",
  inside:
    "“{earlier}”\nThen “{now}”\nPick one. I’d rather you picked it than me.",
  quarrel:
    "“{earlier}”\nNow “{now}”\nMemory’s a strange thing.\nYours especially.",
  phone:
    "“{earlier}”\nAnd now “{now}”\nThat’s two different people I have to go and wake up.",
  meal: "“{earlier}”\nNow “{now}”\nIt’s a small thing. Small things are all I do.",
  dana: "“{earlier}”\nAnd now “{now}”\nShe’s two doors down giving her own version of this, and nobody has told her yours.",
  danaSpan:
    "You gave me “{earlier}”\nNow it’s “{now}”\nShe can only give me one of those.",
};

/** Used when a claim collides and nothing more specific has been written. */
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
        reply: "Walking. In November.",
      },
      {
        label: "The Anchor. On Wharf Street.",
        to: "the-name",
        asserts: { location: "bar" },
        reply: "The Anchor.\nThey’ll know you in there, then.",
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
        reply: "Three floors and a mailbox.\nAll right.",
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
        reply: "Close.\nThat’s a word people pick carefully.",
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
        reply: "Through all of it.\nYou sleep well for a man who doesn’t sleep.",
      },
      {
        label: "I watched it go. The whole street at once.",
        to: "who-else",
        asserts: { location: "street" },
        reply: "That’s a good detail.\nPeople remember what they saw.",
      },
      {
        label: "The Anchor runs its own generator. Nobody looked up.",
        to: "who-else",
        asserts: { location: "bar" },
        reply: "A generator.\nYou’d have to have been in there a while to know that.",
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
      {
        label: "No. On my own.",
        to: "a-no-one",
        asserts: { alibi: "alone" },
        reply: "On your own.",
      },
      {
        label: "Dana Reyes was with me.",
        to: "w-dana",
        asserts: { alibi: "witness" },
        reply: "Reyes.\nWe’ve got her in four.",
      },
    ],
  },

  // --- alone: the fork ------------------------------------------------------
  //
  // Give him nothing and he stops looking for threads and starts looking at
  // you. Give him something checkable and every question after it is the
  // detail being tested. Same eleven questions either way, different interview.

  "a-no-one": {
    id: "a-no-one",
    text: "Nobody saw you. Nobody rang.\nThat isn’t a problem in itself.\nIt’s just thin, and thin is what I have to write down.",
    choices: [
      {
        label: "I don’t keep an audience.",
        to: "q-him",
        reply: "No.\nI didn’t suppose you did.",
      },
      {
        label: "I rang my sister. Around eleven.",
        to: "c-hours",
        asserts: { phone: "sister" },
        reply: "A number and a time.\nThat’s the first useful thing anybody’s given me tonight.",
      },
      {
        label: "The man below me had his television up. I could hear it through the floor.",
        to: "c-hours",
        asserts: { phone: "neighbour", location: "home" },
        reply: "Through the floor.\nWe can ask him what he was watching.",
      },
    ],
  },

  // --- alone, quiet: he stops looking for threads and looks at you ----------

  "q-him": {
    id: "q-him",
    text: "Then we’ll talk about him instead of you.\nWhat did Ellis Vance do for a living.",
    callback: {
      claim: "knew",
      line: "“{said}”\nThat’s what you gave me, for a man who lived above you.",
    },
    choices: [
      { label: "I wouldn’t know.", to: "q-drink", asserts: { knew: "no" }, reply: "No." },
      {
        label: "He fixed things. Boats, mostly.",
        to: "q-drink",
        asserts: { knew: "some" },
        reply: "Boats.\nThat’s more than a mailbox tells you.",
      },
      {
        label: "He taught. Until he didn’t.",
        to: "q-drink",
        asserts: { knew: "close" },
        reply: "Until he didn’t.\nYou’d know why, then.",
      },
    ],
  },

  "q-drink": {
    id: "q-drink",
    text: "Half that building says he drank.\nWould you know.",
    pressure: true,
    choices: [
      { label: "No idea.", to: "q-call", asserts: { knew: "no" }, reply: "None at all." },
      {
        label: "He did. Not happily.",
        to: "q-call",
        asserts: { knew: "some" },
        reply: "Not happily.\nThat’s a careful way to put it.",
      },
      {
        label: "He stopped for six years. Then he stopped stopping.",
        to: "q-call",
        asserts: { knew: "close" },
        reply: "Six years.\nYou counted.",
      },
    ],
  },

  "q-call": {
    id: "q-call",
    text: "There’s a call from his phone to yours.\nThursday. Eight forty.",
    callback: {
      claim: "location",
      line: "You put yourself at “{said}”\nKeep hold of that. I want to ask you about a telephone.",
    },
    choices: [
      {
        label: "I didn’t pick it up.",
        to: "q-building",
        asserts: { spoke: "no" },
        reply: "It rang ninety seconds.\nThat’s a long time to sit near a telephone.",
      },
      {
        label: "We spoke. Two minutes, maybe.",
        to: "q-building",
        asserts: { spoke: "yes", knew: "some" },
        reply: "Two minutes.\nWhat does a man say in two minutes.",
      },
      {
        label: "That number isn’t mine.",
        to: "q-building",
        asserts: { spoke: "denied" },
        reply: "It’s on the bill in front of me.\nWe’ll come back to it.",
      },
    ],
  },

  "q-building": {
    id: "q-building",
    text: "You’ve given me almost nothing, and none of it can be checked.\nSo here’s the one thing that can be.\nNine Kestrel Street. When were you last inside it.",
    pressure: true,
    choices: [
      { label: "Never been in it.", to: "a-march", asserts: { inside: "no" }, reply: "Never." },
      {
        label: "Years ago. Before he moved up a floor.",
        to: "a-march",
        asserts: { inside: "yes", knew: "close" },
        reply: "You knew which floor he moved to.",
      },
      {
        label: "Thursday. Early evening, before nine.",
        to: "a-march",
        asserts: { inside: "yes" },
        reply: "Thursday.\nThank you.\nThat’s the first thing tonight that cost you anything.",
      },
    ],
  },

  // --- alone, checkable: he has a thread now, and pulls it ------------------

  "c-hours": {
    id: "c-hours",
    text: "We’ll do the times properly, then.\nWhat time did you turn in.",
    callback: {
      claim: "location",
      line: "You put yourself at “{said}”\nNow give me the hours that go around it.",
    },
    choices: [
      {
        label: "Before ten. I was in bed by the news.",
        to: "c-call",
        asserts: { time: "early", location: "home" },
        reply: "By the news.",
      },
      {
        label: "After one.",
        to: "c-call",
        asserts: { time: "late" },
        reply: "One in the morning.\nDoing what.",
      },
      {
        label: "I don’t watch the clock.",
        to: "c-call",
        reply: "You gave me an hour a minute ago, to the quarter.\nNow the clock’s gone.",
      },
    ],
  },

  "c-call": {
    id: "c-call",
    text: "There’s another call. His phone to yours.\nThursday. Eight forty.\nThat one you didn’t mention.",
    choices: [
      {
        label: "I didn’t pick it up.",
        to: "c-building",
        asserts: { spoke: "no" },
        reply: "It rang ninety seconds.",
      },
      {
        label: "We spoke. Two minutes, maybe.",
        to: "c-building",
        asserts: { spoke: "yes", knew: "some" },
        reply: "Two minutes.\nAnd you led with the other call.",
      },
      {
        label: "That number isn’t mine.",
        to: "c-building",
        asserts: { spoke: "denied" },
        reply: "It’s on the same bill as the one you told me about.\nSame page, even.",
      },
    ],
  },

  "c-building": {
    id: "c-building",
    text: "Nine Kestrel Street.\nWhoever you’ve pointed me at will know the answer to this before you give it.\nWhen were you last inside that building.",
    pressure: true,
    choices: [
      { label: "Never been in it.", to: "c-doorstep", asserts: { inside: "no" }, reply: "Never." },
      {
        label: "Years ago. Before he moved up a floor.",
        to: "c-doorstep",
        asserts: { inside: "yes", knew: "close" },
        reply: "You knew which floor he moved to.",
      },
      {
        label: "Thursday. Early evening, before nine.",
        to: "c-doorstep",
        asserts: { inside: "yes" },
        reply: "Thursday.\nAll right. That’s honest, and it’s expensive.",
      },
    ],
  },

  "c-doorstep": {
    id: "c-doorstep",
    text: "Somebody will be on that doorstep by nine in the morning with all of this written down.\nIs there anything they’ll say that you haven’t.",
    callback: {
      claim: "phone",
      line: "“{said}”\nThat’s the door I mean.\nIt’s the only thing you’ve given me all night with a time on it.",
    },
    choices: [
      { label: "No.", to: "a-march", reply: "No." },
      {
        label: "They’ll say I was in all night.",
        to: "a-march",
        asserts: { location: "home" },
        reply: "They’ll say that, will they.\nBefore I’ve asked.",
      },
      {
        label: "Ask them. I’ve said what I’ve said.",
        to: "a-march",
        reply: "You have.\nTwice, in places.",
      },
    ],
  },

  // --- alone: back together for the last two -------------------------------

  "a-march": {
    id: "a-march",
    text: "March the ninth.\nYou and he in the entryway, loud enough that somebody upstairs wrote it in a book.",
    choices: [
      {
        label: "We disagreed about money.",
        to: "a-last",
        asserts: { quarrel: "money", knew: "close" },
        reply: "Money.\nIt usually is, and it’s usually not.",
      },
      {
        label: "I don’t remember an argument.",
        to: "a-last",
        asserts: { quarrel: "none" },
        reply: "It was loud enough to write down.",
      },
      {
        label: "That wasn’t me.",
        to: "a-last",
        asserts: { quarrel: "none", knew: "no" },
        reply: "Wasn’t it.",
      },
    ],
  },

  "a-last": {
    id: "a-last",
    text: "He came down eleven steps. The doctor says he was helped.\nLast thing.\nYou’ve been steady. Most people aren’t.\nAnything you want to correct.",
    pressure: true,
    callback: {
      claim: "alibi",
      line: "“{said}”\nThat’s where this started, and there’s been nobody in it since.",
    },
    choices: [
      { label: "No.", to: UNVERIFIED, reply: "No." },
      { label: "You’ve had me here four hours.", to: UNVERIFIED },
      { label: "It was an accident.", to: CAUGHT, fatal: true },
    ],
  },

  // --- Reyes: the fork ------------------------------------------------------
  //
  // Stand behind her and he spends the rest of it trying to get daylight
  // between the two accounts. Hedge on her and he stops treating her as an
  // alibi at all, and starts offering you the door she's standing in.

  "w-dana": {
    id: "w-dana",
    text: "Dana Reyes.\nShe’s in four. She’s been very calm about all this.\nShe’ll say what you’re about to say.",
    choices: [
      {
        label: "She will.",
        to: "v-where",
        asserts: { dana: "firm" },
        reply: "Good.\nI’ll hold you to that.",
      },
      { label: "Ask her.", to: "v-where", reply: "We are.\nTwo doors down. Right now." },
      {
        label: "She might not have the times right.",
        to: "h-wrong",
        asserts: { dana: "hedged" },
        reply: "Already.\nWe’re four minutes into this.",
      },
    ],
  },

  // --- Reyes, vouched for: he works on the gap between two accounts ---------

  "v-where": {
    id: "v-where",
    text: "Where was she, then.\nExactly.",
    choices: [
      {
        label: "With me. The whole stretch.",
        to: "v-her-account",
        asserts: { danaSpan: "all" },
        reply: "The whole stretch.",
      },
      {
        label: "She came by around eleven.",
        to: "v-her-account",
        asserts: { danaSpan: "late", time: "late" },
        reply: "Eleven.\nSo the first two hours are yours alone.",
      },
      {
        label: "In and out. She has a dog.",
        to: "v-her-account",
        asserts: { danaSpan: "partial" },
        reply: "In and out.\nThe dog’s the only one of you I can’t interview.",
      },
    ],
  },

  "v-her-account": {
    id: "v-her-account",
    text: "She told the officer on the door she went home at nine.",
    callback: {
      claim: "alibi",
      line: "“{said}”\nThat was four questions ago, and you didn’t hesitate.\nHere’s hers.",
    },
    choices: [
      {
        label: "Then she’s wrong.",
        to: "v-split",
        reply: "One of you is.\nI’ll know which by breakfast.",
      },
      {
        label: "She has it late. It was later than that.",
        to: "v-split",
        asserts: { danaSpan: "all" },
        reply: "Later.",
      },
      {
        label: "Nine. Yes. That’s about right.",
        to: "v-split",
        asserts: { danaSpan: "early" },
        reply: "About right.\nYou agreed with me very quickly there.",
      },
    ],
  },

  "v-split": {
    id: "v-split",
    text: "I’m going to ask her something you won’t be in the room for.\nWhat will she say the two of you ate.",
    pressure: true,
    choices: [
      {
        label: "Nothing. Neither of us ate.",
        to: "v-building",
        asserts: { meal: "none" },
        reply: "Nothing at all, in three hours.",
      },
      {
        label: "Takeaway. The Thai place on Wharf.",
        to: "v-building",
        asserts: { meal: "thai" },
        reply: "They keep receipts.\nI like a place that keeps receipts.",
      },
      {
        label: "How would I know what she’ll say.",
        to: "v-building",
        asserts: { dana: "hedged" },
        reply: "That’s a different answer to the one you started with.",
      },
    ],
  },

  "v-building": {
    id: "v-building",
    text: "Nine Kestrel Street.\nWhen were you last inside it.",
    callback: {
      claim: "location",
      line: "You put the pair of you at “{said}”\nHold that where I can see it.",
    },
    choices: [
      { label: "Never been in it.", to: "w-march", asserts: { inside: "no" }, reply: "Never." },
      {
        label: "Years ago. Before he moved up a floor.",
        to: "w-march",
        asserts: { inside: "yes", knew: "close" },
        reply: "You knew which floor he moved to.",
      },
      {
        label: "Thursday. Dana waited outside.",
        to: "w-march",
        asserts: { inside: "yes", danaSpan: "partial" },
        reply: "Outside.\nIn the cold, while you went up.",
      },
    ],
  },

  // --- Reyes, hedged on: he stops treating her as an alibi ------------------

  "h-wrong": {
    id: "h-wrong",
    text: "You raised her memory before I did.\nSo tell me what it is she’s going to get wrong.",
    choices: [
      {
        label: "The hour she arrived.",
        to: "h-her-account",
        asserts: { danaSpan: "late" },
        reply: "The hour.\nThat’s the part I care about, as it happens.",
      },
      {
        label: "How long she stayed.",
        to: "h-her-account",
        asserts: { danaSpan: "partial" },
        reply: "How long.",
      },
      {
        label: "Nothing. I shouldn’t have said it.",
        to: "h-her-account",
        asserts: { dana: "firm" },
        reply: "No. You shouldn’t.",
      },
    ],
  },

  "h-her-account": {
    id: "h-her-account",
    text: "She told the officer on the door she went home at nine.\nIs that one of the things she’s got wrong.",
    callback: {
      claim: "location",
      line: "“{said}”\nYou gave me that before you gave me her.\nI’m keeping them in the order you said them.",
    },
    choices: [
      {
        label: "Yes. She was there past midnight.",
        to: "h-alone",
        asserts: { danaSpan: "all" },
        reply: "Past midnight.",
      },
      {
        label: "No. Nine is right.",
        to: "h-alone",
        asserts: { danaSpan: "early" },
        reply: "Then the rest of the night is yours.",
      },
      {
        label: "I don’t know what she told anyone.",
        to: "h-alone",
        reply: "No.\nThat’s rather the trouble with her, isn’t it.",
      },
    ],
  },

  "h-alone": {
    id: "h-alone",
    text: "Take her out of it a moment.\nIf she had never been there at all — what would you be telling me.",
    pressure: true,
    callback: {
      claim: "alibi",
      line: "“{said}”\nThat was the first thing you offered me, before I asked for anyone.",
    },
    choices: [
      { label: "The same thing.", to: "h-building", reply: "The same thing." },
      {
        label: "That I was on my own.",
        to: "h-building",
        asserts: { alibi: "alone" },
        reply: "There it is.",
      },
      {
        label: "That isn’t a question I’m going to answer.",
        to: "h-building",
        reply: "No.\nYou’re the first one tonight to notice it was a question.",
      },
    ],
  },

  "h-building": {
    id: "h-building",
    text: "Nine Kestrel Street.\nShe won’t be able to help you with this one either.\nWhen were you last inside it.",
    choices: [
      { label: "Never been in it.", to: "w-march", asserts: { inside: "no" }, reply: "Never." },
      {
        label: "Years ago. Before he moved up a floor.",
        to: "w-march",
        asserts: { inside: "yes", knew: "close" },
        reply: "You knew which floor he moved to.",
      },
      {
        label: "Thursday. Early evening, before nine.",
        to: "w-march",
        asserts: { inside: "yes" },
        reply: "Thursday.\nAnd she wasn’t with you for that part.",
      },
    ],
  },

  // --- Reyes: back together for the last two -------------------------------

  "w-march": {
    id: "w-march",
    text: "March the ninth.\nYou and he in the entryway, loud enough that somebody upstairs wrote it in a book.\nReyes was there for that one too.",
    callback: {
      claim: "knew",
      line: "“{said}”\nI’d like you to hear that back before you answer this one.",
    },
    choices: [
      {
        label: "We disagreed about money.",
        to: "w-last",
        asserts: { quarrel: "money", knew: "close" },
        reply: "Money.\nIt usually is, and it’s usually not.",
      },
      {
        label: "I don’t remember an argument.",
        to: "w-last",
        asserts: { quarrel: "none" },
        reply: "Two of you were there and neither remembers it.",
      },
      {
        label: "Ask Dana about March.",
        to: "w-last",
        asserts: { dana: "firm" },
        reply: "I intend to.\nYou keep sending me back to her.",
      },
    ],
  },

  "w-last": {
    id: "w-last",
    text: "He came down eleven steps. The doctor says he was helped.\nLast thing.\nAnything you want to correct.",
    pressure: true,
    choices: [
      { label: "No.", to: RELEASED, reply: "No." },
      { label: "Dana’s memory isn’t what it was.", to: DEFLECTED },
      { label: "It was an accident.", to: CAUGHT, fatal: true },
    ],
  },

  // --- endings -------------------------------------------------------------

  [CAUGHT]: {
    id: CAUGHT,
    text: "All right. We’ll stop.\nI’m going to read it back. Not for you — for the file.",
    choices: [],
    ending: "loss",
    stamp: "CHARGED",
    close:
      "Three times you moved.\nThat isn’t nerves. Nerves shake. They don’t rearrange.\nSomebody will be in shortly with a form and a pen that doesn’t work.\nStay sitting. It’s warmer in here than where you’re going.",
  },

  [RELEASED]: {
    id: RELEASED,
    text: "Hm.\nLet me read it back.",
    choices: [],
    ending: "win",
    stamp: "RELEASED",
    close:
      "It holds.\nEverywhere I pushed at it, it held.\nReyes gave it the same way you did, in a different room, without being told a word of yours.\nThat’s the part I can’t argue with, and I did try.\nSign at the desk. Take your coat — it’s cold, and I’m not offering you a lift.",
  },

  // Same trigger as ever: a witness in the account, and a record that moved.
  // What it costs is somebody else.
  [DEFLECTED]: {
    id: DEFLECTED,
    text: "Hm.\nLet me read it back. You should hear how it sounds from this side.",
    choices: [],
    ending: "finish",
    stamp: "SUBJECT AMENDED",
    close:
      "You walked in here with her name, and you’re walking out having spent it.\nEvery soft place in that account, you let fall on her side of the table. I didn’t put it there.\nShe’s been in four since eight. Nobody has read her any of this yet.\nSomebody will, inside the hour, and she’ll have to account for a night you’ve just finished describing without her.\nGo on. Your coat’s at the desk.\nThat room hasn’t got a window either, so she won’t see you go.",
  },

  [UNVERIFIED]: {
    id: UNVERIFIED,
    text: "Hm.\nLet me read it back.",
    choices: [],
    ending: "finish",
    stamp: "UNRESOLVED",
    close:
      "There’s nothing in there I can prove is a lie.\nThere’s nothing in there I can check either. You were alone.\nAlone is only a word. It’s the one word I can’t do anything with.\nSo you’ll go home, and this stays open on my desk where I can see it.\nDon’t leave the city. That isn’t a threat, it’s paperwork.",
  },
};
