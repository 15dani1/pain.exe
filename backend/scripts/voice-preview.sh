#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
TEXT="${1:-You said Thursday. It is Saturday. Move now.}"
OUT_FILE="${2:-preview.mp3}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed."
  exit 1
fi

RESP_FILE="$(mktemp)"
trap 'rm -f "$RESP_FILE"' EXIT

curl -sS -X POST "${BASE_URL}/api/voice/preview" \
  -H "Content-Type: application/json" \
  -d "$(printf '{"text":"%s"}' "$(printf '%s' "$TEXT" | sed 's/"/\\"/g')")" \
  > "$RESP_FILE"

node -e '
  const fs = require("fs");
  const [respPath, outFile] = process.argv.slice(1);
  const raw = fs.readFileSync(respPath, "utf8");
  const data = JSON.parse(raw);
  if (!data.audioBase64) {
    console.error("Voice preview failed:", data.error || "Unknown error");
    if (data.detail) console.error(data.detail);
    process.exit(1);
  }
  fs.writeFileSync(outFile, Buffer.from(data.audioBase64, "base64"));
  console.log(`Saved ${outFile}`);
' "$RESP_FILE" "$OUT_FILE"

if command -v afplay >/dev/null 2>&1; then
  afplay "$OUT_FILE"
else
  echo "afplay not found; file saved at $OUT_FILE"
fi

