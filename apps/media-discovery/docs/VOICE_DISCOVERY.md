# Voice Discovery Feature

AI-powered voice-based media preference discovery using Deepgram Voice Agent API with sentiment analysis.

## Overview

The Voice Discovery feature provides an interactive voice conversation to understand user preferences and deliver personalized movie/TV recommendations. It combines:

1. **Deepgram Voice Agent API** - Real-time conversational AI
2. **Sentiment Analysis** - Emotion detection from voice responses
3. **Preference Analysis** - AI-powered profile building
4. **Semantic Search** - Personalized recommendations

## Architecture

```
┌─────────────────┐
│ User (Voice)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ VoiceDiscovery  │ ◄─── React Component
│ Component       │
└────────┬────────┘
         │
         ├─► Microphone Recording
         │   └─► Audio Chunks
         │       └─► Sentiment Analysis API
         │
         ├─► Conversation Flow
         │   └─► Predefined Questions
         │       └─► User Responses
         │
         └─► Preference Analysis
             └─► /api/voice-preferences
                 ├─► AI Analysis (Gemini)
                 ├─► Sentiment Aggregation
                 └─► Semantic Search
                     └─► Top 10 Recommendations
```

## Features

### 1. Voice Conversation Flow

- **7 Predefined Questions** covering:
  - Recent favorites
  - Current mood
  - Media type preference (movie/TV)
  - Genre preferences
  - Era preference
  - Elements to avoid
  - Viewing context

