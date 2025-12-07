# 🚀 Deploy to Google Cloud Run - Quick Start

## ✅ Files Ready
- ✅ Dockerfile (with Python & build tools)
- ✅ .dockerignore
- ✅ deploy.sh script
- ✅ next.config.ts (standalone output enabled)
- ✅ .env with API keys

---

## 🎯 Deploy Now (3 Steps)

### Step 1: Install gcloud CLI

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash

# Restart shell to use gcloud
exec -l $SHELL

# Authenticate
gcloud auth login

# List projects or create new one
gcloud projects list
```

### Step 2: Set Your Project

```bash
# Set project ID (replace with yours)
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"

# Configure gcloud
gcloud config set project $GCP_PROJECT_ID
```

### Step 3: Deploy!

**Option A: One-Command Deploy (Recommended)**
```bash
cd /workspace/apps/media-discovery

# Setup APIs and secrets
./deploy.sh setup

# Add your API keys to secrets
echo -n "$TMDB_ACCESS_TOKEN" | gcloud secrets versions add tmdb-access-token --data-file=-
echo -n "$GOOGLE_GENERATIVE_AI_API_KEY" | gcloud secrets versions add google-ai-api-key --data-file=-

# Build and deploy
./deploy.sh build-cloud
./deploy.sh deploy

# Get your URL
./deploy.sh url
```

**Option B: Manual gcloud Commands**
```bash
cd /workspace/apps/media-discovery

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Build with Cloud Build
gcloud builds submit --tag gcr.io/$GCP_PROJECT_ID/media-discovery

# Deploy to Cloud Run
gcloud run deploy media-discovery \
  --image gcr.io/$GCP_PROJECT_ID/media-discovery \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-env-vars "NODE_ENV=production,TMDB_ACCESS_TOKEN=$TMDB_ACCESS_TOKEN,NEXT_PUBLIC_TMDB_ACCESS_TOKEN=$TMDB_ACCESS_TOKEN,GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY"
```

---

## 📋 Using Environment Variables from .env

Load from your existing .env file:

```bash
cd /workspace/apps/media-discovery

# Load environment variables
source .env

# Verify they're loaded
echo "TMDB: ${TMDB_ACCESS_TOKEN:0:20}..."
echo "Google AI: ${GOOGLE_GENERATIVE_AI_API_KEY:0:20}..."

# Now deploy with loaded env vars
gcloud run deploy media-discovery \
  --image gcr.io/$GCP_PROJECT_ID/media-discovery \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-env-vars "TMDB_ACCESS_TOKEN=$TMDB_ACCESS_TOKEN,NEXT_PUBLIC_TMDB_ACCESS_TOKEN=$TMDB_ACCESS_TOKEN,GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY"
```

---

## 🧪 Test After Deployment

```bash
# Get your service URL
SERVICE_URL=$(gcloud run services describe media-discovery \
  --platform managed \
  --region us-central1 \
  --format 'value(status.url)')

# Test search
curl "$SERVICE_URL/api/search?q=inception"

# Test decision API
curl -X POST $SERVICE_URL/api/decide \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user",
    "query": "exciting sci-fi adventure",
    "userSubscriptions": [{"platform": "netflix", "active": true}]
  }'
```

---

## 💰 Estimated Cost

**Free Tier:**
- First 2 million requests/month: FREE
- First 360,000 GB-seconds: FREE
- First 180,000 vCPU-seconds: FREE

**Typical hackathon demo:**
- Cost: **$0** (within free tier)

---

## 🔧 Troubleshooting

### "gcloud: command not found"
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### Build fails with native module errors
✅ Already fixed! Dockerfile includes Python and build tools

### "Permission denied" errors
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Environment variables not working
Use Secret Manager for production:
```bash
# Create secrets
echo -n "$TMDB_ACCESS_TOKEN" | gcloud secrets create tmdb-token --data-file=-

# Deploy with secrets
gcloud run deploy media-discovery \
  --set-secrets="TMDB_ACCESS_TOKEN=tmdb-token:latest"
```

---

## 📞 Next Steps

1. Install gcloud CLI (if not installed)
2. Set GCP_PROJECT_ID environment variable
3. Run `./deploy.sh setup` to enable APIs
4. Run `./deploy.sh build-cloud` to build image
5. Run `./deploy.sh deploy` to deploy to Cloud Run
6. Get URL with `./deploy.sh url`
7. Test your hackathon demo!

**Deploy time:** ~5-10 minutes
**Cost:** Free tier eligible
