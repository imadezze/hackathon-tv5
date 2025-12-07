# Media Discovery Scripts

Utility scripts for managing the media discovery application.

## Pre-Indexing Script

The pre-indexing script generates and stores embeddings for popular movies and TV shows **before deployment**. This dramatically improves search performance by avoiding real-time embedding generation.

### Usage

```bash
# Standard indexing (200 items - recommended for development)
npm run pre-index

# Custom page count (10 pages = ~400 items)
npm run pre-index -- --pages 10

# Full indexing (1000 items - recommended for production)
npm run pre-index:full
```

### What it does

1. **Fetches popular content** from TMDB API
   - Movies: Popular movies (pages 1-N)
   - TV Shows: Popular TV shows (pages 1-N)

2. **Generates embeddings** using Google AI (text-embedding-004)
   - 768-dimensional vectors
   - Cached for 5 minutes to reduce API calls

3. **Stores in vector database** (RuVector)
   - File: `data/media-vectors.db`
   - Indexed with HNSW for fast similarity search

### Performance

- **Standard mode**: ~200 items in 50 seconds
- **Full mode**: ~1000 items in 4-5 minutes
- **Per item**: ~250ms average (embedding generation + storage)

### Environment Variables Required

```bash
TMDB_ACCESS_TOKEN=your_tmdb_token
GOOGLE_AI_API_KEY=your_google_ai_key
```

### Integration Options

#### Option 1: Manual Pre-Indexing (Local Development)

```bash
npm run pre-index
npm run dev
```

#### Option 2: Docker Build Step

Add to Dockerfile before CMD:

```dockerfile
RUN npm run pre-index
```

#### Option 3: Cloud Run Startup Hook

Create a startup script that runs pre-indexing on first deploy.

#### Option 4: Scheduled Cloud Function

Run weekly to keep database updated with latest popular content.

### Output

```
======================================================================
🎬 MEDIA DISCOVERY - PRE-INDEXING SCRIPT
======================================================================
Mode: STANDARD
Pages per type: 5
Expected items: ~200 (100 movies + 100 TV shows)
======================================================================

📊 Checking database status...
   Current vectors: 0

🎬 Fetching popular movies (5 pages)...
   ✓ Fetched 100 movies

🧠 Generating movie embeddings...
   ✓ Generated 100 movie embeddings

💾 Storing movie embeddings...
   ✓ Stored 100 movie embeddings

📺 Fetching popular TV shows (5 pages)...
   ✓ Fetched 100 TV shows

🧠 Generating TV show embeddings...
   ✓ Generated 100 TV show embeddings

💾 Storing TV show embeddings...
   ✓ Stored 100 TV show embeddings

======================================================================
✅ PRE-INDEXING COMPLETE
======================================================================
Movies indexed:     100
TV shows indexed:   100
Total new vectors:  200
Database size:      200 vectors
Duration:           50s (50000ms)
Avg per item:       250ms
======================================================================
```

### Troubleshooting

**Error: TMDB_ACCESS_TOKEN is not defined**
- Set environment variable in `.env.local`

**Error: GOOGLE_AI_API_KEY is not defined**
- Get API key from https://aistudio.google.com/apikey
- Set in `.env.local`

**Database file not found**
- Will be created automatically in `data/media-vectors.db`
- Ensure `data/` directory exists

**Slow performance**
- Google AI API rate limits may apply
- Use caching to reduce duplicate requests
- Consider batching requests
