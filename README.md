# YouTube Video Summarizer (YVS)

A full-stack application that automatically transcribes and summarizes YouTube videos using AI. Built with React (frontend) and Node.js/Express (backend), featuring multiple AI backend options including free local processing.

---

## 🎯 Features

- 🎥 **YouTube Video Processing** - Extract audio from any YouTube video
- 🎤 **Speech-to-Text** - Transcribe audio using Whisper (local or API)
- 🤖 **AI Summarization** - Generate structured summaries using Ollama, Gemini, or OpenAI
- 💾 **Smart Caching** - Store transcripts and summaries in MongoDB
- 🔄 **Background Processing** - Queue-based job processing with BullMQ
- 📊 **Real-time Progress** - Track processing status with live updates
- 💰 **100% FREE Option** - Complete pipeline with no API costs

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FULL SYSTEM ARCHITECTURE                  │
└─────────────────────────────────────────────────────────────┘

Frontend (React + Vite)
http://localhost:5173
  │
  ├─> Submit YouTube URL
  ├─> Poll for job status
  └─> Display results
  │
  ▼
Backend API (Express)
http://localhost:5000
  │
  ├─> POST /api/summarize    ← Validate URL, check cache, enqueue job
  ├─> GET /api/result/:jobId ← Poll for status and results
  └─> GET /api/health        ← Health check
  │
  ▼
BullMQ Queue (Redis)
  │
  ├─> Job queuing
  ├─> Retry logic (3 attempts)
  └─> Progress tracking
  │
  ▼
Worker Process
  │
  ├─> Step 1: Download audio (yt-dlp)
  ├─> Step 2: Normalize audio (FFmpeg → 16kHz mono WAV)
  ├─> Step 3: Transcribe (Whisper - local/API)
  ├─> Step 4: Chunk transcript (~1500 tokens/chunk)
  ├─> Step 5: MAP summarize (AI - per chunk)
  └─> Step 6: REDUCE summarize (AI - final summary)
  │
  ▼
MongoDB Atlas
  │
  └─> Store: video metadata, transcripts, summaries
```

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [AI Backend Options](#ai-backend-options)
- [API Reference](#api-reference)
- [Frontend Details](#frontend-details)
- [Backend Details](#backend-details)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Performance & Cost](#performance--cost)

---

## 🔧 Prerequisites

### Required Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **Node.js ≥ 18** | Runtime | https://nodejs.org |
| **Python ≥ 3.8** | For Whisper | https://python.org |
| **Redis** | Job queue | https://redis.io or Redis Cloud (free) |
| **MongoDB** | Database | MongoDB Atlas (free tier) |
| **yt-dlp** | YouTube downloader | `pip install yt-dlp` |
| **FFmpeg** | Audio processing | https://ffmpeg.org/download.html |

### Optional Tools (for FREE setup)

| Tool | Purpose | Install |
|------|---------|---------|
| **Whisper (local)** | Free transcription | `pip install openai-whisper` |
| **Ollama** | Free summarization | https://ollama.com/download |

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd youtube-video-summarizer
```

### 2. Setup Backend

```bash
cd yvs-backend
npm install
cp .env.example .env
# Edit .env with your configuration
```

### 3. Setup Frontend

```bash
cd yvs-frontend
npm install
cp .env.example .env
# Edit .env with backend API URL
```

### 4. Start Redis

```bash
# Option 1: Local Redis
redis-server

# Option 2: Docker
docker run -p 6379:6379 redis:alpine

# Option 3: Use Redis Cloud (free tier)
```

### 5. Start the Application

```bash
# Terminal 1: Backend API
cd yvs-backend
npm start

# Terminal 2: Worker Process
cd yvs-backend
npm run worker

# Terminal 3: Frontend
cd yvs-frontend
npm run dev
```

### 6. Access the Application

Open your browser and navigate to:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **API Health:** http://localhost:5000/api/health

---

## 📁 Project Structure

