# DocBot - Serverless RAG Chatbot

A production-ready, serverless RAG (Retrieval-Augmented Generation) chatbot built with Firebase Functions, React, AWS S3, and AWS Bedrock.

## Features

- **Ephemeral Sessions**: Each browser session creates a new session with its own knowledge base
- **Document Types**: Supports PDF, DOCX, DOC, and TXT files
- **Semantic Chunking**: Uses sentence-aware chunking with `tiktoken` for intelligent text splitting
- **Vector Search**: S3-backed vector storage with in-memory cosine similarity search
- **AWS Bedrock**: Uses Claude models via AWS Bedrock for chat completions
- **Firebase Auth**: Google Sign-In authentication
- **Firestore**: Session and conversation storage
- **Auto-cleanup**: Sessions expire after 60 minutes (configurable)

## Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- AWS Account with S3 and Bedrock access
- Firebase project with:
  - Authentication (Google Sign-In enabled)
  - Firestore Database
  - Functions enabled
  - Hosting enabled

## Setup

### 1. Clone and Install Dependencies

```bash
# Install function dependencies
cd functions
npm install

# Install web dependencies
cd ../web
npm install
```

### 2. Configure Firebase

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Google Sign-In provider)
3. Enable Firestore Database
4. Enable Functions and Hosting

### 3. Set Environment Variables

#### Functions (Firebase Secrets)

Set AWS credentials for Bedrock and S3:

```bash
# AWS Credentials (required for Bedrock and S3)
firebase functions:secrets:set AWS_ACCESS_KEY_ID
# Enter your AWS Access Key ID when prompted

firebase functions:secrets:set AWS_SECRET_ACCESS_KEY
# Enter your AWS Secret Access Key when prompted

firebase functions:secrets:set AWS_REGION
# Enter your AWS region (e.g., us-east-1)

# S3 Vector Storage (required)
firebase functions:secrets:set S3_VECTOR_BUCKET
# Enter your S3 bucket name (e.g., docbot-vectors-production)

# Optional: Bedrock Model ID (defaults to Claude 3 Sonnet if not set)
firebase functions:secrets:set BEDROCK_MODEL_ID
# Enter model ID (e.g., anthropic.claude-3-sonnet-20240229-v1:0)
```

Or set via environment variables in `functions/.env` (for local development):

```env
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1

# S3 Vector Storage
S3_VECTOR_BUCKET=your-bucket-name

# Optional: Bedrock Model (defaults to Claude 3 Sonnet)
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Optional: Session TTL
SESSION_TTL_MINUTES=60
```

#### Web (`.env.local`)

Create `web/.env.local`:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id

# API Base URL (for development, use Functions emulator)
# Development: http://localhost:5001 (Firebase Functions emulator)
# Production: Leave empty or use your deployed Firebase Functions URL
VITE_API_BASE_URL=http://localhost:5001
```

You can find these values in Firebase Console > Project Settings > General > Your apps.

### 4. Update Firebase Project ID

Edit `.firebaserc` and replace `your-project-id` with your actual Firebase project ID.

### 5. Set Up AWS Services

#### Enable AWS Bedrock

1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Select your region (e.g., `us-east-1`)
3. Navigate to "Model access" tab
4. Request access to the models you want to use (Claude 3 Sonnet, etc.)
5. Note: Bedrock model access must be explicitly enabled - this can take a few minutes to approve

#### Set Up S3 Vector Storage

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://your-vector-storage-bucket --region us-east-1
   ```

2. **Set S3 Bucket Secret** (if not already done in step 3):
   ```bash
   firebase functions:secrets:set S3_VECTOR_BUCKET
   # Enter: your-vector-storage-bucket
   ```

3. **Verify AWS Credentials** (if not already done in step 3):
   - Ensure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` are set
   - These same credentials work for both Bedrock and S3

📘 **For detailed S3 setup instructions, including IAM permissions, see [S3_VECTOR_SETUP.md](./S3_VECTOR_SETUP.md)**

## Development

### Start Development Servers

1. **Start Firebase Emulators** (in project root):

```bash
firebase emulators:start --only functions,hosting,firestore,auth
```

This will start:
- Functions emulator on `http://localhost:5001`
- Hosting emulator on `http://localhost:5000`
- Firestore emulator on `http://localhost:8080`
- Auth emulator on `http://localhost:9099`

2. **Start Frontend Dev Server** (in `web/` directory):

```bash
cd web
npm run dev
```

The frontend will run on `http://localhost:3000` and proxy API calls to the Functions emulator.

Note: Make sure S3 bucket is configured (see "Set Up S3 Vector Storage" above).

### Build Functions

```bash
cd functions
npm run build
```

## Deployment

### Vector Storage Setup (S3)

Vector storage uses AWS S3 - no separate deployment needed! Just create an S3 bucket and configure it.

