/**
 * Sound design (off by default; the user turns it on with the speaker button).
 *
 * Every bin has its own short chime, built with the Web Audio API (no audio files):
 * soft sine + triangle partials with a quick attack and a gentle exponential decay,
 * like a small mallet on a glass. All notes come from one C-major pentatonic scale,
 * so any sequence of sorts sounds consonant together.
 *
 * - Recycling: bright rising third. Food scraps: warm low fifth. Garbage: a single
 *   muted low note (no "reward" for landfill). Depot: coin-like high double ping.
 *   Eco Station: two careful notes. Check first: a gentle questioning rise.
 * - "Collect": a tiny sparkle when the impact tally goes up.
 * - Streak: each diverted item in a row adds the next note of a rising pentatonic
 *   melody, which resets when something goes to landfill.
 */
import type { DestinationId } from '@trashifyyeg/shared/rules/types';

// C-major pentatonic, C4..E6 (Hz)
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
const N = (i: number) => SCALE[Math.max(0, Math.min(SCALE.length - 1, i))]!;

type Phrase = { f: number; t: number; d?: number; v?: number }[];

const PHRASES: Record<DestinationId, Phrase> = {
  edm_blue_bag: [{ f: N(5), t: 0 }, { f: N(7), t: 0.09 }],
  uofa_recyclables: [{ f: N(5), t: 0 }, { f: N(7), t: 0.09 }],
  uofa_mixed_paper: [{ f: N(6), t: 0 }, { f: N(8), t: 0.09 }],
  edm_green_cart: [{ f: N(2), t: 0, d: 0.7 }, { f: N(5), t: 0.11, d: 0.7 }],
  uofa_organics: [{ f: N(2), t: 0, d: 0.7 }, { f: N(5), t: 0.11, d: 0.7 }],
  bottle_depot: [{ f: N(10), t: 0, d: 0.25 }, { f: N(12), t: 0.07, d: 0.45 }],
  eco_station: [{ f: N(3), t: 0, d: 0.5 }, { f: N(3), t: 0.16, d: 0.5 }],
  uofa_battery_bin: [{ f: N(3), t: 0, d: 0.5 }, { f: N(3), t: 0.16, d: 0.5 }],
  uofa_special: [{ f: N(3), t: 0, d: 0.5 }, { f: N(4), t: 0.16, d: 0.5 }],
  edm_black_cart: [{ f: N(0) / 2 * 1.5, t: 0, d: 0.5, v: 0.5 }],
  uofa_landfill: [{ f: N(0) / 2 * 1.5, t: 0, d: 0.5, v: 0.5 }],
  check_local: [{ f: N(4), t: 0, d: 0.35 }, { f: N(6), t: 0.14, d: 0.6 }],
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      // A touch of low-pass keeps the high notes soft instead of piercing.
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4200;
      master.connect(lp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { ctx, out: master! };
  } catch {
    return null;
  }
}

/** One mallet note: fundamental (sine) + a quiet octave (triangle) for shimmer. */
function note(a: { ctx: AudioContext; out: GainNode }, f: number, at: number, dur = 0.45, vol = 1) {
  const t0 = a.ctx.currentTime + at;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.9 * vol, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  env.connect(a.out);
  for (const [type, mult, g] of [['sine', 1, 1], ['triangle', 2, 0.18]] as const) {
    const o = a.ctx.createOscillator();
    const og = a.ctx.createGain();
    o.type = type;
    o.frequency.value = f * mult;
    og.gain.value = g;
    o.connect(og).connect(env);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
}

let enabled = false;
export const sound = {
  get enabled() {
    return enabled;
  },
  set enabled(v: boolean) {
    enabled = v;
    if (v) audio(); // create/resume inside the user's tap (autoplay rules)
  },
  bin(dest: DestinationId) {
    const a = enabled ? audio() : null;
    if (!a) return;
    for (const p of PHRASES[dest] ?? []) note(a, p.f, p.t, p.d, p.v);
  },
  /** Sparkle + the streak's next melody note, after the bin chime. */
  collect(streak: number) {
    const a = enabled ? audio() : null;
    if (!a) return;
    note(a, N(9), 0.32, 0.18, 0.35);
    note(a, N(11), 0.38, 0.22, 0.3);
    if (streak >= 2) note(a, N(Math.min(SCALE.length - 1, 4 + streak)), 0.5, 0.6, 0.55);
  },
};
