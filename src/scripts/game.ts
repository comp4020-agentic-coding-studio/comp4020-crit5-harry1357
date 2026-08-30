// The room. This file renders a state and dispatches an answer; every decision
// --- what collides, what it costs, which ending the record has earned --- is
// made in ../lib/interrogation.ts and never here.

import {
  MAX_SUSPICION,
  answer,
  begin,
  catchLine,
  type Contradiction,
} from "../lib/interrogation";
import { PREAMBLE, REGISTER, START, passages, type Choice, type Passage } from "../lib/story";
import { createTypebar, returning, striking } from "./audio";

const doc = document;
const view = doc.defaultView;
if (!view) throw new Error("no window");
const win: Window = view;

function must<T extends HTMLElement>(id: string): T {
  const found = doc.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
}

const record = must<HTMLElement>("record");
const choices = must<HTMLElement>("choices");
const marks = must<HTMLElement>("marks");
const announce = must<HTMLElement>("announce");
const stamps = [...marks.querySelectorAll<SVGElement>(".stamp")];
const reel = must<HTMLButtonElement>("reel");

const tape = createTypebar(win);

const still = win.matchMedia("(prefers-reduced-motion: reduce)");
const animated = (): boolean => !still.matches;

// Typing pace. The beat after a full stop is most of what makes him sound
// unhurried, so it is longer than it looks like it should be.
const CHAR_MS = 30;
const STOP_MS = 260;
const COMMA_MS = 90;
const LINE_MS = 240;
const REVEAL_MS = 130;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    win.setTimeout(resolve, ms);
  });

// --- following the record ---------------------------------------------------

function atBottom(): boolean {
  return win.innerHeight + win.scrollY >= doc.body.scrollHeight - 260;
}

function follow(wasAtBottom: boolean): void {
  if (!wasAtBottom) return;
  win.scrollTo({ top: doc.body.scrollHeight, behavior: "auto" });
}

function append(element: HTMLElement): void {
  const stick = atBottom();
  record.append(element);
  follow(stick);
}

// --- typing -----------------------------------------------------------------

let typing = false;
let skipRequested = false;

function requestSkip(): void {
  if (!typing) return;
  skipRequested = true;
  // Nothing is scheduled ahead, so this only has to silence what is already
  // sounding --- there is no queue to flush.
  tape.cut();
}

/** The tape mark is a control, not somewhere to click to hurry him along. */
const onTheReel = (event: Event): boolean =>
  event.target instanceof Node && reel.contains(event.target);

// A mouse grants activation on the down, a key on the down, and a touch only on
// the way back up --- so all three are hooked, and wake() is idempotent.
doc.addEventListener("pointerdown", (event) => {
  tape.wake();
  if (!onTheReel(event)) requestSkip();
});
doc.addEventListener("pointerup", () => {
  tape.wake();
});
doc.addEventListener(
  "keydown",
  (event) => {
    tape.wake();
    if (onTheReel(event)) return;
    if (!event.metaKey && !event.ctrlKey && !event.altKey) requestSkip();
  },
  { capture: true },
);

function paintReel(): void {
  const on = !tape.muted();
  reel.setAttribute("aria-pressed", String(on));
  reel.classList.toggle("is-off", !on);
}

reel.addEventListener("click", () => {
  tape.wake();
  tape.mute(!tape.muted());
  paintReel();
});
paintReel();

/** How long to hold after a character, so he sounds like he has all night. */
function beatAfter(character: string): number {
  if (returning(character)) return STOP_MS;
  if (character === "," || character === "—" || character === ";") return COMMA_MS;
  return CHAR_MS;
}

