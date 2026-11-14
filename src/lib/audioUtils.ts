export function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    let s = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let nextStartTime = 0;

export function playAudioChunk(audioCtx: AudioContext, base64Audio: string) {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768;
  }
  
  const buffer = audioCtx.createBuffer(1, float32Array.length, 24000);
  buffer.getChannelData(0).set(float32Array);
  
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  
  if (nextStartTime < audioCtx.currentTime) {
    nextStartTime = audioCtx.currentTime;
  }
  source.start(nextStartTime);
  nextStartTime += buffer.duration;
}

export function interruptAudio(audioCtx: AudioContext) {
  // Simple way to interrupt is to suspend and recreate, or we can just reset nextStartTime if we keep track of active sources
  nextStartTime = audioCtx.currentTime;
}
