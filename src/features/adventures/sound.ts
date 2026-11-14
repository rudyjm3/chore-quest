/**
 * Tiny synthesised feedback sounds (ADR 0016): no audio files, so nothing to ship through the asset
 * manifest yet. Callers pass whether sound is on; this module never decides that itself, and it only
 * ever runs in response to a child's own action (browsers require that to start audio anyway).
 */
type Tone = { freq: number; at: number; length: number };

const TONES: Record<"solved" | "oops", Tone[]> = {
  solved: [
    { freq: 523.25, at: 0, length: 0.14 },
    { freq: 659.25, at: 0.14, length: 0.14 },
    { freq: 783.99, at: 0.28, length: 0.28 },
  ],
  oops: [{ freq: 261.63, at: 0, length: 0.22 }],
};

let context: AudioContext | null = null;

export function playFeedbackSound(kind: "solved" | "oops", soundOn: boolean): void {
  if (!soundOn || typeof window === "undefined") return;
  try {
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    const ctx = context;
    if (ctx.state === "suspended") void ctx.resume();
    for (const tone of TONES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + tone.at;
      osc.type = "sine";
      osc.frequency.value = tone.freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02); // quiet on purpose
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + tone.length + 0.05);
    }
  } catch {
    // Audio is a nicety; never let it break the page.
  }
}
