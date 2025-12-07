# Setup Guide - Media Discovery App

## 🔑 Required API Keys

### 1. TMDB API Key (Required)
**What it's for**: Movie and TV show data

**How to get it**:
1. Go to https://www.themoviedb.org/signup
2. Create a free account
3. Go to Settings → API
4. Request an API key (choose "Developer" option)
5. Copy the **"API Read Access Token"** (v4 auth)

**Add to `.env`**:
```bash
TMDB_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ...
```

### 2. OpenAI API Key (Required for AI features)
**What it's for**: Natural language understanding and semantic search

**How to get it**:
1. Go to https://platform.openai.com/signup
2. Create an account
3. Go to https://platform.openai.com/api-keys
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

**Add to `.env`**:
```bash
OPENAI_API_KEY=sk-proj-...
```

**Cost**: ~$0.01 per 1000 searches (very cheap for demo)

### 3. Google AI API Key (Optional)
**What it's for**: Alternative to OpenAI, can use Gemini for query understanding

**How to get it**:
1. Go to https://aistudio.google.com/app/apikey
2. Create an API key
3. Copy the key

**Add to `.env`**:
```bash
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
```

---

## 📝 Setup Steps

### Step 1: Copy Environment File
```bash
cd /workspace/apps/media-discovery
cp .env.example .env
```

### Step 2: Add Your API Keys
Edit `.env` and add your keys:
```bash
# Replace these with your actual keys
TMDB_ACCESS_TOKEN=your_tmdb_token_here
OPENAI_API_KEY=your_openai_key_here
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Start Development Server
```bash
npm run dev
```

The app will be available at http://localhost:3000

---

## 🚀 Quick Test (Free Tier)

If you want to test WITHOUT API keys (demo mode):

### Option 1: Use Mock Data
The app will fall back to mock embeddings and sample data.

### Option 2: TMDB Only (Free)
Just add TMDB_ACCESS_TOKEN - it's completely free!
- Skip OpenAI_API_KEY
- App will work with basic search (no AI understanding)

### Option 3: Full Experience
Add both TMDB and OpenAI keys for the complete AI-powered experience.

---

## 🧪 Testing the API

### Test Basic Search (needs TMDB only)
```bash
curl "http://localhost:3000/api/search?q=inception"
```

### Test AI-Powered Decision (needs both keys)
```bash
curl -X POST http://localhost:3000/api/decide \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user",
    "query": "exciting sci-fi adventure",
    "userSubscriptions": [
      {"platform": "netflix", "active": true, "region": "US"}
    ]
  }'
```

---

## 🆓 Free Tier Limits

### TMDB API
- ✅ **Completely FREE**
- ✅ 50 requests per second
- ✅ No credit card required
- ✅ Perfect for hackathon demos

### OpenAI API
- 💰 **Pay-as-you-go**
- $0.50 per 1M tokens (input)
- $1.50 per 1M tokens (output)
- ~$0.01 per 1000 searches
- First-time users get $5 free credit

### Google AI (Gemini)
- ✅ **Free tier available**
- 60 requests per minute
- Good alternative to OpenAI

---

## ⚠️ Troubleshooting

### Error: "TMDB_ACCESS_TOKEN is not defined"
- Make sure `.env` file exists in `/workspace/apps/media-discovery/`
- Check that you're using the **Access Token** (v4), not the API Key (v3)
- Restart the dev server after adding the key

### Error: "OpenAI API key is missing"
- Add `OPENAI_API_KEY=sk-...` to your `.env` file
- Restart the dev server
- Alternative: Use Google AI instead

### App works but no results
- Check that your TMDB token is valid
- Try a simple search like "star wars" first
- Check the console for specific error messages

---

## 🎯 Recommended Setup for Hackathon Demo

**Minimal (Free)**:
```bash
TMDB_ACCESS_TOKEN=your_token_here
# App works with basic search
```

**Recommended (Best Experience)**:
```bash
TMDB_ACCESS_TOKEN=your_token_here
OPENAI_API_KEY=your_key_here
# Full AI-powered experience, ~$0.50 for entire demo
```

**Alternative (Free AI)**:
```bash
TMDB_ACCESS_TOKEN=your_token_here
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
# Full experience with free Google AI
```

---

## 📞 Need Help?

1. **TMDB issues**: https://www.themoviedb.org/talk
2. **OpenAI issues**: https://help.openai.com/
3. **App issues**: Check `/workspace/apps/media-discovery/README.md`

---

**Quick Start**: Get TMDB key (2 minutes, free) → Add to .env → npm run dev → Done! 🎉
