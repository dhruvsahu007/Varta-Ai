# 🧠 Varta AI Companion

A **Slack-like chat platform** powered by AI that enhances workplace communication with smart features like Org Memory, Instant Reply Composer, and AI-Powered Meeting Notes.

---

## 🛠 Features

### 🧩 Varta AI

- Multi-user chat interface with **threads**, **mentions**, and **channels**
- Responsive UI styled with **TailwindCSS + Radix UI**
- Built with **React (Vite)** and **Express**

---

### 🤖 AI-Powered Add-ons

#### 🧠 Org Brain Plugin  
Ask questions like:  
> “What’s the latest on Project Atlas?”

AI summarizes across public channels and pinned docs to keep you up-to-date.

---

#### ✍️ Auto-Reply Composer  
Click **“Suggest Reply”** in any thread — AI proposes replies using:
- Full thread context
- Org-wide memory

---

#### 🎯 Tone & Impact Meter  
AI analyzes your drafted replies for:
- Aggressive / Weak / Confusing tone
- High-Impact vs Low-Impact phrasing

---

#### 📝 Meeting Notes Generator  
Select any **thread or channel**, click **“Generate Notes”**, and AI generates clean, summarized meeting notes instantly.

---

## 🧪 Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Radix UI
- **Backend**: Express.js, TypeScript
- **AI**: OpenAI API
- **Database**: PostgreSQL (via Drizzle ORM + Neon)
- **Deployment**: Render

---

## 🧰 Setup Instructions

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (local or cloud)

### 1. Clone the Repo
```bash
git clone https://github.com/dhruvsahu007/Varta-Ai
cd Varta-Ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values:
# - DATABASE_URL=your-postgres-url
# - OPENAI_API_KEY=your-openai-api-key  
# - SESSION_SECRET=your-secure-session-secret
# - OPENSEARCH_ENDPOINT=https://your-collection.region.aoss.amazonaws.com
```

### 4. Database Setup
```bash
# Push database schema
npm run db:push

# Seed with sample data
npm run seed
```

### 5. Development Setup
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend  
npm run dev:frontend
```
This runs:
- Frontend on http://localhost:3000
- Backend API on http://localhost:5000
- WebSocket on ws://localhost:5000/ws

### 6. Production Build
```bash
# Build both frontend and backend
npm run build

# Start production server (serves both)
npm start
```
## 🛰 Deployment

### Local Development
```bash
# Separated services
npm run dev:frontend  # Port 3000
npm run dev:backend   # Port 5000

# Or use Docker for development
docker-compose up --build
```

### Production Deployment

#### 1. AWS ECR Setup
The repository includes GitHub Actions workflow for automated deployment to AWS ECR:
- Push to `main` branch triggers automatic build and push to ECR
- Frontend and backend images are built separately
- Images are tagged with both `latest` and commit SHA

#### 2. EC2 Production Deployment
```bash
# 1. Deploy application to EC2 (run from your local machine)
./deploy/deploy.sh

# 2. SSH to your EC2 instance and set up systemd service
ssh ubuntu@your-ec2-instance

# 3. Run the service setup script (on EC2)
sudo ./deploy/setup-service.sh
```

#### 3. Systemd Service Management
Once the service is installed, manage it with systemd commands:

```bash
# Start the service
sudo systemctl start varta-deploy

# Stop the service
sudo systemctl stop varta-deploy

# Restart the service
sudo systemctl restart varta-deploy

# Check service status
sudo systemctl status varta-deploy

# View service logs
sudo journalctl -u varta-deploy -f

# View last 50 log entries
sudo journalctl -u varta-deploy -n 50
```

#### 4. Manual Docker Compose (Alternative)
If you prefer manual management without systemd:
```bash
# Run in production mode
cd /home/ubuntu/deploy
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

#### 5. Environment Variables
Ensure these environment variables are set in your EC2 environment or .env file:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `DATABASE_URL`
- `JWT_SECRET`
- Any other application-specific variables

#### 6. Health Checks
The application exposes health check endpoints:
- Frontend: `http://your-domain/` (served by nginx)
- Backend: `http://your-domain:3000/api/health`

#### 7. Deployment Files Structure
```
deploy/
├── deploy.sh              # EC2 deployment script
├── setup-service.sh       # Systemd service setup
├── varta-deploy.service   # Systemd service configuration
client/Dockerfile          # Frontend production Dockerfile
server/Dockerfile          # Backend production Dockerfile
docker-compose.prod.yml    # Production Docker Compose
.github/workflows/
└── deploy-ecr.yml         # GitHub Actions ECR workflow
```

### Cloud Deployment (Render/Railway/Vercel)
- **Frontend**: Deploy `/client` folder with `npm run build:frontend`
- **Backend**: Deploy with `npm run build:backend` and `npm start`
- **Environment**: Set all variables from `.env.example`

### Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   React + Vite  │───▶│   Express + TS  │
│   Port 3000     │    │   Port 5000     │
└─────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         └──────────────▶│   PostgreSQL    │
                        │   + WebSocket   │
                        └─────────────────┘
```

## 🚀 Enhanced Message Flow

When a new message is created, the system automatically:

1. **Saves to PostgreSQL** - Message stored with full metadata
2. **Generates Embeddings** - OpenAI API creates vector representation  
3. **Stores in OpenSearch** - Vector saved for semantic search with metadata:
   - Message content and author info
   - Channel/DM context  
   - Timestamps and token counts
4. **Background Processing** - All vector operations happen asynchronously

### Vector Search Features
- **Semantic Search** - Find messages by meaning, not just keywords
- **Smart RAG** - Retrieve relevant context for AI responses
- **Content Discovery** - Surface related conversations and knowledge

### Testing the Complete Flow

**Option 1: API Endpoint Test**
```bash
# Start your backend server first
npm run dev:backend

# Then test the complete flow via HTTP endpoint
node test-embedding-endpoint.js
# OR make a POST request to: http://localhost:5000/test-message
```

**Option 2: Direct Module Test**
```bash
node test-message-embedding-flow.js
```

## 🧑‍💻 Author

Made by Dhruv Sahu as part of a fullstack AI Slack Clone project.

---

## 🧹 Cleaned for Deployment

This repository has been cleaned and optimized for production deployment:

### Removed Development Files:
- All test-*.js debug and diagnostic scripts
- Local database files (dev.db, sessions.db) 
- Unused attached_assets directory and temporary images
- Development-only migration utility scripts

### Production Ready:
- ✅ Core application code preserved
- ✅ Database migrations maintained in `/migrations`
- ✅ All npm scripts functional (`npm run dev`, `npm run build`, `npm start`)
- ✅ Environment configuration intact
- ✅ Deployment configs preserved

The application is now deployment-ready with a clean, production-focused codebase.
