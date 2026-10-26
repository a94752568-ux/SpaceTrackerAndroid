/**
 * Audio ambiental opcional (Web Audio API). Mute por defecto.
 */
import { loadImmersionPrefs } from "./immersionPrefs";

let ctx: AudioContext | null = null;
let noiseNode: AudioBufferSourceNode | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!loadImmersionPrefs().audioEnabled) return null;
  if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(freq: number, durMs: number, gain = 0.03): void {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000 + 0.02);
}

export function playAosBeep(): void {
  beep(880, 80, 0.025);
}

export function playLosBeep(): void {
  beep(440, 100, 0.02);
}

export function playCatalogReadyBeep(): void {
  beep(660, 60, 0.02);
  setTimeout(() => beep(880, 60, 0.02), 90);
}

export function startAmbientNoise(): void {
  const c = ensureCtx();
  if (!c || noiseNode) return;
  const bufferSize = 2 * c.sampleRate;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 0.5;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const g = c.createGain();
  g.gain.value = 0.012;
  src.connect(g);
  g.connect(c.destination);
  src.start();
  noiseNode = src;
}

export function stopAmbientNoise(): void {
  try {
    noiseNode?.stop();
  } catch {
    /* ignore */
  }
  noiseNode = null;
}

export function syncAmbientFromPrefs(): void {
  if (loadImmersionPrefs().audioEnabled) startAmbientNoise();
  else stopAmbientNoise();
}