function typeInto(element: HTMLElement, text: string): Promise<void> {
  if (!animated()) {
    element.textContent = text;
    // Nothing is being typed here, so there are no keystrokes to sound --- but
    // a motion preference is not a sound preference, and silence would be a
    // second thing taken away. One sound as the line lands, and a carriage if
    // it lands on the end of a sentence.
    const tail = text.replace(/[”"’'\s]+$/u, "").slice(-1);
    if (returning(tail)) tape.carriage();
    else tape.strike();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let index = 0;
    let letters = 0;
    const step = (): void => {
      if (skipRequested) {
        element.textContent = text;
        resolve();
        return;
      }
      index += 1;
      const character = text[index - 1];
      element.textContent = text.slice(0, index);
      if (returning(character)) tape.carriage();
      else if (striking(character, letters)) tape.strike();
      if (/\S/u.test(character)) letters += 1;
      if (index >= text.length) {
        resolve();
        return;
      }
      win.setTimeout(step, beatAfter(character));
    };
    step();
  });
}

/** A pause the player can cut short, the same way they can cut a line short. */
async function hold(ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until && !skipRequested) await wait(60);
}

/**
 * The point of the red ink is that you see your own words marked up. On a phone
 * the line it lands on is usually two screens above the one you're reading, so
 * go and look at it, then come back.
 */
async function visitTheOldLine(index: number): Promise<void> {
  const older = line(index);
  if (!older) return;
  const box = older.getBoundingClientRect();
  const headroom = marks.getBoundingClientRect().bottom;
  if (box.top >= headroom && box.bottom <= win.innerHeight) return;
  const behavior = animated() ? "smooth" : "auto";
  const came = win.scrollY;
  win.scrollTo({ top: Math.max(0, came + box.top - win.innerHeight * 0.4), behavior });
  await hold(animated() ? 1300 : 800);
  win.scrollTo({ top: came, behavior });
  await hold(animated() ? 400 : 0);
}

/** One block of the interrogator's speech, a line at a time. */
async function say(text: string, variant = "", afterFirstLine?: () => void | Promise<void>): Promise<void> {
  const lines = text.split("\n").filter((line) => line.length > 0);
  for (const [index, line] of lines.entries()) {
    const paragraph = doc.createElement("p");
    paragraph.className = variant ? `speech ${variant}` : "speech";
    append(paragraph);
    await typeInto(paragraph, line);
    if (index === 0 && afterFirstLine) await afterFirstLine();
    if (index < lines.length - 1 && animated() && !skipRequested) await wait(LINE_MS);
  }
  announce.textContent = lines.join(" ");
}

// --- the record itself ------------------------------------------------------

function said(text: string, line: number): void {
  const paragraph = doc.createElement("p");
  paragraph.className = "said";
  paragraph.dataset.line = String(line);
  const quote = doc.createElement("span");
  quote.className = "quote";
  quote.textContent = text;
  paragraph.append(quote);
  append(paragraph);
}

/**
 * Red ink over a line that is now known not to be true, and a circled number in
 * the margin matching it to the line it collided with. A line can collide more
 * than once --- an opening answer three later answers all talk past --- so the
 * rings stack rather than replace each other, or the pairing lies.
 */
function strike(target: HTMLElement | null, ordinal: number): void {
  if (!target) return;
  target.classList.add("is-struck");
  let gutter = target.querySelector<HTMLElement>(".marginalia");
  if (!gutter) {
    gutter = doc.createElement("span");
    gutter.className = "marginalia";
    gutter.setAttribute("aria-hidden", "true");
    target.prepend(gutter);
  }
  const ring = doc.createElement("span");
  ring.className = "ring";
  ring.style.setProperty("--tilt", `${(ordinal % 2 === 0 ? 7 : -8) - ordinal}deg`);
  ring.textContent = String(ordinal);
  gutter.append(ring);
  if (animated()) {
    target.classList.add("is-inking");
    ring.classList.add("is-landing");
    win.setTimeout(() => {
      target.classList.remove("is-inking");
      ring.classList.remove("is-landing");
    }, 700);
  }
}

const line = (index: number): HTMLElement | null =>
  doc.querySelector<HTMLElement>(`.said[data-line="${index}"]`);

