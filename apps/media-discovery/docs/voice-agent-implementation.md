# Deepgram Voice Agent Implementation Guide

## Overview

This document explains the complete implementation of Deepgram Voice Agent with Managed LLM for real-time voice conversations in the browser.

## Critical Implementation Details

### 1. AudioContext Sample Rate (CRITICAL!)

**The #1 most important detail**: AudioContext must be initialized at **16kHz**, not default browser rate (48kHz).

```typescript
// ❌ WRONG - Uses browser default (48kHz), causes issues
this.audioContext = new AudioContext();

// ✅ CORRECT - Forces 16kHz for proper microphone downsampling
this.audioContext = new AudioContext({ sampleRate: 16000 });
```

**Why?**
- Browser microphones run at 48kHz native
- Voice Agent expects 16kHz Linear16 PCM input
- AudioContext at 16kHz automatically downsamples 48kHz → 16kHz
- AudioWorklet then converts to Int16 PCM format

### 2. Audio Configuration

```typescript
this.connection.configure({
  audio: {
    input: {
      encoding: 'linear16',
      sample_rate: 16000,  // Matches AudioContext
    },
    output: {
      encoding: 'linear16',
      sample_rate: 24000,  // Agent sends 24kHz audio
    },
  },
  agent: {
    listen: { provider: { type: 'deepgram', model: 'nova-3' } },
    think: { provider: { type: 'open_ai', model: 'gpt-4o-mini' }, prompt: '...' },
    speak: { provider: { type: 'deepgram', model: 'aura-asteria-en' } },
    greeting: '...',
  },
});
```

### 3. Microphone Capture (AudioWorklet)

**NO WAV headers needed!** Use direct PCM conversion:

```typescript
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    if (!this.isRecording || !inputs[0] || !inputs[0][0]) {
      return true;
    }

    const input = inputs[0][0];

    for (let i = 0; i < input.length; i++) {
      this.buffer[this.bufferIndex++] = input[i];

      if (this.bufferIndex >= this.bufferSize) {
        this.sendBuffer();
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  sendBuffer() {
    const audioData = this.buffer.slice(0, this.bufferIndex);
    const pcmData = new Int16Array(audioData.length);

    // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.port.postMessage({
      type: 'audio',
      data: pcmData.buffer
    }, [pcmData.buffer]);
  }
}
```

**Key Points:**
- AudioContext at 16kHz downsamples microphone automatically
- AudioWorklet converts Float32 → Int16 PCM
- No manual resampling needed!
- Send raw PCM directly: `connection.send(pcmData.buffer)`

### 4. Audio Playback (Direct PCM)

**NO WAV headers!** Direct PCM-to-AudioBuffer conversion:

```typescript
private createAudioBuffer(data: ArrayBuffer, sampleRate: number): AudioBuffer | null {
  const audioDataView = new Int16Array(data);
  const buffer = this.audioContext!.createBuffer(1, audioDataView.length, sampleRate);
  const channelData = buffer.getChannelData(0);

  // Convert Int16 [-32768, 32767] to Float32 [-1, 1]
  for (let i = 0; i < audioDataView.length; i++) {
    channelData[i] = audioDataView[i] / 32768;
  }

  return buffer;
}
```

**Why no WAV headers?**
- Web Audio API's `createBuffer()` accepts raw PCM directly
- WAV headers are only needed for `decodeAudioData()` or `<audio>` elements
- Direct conversion is faster (zero latency)

### 5. Precise Timing System

**Critical for continuous playback without gaps:**

```typescript
private startTimeRef: { current: number } = { current: 0 };

private playAudioBuffer(buffer: AudioBuffer): void {
  const source = this.audioContext!.createBufferSource();
  source.buffer = buffer;
  source.connect(this.audioContext!.destination);

  const currentTime = this.audioContext!.currentTime;

  // Reset if we're behind
  if (this.startTimeRef.current < currentTime) {
    this.startTimeRef.current = currentTime;
  }

  // Schedule this chunk
  source.start(this.startTimeRef.current);

  // Update for next chunk
  this.startTimeRef.current += buffer.duration;

  // Track for cleanup
  this.activeSourceNodes.push(source);
  source.onended = () => {
    const index = this.activeSourceNodes.indexOf(source);
    if (index !== -1) this.activeSourceNodes.splice(index, 1);
  };
}
```

**Why this works:**
- Each 20ms chunk scheduled precisely
- No gaps between chunks
- No buffering delays
- Web Audio API handles 24kHz → 16kHz resampling automatically

## Common Mistakes to Avoid

### ❌ Wrong: Default AudioContext
```typescript
this.audioContext = new AudioContext(); // 48kHz - WRONG!
```

### ❌ Wrong: Adding WAV Headers
```typescript
const wavBuffer = addWavHeader(pcmData, 24000, 1, 16); // Unnecessary!
this.audioContext.decodeAudioData(wavBuffer); // Slower!
```

### ❌ Wrong: Buffering Chunks
```typescript
// Don't buffer - causes latency!
this.pendingChunks.push(audioData);
setTimeout(() => this.flushChunks(), 50); // NO!
```

### ❌ Wrong: Using decodeAudioData
```typescript
// Too slow for real-time streaming
this.audioContext.decodeAudioData(wavBuffer); // NO!
```

## Correct Implementation Summary

1. **AudioContext at 16kHz** - Automatic microphone downsampling
2. **Direct PCM conversion** - No WAV headers needed
3. **Immediate playback** - No buffering
4. **Precise timing** - startTimeRef scheduling
5. **Clean extraction** - Handle Node.js Buffer objects from SDK

## Audio Flow Diagram

```
Microphone (48kHz native)
    ↓
AudioContext (16kHz) - Auto downsampling
    ↓
AudioWorklet - Float32 → Int16 PCM conversion
    ↓
WebSocket send() - Raw PCM ArrayBuffer
    ↓
[Deepgram Voice Agent Processing]
    ↓
WebSocket AgentEvents.Audio - Node.js Buffer
    ↓
Extract ArrayBuffer from Buffer object
    ↓
createBuffer() + manual Int16 → Float32
    ↓
Precise timing with startTimeRef
    ↓
Speaker output (16kHz, resampled by browser to 48kHz)
```

## Performance Characteristics

- **Latency**: ~50ms total (network + processing)
- **Chunk size**: 20ms audio chunks (960 bytes at 24kHz)
- **Memory**: Minimal - direct streaming, no buffering
- **CPU**: Low - browser handles sample rate conversion

## References

- [dg_react_agent implementation](https://github.com/deepgram/dg_react_agent)
- [Deepgram Voice Agent Docs](https://developers.deepgram.com/docs/voice-agent)
- [Web Audio API Spec](https://www.w3.org/TR/webaudio/)

## Troubleshooting

### Issue: No audio playback
**Cause**: Wrong AudioContext sample rate
**Fix**: Use `new AudioContext({ sampleRate: 16000 })`

### Issue: Robotic/distorted voice
**Cause**: Adding WAV headers or wrong sample rate
**Fix**: Use direct PCM conversion at correct rates

### Issue: Microphone not capturing
**Cause**: AudioContext sample rate mismatch
**Fix**: 16kHz AudioContext for automatic downsampling

### Issue: Audio gaps/stuttering
**Cause**: Buffering or incorrect timing
**Fix**: Use startTimeRef for precise scheduling