```
youtube-video-summarizer/
├── yvs-frontend/              # React frontend
│   ├── src/
│   │   ├── App.jsx           # Main application component
│   │   ├── App.css           # Styles
│   │   ├── main.jsx          # Entry point
│   │   └── assets/           # Images and icons
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── yvs-backend/               # Node.js backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js         # MongoDB connection
│   │   │   └── redis.js      # Redis connection
│   │   ├── controllers/
│   │   │   └── summarize.controller.js
│   │   ├── models/
│   │   │   └── Video.js      # Mongoose schema
│   │   ├── queue/
│   │   │   ├── queue.js      # BullMQ queue
│   │   │   └── worker.js     # Background worker
│   │   ├── routes/
│   │   │   ├── summarize.routes.js
│   │   │   └── health.routes.js
│   │   ├── services/
│   │   │   ├── video.service.js         # yt-dlp + FFmpeg
│   │   │   ├── transcription.service.js # Whisper
│   │   │   └── summarization.service.js # AI summarization
│   │   ├── utils/
│   │   │   ├── chunker.js    # Text chunking
│   │   │   ├── logger.js     # Winston logger
│   │   │   └── youtube.js    # URL validation
│   │   ├── app.js            # Express app
│   │   └── server.js         # Entry point
│   ├── tmp/                  # Temp audio files
│   ├── .env.example
│   └── package.json
│
└── README.md                 # This file
```

---

## ⚙️ Configuration

### Choose Your AI Backend

You have **three options** for summarization:

| Backend | Cost | Setup Time | Speed | Quality | Rate Limits |
|---------|------|------------|-------|---------|-------------|
| **Ollama** | FREE | 10 min | Medium | Very Good | None |
| **Gemini** | FREE | 2 min | Fast | Excellent | 15 RPM |
| **OpenAI** | Paid | 2 min | Fast | Excellent | Varies |

---

## 🤖 AI Backend Options

### Option 1: Ollama (Recommended - FREE & Unlimited)

**Best for:** Privacy, unlimited processing, offline capability

**Pros:**
- ✅ 100% FREE
- ✅ Unlimited processing
- ✅ Works offline
- ✅ Complete privacy
- ✅ No API keys needed

**Setup:**

1. **Download Ollama:** https://ollama.com/download
2. **Install** and run the installer
3. **Download a model:**
   ```bash
   ollama pull llama3.2
   ```
4. **Update backend `.env`:**
   ```env
   SUMMARIZATION_BACKEND=ollama
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```

**Recommended Models:**

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| `llama3.2` | 2GB | Fast | Good | **General use** ✅ |
| `gemma2:2b` | 1.6GB | Fastest | Good | Low-end PCs |
| `mistral` | 4GB | Medium | Very Good | Better quality |
| `llama3.1:8b` | 4.7GB | Slower | Excellent | Best quality |

### Option 2: Gemini (Easiest - FREE with Limits)

**Best for:** Quick setup, cloud-based processing

**Pros:**
- ✅ No installation needed
- ✅ FREE (15 requests/minute)
- ✅ Fast and reliable
- ✅ Works immediately

**Cons:**
- ❌ Requires internet
- ❌ Rate limited (15 RPM)
- ❌ ~100 videos/day limit

**Setup:**

1. **Get FREE API key:** https://aistudio.google.com/app/apikey
2. **Update backend `.env`:**
   ```env
   SUMMARIZATION_BACKEND=gemini
   GEMINI_API_KEY=AIzaSy...your-key-here
   ```

### Option 3: OpenAI (Paid)

**Best for:** Highest quality, production use

**Pros:**
- ✅ Excellent quality
- ✅ Fast processing
- ✅ Reliable

**Cons:**
- ❌ Requires credit card
- ❌ Costs ~$0.0002 per video

**Setup:**

1. **Get API key:** https://platform.openai.com/api-keys
2. **Add payment method**
3. **Update backend `.env`:**
   ```env
   SUMMARIZATION_BACKEND=openai
   OPENAI_API_KEY=sk-proj-...your-key-here
   ```

### Transcription Setup

#### Local Whisper (Recommended - FREE)

**Pros:**
- ✅ Completely FREE
- ✅ Unlimited usage
- ✅ Works offline
- ✅ No file size limits

**Setup:**

```bash
pip install openai-whisper
```

**Backend `.env`:**
```env
WHISPER_MODE=local
WHISPER_LOCAL_PATH=whisper
```

**For Windows (use full path):**
```bash
# Find the path
where.exe whisper

# Update .env
WHISPER_LOCAL_PATH=C:\Users\YourName\AppData\Local\Programs\Python\Python310\Scripts\whisper.exe
```