const MARK_WORDS = ["An unmarked file.", "One mark.", "Two marks.", "Three marks."];

function land(suspicion: number): void {
  marks.setAttribute("aria-label", MARK_WORDS[Math.min(suspicion, MAX_SUSPICION)]);
  const stamp = stamps[suspicion - 1];
  if (!stamp) return;
  stamp.classList.add("is-stamped");
  tape.thud();
  if (animated()) {
    stamp.classList.add("is-landing");
    doc.body.classList.add("is-jolted");
    win.setTimeout(() => doc.body.classList.remove("is-jolted"), 180);
    win.setTimeout(() => stamp.classList.remove("is-landing"), 400);
  }
}

/**
 * Something said several questions ago, read back on the way into this one.
 * The words come out of the transcript rather than out of this file, so it is
 * always what the player actually said. Nothing is scored --- if no line on the
 * record ever set that claim, he simply doesn't bring it up.
 */
function callbackLine(passage: Passage): string | null {
  const recall = passage.callback;
  if (!recall) return null;
  const source = state.transcript.find((entry) => recall.claim in entry.asserted);
  if (!source) return null;
  return recall.line.replaceAll("{said}", source.said);
}

/**
 * How he sounds leaning on this one, given what's already on the file. The
 * cursor advances rather than indexing off the transcript length: keyed off the
 * length, two pressure points that happen to be four answers apart draw the
 * same line, and hearing it twice in one interview reads as a loop.
 */
let asides = 0;

function registerLine(passage: Passage): string | null {
  if (passage.pressure !== true) return null;
  const tier = REGISTER[Math.min(state.suspicion, REGISTER.length - 1)];
  const line = tier[asides % tier.length] ?? null;
  asides += 1;
  return line;
}

/** Everything he says before the question itself, in the same breath as it. */
async function approach(passage: Passage): Promise<void> {
  for (const line of [registerLine(passage), callbackLine(passage)]) {
    if (line === null) continue;
    await say(line);
    if (animated() && !skipRequested) await wait(LINE_MS);
  }
}

// --- answers ----------------------------------------------------------------

let state = begin(START);
let played = false;
let busy = false;

function renderChoices(passage: Passage): void {
  const list = doc.createElement("ul");
  list.className = "options";
  passage.choices.forEach((choice, index) => {
    const item = doc.createElement("li");
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "option";
    button.textContent = choice.label;
    button.addEventListener("click", () => {
      void pick(index);
    });
    item.append(button);
    list.append(item);
  });
  const stick = atBottom();
  choices.replaceChildren(list);
  if (animated()) {
    list.classList.add("is-arriving");
    win.setTimeout(() => list.classList.remove("is-arriving"), 320);
  }
  follow(stick);
  if (played) list.querySelector("button")?.focus();
}

async function clearChoices(): Promise<void> {
  const list = choices.firstElementChild;
  if (list && animated()) {
    list.classList.add("is-leaving");
    await wait(110);
  }
  choices.replaceChildren();
}

async function pick(index: number): Promise<void> {
  if (busy) return;
  busy = true;
  played = true;

  const from = passages[state.at];
  const choice: Choice | undefined = from?.choices[index];
  const step = answer(passages, state, index);
  if (step.state === state || !choice) {
    busy = false;
    return;
  }

  await clearChoices();
  state = step.state;
  said(choice.label, state.transcript.length - 1);
  if (animated()) await wait(320);

  typing = true;
  skipRequested = false;
  if (step.caught) await deliverCatch(step.caught);
  else if (choice.reply) await say(choice.reply);

  const now = passages[state.at];
  if (!now) {
    typing = false;
    busy = false;
    return;
  }
  if (animated() && !skipRequested) await wait(LINE_MS);
  skipRequested = false;
  await approach(now);
  await say(now.text);
  typing = false;

  if (now.ending) await closeTheFile(now);
  else renderChoices(now);
  busy = false;
}

