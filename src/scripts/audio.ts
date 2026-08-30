// The typewriter's own noise, synthesised. No files, no fetches --- three
// voices built out of one short buffer of white noise and one oscillator.
//
// Nothing here schedules ahead of `currentTime`. That is deliberate: a line the
// player skips has to go quiet on the same frame they ask for it, and anything
// queued into the future would arrive after the text it belonged to. It also
// means `cut()` only has to deal with what is already sounding.
//
// The context is not created until the player has actually done something.
// Until then `strike()` is a no-op and the opening record types in silence,
// which is the autoplay policy's rule rather than a compromise with it: a
// suspended context's `currentTime` doesn't advance, so scheduling into one
// collapses every envelope to zero length (learned the hard way in crit 4).

/** One strike per this many characters that aren't spaces. */
const STRIKE_EVERY = 3;

const CLICK_HZ = 2000;
const CARRIAGE_HZ = 760;
const LEVEL = 0.26;
const MUTE_KEY = "record-of-interview.tape";

/**
 * Voices are scheduled this far ahead of `currentTime`, never at it.
 * `currentTime` is the start of the render quantum that has already gone, so an
 * envelope pinned to it is partly in the past --- and an 8ms envelope entirely
 * in the past renders as its own end state, which is silence. Same trap as
 * scheduling into a suspended context, different clock.
 */
const LOOKAHEAD = 0.008;

/**
 * The closest two voices are allowed to land. Ordinary typing is 90ms apart so
 * this never binds; it only bites when a whole block of text arrives at once,
 * which is what happens with the typewriter off --- and a dozen bursts stacked
 * on one instant is a thump, not typing.
 */
const MIN_GAP = 0.03;

/**
 * Whether this character sounds. Spaces never do --- the space bar is the one
 * key with no typebar behind it --- and only every third of the rest does,
 * because a click per character at 30ms is a buzz rather than typing.
 */
export function striking(character: string, nonSpaceIndex: number): boolean {
  if (!/\S/u.test(character)) return false;
  return nonSpaceIndex % STRIKE_EVERY === 0;
}

/** The characters that end a sentence, and so get the carriage rather than a click. */
export function returning(character: string): boolean {
  return character === "." || character === "?" || character === "!";
}

export interface Typebar {
  /** Create or resume the context. Only ever called from a real gesture. */
  wake(): void;
  /** Whether anything can sound yet. */
  live(): boolean;
  strike(): void;
  carriage(): void;
  thud(): void;
  /** Stop everything sounding, now. */
  cut(): void;
  muted(): boolean;
  mute(value: boolean): void;
}

interface AudioWindow extends Window {
  AudioContext?: typeof AudioContext;
}

interface Burst {
  readonly hz: number;
  readonly q: number;
  readonly peak: number;
  readonly decay: number;
  readonly type: BiquadFilterType;
}

/** A multiplier within +/- spread of 1, so no two keystrokes are identical. */
function jitter(spread: number): number {
  return 1 + (Math.random() - 0.5) * 2 * spread;
}

function readMuted(scope: Window): boolean {
  try {
    return scope.sessionStorage.getItem(MUTE_KEY) === "off";
  } catch {
    return false;
  }
}

function writeMuted(scope: Window, value: boolean): void {
  try {
    scope.sessionStorage.setItem(MUTE_KEY, value ? "off" : "on");
  } catch {
    // a browser refusing storage is not a reason to refuse sound
  }
}