#### OpenAI Whisper API (Not Recommended)

**Cons:**
- ❌ Costs $0.006/minute
- ❌ 25MB file size limit
- ❌ Requires internet

```env
WHISPER_MODE=openai
OPENAI_API_KEY=sk-proj-...
```

---

## 📡 API Reference

### POST `/api/summarize`

Submit a YouTube URL for processing.

**Request:**
```json
{
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response (new job):** `202 Accepted`
```json
{
  "success": true,
  "cached": false,
  "jobId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "status": "processing",
  "message": "Video is being processed. Poll GET /result/:jobId for updates."
}
```

**Response (cached):** `200 OK`
```json
{
  "success": true,
  "cached": true,
  "jobId": "...",
  "status": "completed",
  "title": "Video Title",
  "summary": {
    "title": "...",
    "overview": "...",
    "keyPoints": ["...", "..."],
    "takeaways": ["...", "..."]
  }
}
```

### GET `/api/result/:jobId`

Poll for job status and results.

**Response (processing):** `202 Accepted`
```json
{
  "success": true,
  "jobId": "...",
  "status": "processing",
  "progress": 55
}
```

**Response (completed):** `200 OK`
```json
{
  "success": true,
  "jobId": "...",
  "status": "completed",
  "title": "Video Title",
  "summary": {
    "title": "...",
    "overview": "3-5 sentence overview...",
    "keyPoints": ["Point 1", "Point 2", "..."],
    "takeaways": ["Takeaway 1", "..."]
  }
}
```

**Response (failed):** `200 OK`
```json
{
  "success": true,
  "jobId": "...",
  "status": "failed",
  "errorMessage": "..."
}
```

### GET `/api/health`

Check API health status.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected"
  }
}
```

---

## 🎨 Frontend Details

### Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **CSS3** - Styling with modern features
- **Fetch API** - HTTP requests

### Features

- Clean, modern UI design
- Real-time job status polling
- Progress indicators
- Error handling and display
- Responsive layout
- Copy-to-clipboard functionality

### Frontend Environment Variables

Create `yvs-frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

### Development

```bash
cd yvs-frontend
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

---

## 🔧 Backend Details

### Technology Stack

- **Node.js + Express** - API server
- **BullMQ** - Job queue management
- **MongoDB + Mongoose** - Database
- **Redis** - Queue storage
- **Winston** - Logging
- **yt-dlp** - YouTube audio extraction
- **FFmpeg** - Audio processing
- **Whisper** - Speech-to-text
- **AI APIs** - Summarization (Ollama/Gemini/OpenAI)

### Processing Pipeline

```
1. Download Audio
   └─> yt-dlp extracts audio from YouTube

2. Normalize Audio
   └─> FFmpeg converts to 16kHz mono WAV

3. Transcribe
   └─> Whisper converts speech to text

4. Chunk Transcript
   └─> Split into ~1500 token chunks

5. MAP Summarize
   └─> AI summarizes each chunk in parallel

6. REDUCE Summarize
   └─> AI combines into structured final summary
   
7. Store Results
   └─> Save to MongoDB
```

### Development

```bash
cd yvs-backend
npm run dev         # Start API server (nodemon)
npm run dev:worker  # Start worker (nodemon)
npm start           # Start API server (production)
npm run worker      # Start worker (production)
```

---

## 🔐 Environment Variables

### Backend Environment Variables

Create `yvs-backend/.env`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/yvs

# Queue (Redis Cloud or local)
REDIS_URL=redis://:password@host:port
# OR for local Redis:
# REDIS_HOST=127.0.0.1
# REDIS_PORT=6379
# REDIS_PASSWORD=

# Transcription
WHISPER_MODE=local                    # 'local' or 'openai'
WHISPER_LOCAL_PATH=whisper            # Path to whisper binary

# Summarization (choose one)
SUMMARIZATION_BACKEND=ollama          # 'ollama', 'gemini', or 'openai'

# Ollama (if using)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Gemini (if using)
GEMINI_API_KEY=AIzaSy...

# OpenAI (if using)
OPENAI_API_KEY=sk-proj-...

# Binary Paths
YTDLP_PATH=yt-dlp                     # or full path
FFMPEG_PATH=ffmpeg                    # or full path

