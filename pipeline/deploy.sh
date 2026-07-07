#!/usr/bin/env bash
# Deploy the CastGraph match pipeline to RocketRide Cloud.
# Reads creds from ../.env, injects NEO4J_PASSWORD into the template,
# POSTs /task, and saves the returned task token to ../_private/rr-token.txt
#
# Usage:  ./deploy.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

# --- load env (ROCKETRIDE_URI, ROCKETRIDE_AUTH, NEO4J_PASSWORD) ---
set -a; . "$ROOT/.env"; set +a
: "${ROCKETRIDE_URI:?}"; : "${ROCKETRIDE_AUTH:?}"; : "${NEO4J_PASSWORD:?}"

TEMPLATE="$HERE/castgraph-match.template.json"
TOKEN_FILE="$ROOT/_private/rr-token.txt"
BODY="$(mktemp)"; RESP="$(mktemp)"
trap 'rm -f "$BODY" "$RESP"' EXIT

# --- inject the real password (never echoed) into the template ---
NEO4J_PASSWORD="$NEO4J_PASSWORD" python3 - "$TEMPLATE" > "$BODY" <<'PY'
import json,os,sys
p=json.load(open(sys.argv[1]))
for c in p["components"]:
    d=c.get("config",{})
    if isinstance(d.get("default"),dict) and d["default"].get("password")=="${NEO4J_PASSWORD}":
        d["default"]["password"]=os.environ["NEO4J_PASSWORD"]
json.dump(p,sys.stdout)
PY

# --- POST /task ---
CODE="$(curl -s -o "$RESP" -w '%{http_code}' --max-time 120 \
  -X POST "$ROCKETRIDE_URI/task" \
  -H "Authorization: Bearer $ROCKETRIDE_AUTH" \
  -H "Content-Type: application/json" \
  --data-binary @"$BODY")"

STATUS="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("status",""))' "$RESP" 2>/dev/null || true)"
TOKEN="$(python3  -c 'import json,sys;print((json.load(open(sys.argv[1])).get("data") or {}).get("token",""))' "$RESP" 2>/dev/null || true)"
ERRMSG="$(python3 -c 'import json,sys;print((json.load(open(sys.argv[1])).get("error") or {}).get("message",""))' "$RESP" 2>/dev/null || true)"

if [ "$STATUS" = "OK" ] && [ -n "$TOKEN" ]; then
  mkdir -p "$ROOT/_private"; printf '%s' "$TOKEN" > "$TOKEN_FILE"
  echo "Deployed castgraph_match. Token saved to $TOKEN_FILE"
  echo "TOKEN=$TOKEN"
elif printf '%s' "$ERRMSG" | grep -qi 'already running'; then
  echo "Pipeline castgraph_match is already running (persistent)."
  echo "Tokens are ephemeral; resolve the live token over WebSocket, or terminate & redeploy."
  echo "  (Butterbase reuses the running pipeline via execute{useExisting:true} — no saved token needed.)"
else
  echo "Deploy failed (HTTP $CODE, status=$STATUS): $ERRMSG" >&2
  exit 1
fi
