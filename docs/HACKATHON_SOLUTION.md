# Agentics TV5 Hackathon Solution
## Solving the 45-Minute Decision Problem

**Challenge**: Millions spend 45+ minutes every night deciding what to watch across fragmented streaming platforms.

**Solution**: AI-powered multi-agent system that reduces decision time from 45 minutes to under 2 minutes.

---

## 🎯 Solution Architecture

### Current State (Already Built)
✅ **AI Media Discovery App** - Natural language search with semantic understanding
✅ **ARW Implementation** - Agent-Ready Web for efficient AI interaction
✅ **Vector Search** - Semantic matching with ruvector
✅ **TMDB Integration** - 1M+ movies and TV shows
✅ **Personalized Recommendations** - ML-powered suggestions

### Enhanced Solution (Proposed)

```
┌─────────────────────────────────────────────────────────────┐
│                    USER NATURAL LANGUAGE                    │
│      "Find a funny show for family movie night"             │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│              ORCHESTRATION LAYER (Claude Flow)              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Agentic Workflow Coordinator                         │   │
│  │ - Query understanding                                │   │
│  │ - Agent task delegation                              │   │
│  │ - Result aggregation                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │
      ┌───────────┼───────────┬────────────┬─────────────┐
      │           │           │            │             │
┌─────▼─────┐ ┌──▼──────┐ ┌──▼──────┐ ┌──▼──────┐ ┌───▼──────┐
│ Content   │ │Platform │ │Preference│ │Group    │ │Decision  │
│ Discovery │ │Availability│Learning  │Consensus│ │Optimizer │
│ Agent     │ │ Agent   │ │ Agent    │ │Agent    │ │Agent     │
└─────┬─────┘ └──┬──────┘ └──┬──────┘ └──┬──────┘ └───┬──────┘
      │          │           │            │             │
      │          │           │            │             │
┌─────▼──────────▼───────────▼────────────▼─────────────▼─────┐
│                    AGENTDB STATE LAYER                       │
│  - User preferences                                          │
│  - Viewing history                                           │
│  - Platform subscriptions                                    │
│  - Learning patterns                                         │
└──────────────────────────────────────────────────────────────┘
      │          │           │            │             │
┌─────▼─────┐ ┌──▼──────┐ ┌──▼──────┐ ┌──▼──────┐ ┌───▼──────┐
│  TMDB     │ │Netflix  │ │  User   │ │ Social  │ │Ruvector  │
│   API     │ │Hulu APIs│ │Profiles │ │   API   │ │Vector DB │
└───────────┘ └─────────┘ └─────────┘ └─────────┘ └──────────┘
```

---

## 🤖 Multi-Agent System Design

### Agent 1: Content Discovery Agent
**Technology**: Claude Sonnet 4.5 + Gemini 2.0
**Capabilities**:
- Natural language query understanding
- Semantic search across 1M+ titles
- Mood and context interpretation
- Genre and theme extraction

**Implementation**:
```typescript
// Uses existing /api/search endpoint
// Enhanced with Gemini for query understanding
```

### Agent 2: Platform Availability Agent
**Technology**: Google ADK + Vertex AI
**Capabilities**:
- Real-time availability checking across platforms
- User subscription verification
- Regional availability detection
- Price comparison for rental/purchase

**New Integration Needed**:
- JustWatch API
- Reelgood API
- Platform-specific APIs (Netflix, Hulu, Disney+)

### Agent 3: Preference Learning Agent
**Technology**: AgentDB + ReasoningBank
**Capabilities**:
- Continuous learning from viewing history
- Pattern recognition in user choices
- Adaptive recommendation refinement
- Temporal preference tracking (weekend vs weekday)

**Storage**: AgentDB with 9 RL algorithms

### Agent 4: Group Consensus Agent
**Technology**: Agentic Flow Swarm
**Capabilities**:
- Multi-user preference aggregation
- Conflict resolution using voting mechanisms
- Fair rotation of decision-makers
- Compromise suggestion generation

**Novel Feature**: Solves "couples deciding what to watch" problem

### Agent 5: Decision Optimizer Agent
**Technology**: SPARC 2.0 + Strange Loops
**Capabilities**:
- Confidence scoring for recommendations
- Explanation generation for transparency
- Trade-off analysis (quality vs availability)
- Decision time minimization

---

## 🔥 Key Differentiators

### 1. **Speed: 45 minutes → 2 minutes**
- Parallel agent execution via Claude Flow
- Pre-cached platform availability
- Instant semantic search with vector DB

### 2. **Cross-Platform Intelligence**
"What you want to watch" > "Where you can watch it"
- Single search across all platforms
- Automatic subscription detection
- Price comparison when content requires payment

### 3. **Learning That Actually Works**
- AgentDB persistent memory across sessions
- ReasoningBank for pattern recognition
- Temporal awareness (time of day, day of week)

### 4. **Group Decision Support**
- Multiplayer mode for families/couples
- Fair consensus algorithms
- "Take turns" mode for serial shows

### 5. **Transparency**
- AI explains WHY it recommended each title
- Shows reasoning: mood match, genre fit, availability
- Build trust through explainability

---

## 🛠️ Technical Implementation

### Phase 1: Enhanced Discovery (Week 1)
```bash
# Already implemented in /apps/media-discovery
- Natural language search ✅
- Semantic matching with ruvector ✅
- TMDB integration ✅
- ARW manifest ✅

# Enhancements needed:
- Add Gemini 2.0 for query understanding
- Implement streaming platform APIs
- Add availability caching layer
```

