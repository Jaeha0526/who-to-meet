#!/bin/bash
# Load sample participant data into the running backend

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Loading 20 sample participants..."

curl -s -X POST http://localhost:8000/api/reset > /dev/null 2>&1

RESULT=$(curl -s -X POST http://localhost:8000/api/ingest/batch \
  -H "Content-Type: application/json" \
  -d @"$SCRIPT_DIR/data/sample_participants.json")

COUNT=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['imported'])" 2>/dev/null)

if [ -n "$COUNT" ]; then
  echo "Loaded $COUNT participants"
  echo ""
  echo "Open http://localhost:3000 to view the app"
else
  echo "Failed to load data. Is the backend running on :8000?"
  echo "   Start it with: ./start.sh"
fi
