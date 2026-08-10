import type { CareAction } from "./needs";

export type CompanionSoundName =
  | "bark" | "purr" | "chime" | "snack" | "slurp"
  | "happy" | "sleepy" | "wake" | "yip";

export interface SoundVoice {
  hz: number;
  endHz?: number;
  delayMs: number;
  durationMs: number;
  gain: number;
  wave: OscillatorType;
}

export interface SoundRecipe {
  masterGain: number;
  voices: SoundVoice[];
  noise?: { gain: number; frequency: number; durationMs: number };
}

const voice = (
  hz: number, delayMs: number, durationMs: number, gain: number,
  wave: OscillatorType = "triangle", endHz?: number,
): SoundVoice => ({ hz, delayMs, durationMs, gain, wave, endHz });

/** Warm, short sound recipes designed to read as a tiny animal—not an alert. */
export function soundRecipe(name: CompanionSoundName): SoundRecipe {
  switch (name) {
    case "bark": return {
      masterGain: .18,
      voices: [
        voice(290, 0, 145, .8, "sawtooth", 150),
        voice(245, 185, 135, .72, "sawtooth", 132),
      ],
      noise: { gain: .18, frequency: 720, durationMs: 330 },
    };
    case "yip": return {
      masterGain: .13,
      voices: [voice(610, 0, 105, .7, "triangle", 880), voice(760, 125, 90, .5, "sine", 980)],
    };
    case "purr": return {
      masterGain: .1,
      voices: [
        voice(73, 0, 380, .6, "sine"), voice(82, 100, 360, .45, "sine"),
        voice(92, 220, 320, .35, "sine"),
      ],
      noise: { gain: .035, frequency: 170, durationMs: 560 },
    };
    case "snack": return {
      masterGain: .13,
      voices: [voice(523.25, 0, 105, .55), voice(659.25, 105, 105, .55), voice(783.99, 210, 130, .62)],
    };
    case "slurp": return {
      masterGain: .12,
      voices: [
        voice(310, 0, 170, .46, "sine", 610), voice(390, 150, 170, .42, "sine", 740),
        voice(190, 340, 105, .5, "sine", 115),
      ],
      noise: { gain: .045, frequency: 1100, durationMs: 360 },
    };
    case "happy": return {
      masterGain: .14,
      voices: [
        voice(523.25, 0, 100, .5), voice(659.25, 95, 100, .52),
        voice(783.99, 190, 100, .55), voice(1046.5, 285, 170, .65),
      ],
    };
    case "sleepy": return {
      masterGain: .085,
      voices: [voice(392, 0, 220, .42, "sine"), voice(329.63, 190, 240, .38, "sine"), voice(261.63, 405, 300, .34, "sine")],
    };
    case "wake": return {
      masterGain: .11,
      voices: [voice(392, 0, 110, .45), voice(523.25, 100, 110, .52), voice(659.25, 205, 160, .58)],
    };
    case "chime":
    default: return {
      masterGain: .11,
      voices: [voice(523.25, 0, 160, .45), voice(659.25, 90, 170, .42), voice(783.99, 180, 220, .48)],
    };
  }
}

export function careSound(action: CareAction, species: "dog" | "cat"): CompanionSoundName {
  if (action === "feed") return "snack";
  if (action === "water") return "slurp";
  if (action === "rest") return "sleepy";
  return species === "cat" ? "purr" : "yip";
}

let sharedContext: AudioContext | null = null;

export async function unlockCompanionAudio(): Promise<AudioContext | null> {
  const audioClass = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!audioClass) return null;
  sharedContext ??= new audioClass({ latencyHint: "interactive" });
  if (sharedContext.state === "suspended") await sharedContext.resume();
  return sharedContext.state === "running" ? sharedContext : null;
}

/** Plays in either the pet or Settings webview. Returns false when autoplay is blocked. */
export async function playCompanionSound(name: CompanionSoundName, volume = .75): Promise<boolean> {
  const audio = await unlockCompanionAudio();
  if (!audio) return false;
  const recipe = soundRecipe(name);
  const now = audio.currentTime;
  const master = audio.createGain();
  const peak = Math.max(.0001, recipe.masterGain * Math.max(0, Math.min(1, volume)));
  const durationMs = Math.max(...recipe.voices.map(item => item.delayMs + item.durationMs), recipe.noise?.durationMs ?? 0);
  master.gain.setValueAtTime(.0001, now);
  master.gain.exponentialRampToValueAtTime(peak, now + .018);
  master.gain.exponentialRampToValueAtTime(.0001, now + durationMs / 1000 + .08);
  master.connect(audio.destination);

  for (const item of recipe.voices) {
    const start = now + item.delayMs / 1000;
    const end = start + item.durationMs / 1000;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = item.wave;
    oscillator.frequency.setValueAtTime(item.hz, start);
    if (item.endHz) oscillator.frequency.exponentialRampToValueAtTime(item.endHz, end);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(item.gain, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(end + .02);
  }

  if (recipe.noise) {
    const samples = Math.ceil(audio.sampleRate * recipe.noise.durationMs / 1000);
    const buffer = audio.createBuffer(1, samples, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const noiseGain = audio.createGain();
    filter.type = "bandpass";
    filter.frequency.value = recipe.noise.frequency;
    filter.Q.value = 1.4;
    noiseGain.gain.setValueAtTime(recipe.noise.gain, now);
    noiseGain.gain.exponentialRampToValueAtTime(.0001, now + recipe.noise.durationMs / 1000);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    source.start(now);
  }
  return true;
}
