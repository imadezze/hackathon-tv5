# Deepgram Voice Agent - Full Conversational Implementation

## Overview

This is a **true bidirectional voice conversation system** using Deepgram's Voice Agent API - not text-to-speech, but real-time voice-to-voice communication with AI.

## Architecture

```
┌──────────────┐
│   Browser    │
│  (User Voice)│
└──────┬───────┘
       │ Microphone Stream (16kHz PCM)
       ▼
┌──────────────────────────────────────┐
│   VoiceAgentClient (WebSocket)       │
│   wss://agent.deepgram.com/agent     │
└──────┬───────────────────────────────┘
       │
       ├─► Listen (Speech-to-Text)
       │   └─► Deepgram Nova-2 Model
       │       └─► Transcribed Text
       │
       ├─► Think (LLM Processing)
       │   └─► OpenAI GPT-4o-mini
       │       └─► AI Response
       │
       └─► Speak (Text-to-Speech)
           └─► Deepgram Aura (Asteria voice)
               └─► Audio Stream (24kHz PCM)
                   └─► Browser Playback
```

## How It Works

### 1. Connection Flow

```typescript
// Create voice agent
const agent = new VoiceAgentClient({
  apiKey: 'your_deepgram_key',
  systemPrompt: 'You are a movie assistant...',
  greeting: 'Hi! Let's find movies you'll love',
  llmModel: 'gpt-4o-mini',
  voiceModel: 'aura-asteria-en',
});

// Connect via WebSocket
await agent.connect();
// → Sends SettingsConfiguration
// → Sends InjectedMessage (greeting)

// Start recording from microphone
const stream = await agent.startRecording();
// → Captures audio at 16kHz
// → Converts Float32 → Int16 PCM
// → Streams to WebSocket
```

### 2. Real-Time Conversation Loop

```
User speaks → Microphone captures → PCM audio → WebSocket send
                                                        ↓
Agent receives ← Audio playback ← PCM conversion ← WebSocket receive
        ↓
    UserStartedSpeaking event
        ↓
    Speech-to-Text (Nova-2)
        ↓
    UserStoppedSpeaking event
        ↓
    ConversationText { role: 'user', content: '...' }
        ↓
    AgentThinking event
        ↓
    LLM Processing (GPT-4o-mini)
        ↓
    AgentStartedSpeaking event
        ↓
    ConversationText { role: 'assistant', content: '...' }
        ↓
    Text-to-Speech (Aura)
        ↓
    AudioData (binary PCM chunks)
        ↓
    Browser plays audio
        ↓
    AgentStoppedSpeaking event
        ↓
    [Loop continues...]
```

### 3. Audio Processing

**Microphone Input (Float32 → Int16):**
```typescript
const inputData = audioBuffer.getChannelData(0); // Float32 [-1, 1]
const int16Data = new Int16Array(inputData.length);

for (let i = 0; i < inputData.length; i++) {
  const s = Math.max(-1, Math.min(1, inputData[i]));
  int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
}

// Send to WebSocket
websocket.send(int16Data.buffer);
```

**Agent Audio Output (Int16 → Float32):**
```typescript
const int16Array = new Int16Array(arrayBuffer);
const float32Array = new Float32Array(int16Array.length);

for (let i = 0; i < int16Array.length; i++) {
  float32Array[i] = int16Array[i] / 32768.0;
}

// Create audio buffer and play
const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
audioBuffer.getChannelData(0).set(float32Array);
// → Play through speakers
```

## Event Types

### Connection Events

- **Welcome** - Connection established
- **SettingsApplied** - Configuration accepted
- **Close** - Connection closed
- **Error** - Connection or processing error

### Speech Detection Events

- **UserStartedSpeaking** - User began speaking
- **UserStoppedSpeaking** - User stopped speaking
- **AgentStartedSpeaking** - Agent began speaking
- **AgentStoppedSpeaking** - Agent finished speaking

### Processing Events

- **AgentThinking** - LLM processing response
- **ConversationText** - Transcript message
  ```json
  {
    "type": "ConversationText",
    "role": "user" | "assistant",
    "content": "text content"
  }
  ```

### Audio Events

- **AudioData** - Binary PCM audio chunks (ArrayBuffer)
- **AgentAudioDone** - Complete audio response sent

## Configuration

### WebSocket Message: SettingsConfiguration

```json
{
  "type": "SettingsConfiguration",
  "audio": {
    "input": {
      "encoding": "linear16",
      "sample_rate": 16000
    },
    "output": {
      "encoding": "linear16",
      "sample_rate": 24000,
      "container": "none"
    }
  },
  "agent": {
    "listen": {
      "model": "nova-2"
    },
    "think": {
      "provider": {
        "type": "open_ai"
      },
      "model": "gpt-4o-mini",
      "instructions": "Your system prompt..."
    },
    "speak": {
      "model": "aura-asteria-en"
    }
  }
}
```