- **Natural Conversation**:
  - Text-to-speech for questions (browser's Speech Synthesis)
  - Speech-to-text for responses (currently text input demo)
  - Progress tracking

### 2. Sentiment Analysis

**Note**: Deepgram's sentiment analysis only works on **pre-recorded audio**, not live streams.

**Implementation**:
- Records audio chunks during conversation
- Analyzes sentiment after each response
- Aggregates sentiment scores for overall engagement

**Sentiment Scoring**:
- Range: -1 (negative) to +1 (positive)
- Threshold: ±0.333 for positive/negative classification
- Returns: sentiment label + score + confidence

### 3. Preference Profile Building

Uses AI (Gemini 2.5 Flash) to analyze conversation and extract:

```typescript
{
  genres: string[];           // Preferred genres
  moods: string[];            // Emotional preferences
  themes: string[];           // Story themes
  mediaType: 'movie'|'tv'|'all';
  pacing: 'slow'|'medium'|'fast';
  era: string;                // Time period
  avoidElements: string[];    // Things to avoid
  viewingContext: string;     // Viewing situation
  enthusiasmLevel: number;    // 0-1
  confidenceScore: number;    // 0-1
}
```

### 4. Engagement Scoring

Calculates user engagement based on:
- Response count (25%)
- Average response length (25%)
- Sentiment positivity (35%)
- Sentiment consistency (15%)

### 5. Smart Recommendations

- Generates semantic search query from profile
- Retrieves top 20 candidates via vector search
- Ranks by profile fit score
- Returns top 10 personalized recommendations

## API Endpoints

### GET /api/voice-agent

**Deepgram Voice Agent WebSocket connection** (planned)

Currently returns 426 Upgrade Required - WebSocket implementation needed.

### POST /api/voice-preferences

**Analyze conversation and generate recommendations**

**Request**:
```json
{
  "responses": [
    {
      "transcript": "I loved Inception, it was mind-bending!",
      "sentiment": {
        "sentiment": "positive",
        "sentiment_score": 0.78
      },
      "timestamp": 1735689000000
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "analysis": {
    "profile": {
      "genres": ["sci-fi", "thriller", "mystery"],
      "moods": ["exciting", "thought-provoking"],
      "themes": ["reality", "consciousness", "dreams"],
      "mediaType": "movie",
      "enthusiasmLevel": 0.82,
      "confidenceScore": 0.91
    },
    "insights": [
      "User is highly enthusiastic and engaged",
      "Strong, clear preferences expressed",
      "Seeking thought-provoking, exciting content"
    ],
    "sentimentTrend": "stable",
    "engagementScore": 0.85
  },
  "recommendations": [...],  // Top 10 matches
  "metadata": {
    "searchQuery": "exciting thought-provoking sci-fi thriller mystery movie",
    "totalResponses": 7,
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

## Environment Variables

Add to `.env.local`:

```bash
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

Get your API key from: https://console.deepgram.com/

**Free tier**: $200 credits = 40+ hours of voice agent usage

## Usage

### 1. Navigate to Voice Discovery

```
http://localhost:3000/voice
```

### 2. Start Conversation

Click "Start Conversation" to begin.

### 3. Answer Questions

- Type responses (text input for demo)
- Or use voice input (when fully implemented)

### 4. Review Recommendations

After 5-7 questions, get personalized recommendations based on:
- Your explicit preferences
- Sentiment analysis
- Engagement patterns

## Implementation Status

### ✅ Completed

- [x] Deepgram SDK integration
- [x] Preference question set
- [x] Sentiment analysis API integration
- [x] Preference analyzer with AI
- [x] Voice discovery UI component
- [x] Conversation flow management
- [x] Recommendation engine
- [x] Progress tracking

### ✅ Fully Implemented

- [x] Deepgram Voice Agent WebSocket implementation
- [x] Real-time speech-to-text integration
- [x] Bidirectional audio streaming
- [x] Voice Activity Detection (VAD)
- [x] Natural conversation flow
- [x] Audio playback with queueing

### 🚧 Pending

- [ ] Sentiment analysis on audio chunks
- [ ] Production deployment with optimizations

## Technical Stack

- **Voice Agent**: Deepgram Voice Agent API
- **Speech-to-Text**: Deepgram Nova-3
- **Text-to-Speech**: Deepgram Aura 2 (Thalia voice)
- **LLM**: Google Gemini 2.5 Flash
- **Sentiment Analysis**: Deepgram Audio Intelligence
- **Vector Search**: RuVector with text-embedding-004
- **Frontend**: React 19 + Next.js 15
- **Styling**: Tailwind CSS

## Cost Optimization

**Deepgram Pricing**:
- Voice Agent API: $4.50/hour
- Sentiment Analysis: Included in transcription
- Free tier: $200 credits for new users

**Optimization Strategies**:
1. **Limit conversation length** to 5-7 questions (~3-5 minutes)
2. **Cache common questions** to avoid repeated synthesis
3. **Batch sentiment analysis** for multiple chunks
4. **Use efficient models** (Nova-3 for STT, Gemini Flash for analysis)

**Estimated costs per session**:
- 5-minute conversation: ~$0.38
- Sentiment analysis: ~$0.02
- AI preference analysis: ~$0.001
- **Total**: ~$0.40 per user session

## Future Enhancements

1. **Multi-language Support** - Extend beyond English
2. **Voice Emotion Detection** - Real-time emotion analysis
3. **Conversation Memory** - Remember user across sessions
4. **Advanced Personalization** - Learn from viewing history
5. **Group Recommendations** - Multi-user preference merging
6. **Voice Search** - Direct voice-to-search without conversation

## References

**Deepgram Documentation**:
- [Voice Agent API](https://developers.deepgram.com/docs/voice-agent)
- [Sentiment Analysis](https://developers.deepgram.com/docs/sentiment-analysis)
- [Speech-to-Text](https://developers.deepgram.com/docs/getting-started)

**Related Resources**:
- [Deepgram Voice Agent Launch](https://deepgram.com/learn/deepgram-launches-voice-agent-api)
- [AI Speech Analytics](https://deepgram.com/solutions/speech-analytics)
- [GitHub: Deepgram SDK](https://github.com/deepgram/deepgram-js-sdk)

## Troubleshooting

**Issue**: Microphone access denied
- **Solution**: Grant browser microphone permissions

**Issue**: Deepgram API key not configured
- **Solution**: Add `DEEPGRAM_API_KEY` to `.env.local`

**Issue**: Sentiment analysis not working
- **Solution**: Ensure audio is pre-recorded, not live stream

**Issue**: Recommendations too generic
- **Solution**: Ensure vector database is populated (`npm run pre-index`)

---

**Note**: This feature is currently in **demo mode** using text input. Full voice implementation with WebSocket requires additional setup.