/** He quotes it back, the old line gets circled, and a mark lands on the file. */
async function deliverCatch(caught: Contradiction): Promise<void> {
  const ordinal = state.contradictions.length;
  await say(catchLine(caught), "speech-catch", async () => {
    strike(line(caught.earlier), ordinal);
    strike(line(caught.now), ordinal);
    land(state.suspicion);
    announce.textContent = `That line is circled in red. ${MARK_WORDS[state.suspicion]}`;
    await visitTheOldLine(caught.earlier);
  });
}

// --- the finished report ----------------------------------------------------

async function closeTheFile(ending: Passage): Promise<void> {
  const marked = new Map<number, number[]>();
  state.contradictions.forEach((contradiction, index) => {
    for (const at of [contradiction.earlier, contradiction.now]) {
      marked.set(at, [...(marked.get(at) ?? []), index + 1]);
    }
  });

  const list = doc.createElement("ol");
  list.className = "report";
  append(list);

  for (const [index, line] of state.transcript.entries()) {
    const item = doc.createElement("li");
    item.className = "quoted";
    item.dataset.sum = String(index);
    const quote = doc.createElement("span");
    quote.className = "quote";
    quote.textContent = `“${line.said}”`;
    item.append(quote);
    const stick = atBottom();
    list.append(item);
    for (const ordinal of marked.get(index) ?? []) strike(item, ordinal);
    if (animated()) {
      item.classList.add("is-reading");
      win.setTimeout(() => item.classList.remove("is-reading"), 400);
    }
    follow(stick);
    if (animated()) await wait(REVEAL_MS);
  }

  announce.textContent = state.transcript.map((line) => line.said).join(" ");

  if (animated()) await wait(500);
  typing = true;
  skipRequested = false;
  if (ending.close) await say(ending.close);
  typing = false;

  if (ending.stamp) stampVerdict(ending);
  offerAnother();
}

function stampVerdict(ending: Passage): void {
  const verdict = doc.createElement("p");
  verdict.className = "verdict";
  tape.thud();
  verdict.dataset.outcome = ending.ending ?? "finish";
  verdict.textContent = ending.stamp ?? "";
  const stick = atBottom();
  record.append(verdict);
  if (animated()) {
    verdict.classList.add("is-landing");
    doc.body.classList.add("is-jolted");
    win.setTimeout(() => doc.body.classList.remove("is-jolted"), 180);
    win.setTimeout(() => verdict.classList.remove("is-landing"), 500);
  }
  follow(stick);
}

function offerAnother(): void {
  const list = doc.createElement("ul");
  list.className = "options";
  const item = doc.createElement("li");
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "option";
  button.textContent = "Bring in the next one.";
  button.addEventListener("click", () => {
    void restart();
  });
  item.append(button);
  list.append(item);
  const stick = atBottom();
  choices.replaceChildren(list);
  if (animated()) {
    list.classList.add("is-arriving");
    win.setTimeout(() => list.classList.remove("is-arriving"), 320);
  }
  follow(stick);
  button.focus();
}

async function restart(): Promise<void> {
  if (busy) return;
  busy = true;
  await clearChoices();
  record.replaceChildren();
  for (const stamp of stamps) stamp.classList.remove("is-stamped");
  marks.setAttribute("aria-label", MARK_WORDS[0]);
  state = begin(START);
  asides = 0;
  // the tape mark is deliberately not reset: a player who turned it off has
  // said so once
  played = true;
  win.scrollTo({ top: 0, behavior: "auto" });
  await open();
  busy = false;
}

// --- the interview starts already in progress -------------------------------

async function open(): Promise<void> {
  const first = passages[START];
  if (!first) return;
  typing = true;
  skipRequested = false;
  await say(PREAMBLE, "speech-record");
  if (animated() && !skipRequested) await wait(LINE_MS);
  await say(first.text);
  typing = false;
  renderChoices(first);
}

record.replaceChildren();
choices.replaceChildren();
void open();
