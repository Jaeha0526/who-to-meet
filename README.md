# Who To Meet

> AI-powered networking recommendations for social events — built at [Ralphthon SF 2026](https://finance.biggo.com/news/6Y_IIZ0BOIb5Xxav8sJa)

**Who To Meet** ingests participant data into a knowledge graph, then uses OpenAI o3 to generate deep, transparent recommendations on who you should connect with — and *why*.

Unlike shallow "you both like AI" matching, every recommendation shows the actual reasoning chain: shared goals, complementary skills, overlapping life experiences, all traced back to source data.

## How It Works

```
Conversation Transcripts / Bios / LinkedIn text
        ↓ LLM extraction (o3)
   Knowledge Graph (NetworkX)
        ↓ Semantic pairwise edge creation (o3)
   Transparent Recommendations
        ↓
   Interactive Graph + Chat Agent
```

1. **Ingest** participant data via transcript, manual paste, or batch JSON
2. **Extract** structured profiles (interests, skills, traits, goals) using o3
3. **Compute** semantic edges between all participants — o3 analyzes each pair for deep connections
4. **Visualize** the knowledge graph as an interactive 2D force-directed network
5. **Chat** with an AI agent that recommends who to meet with specific, grounded reasoning

## Features

### Graph + Chat (Tab 1)
- Interactive 2D force-directed graph visualization (dark mode)
- Click any node to see a person's full profile
- Click any edge to see *why* two people are connected
- Chat sidebar with recommendation mode — ask "Who should I talk to about X?"
- Toggle: enable knowledge updates from conversations or keep it comfortable

### Personal Knowledge Dashboard (Tab 2)
- Browse all participants as cards with tags
- View detailed profiles: interests, skills, traits, goals
- See all connections and conversation history for each person

### Fun Matches (Tab 3)
- **Startup Co-founders** — complementary skills for building together
- **Potential Friends** — shared personal interests and values
- **Creative Pairings** — unexpected combinations that spark ideas
- **Brain Trust** — people who'd have the best problem-solving discussions
- **World Changers** — aligned missions and goals
- **Most Unlikely But Perfect Pair** — zero surface overlap, deep structural similarity
- **Person Who Would Challenge Your Worldview** — maximally different but productively so

### Data Ingestion (3 modes)
- **Manual Paste** — name + bio text, extracted in real time
- **Transcript** — conversation recordings (Korean or English), auto-extracts all participants
- **Batch JSON** — bulk import from pre-collected data

### Quality & Transparency
- Duplicate detection warns before adding someone who's already in the graph
- Every recommendation shows WHY with visible reasoning chains and graph paths
- Chat history persists across page refreshes
- Chat conversations update the knowledge graph in real-time (when toggle is ON)
- SQLite always synced with in-memory graph — no data loss
- Cross-transcript person identity merging (same person = one node)
- 10 pytest tests covering critical demo paths

## Architecture

```
┌─────────────────────────────────────────────────┐
│         Frontend (Next.js + TypeScript)          │
│  react-force-graph-2d │ Chat Sidebar │ Dashboard │
│         http://localhost:3000                    │
└────────────────────┬────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────┐
│           Backend (FastAPI + Python)             │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ graph.py │ │  llm.py  │ │    main.py      │  │
│  │ NetworkX │ │ OpenAI o3│ │  12 API routes  │  │
│  │ + SQLite │ │          │ │                 │  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
│         http://localhost:8000                    │
└─────────────────────────────────────────────────┘
```

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Python 3.12, Uvicorn |
| Graph | NetworkX (in-memory) + SQLite (persistence) |
| LLM | OpenAI o3 (reasoning model) |
| Frontend | Next.js 14, React 18, TypeScript |
| Visualization | react-force-graph-2d (canvas-based) |
| Styling | Tailwind CSS, dark mode |

## Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- OpenAI API key

### 1. Clone and configure

```bash
git clone https://github.com/Jaeha0526/who-to-meet.git
cd who-to-meet
```

Create `.env` in the project root:
```
OPENAI_API_KEY=sk-your-key-here
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 3. Frontend setup

```bash
cd frontend
npm install
cd ..
```

### 4. Start the app

```bash
# Terminal 1: Backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

Or use the startup script:
```bash
chmod +x start.sh
./start.sh
```

### 5. Load sample data

```bash
chmod +x load_data.sh
./load_data.sh
```

This loads 20 sample Ralphthon participants with rich profiles.

Open **http://localhost:3000** to explore.

## Key Design Decisions

**Why NetworkX + SQLite instead of Neo4j?**
For a hackathon demo with 20 participants, a full graph database is overkill. NetworkX gives us in-memory graph operations with zero setup overhead. SQLite provides persistence across restarts.

**Why o3 for edge creation?**
The quality difference matters. o3 produces edges like *"Both pivoted from creative fields to engineering and share a frustration with tools that hide their reasoning"* — not *"you both like technology."* Semantic depth is the entire value proposition.

**Why batch edge creation?**
With 20 participants, that's 190 pairwise comparisons. Running them once during ingestion and storing the results is simple and sufficient. Live additions only compute edges against existing participants.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server status |
| GET | `/api/graph` | Full graph data for visualization |
| GET | `/api/persons` | All participants |
| GET | `/api/persons/{id}` | Single person + connections |
| GET | `/api/check-duplicate?name=` | Duplicate detection |
| POST | `/api/ingest/transcript` | Extract people from conversation text |
| POST | `/api/ingest/bio` | Single person bio ingestion |
| POST | `/api/ingest/batch` | Bulk JSON import |
| POST | `/api/chat` | Chat with recommendation agent |
| GET | `/api/matches` | Generate fun matching categories |
| POST | `/api/save` | Persist graph to SQLite |
| POST | `/api/reset` | Clear all data |

## Built With

- **Ouroboros** — specification-first AI development workflow
- **Kkanbu** — taste oracle that proxied user preferences during development
- **Claude Code** — autonomous mediator between Ouroboros and Kkanbu

Built in ~45 minutes of AI execution time across 3 iterations at the SF Ralphthon hackathon, March 2026.

### Development Timeline

| Iteration | Focus | ACs | Time |
|-----------|-------|-----|------|
| 1 | Full-stack app build (FastAPI + Next.js + graph + chat) | 14/14 | ~14 min |
| 2 | Semantic edges (o3), chat persistence, fun matches, UX polish | 12/12 | ~9 min |
| 3 | 17 bug fixes, pytest tests, chat→graph sync, name extraction | 11/11 | ~8 min |

### Workflow

The entire app was built using an autonomous AI development loop:

1. **Ouroboros** generated Socratic interview questions to crystallize requirements
2. **Kkanbu** (taste oracle) answered interview questions as the user's proxy
3. **Claude Code** mediated between Ouroboros and Kkanbu, executed builds, reviewed code, and committed
4. After each iteration: evaluate → consult Kkanbu → interview → seed → run → repeat

## License

MIT
