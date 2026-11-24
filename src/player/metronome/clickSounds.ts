/** Metronome sounds, synthesized with Web Audio so no sample files are needed. */

export type MetronomeSound = "click" | "woodblock" | "beep" | "cowbell" | "hihat";

export const METRONOME_SOUNDS: { id: MetronomeSound; label: string }[] = [
  { id: "click", label: "Click" },
  { id: "woodblock", label: "Woodblock" },
  { id: "beep", label: "Beep" },
  { id: "cowbell", label: "Cowbell" },
  { id: "hihat", label: "Hi-hat" },
];

/** Gain ramps can't reach zero, so silence is this. */
const SILENT = 0.0001;

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.3), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** A sharp attack and exponential decay, peaking at `peak`. */
function envelope(ctx: BaseAudioContext, when: number, peak: number, decay: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(SILENT, peak), when + 0.002);
  gain.gain.exponentialRampToValueAtTime(SILENT, when + 0.002 + decay);
  return gain;
}

function tone(ctx: BaseAudioContext, type: OscillatorType, frequency: number, when: number) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  return osc;
}

function noise(ctx: BaseAudioContext) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  return source;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q = 1) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

/**
 * Schedules one click at `when` (audio context time) and returns its sources, so a click that
 * hasn't sounded yet can be cancelled. Accented clicks are louder and pitched up.
 */
export function playClick(
  ctx: BaseAudioContext,
  sound: MetronomeSound,
  when: number,
  accent: boolean,
  volume: number,
): AudioScheduledSourceNode[] {
  const peak = volume * (accent ? 1 : 0.6);
  const chain = (sources: AudioScheduledSourceNode[], nodes: AudioNode[], decay: number) => {
    const env = envelope(ctx, when, peak, decay);
    let input: AudioNode = env;
    for (const node of [...nodes].reverse()) {
      node.connect(input);
      input = node;
    }
    env.connect(ctx.destination);
    for (const source of sources) {
      source.connect(input);
      source.start(when);
      source.stop(when + decay + 0.05);
    }
    return sources;
  };

  switch (sound) {
    case "click":
      return chain([tone(ctx, "triangle", accent ? 2400 : 1600, when)], [], 0.03);
    case "beep":
      return chain([tone(ctx, "sine", accent ? 1320 : 880, when)], [], 0.08);
    case "woodblock": {
      const body = tone(ctx, "sine", accent ? 1250 : 900, when);
      body.frequency.exponentialRampToValueAtTime(accent ? 1000 : 720, when + 0.05);
      return chain([body, noise(ctx)], [filter(ctx, "bandpass", accent ? 1250 : 900, 8)], 0.06);
    }
    case "cowbell": {
      const scale = accent ? 1.15 : 1;
      return chain(
        [tone(ctx, "square", 587 * scale, when), tone(ctx, "square", 845 * scale, when)],
        [filter(ctx, "bandpass", 900 * scale, 3)],
        accent ? 0.3 : 0.2,
      );
    }
    case "hihat":
      return chain([noise(ctx)], [filter(ctx, "highpass", 7000)], accent ? 0.12 : 0.05);
  }
}
