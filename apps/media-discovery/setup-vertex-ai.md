# Using Gemini via Vertex AI (Google Cloud)

## Step 1: Enable Vertex AI API

```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"

gcloud services enable aiplatform.googleapis.com
```

## Step 2: Install Vertex AI SDK

```bash
npm install @google-cloud/aiplatform
```

## Step 3: Set up authentication

```bash
# Create service account
gcloud iam service-accounts create vertex-ai-user \
    --display-name="Vertex AI User"

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding agentics-foundation25lon-1805 \
    --member="serviceAccount:vertex-ai-user@agentics-foundation25lon-1805.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# Create key
gcloud iam service-accounts keys create vertex-key.json \
    --iam-account=vertex-ai-user@agentics-foundation25lon-1805.iam.gserviceaccount.com
```

## Step 4: Use in your code

```typescript
import { VertexAI } from '@google-cloud/vertexai';

const vertex_ai = new VertexAI({
  project: 'agentics-foundation25lon-1805',
  location: 'us-central1',
});

const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
});

// Generate text
const result = await model.generateContent('Tell me about movies');
console.log(result.response.text());
```

## Pricing Comparison

**Google AI Studio (current):**
- ✅ Free tier: 15 requests/minute
- ✅ Easiest setup
- ✅ No billing required

**Vertex AI:**
- 💰 Pay-as-you-go
- 🏢 Better for production
- 🔒 More security controls
- 📊 Better monitoring
