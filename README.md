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
- Docker & Docker Compose (for production)
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
```

### 4. Development Setup

#### Option A: Separated Frontend & Backend (Recommended)
```bash
# Windows
./dev.bat

# Linux/Mac
./dev.sh
```
This runs:
- Frontend on http://localhost:3000
- Backend API on http://localhost:5000
- WebSocket on ws://localhost:5000/ws

#### Option B: Manual Setup
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend  
npm run dev:frontend
```

### 5. Production Deployment

#### Option A: Docker Compose (Recommended)
```bash
# Windows
./deploy.bat

# Linux/Mac
./deploy.sh
```

#### Option B: Manual Production Build
```bash
# Build both frontend and backend
npm run build

# Start production server (serves both)
npm start
```

### 6. Database Setup
```bash
# Push database schema
npm run db:push

# Seed with sample data
npm run seed
```
## 🛰 Deployment

### Local Development
```bash
# Separated services
npm run dev:frontend  # Port 3000
npm run dev:backend   # Port 5000

# Or use helper scripts
./dev.bat            # Windows
./dev.sh             # Linux/Mac
```

### Production Deployment

#### Docker Compose (Recommended)
```bash
# Build and deploy
./deploy.bat         # Windows  
./deploy.sh          # Linux/Mac

# Manual commands
npm run docker:build
npm run docker:up
npm run docker:logs  # Monitor logs
npm run docker:down  # Stop services
```

#### Cloud Deployment (Render/Railway/Vercel)
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
## 🧑‍💻 Author

Made by Dhruv Sahu as part of a fullstack AI Slack Clone project.