export function createTypebar(scope: Window): Typebar {
  const host = scope as AudioWindow;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let silent = readMuted(scope);
  let nextFree = 0;
  const sounding = new Set<AudioScheduledSourceNode>();

  function wake(): void {
    if (ctx === null) {
      const Ctor = host.AudioContext;
      if (typeof Ctor !== "function") return;
      ctx = new Ctor();
      noise = hiss(ctx);
      master = ctx.createGain();
      master.gain.setValueAtTime(silent ? 0 : LEVEL, ctx.currentTime);
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  }

  const live = (): boolean => ctx !== null && ctx.state === "running";

  /** Everything a voice needs, or null if nothing should sound right now. */
  function bench(): { at: number; out: GainNode; ctx: AudioContext } | null {
    if (ctx === null || master === null || silent || ctx.state !== "running") return null;
    const at = Math.max(ctx.currentTime + LOOKAHEAD, nextFree);
    nextFree = at + MIN_GAP;
    return { at, out: master, ctx };
  }

  function play(node: AudioScheduledSourceNode, at: number, until: number): void {
    // Every node in here has been started, so cut() can always stop it.
    sounding.add(node);
    node.addEventListener("ended", () => sounding.delete(node));
    node.start(at);
    node.stop(until);
  }

  /** One filtered puff of noise: the shape all the percussive parts are made of. */
  function burst(where: { at: number; out: GainNode; ctx: AudioContext }, shape: Burst): void {
    const { at, out, ctx: c } = where;
    if (noise === null) return;
    const source = c.createBufferSource();
    source.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = shape.type;
    filter.frequency.setValueAtTime(shape.hz, at);
    filter.Q.setValueAtTime(shape.q, at);
    const level = c.createGain();
    // Scheduled, never assigned: a bare gain.value mid-envelope steps and clicks.
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(shape.peak, at + 0.0008);
    level.gain.exponentialRampToValueAtTime(0.0004, at + shape.decay);
    level.gain.setValueAtTime(0, at + shape.decay + 0.001);
    source.connect(filter).connect(level).connect(out);
    play(source, at, at + shape.decay + 0.004);
  }

  return {
    wake,
    live,

    /** A letter hitting the platen. Short, dry, and never twice the same. */
    strike(): void {
      const where = bench();
      if (where === null) return;
      burst(where, {
        hz: CLICK_HZ * jitter(0.07),
        q: 7,
        peak: 0.55 * jitter(0.1),
        decay: 0.008,
        type: "bandpass",
      });
    },

    /** The end of a sentence: lower, broader, with the weight of the return under it. */
    carriage(): void {
      const where = bench();
      if (where === null) return;
      burst(where, {
        hz: CARRIAGE_HZ * jitter(0.05),
        q: 2.2,
        peak: 0.4 * jitter(0.08),
        decay: 0.05,
        type: "bandpass",
      });
      burst(where, { hz: 300, q: 0.7, peak: 0.28, decay: 0.08, type: "lowpass" });
    },

    /** A stamp coming down. Not a click --- a weight. */
    thud(): void {
      const where = bench();
      if (where === null) return;
      const { at, out, ctx: c } = where;
      const body = c.createOscillator();
      body.type = "sine";
      body.frequency.setValueAtTime(128 * jitter(0.05), at);
      body.frequency.exponentialRampToValueAtTime(44, at + 0.09);
      const level = c.createGain();
      level.gain.setValueAtTime(0, at);
      level.gain.linearRampToValueAtTime(0.95, at + 0.004);
      level.gain.exponentialRampToValueAtTime(0.0004, at + 0.17);
      level.gain.setValueAtTime(0, at + 0.18);
      body.connect(level).connect(out);
      play(body, at, at + 0.2);
      // the felt actually meeting the paper
      burst(where, { hz: 420, q: 0.9, peak: 0.5, decay: 0.045, type: "lowpass" });
    },

    cut(): void {
      // Every node in here has been started, so stop() is always legal; one
      // whose start is still ahead of the clock simply never sounds.
      for (const voice of [...sounding]) voice.stop();
      sounding.clear();
      nextFree = 0;
    },

    muted: () => silent,

    mute(value: boolean): void {
      silent = value;
      writeMuted(scope, value);
      if (value) this.cut();
      if (ctx !== null && master !== null) {
        master.gain.setTargetAtTime(value ? 0 : LEVEL, ctx.currentTime, 0.008);
      }
    },
  };
}

/** Sixty milliseconds of white noise, made once and re-read by every voice. */
function hiss(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.06), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
  return buffer;
}