# Storage
TEMP_DIR=./tmp

# Job Configuration
JOB_ATTEMPTS=3
JOB_BACKOFF_DELAY=5000

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend Environment Variables

Create `yvs-frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

---

## 🐛 Troubleshooting

### Common Issues

#### Ollama Issues

**"fetch failed" or "Ollama not running"**

```bash
# Check installation
ollama --version

# Start Ollama (should auto-start)
# Check system tray for Ollama icon

# Verify
ollama list

# Test
ollama run llama3.2 "Hello!"
```

**"Model not found"**

```bash
ollama pull llama3.2
```

#### Whisper Issues

**"whisper: command not found"**

```bash
# Install
pip install openai-whisper

# Or use full path in .env
WHISPER_LOCAL_PATH=C:\Users\...\Scripts\whisper.exe
```

**Slow transcription**

- Use smaller model (`tiny` or `base`)
- Install GPU support (CUDA for NVIDIA)
- Close other applications

#### Redis Issues

**"REDIS_URL is not defined"**

Check `.env` file has `REDIS_URL` or individual settings:
```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

#### Worker Not Processing

1. Check both server and worker are running
2. Check Redis connection
3. Check worker logs for errors
4. Restart worker: `npm run worker`

#### Frontend Can't Connect

1. Check backend is running on correct port
2. Verify `VITE_API_URL` in frontend `.env`
3. Check CORS settings in backend `.env`

---

## 📊 Performance & Cost

### Cost Comparison (per 100 videos)

| Configuration | Transcription | Summarization | Total Cost |
|---------------|---------------|---------------|------------|
| **Ollama + Local Whisper** | FREE | FREE | **$0.00** ✅ |
| **Gemini + Local Whisper** | FREE | FREE | **$0.00** ✅ |
| **OpenAI GPT-3.5 + Local Whisper** | FREE | ~$0.02 | ~$0.02 |
| **OpenAI GPT-4 + OpenAI Whisper** | ~$3.60 | ~$0.30 | ~$3.90 |

### Processing Time (10-minute video)

| Configuration | Time | Notes |
|---------------|------|-------|
| **Ollama (CPU)** | 8-12 min | llama3.2 model |
| **Ollama (GPU)** | 4-6 min | With NVIDIA GPU |
| **Gemini** | 3-5 min | Cloud-based |
| **OpenAI** | 3-5 min | Cloud-based |

### Hardware Requirements

#### Minimum (for Ollama)
- **RAM:** 8GB
- **Disk:** 5GB free
- **CPU:** Any modern CPU
- **GPU:** Optional (3-5x faster)

#### Recommended
- **RAM:** 16GB
- **Disk:** 10GB free
- **CPU:** Multi-core processor
- **GPU:** NVIDIA GPU (for faster processing)

---

## 🎯 Recommended Setup (100% FREE)

For the best free experience:

1. **Frontend:** React + Vite (FREE)
2. **Backend:** Node.js + Express (FREE)
3. **Transcription:** Local Whisper (FREE, unlimited)
4. **Summarization:** Ollama with llama3.2 (FREE, unlimited)
5. **Database:** MongoDB Atlas free tier (512MB)
6. **Queue:** Redis Cloud free tier (30MB)

**Total cost: $0.00 per video** 🎉

---

## 🚀 Quick Commands

```bash
# Frontend
cd yvs-frontend
npm run dev          # Start dev server
npm run build        # Build for production

# Backend
cd yvs-backend
npm start            # Start API server
npm run worker       # Start worker
npm run dev          # Dev mode (API)
npm run dev:worker   # Dev mode (worker)

# Check installations
ollama --version
python -c "import whisper; print('OK')"
node --version
redis-cli ping

# Test components
ollama run llama3.2 "Hello!"
whisper --help
curl http://localhost:5000/api/health
```

---

## 📝 Notes

- API server and worker are **separate processes** — both must be running
- Duplicate URLs are detected — no double processing
- Transcripts are cached in MongoDB — re-runs skip transcription
- Failed jobs can be re-submitted
- Temp audio files are auto-deleted after processing
- Redis connection includes automatic retry logic

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🆘 Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review worker logs for error messages
3. Verify all prerequisites are installed
4. Check environment variables are set correctly

---

**Happy summarizing!** 🚀
