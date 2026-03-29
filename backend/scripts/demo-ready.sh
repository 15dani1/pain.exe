#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
USER_ID="${1:-}"

pass() { printf "[PASS] %s\n" "$1"; }
warn() { printf "[WARN] %s\n" "$1"; }
fail() { printf "[FAIL] %s\n" "$1"; exit 1; }

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required"
fi

if [ -z "$USER_ID" ]; then
  seed_out=$(npm run -s seed 2>&1 || true)
  USER_ID=$(echo "$seed_out" | sed -n 's/.*userId=\([a-f0-9]\{24\}\).*/\1/p' | tail -n 1)
  if [ -z "$USER_ID" ]; then
    USER_ID=$(echo "$seed_out" | sed -n 's/.*exists: \([a-f0-9]\{24\}\).*/\1/p' | tail -n 1)
  fi
fi

[ -n "$USER_ID" ] || fail "Unable to determine demo userId. Pass one explicitly."
echo "Using userId=$USER_ID"

health=$(curl -sS "$BASE_URL/health")
echo "$health" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.ok) process.exit(1);});' || fail "Health check failed"
pass "health"

reset=$(curl -sS -X POST "$BASE_URL/api/demo/reset" -H "Content-Type: application/json" -d "{\"userId\":\"$USER_ID\"}")
echo "$reset" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.ok || j.stage!==2 || j.debtCount!==1) process.exit(1);});' || fail "Demo reset failed"
pass "demo reset"

state=$(curl -sS "$BASE_URL/api/demo/state?userId=$USER_ID")
echo "$state" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.ok || j.stage!==2 || j.debtCount!==1) process.exit(1);});' || fail "Demo state check failed"
pass "demo state"

chat=$(curl -sS -X POST "$BASE_URL/api/chat" -H "Content-Type: application/json" -d "{\"userId\":\"$USER_ID\",\"message\":\"Ready for demo\",\"includeVoice\":true}")
echo "$chat" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.content){process.exit(1);} if(j.voice&&j.voice.audioBase64){console.log("voice=ok");} else if(j.voiceError){console.log("voice=degraded");} else {console.log("voice=none");}});' || fail "Chat endpoint failed"

if echo "$chat" | rg -q '"voiceError"'; then
  warn "chat text ok, voice degraded"
else
  pass "chat + voice"
fi

call=$(curl -sS -X POST "$BASE_URL/api/call/start" -H "Content-Type: application/json" -d "{\"userId\":\"$USER_ID\"}")
echo "$call" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.ok || !j.provider){process.exit(1);} console.log(`provider=${j.provider} status=${j.status ?? "unknown"}`);});' || fail "Call stage trigger failed"
pass "stage 4 call trigger"

printf "\nDemo readiness: READY\n"
