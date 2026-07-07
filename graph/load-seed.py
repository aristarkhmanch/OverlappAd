#!/usr/bin/env python3
"""Загружает .drl/seed-data.cypher в Neo4j через AuraDB Query API v2. Креды берёт из .env."""
import base64, json, os, re, sys, urllib.request, urllib.error, pathlib

root = pathlib.Path(__file__).parent
repo = root.parent
env = {}
for line in (repo / ".env").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

host = env["NEO4J_URI"].split("://", 1)[1]           # 22ad19fc.databases.neo4j.io
db   = env.get("NEO4J_DATABASE", "neo4j")
url  = f"https://{host}/db/{db}/query/v2"
auth = base64.b64encode(f'{env["NEO4J_USERNAME"]}:{env["NEO4J_PASSWORD"]}'.encode()).decode()

def run(stmt):
    body = json.dumps({"statement": stmt}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json", "Accept": "application/json",
        "Authorization": f"Basic {auth}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return True, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return False, e.read().decode()

# режем построчные // комментарии, склеиваем, делим на стейтменты по ';'
raw = (root / "seed-data.cypher").read_text()
no_comments = "\n".join(l for l in raw.splitlines() if not l.lstrip().startswith("//"))
stmts = [s.strip() for s in no_comments.split(";") if s.strip()]

print(f"Загружаю {len(stmts)} стейтментов в базу '{db}'…")
ok = 0
for i, s in enumerate(stmts, 1):
    success, resp = run(s)
    if success:
        ok += 1
    else:
        print(f"  ✗ стейтмент {i} упал:\n    {s[:80]}…\n    {resp[:200]}")
        sys.exit(1)
print(f"✓ Загружено {ok}/{len(stmts)} стейтментов без ошибок.")
