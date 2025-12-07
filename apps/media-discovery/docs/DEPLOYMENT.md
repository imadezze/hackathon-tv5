# Deployment Guide - Google Cloud Run

## 🚀 Quick Deploy

### Prerequisites
- Google Cloud account with billing enabled
- API keys configured in `.env` file

### One-Command Deployment

```bash
cd /workspace/apps/media-discovery
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. ✅ Install gcloud CLI (if needed)
2. ✅ Authenticate with Google Cloud
3. ✅ Enable required APIs
4. ✅ Build Docker image
5. ✅ Deploy to Cloud Run
6. ✅ Return your live URL

---

## 📋 Manual Deployment

### Step 1: Install Google Cloud CLI

```bash
# Download and install
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize
gcloud init
```

### Step 2: Authenticate

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### Step 3: Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com
```

### Step 4: Configure Next.js for Production

Update `next.config.ts` or `next.config.js`:

```typescript
const config: NextConfig = {
  output: 'standalone', // Required for Docker
  // ... rest of config
};
```

### Step 5: Build and Deploy

**Option A: Using Cloud Build (Recommended)**
```bash
# Build the image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/media-discovery

# Deploy to Cloud Run
gcloud run deploy media-discovery \
  --image gcr.io/YOUR_PROJECT_ID/media-discovery \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-env-vars "TMDB_ACCESS_TOKEN=your_token" \
  --set-env-vars "GOOGLE_GENERATIVE_AI_API_KEY=your_key"
```

**Option B: Using Local Docker**
```bash
# Build locally
docker build -t gcr.io/YOUR_PROJECT_ID/media-discovery .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/media-discovery

# Deploy
gcloud run deploy media-discovery \
  --image gcr.io/YOUR_PROJECT_ID/media-discovery \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🔐 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TMDB_ACCESS_TOKEN` | TMDB API v4 token | `eyJhbGc...` |
| `NEXT_PUBLIC_TMDB_ACCESS_TOKEN` | Public TMDB token | `eyJhbGc...` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI API key | `AIza...` |

### Setting Environment Variables

**During deployment:**
```bash
gcloud run deploy media-discovery \
  --set-env-vars "KEY1=value1,KEY2=value2"
```

**After deployment:**
```bash
gcloud run services update media-discovery \
  --update-env-vars "KEY1=value1"
```

**Using Secret Manager (Recommended for production):**
```bash
# Create secret
echo -n "your-api-key" | gcloud secrets create tmdb-token --data-file=-

# Grant access
gcloud secrets add-iam-policy-binding tmdb-token \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Deploy with secret
gcloud run deploy media-discovery \
  --set-secrets="TMDB_ACCESS_TOKEN=tmdb-token:latest"
```

---

## ⚙️ Cloud Run Configuration

### Recommended Settings

```bash
gcloud run deploy media-discovery \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \           # 1GB RAM
  --cpu 1 \                # 1 vCPU
  --min-instances 0 \      # Scale to zero
  --max-instances 10 \     # Max 10 instances
  --timeout 60s \          # 60 second timeout
  --port 8080              # Container port
```

### Cost Optimization

**Free Tier Limits:**
- 2 million requests/month
- 360,000 GB-seconds/month
- 180,000 vCPU-seconds/month

**Tips:**
- Use `--min-instances 0` to scale to zero when idle
- Start with `--memory 512Mi` and scale up if needed
- Monitor usage with `gcloud run services describe`

---

## 🧪 Testing Deployment

### Health Check
```bash
curl https://YOUR_SERVICE_URL/
```

### Search API
```bash
curl "https://YOUR_SERVICE_URL/api/search?q=inception"
```

### Decision API
```bash
curl -X POST https://YOUR_SERVICE_URL/api/decide \
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

## 📊 Monitoring

### View Logs
```bash
gcloud run services logs read media-discovery --limit 50
```

### Metrics
```bash
gcloud run services describe media-discovery --format="value(status)"
```

### Cloud Console
- Visit: https://console.cloud.google.com/run
- Select your service
- View metrics, logs, and revisions

---

## 🔄 Updates and Rollbacks

### Deploy New Version
```bash
# Build new image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/media-discovery

# Deploy updates
gcloud run deploy media-discovery \
  --image gcr.io/YOUR_PROJECT_ID/media-discovery
```

### Rollback to Previous Version
```bash
# List revisions
gcloud run revisions list --service media-discovery

# Rollback
gcloud run services update-traffic media-discovery \
  --to-revisions REVISION_NAME=100
```

---

## 🐛 Troubleshooting

### Build Fails

**Issue:** Native module compilation errors
**Fix:** Ensure Dockerfile has build dependencies:
```dockerfile
RUN apt-get update && apt-get install -y \
    python-is-python3 \
    build-essential \
    libxi-dev \
    libglu1-mesa-dev
```

### Service Not Starting

**Check logs:**
```bash
gcloud run services logs read media-discovery --limit 50
```

**Common issues:**
- Missing environment variables
- Port mismatch (Cloud Run expects PORT env var)
- Memory/CPU limits too low

### API Errors

**Issue:** TMDB API errors
**Fix:** Verify environment variables are set correctly:
```bash
gcloud run services describe media-discovery \
  --format="value(spec.template.spec.containers[0].env)"
```

---

## 💰 Cost Estimation

### Typical Usage (100 users/day)
- **Requests:** ~10,000/month
- **Compute:** ~5,000 GB-seconds/month
- **Estimated Cost:** **$0 - $5/month** (within free tier)

### High Usage (1000 users/day)
- **Requests:** ~100,000/month
- **Compute:** ~50,000 GB-seconds/month
- **Estimated Cost:** **$20 - $30/month**

---

## 🔒 Security Best Practices

1. **Use Secret Manager** for API keys
2. **Enable HTTPS** (automatic with Cloud Run)
3. **Restrict access** with IAM if needed
4. **Set resource limits** to prevent cost overruns
5. **Enable Cloud Armor** for DDoS protection (if needed)

---

## 📞 Support

- **Cloud Run Docs:** https://cloud.google.com/run/docs
- **Troubleshooting:** https://cloud.google.com/run/docs/troubleshooting
- **Pricing:** https://cloud.google.com/run/pricing

---

**Deployment Time:** ~5-10 minutes
**Estimated Cost:** Free tier eligible
**Scale:** 0 to 1000+ users automatically
