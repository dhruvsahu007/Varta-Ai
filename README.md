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
