/** Convert Float32 PCM samples (-1..1) into little-endian 16-bit base64. */
export function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcmData[i] || 0));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked to avoid "Maximum call stack size exceeded" on long buffers.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
}

/**
 * Queues PCM chunks for gapless playback.
 *
 * The previous module-level `nextStartTime` was shared by every AudioContext
 * (including re-created ones), which corrupted scheduling after a session
 * restart and made `interruptAudio` a no-op for already queued audio.
 */
export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(private sampleRate = 24_000) {}

  get context(): AudioContext | null {
    return this.ctx;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new Ctor({ sampleRate: this.sampleRate });
      this.nextStartTime = 0;
    }
    return this.ctx;
  }

  async resume(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* autoplay policy — user gesture will retry */
      }
    }
  }

  play(base64Audio: string): void {
    const ctx = this.ensureContext();
    if (!ctx || !base64Audio) return;

    const int16 = base64ToInt16(base64Audio);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, this.sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    if (this.nextStartTime < ctx.currentTime) this.nextStartTime = ctx.currentTime;
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  /** Stop playback immediately (barge-in / user interruption). */
  stop(): void {
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    });
    this.sources.clear();
    this.nextStartTime = this.ctx?.currentTime ?? 0;
  }

  close(): void {
    this.stop();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Notification chime                                                         */
/* -------------------------------------------------------------------------- */

let chimeCtx: AudioContext | null = null;

/** Short, pleasant "focus finished" chime. Reuses one AudioContext. */
export function playChime(volume = 0.18): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    chimeCtx = chimeCtx ?? new Ctor();
    const ctx = chimeCtx;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const notes = [587.33, 880, 1174.66];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.12);
      gain.gain.setValueAtTime(0, now + index * 0.12);
      gain.gain.linearRampToValueAtTime(volume, now + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 1);
    });
  } catch {
    /* Audio is best-effort only. */
  }
}