📘 **For detailed S3 setup instructions, see [S3_VECTOR_SETUP.md](./S3_VECTOR_SETUP.md)**

**Quick Setup:**

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://your-vector-storage-bucket --region us-east-1
   ```

2. **Set S3 Bucket Secret**:
   ```bash
   firebase functions:secrets:set S3_VECTOR_BUCKET
   # Enter: your-vector-storage-bucket
   ```

3. **Verify AWS Credentials** (same as Bedrock):
   ```bash
   firebase functions:secrets:set AWS_ACCESS_KEY_ID
   firebase functions:secrets:set AWS_SECRET_ACCESS_KEY
   firebase functions:secrets:set AWS_REGION
   ```

That's it! No separate deployment needed - S3 is ready to use.

#### Security Considerations

For production deployments, consider:

1. **S3 Encryption**: Enable SSE-S3 encryption on your bucket (free, recommended)
2. **IAM Permissions**: Use least-privilege IAM policies for S3 access
3. **Lifecycle Policies**: Auto-delete old session files to save storage costs

### Deploy Firebase Functions and Hosting

### 1. Build the Frontend

```bash
cd web
npm run build
```

This creates `web/dist/` with the production build.

### 2. Deploy to Firebase

```bash
# Deploy functions and hosting
firebase deploy --only functions,hosting

# Or deploy individually
firebase deploy --only functions
firebase deploy --only hosting
```

### 3. Set Up Firestore TTL

1. Go to Firebase Console > Firestore Database > Indexes
2. The TTL field `expiresAt` should be automatically configured via `firestore.indexes.json`

## Usage

1. Visit your deployed app or `http://localhost:3000` in development
2. Sign in with Google
3. Upload a document (PDF, DOCX, DOC, or TXT)
4. Start chatting with your document!

### API Endpoints

- `POST /api/startSession` - Create a new session
- `POST /api/ingest` - Ingest a document (file upload only)
- `POST /api/chat` - Send a chat message
- `POST /api/endSession` - End a session and clean up
- `GET /api/search?sessionId=...&q=...&topK=5` - Debug vector search

## Project Structure

```
.
├─ functions/          # Firebase Functions (backend)
│  ├─ src/
│  │  ├─ api/         # API endpoints
│  │  ├─ services/    # Business logic (extractText, chunker, s3-vector, bedrock, firestore)
│  │  └─ utils/       # Utilities (config, auth, response)
│  └─ package.json
├─ web/               # React frontend
│  ├─ src/
│  │  ├─ routes/      # Page components (Login, Ingest, Chat)
│  │  ├─ components/  # Reusable components
│  │  ├─ lib/         # API client
│  │  └─ firebase.ts  # Firebase config
│  └─ package.json
├─ firebase.json      # Firebase configuration
├─ firestore.rules    # Firestore security rules
└─ README.md
```

## Session Lifecycle

1. **Start**: User logs in → `POST /api/startSession` → Creates Firestore session + returns `sessionId`
2. **Ingest**: User uploads document → `POST /api/ingest` → Extracts text → Semantic chunks → Embeddings → Upserts to S3 `vectors/{sessionId}.json`
3. **Chat**: User asks question → `POST /api/chat` → Vector search → RAG prompt → AWS Bedrock response
4. **End**: Session expires (TTL) or user ends → S3 vector file deleted + Firestore data cleaned

## Security

- All API endpoints validate Firebase Auth tokens (optional middleware)
- Firestore rules restrict access to user's own sessions/conversations
- Sessions are ephemeral and auto-deleted after TTL
- S3 vector files are per-session and deleted on session end

## Troubleshooting

### S3 Vector Storage Error

Ensure S3 bucket is configured:
```bash
# Verify bucket exists
aws s3 ls s3://your-vector-storage-bucket/

# Check S3_VECTOR_BUCKET secret
firebase functions:secrets:access S3_VECTOR_BUCKET
```

Verify AWS credentials have S3 permissions (PutObject, GetObject, DeleteObject, ListBucket).

For detailed IAM policy, see [S3_VECTOR_SETUP.md](./S3_VECTOR_SETUP.md#2-set-iam-permissions).

### AWS Bedrock Errors

Verify your AWS credentials and Bedrock access:
```bash
# Check AWS credentials
firebase functions:secrets:access AWS_ACCESS_KEY_ID
firebase functions:secrets:access AWS_SECRET_ACCESS_KEY
firebase functions:secrets:access AWS_REGION

# Verify Bedrock is enabled in your AWS region
aws bedrock list-foundation-models --region us-east-1
```

### Firestore Permission Denied

Check Firestore rules in `firestore.rules` and ensure you're authenticated.

### Functions Build Errors

```bash
cd functions
npm run build
# Check for TypeScript errors
```

## License

MIT