### Supported Models

**Speech-to-Text (Listen):**
- `nova-2` - Latest, most accurate (recommended)
- `nova` - Previous generation

**LLM (Think):**
- OpenAI: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`
- Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`
- Google: `gemini-2.0-flash-exp`

**Text-to-Speech (Speak):**
- `aura-asteria-en` - Natural female voice (recommended)
- `aura-luna-en` - Warm female voice
- `aura-stella-en` - Clear female voice
- `aura-athena-en` - Professional female voice
- `aura-hera-en` - Authoritative female voice
- `aura-orion-en` - Deep male voice
- `aura-arcas-en` - Friendly male voice
- `aura-perseus-en` - Clear male voice
- `aura-angus-en` - Irish accent male
- `aura-orpheus-en` - Narrative male voice
- `aura-helios-en` - Energetic male voice
- `aura-zeus-en` - Commanding male voice

## Keep-Alive

Send periodic keep-alive messages every 5 seconds:

```typescript
setInterval(() => {
  if (websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({ type: 'KeepAlive' }));
  }
}, 5000);
```

## Error Handling

```typescript
agent.on('Error', (data) => {
  console.error('Voice agent error:', data.error);

  // Common errors:
  // - Invalid API key
  // - Model not available
  // - Audio format mismatch
  // - Network timeout
  // - Rate limit exceeded
});

agent.on('Close', () => {
  console.log('Connection closed');
  // Cleanup: stop recording, close audio context
});
```

## Usage Example

```typescript
// 1. Create agent
const agent = new VoiceAgentClient({
  apiKey: process.env.DEEPGRAM_API_KEY!,
  systemPrompt: 'Be helpful and concise',
  greeting: 'Hello! How can I help?',
});

// 2. Setup event handlers
agent.on('ConversationText', (data) => {
  console.log(`${data.role}: ${data.content}`);
  updateUI(data.role, data.content);
});

agent.on('UserStartedSpeaking', () => {
  showIndicator('User speaking...');
});

agent.on('AgentStartedSpeaking', () => {
  showIndicator('Agent speaking...');
});

// 3. Connect and start
await agent.connect();
await agent.startRecording();

// 4. Conversation happens automatically!
// User speaks → Agent listens → Agent thinks → Agent responds

// 5. End conversation
agent.disconnect();
```

## Browser Requirements

- **WebSocket** support (all modern browsers)
- **Web Audio API** (Chrome, Firefox, Safari, Edge)
- **MediaDevices API** (microphone access)
- **getUserMedia** permission required

## Performance

**Latency Breakdown:**
- Microphone capture: <50ms
- WebSocket transmission: 10-50ms
- Speech-to-Text: 100-300ms
- LLM processing: 200-800ms
- Text-to-Speech: 100-300ms
- Audio playback: <50ms
- **Total**: ~500ms - 1.5s (natural conversation speed)

**Data Usage:**
- Uplink (16kHz mono): ~32 KB/s
- Downlink (24kHz mono): ~48 KB/s
- **Total**: ~80 KB/s (~5 MB per minute)

## Cost Optimization

**Deepgram Pricing:**
- Voice Agent API: **$4.50/hour**
- Free tier: $200 credits

**Per Conversation (5 minutes):**
- 5 min × ($4.50/60 min) = **$0.375**
- With $200 credit: **~533 conversations**

**Tips:**
1. Use `gpt-4o-mini` instead of `gpt-4o` for 80% cost reduction on LLM
2. Limit conversations to 5-7 minutes
3. Implement conversation timeout
4. Use greeting to set expectations
5. End conversation naturally when goals met

## Troubleshooting

**No audio output:**
- Check browser audio permissions
- Verify AudioContext is not blocked
- Check speaker/headphone connection

**Can't connect:**
- Verify API key is correct
- Check network/firewall allows WebSocket
- Ensure `wss://` (not `ws://`)

**Poor quality:**
- Check microphone quality
- Reduce background noise
- Ensure stable internet connection
- Try different voice model

**High latency:**
- Check internet speed
- Reduce system load
- Try different LLM model
- Consider edge deployment

## Next Steps

1. **Test locally**: `npm run dev` → `http://localhost:3000/voice`
2. **Grant microphone permission** when prompted
3. **Click "Start Voice Chat"**
4. **Speak naturally** - the agent will respond!
5. **After 5-7 exchanges**, agent ends and shows recommendations

## Key Differences from Text-to-Speech

| Feature | Text-to-Speech | Voice Agent |
|---------|----------------|-------------|
| Input | Text only | Voice (real-time) |
| Output | Audio file | Streaming audio |
| Latency | High (batch) | Low (streaming) |
| Conversation | One-way | Bidirectional |
| Detection | Manual | Automatic (VAD) |
| Natural | No | Yes |

This is a **true conversational AI** - users just talk, and the agent responds naturally! 🎙️
