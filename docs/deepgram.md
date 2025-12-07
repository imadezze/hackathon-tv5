# Deepgram Voice Agent Implementation

## Overview

The media discovery app now uses **Deepgram Voice Agent with Managed LLM** for conversational voice interactions. This provides a fully integrated solution where Deepgram handles:

1. **Speech-to-Text (STT)** - Deepgram Nova-3
2. **LLM Reasoning** - Google Gemini 2.0 Flash (managed by Deepgram)
3. **Text-to-Speech (TTS)** - Deepgram Aura Asteria voice

## Architecture

### Previous Approach (Hybrid)
- Deepgram Live STT → Gemini AI (separate) → Deepgram TTS
- Required managing LLM calls ourselves
- More complex state management

### Current Approach (Managed LLM)
- **Single WebSocket connection** to Deepgram Voice Agent
- Deepgram manages the entire conversational chain
- Simplified implementation with built-in conversation handling

## Configuration

### API Key
Set your Deepgram API key in `.env`:
```bash
DEEPGRAM_API_KEY=caa9cc44ca956d9c3e2b38a654b6e77b71adf104
```

### LLM Options

**Managed LLM Providers (Fully Managed by Deepgram):**
- **OpenAI**: GPT-5, GPT-5-mini, GPT-4o, GPT-4o-mini ✅ (currently used)
- **Anthropic**: Claude Sonnet 4.5, Claude Haiku 4.5

**Self-Hosted LLM Providers (Require Custom Endpoint):**
- **Google**: Gemini models (requires Google AI Studio API key)
- **Groq**: GPT OSS 20B
- **AWS Bedrock**: Various models

**Current Configuration:**
```typescript
{
  llmProvider: 'open_ai',
  llmModel: 'gpt-4o-mini',
  ttsVoice: 'aura-asteria-en'
}
```

## Voice Agent Settings

### Audio Configuration
- **Input**: Linear16 PCM, 24kHz, mono
- **Output**: Linear16 PCM, 24kHz
- **Format**: WebM/Opus for streaming

### Agent Behavior
```typescript
agent: {
  listen: {
    provider: { type: 'deepgram', model: 'nova-3' },
  },
  think: {
    provider: { type: 'open_ai', model: 'gpt-4o-mini' },
    prompt: SYSTEM_INSTRUCTIONS,
  },
  speak: {
    provider: { type: 'deepgram', model: 'aura-asteria-en' },
  },
  greeting: "Hi! I'm your personal movie and TV show assistant...",
}
```

### System Instructions
The agent follows these guidelines:
- Ask 5-7 questions about viewing preferences
- Keep responses under 25 words
- Be enthusiastic and conversational
- End naturally after gathering preferences

## Implementation Files

### Core Library
**`src/lib/voice-agent-managed.ts`**
- `ManagedVoiceAgent` class
- WebSocket connection management
- Event handling (Ready, UserMessage, AgentUtterance, etc.)
- Audio streaming from microphone
- Keep-alive mechanism (every 5 seconds)

### UI Component
**`src/components/VoiceConversation.tsx`**
- Voice chat interface
- Real-time conversation display
- State management (listening, thinking, speaking)
- Automatic preference analysis on completion

### API Endpoint
**`src/app/api/voice-preferences/route.ts`**
- Analyzes conversation transcript
- Generates preference profile using Gemini
- Returns personalized recommendations

## Events

The Voice Agent emits these events:

| Event | Description |
|-------|-------------|
| `Ready` | Connection established, ready to talk |
| `Welcome` | Agent connected and initialized |
| `UserMessage` | User spoke (transcribed text) |
| `AgentUtterance` | Agent responded (text) |
| `AgentStateChange` | State changed (listening/thinking/speaking) |
| `AgentStartedSpeaking` | Agent began TTS playback |
| `AgentAudioDone` | Agent finished speaking |
| `Error` | Connection or processing error |
| `Close` | Connection closed |

## Usage Flow

1. **User clicks "Start Voice Chat"**
   - Request microphone access
   - Connect to Deepgram Voice Agent
   - Start audio streaming

2. **Conversation**
   - Agent asks questions (5-7 exchanges)
   - User responds naturally
   - Real-time transcription and responses

3. **Auto-completion**
   - After 7 user messages OR agent says goodbye
   - Connection closes automatically
   - Analyzes conversation
   - Generates recommendations

## Pricing

**Deepgram Voice Agent Managed LLM:**
- **Budget tier** (GPT-4o-mini): ~$0.15-0.25 per conversation ✅ (currently used)
- **Advanced tier** (GPT-4o, Claude Sonnet 4.5): ~$0.40-0.50 per conversation
- **Premium tier** (GPT-5): ~$0.60-0.80 per conversation

**Breakdown:**
- STT (Nova-3): ~$0.05 per conversation (5-7 minutes)
- LLM (GPT-4o-mini): ~$0.05-0.15 per conversation
- TTS (Aura): ~$0.05 per conversation

## Testing

Navigate to: `http://localhost:3000/voice`

1. Click "Start Voice Chat"
2. Allow microphone access
3. Have a natural conversation
4. Agent will ask about preferences
5. View personalized recommendations

## Troubleshooting

### Common Issues

**"WebSocket connection failed"**
- Check Deepgram API key in `.env`
- Verify API key has Voice Agent access
- Check browser console for detailed errors

**"No response from agent"**
- Check browser microphone permissions
- Verify audio input device is working
- Look for errors in browser console

**"Audio playback not working"**
- Check browser audio permissions
- Verify speakers/headphones connected
- Try refreshing the page

### Debug Logging

Enable verbose logging in browser console:
```javascript
// All agent events are logged with emoji prefixes:
// ✅ = Connection success
// 👋 = Welcome/greeting
// 👤 = User message
// 🤖 = Agent response
// 🔄 = State change
// ❌ = Error
// 💓 = Keep-alive ping
```

## Next Steps

- [ ] Test voice conversation locally
- [ ] Fine-tune system instructions for better questions
- [ ] Add conversation history persistence
- [ ] Implement voice settings (speed, pitch)
- [ ] Add support for multiple languages
- [ ] Deploy to Google Cloud Run