### Phase 2: Multi-Agent Orchestration (Week 2)
```typescript
// Use Claude Flow for agent coordination
import { claudeFlow } from 'claude-flow';

const solution = await claudeFlow.orchestrate({
  agents: [
    'content-discovery',
    'platform-availability',
    'preference-learning',
    'group-consensus',
    'decision-optimizer'
  ],
  topology: 'hierarchical',
  memory: 'agentdb',
  coordination: 'auto'
});
```

### Phase 3: State Management (Week 2)
```typescript
// AgentDB for persistent learning
import { AgentDB } from 'agentdb';

const db = new AgentDB({
  namespace: 'media-discovery',
  learning: {
    algorithm: 'decision-transformer',
    training: 'continuous'
  }
});

// Store user interactions
await db.store('user-preferences', {
  userId: 'user123',
  interactions: watchHistory,
  patterns: learnedPatterns
});
```

### Phase 4: Platform Integration (Week 3)
```typescript
// Platform availability checking
const platforms = [
  'netflix',
  'hulu',
  'disney-plus',
  'prime-video',
  'hbo-max',
  'apple-tv'
];

const availability = await checkAvailability(contentId, userSubscriptions);
```

---

## 📊 Success Metrics

### Quantitative
- **Decision Time**: Target < 2 minutes (from 45 minutes)
- **User Satisfaction**: > 85% match rate
- **Platform Coverage**: All major streaming services
- **Response Time**: < 3 seconds for recommendations

### Qualitative
- User reports "found exactly what I wanted"
- Reduced decision fatigue
- Increased content discovery
- Better utilization of existing subscriptions

---

## 🚀 Hackathon Deliverables

### Track 1: Entertainment Discovery
✅ **Primary Solution** - This addresses the core 45-minute problem

### Track 2: Multi-Agent Systems
✅ **5 Coordinated Agents** using Google ADK + Claude Flow

### Track 3: Agentic Workflows
✅ **Autonomous Decision Pipeline** from query to recommendation

### Track 4: Open Innovation
✅ **Group Consensus** - Novel feature for shared viewing decisions

---

## 💻 Code Structure

```
/apps/media-discovery/          # Main Next.js app
  /src/
    /agents/                    # NEW: Agent implementations
      /content-discovery.ts
      /platform-availability.ts
      /preference-learning.ts
      /group-consensus.ts
      /decision-optimizer.ts
    /orchestration/             # NEW: Claude Flow integration
      /coordinator.ts
      /workflows.ts
    /lib/
      /agentdb.ts              # NEW: State management
      /platforms/              # NEW: Platform integrations
        /netflix.ts
        /hulu.ts
        /justwatch.ts
```

---

## 🎯 Demo Scenario

**User Story**: Sarah and Mike want to watch something together on Friday night

1. **Input**: "Something funny but not too silly for Friday night"

2. **Agent Processing** (2 seconds):
   - Content Discovery: Identifies comedy genres, quality threshold
   - Platform Availability: Checks Netflix (Sarah) + Hulu (Mike)
   - Preference Learning: Recalls they both liked "The Office"
   - Group Consensus: Finds overlap in preferences
   - Decision Optimizer: Ranks by confidence score

3. **Output** (< 2 minutes total):
   ```
   Top Recommendation: "Abbott Elementary" on Hulu
   Why:
   - Smart workplace comedy like The Office
   - Currently available on Mike's Hulu subscription
   - 98% match to your Friday night mood
   - Both of you rated similar shows highly

   Alternatives: "Ted Lasso", "Schitt's Creek", "Brooklyn Nine-Nine"
   ```

4. **Result**: Decision made in 90 seconds instead of 45 minutes

---

## 🔮 Future Enhancements

1. **Voice Integration**: Alexa/Google Assistant support
2. **Calendar Awareness**: "What to watch during lunch break"
3. **Social Features**: "Watch parties" with friends
4. **AI Clips**: Show 30-second AI-generated previews
5. **Mood Detection**: Analyze tone of voice for better matching
6. **Smart Reminders**: "New episode of your favorite show available"

---

## 📦 Technology Stack

**Core**:
- Next.js 15 (App Router)
- React 19
- TypeScript 5.9

**AI/ML**:
- Claude Sonnet 4.5 (orchestration)
- Gemini 2.0 (query understanding)
- Vertex AI (preference learning)

**Orchestration**:
- Claude Flow (101 MCP tools)
- Agentic Flow (66 agents)
- Google ADK (multi-agent coordination)

**Data**:
- AgentDB (state management)
- Ruvector (vector search)
- TMDB (content metadata)

**Infrastructure**:
- Google Cloud Run (deployment)
- Vertex AI (ML training)
- Cloud Functions (serverless)

---

## 🏆 Competitive Advantages

vs. **Netflix Algorithm**:
- ❌ Single platform only
- ✅ We search ALL platforms

vs. **JustWatch**:
- ❌ Manual browsing required
- ✅ Natural language + AI recommendations

vs. **Reelgood**:
- ❌ No group decision support
- ✅ Consensus mode for families

vs. **TV Time**:
- ❌ Tracking only, no smart discovery
- ✅ Continuous learning + adaptive recommendations

---

## 📝 Next Steps

1. **Install dependencies** for media-discovery app
2. **Set up APIs** (TMDB, JustWatch, platform APIs)
3. **Implement agents** using Claude Flow framework
4. **Integrate AgentDB** for state persistence
5. **Build orchestration layer** with agentic workflows
6. **Test with real users** and iterate
7. **Deploy to Google Cloud** for hackathon demo

---

**Built with**: Agentics Foundation • Google Cloud • Claude Code • ARW Specification

**Demo Ready In**: 2-3 weeks
**Expected Impact**: 95%+ reduction in decision time
