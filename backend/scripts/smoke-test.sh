#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
USER_ID="${1:-}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed"
  exit 1
fi

if [ -z "$USER_ID" ]; then
  seed_out=$(npm run -s seed 2>&1 || true)
  USER_ID=$(echo "$seed_out" | sed -n 's/.*userId=\([a-f0-9]\{24\}\).*/\1/p' | tail -n 1)
  if [ -z "$USER_ID" ]; then
    USER_ID=$(echo "$seed_out" | sed -n 's/.*exists: \([a-f0-9]\{24\}\).*/\1/p' | tail -n 1)
  fi
fi

if [ -z "$USER_ID" ]; then
  echo "Unable to determine userId. Pass one explicitly: bash scripts/smoke-test.sh <userId>"
  exit 1
fi

echo "Using userId=$USER_ID"

echo "1) health"
curl -sS "$BASE_URL/health" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.ok) process.exit(1); console.log("ok");});'

echo "2) demo reset"
curl -sS -X POST "$BASE_URL/api/demo/reset" -H "Content-Type: application/json" -d "{\"userId\":\"$USER_ID\"}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.ok) process.exit(1); console.log(`stage=${j.stage} debt=${j.debtCount}`);});'

echo "3) dashboard"
curl -sS "$BASE_URL/api/dashboard?userId=$USER_ID" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.user||!j.todayTask) process.exit(1); console.log(`task=${j.todayTask.status} stage=${j.escalation.stage} debt=${j.debtCount}`);});'

echo "4) chat"
curl -sS -X POST "$BASE_URL/api/chat" -H "Content-Type: application/json" -d "{\"userId\":\"$USER_ID\",\"message\":\"I am back\"}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.content) process.exit(1); console.log("coach reply ok");});'

echo "5) checkin missed"
curl -sS -X POST "$BASE_URL/api/checkin" -H "Content-Type: application/json" -d "{\"userId\":\"$USER_ID\",\"status\":\"missed\"}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.ok) process.exit(1); console.log(`stage=${j.stage} debt=${j.debtCount}`);});'

echo "6) recovery accept"
curl -sS -X POST "$BASE_URL/api/recovery" -H "Content-Type: application/json" -d "{\"userId\":\"$USER_ID\",\"action\":\"accept\"}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.ok) process.exit(1); console.log(`debt=${j.debtCount}`);});'

echo "7) dashboard final"
curl -sS "$BASE_URL/api/dashboard?userId=$USER_ID" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.user||!j.todayTask) process.exit(1); console.log(`final stage=${j.escalation.stage} debt=${j.debtCount}`);});'

echo "Smoke test passed"
