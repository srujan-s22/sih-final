/**
 * SwasthyaSetu — Telephony Audio Codec & Utilities (Phase 11)
 * Standard G.711 μ-law (PCMU) <-> 16-bit Linear PCM Transcoding & WAV Synthesizer
 */

// Precompute 256-entry lookup table for fast, allocation-free ITU-T G.711 μ-law decoding
const MULAW_TO_LINEAR_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const byte = ~i & 0xff;
  const sign = byte & 0x80;
  const exponent = (byte >> 4) & 0x07;
  const mantissa = byte & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  MULAW_TO_LINEAR_TABLE[i] = sign !== 0 ? -sample : sample;
}

// Precompute Linear 16-bit PCM to μ-law encoding lookup / quantization
const BIAS = 0x84;
const CLIP = 32635;

/**
 * Encodes a single 16-bit linear PCM sample to an 8-bit μ-law byte
 */
export function linear16ToMulawSample(pcmSample: number): number {
  let sample = pcmSample;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) {
    sample = -sample;
  }
  if (sample > CLIP) {
    sample = CLIP;
  }
  sample = sample + BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const mulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return mulawByte;
}

/**
 * Decodes a μ-law (PCMU) buffer into a 16-bit Linear PCM Buffer (Little Endian)
 */
export function mulawToLinear16(mulawBuffer: Buffer): Buffer {
  const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);
  for (let i = 0; i < mulawBuffer.length; i++) {
    const pcmSample = MULAW_TO_LINEAR_TABLE[mulawBuffer[i]];
    pcmBuffer.writeInt16LE(pcmSample, i * 2);
  }
  return pcmBuffer;
}

/**
 * Encodes a 16-bit Linear PCM Buffer (Little Endian) into a μ-law (PCMU) Buffer
 */
export function linear16ToMulaw(pcmBuffer: Buffer): Buffer {
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  const mulawBuffer = Buffer.alloc(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const pcmSample = pcmBuffer.readInt16LE(i * 2);
    mulawBuffer[i] = linear16ToMulawSample(pcmSample);
  }
  return mulawBuffer;
}

/**
 * Creates a standard 44-byte RIFF/WAV header for 16-bit Linear PCM audio
 */
export function createWavHeader(
  dataByteLength: number,
  sampleRate: number = 8000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const header = Buffer.alloc(44);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  // RIFF Chunk Descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataByteLength, 4); // ChunkSize
  header.write("WAVE", 8);

  // "fmt " Sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // "data" Sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataByteLength, 40);

  return header;
}

/**
 * Wraps raw 16-bit Linear PCM buffer with a standard WAV header
 */
export function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 8000): Buffer {
  const header = createWavHeader(pcmBuffer.length, sampleRate, 1, 16);
  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Converts μ-law buffer directly to a valid 8kHz 16-bit WAV Buffer
 */
export function mulawToWav(mulawBuffer: Buffer, sampleRate: number = 8000): Buffer {
  const pcmBuffer = mulawToLinear16(mulawBuffer);
  return pcmToWav(pcmBuffer, sampleRate);
}

/**
 * Extracts raw 16-bit Linear PCM samples from a WAV Buffer by parsing the RIFF header
 */
export function extractPcmFromWav(wavBuffer: Buffer): { pcmBuffer: Buffer; sampleRate: number } {
  if (wavBuffer.length < 44) {
    return { pcmBuffer: wavBuffer, sampleRate: 8000 };
  }

  // Check for RIFF header
  if (wavBuffer.toString("ascii", 0, 4) === "RIFF" && wavBuffer.toString("ascii", 8, 12) === "WAVE") {
    let offset = 12;
    let sampleRate = 8000;
    let dataOffset = 44;
    let dataSize = wavBuffer.length - 44;

    while (offset < wavBuffer.length - 8) {
      const chunkId = wavBuffer.toString("ascii", offset, offset + 4);
      const chunkSize = wavBuffer.readUInt32LE(offset + 4);

      if (chunkId === "fmt ") {
        sampleRate = wavBuffer.readUInt32LE(offset + 12);
      } else if (chunkId === "data") {
        dataOffset = offset + 8;
        dataSize = chunkSize;
        break;
      }
      offset += 8 + chunkSize;
    }

    const pcm = wavBuffer.subarray(dataOffset, Math.min(dataOffset + dataSize, wavBuffer.length));
    return { pcmBuffer: Buffer.from(pcm), sampleRate };
  }

  // Fallback: Return buffer as-is assuming raw PCM
  return { pcmBuffer: wavBuffer, sampleRate: 8000 };
}

/**
 * Calculates Root-Mean-Square (RMS) audio energy of a 16-bit PCM Buffer
 * Used for simple, deterministic Voice Activity Detection (VAD) / silence detection
 */
export function calculatePcmRms(pcmBuffer: Buffer): number {
  if (pcmBuffer.length < 2) return 0;
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  let sumSquares = 0;

  for (let i = 0; i < sampleCount; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / sampleCount);
}

/**
 * Chunks an audio buffer into uniform frame sizes for streaming over WebSocket
 * Default: 160 bytes of μ-law or 320 bytes of 16-bit Linear PCM (20ms at 8kHz)
 */
export function chunkAudioBuffer(buffer: Buffer, chunkSize: number = 160): Buffer[] {
  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const end = Math.min(offset + chunkSize, buffer.length);
    chunks.push(buffer.subarray(offset, end));
    offset = end;
  }
  return chunks;
}
