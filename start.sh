#!/bin/bash
# Start both backend and frontend for who-to-meet

echo "🚀 Starting Who-to-Meet..."

# Start backend
echo "Starting backend on :8000..."
cd "$(dirname "$0")"
source .venv/bin/activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend on :3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Backend: http://localhost:8000"
echo "✅ Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
