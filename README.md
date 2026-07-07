# OverlappAd 🕸️

**Creator matching that reasons over your customers — not follower counts.**

Live demo → **https://castgraph.butterbase.dev**

> When you launch a product, you open a creator marketplace and get hundreds of profiles ranked by
> follower count — but you can't see which creators' audiences are *actually your customers*, so you
> guess and burn budget. **OverlappAd** models creators, their audiences, and your customers as one
> graph, finds the creators whose followers overlap your real buyers, shows you the exact path that
> proves it, and books them — all in one flow.

Built for **HackwithBay 3.0** — *Graph-Aware Agentic Applications* (Butterbase + Neo4j + RocketRide Cloud).

---

## The problem

DTC food-&-beverage brand marketers sift 50–100 creator profiles per brief ranked on follower-count
vanity metrics, and still misfire — a bad match wastes ~$2–5k and weeks, because *"does this creator's
audience overlap my actual buyers?"* is invisible in a flat directory like Fiverr.

OverlappAd asks the one question a flat directory can't: **whose followers *are* my customers?**

## What it does (the demo)

1. Paste your **customer profile** + **launch brief** (pre-filled: matcha drink for Gen-Z).
2. Hit **Find creators** → three creators appear, each with a **visual why-path** back to your own
   customers: `@creator → reaches → {audience} → 88% overlaps → YOUR customers`, plus past performance
   (`ran Oat-Milk Barista → +38% for Oatly`) and a **match score**.
   These aren't the biggest creators — they're the ones whose audience overlaps your buyers.
3. **Book** one → real checkout flow → `$850 held`, booking recorded.

The picks are ranked by audience-overlap + past campaign lift, not follower count — the big-follower
decoys (`@flavorbomb_eats` 1.4M, `@pixelplays` 1.65M) are correctly buried.

---

## How the three mandatory sponsors are load-bearing

Every recommendation you see is produced by all three, in the live request path:

```
Browser  (Butterbase-hosted frontend, castgraph.butterbase.dev)
  │
  ├─ sign in ─────────────►  Butterbase Auth  ──►  JWT (demo brand account)
  │
  ├─ Find creators ───────►  find_creators  (Butterbase serverless function)
  │                              │
  │                              └─ calls ─►  RocketRide Cloud pipeline  "castgraph_match"
  │                                              (WebSocket DAP, deployed to api.rocketride.ai)
  │                                                 │
  │                                                 └─ runs Cypher on ─►  Neo4j Aura
  │                              ◄── ranked creators + audience-overlap paths ──┘
  │
  ├─ (progressive) ───────►  explain_matches  ──►  Butterbase AI gateway (Claude) → polished "why"
  │
  └─ Book ────────────────►  book_creator  ──►  payment settle + booking row  (Butterbase Postgres)

  briefs + bookings persisted in Butterbase Postgres, scoped to the signed-in user.
```

- **Neo4j** — the brain. The match is a Cypher traversal `Creator -[:REACHES]-> AudienceSegment
  -[:OVERLAPS]-> CustomerSegment`, ranked by overlap % + campaign `PERFORMED` lift. A flat SQL JOIN
  can't express "creators whose audience overlaps my customers, weighted by proven lift." The why-path
  shown in the UI *is* the returned graph path. → [`graph/seed-data.cypher`](graph/seed-data.cypher)
- **RocketRide Cloud** — the hosted reasoning. A deployed pipeline (`webhook → agent → tool_http_request
  → db_neo4j`) executes the Cypher against Aura and returns the ranked result. The app calls this managed
  cloud endpoint per request over RocketRide's WebSocket protocol.
  → [`pipeline/castgraph-match.template.json`](pipeline/castgraph-match.template.json)
- **Butterbase** — the whole backend, zero DevOps: **Auth** (end-user JWT), **Database** (briefs +
  bookings, user-scoped), **serverless functions** (`find_creators`, `book_creator`, `explain_matches`,
  `demo_session`), the **AI model gateway** (Claude, for the friendly explanations), **payment** (booking
  checkout), and the **hosted frontend**. → [`app/`](app/)

## Graph model (Neo4j)

| Node | Key props |
|------|-----------|
| `Creator` | handle, platform, followers, niche |
| `AudienceSegment` | id, name, ageBand, geo, interests |
| `CustomerSegment` | id, name, description |
| `Campaign` | id, name, product, year |
| `Brand` | name, category |

| Relationship | Meaning |
|--------------|---------|
| `(Creator)-[:REACHES {sharePct}]->(AudienceSegment)` | share of a creator's audience in a segment |
| `(AudienceSegment)-[:OVERLAPS {pct}]->(CustomerSegment)` | how much an audience overlaps the brand's customers |
| `(Creator)-[:RAN]->(Campaign)-[:PERFORMED {lift}]->(Brand)` | past campaign performance |

**The match query** (returns the exact 3 winners for the hero brief):

```cypher
MATCH (c:Creator)-[r:REACHES]->(a:AudienceSegment)-[o:OVERLAPS]->(cs:CustomerSegment {id:'CS_Hero'})
WITH c, sum(r.sharePct/100.0 * o.pct) AS audienceFit,
     collect({seg:a.name, overlap:o.pct, contrib:r.sharePct/100.0*o.pct}) AS segs
OPTIONAL MATCH (c)-[:RAN]->(k:Campaign)-[p:PERFORMED]->(b:Brand)
WITH c, audienceFit, segs, collect({campaign:k.name, lift:p.lift, brand:b.name}) AS camps
WITH c, audienceFit,
     reduce(best=segs[0], s IN segs | CASE WHEN s.contrib > best.contrib THEN s ELSE best END) AS topSeg,
     reduce(bc=camps[0], x IN camps | CASE WHEN coalesce(x.lift,0) > coalesce(bc.lift,0) THEN x ELSE bc END) AS topCamp
RETURN c.handle AS creator, c.followers AS followers, topSeg.seg AS topAudience, topSeg.overlap AS overlapPct,
       coalesce(topCamp.brand,'') AS brand, coalesce(topCamp.lift,0) AS lift,
       round(audienceFit + coalesce(topCamp.lift,0)*0.3,1) AS score
ORDER BY score DESC LIMIT 3
```

## Repo layout

```
app/frontend/index.html      – the single-file UI (Butterbase static deploy)
app/functions/               – find_creators, book_creator, explain_matches, demo_session
pipeline/                    – RocketRide pipeline template + deploy.sh + WS client reference
graph/                       – seed-data.cypher (42 creators, rigged hero scenario) + load-seed.py
scripts/                     – check-rocketride.sh (connectivity check)
docs/                        – architecture + judge-facing project description
```

## Run / redeploy

Secrets live in a git-ignored `.env` (RocketRide + Neo4j). Then:

```bash
python3 graph/load-seed.py          # load the graph into Neo4j Aura (idempotent)
./scripts/check-rocketride.sh       # verify RocketRide Cloud connectivity
bash pipeline/deploy.sh             # deploy the castgraph_match pipeline to RocketRide Cloud
# Butterbase app + functions + frontend are provisioned via the Butterbase MCP / API.
```

## Stack

Neo4j AuraDB · RocketRide Cloud · Butterbase (auth, Postgres, functions, AI gateway, payment, frontend)
· vanilla JS. Bonus tracks (Cognee memory) noted in [`docs/`](docs/).

---

*HackwithBay 3.0 · OverlappAd · a reasoning engine over who actually reaches your customers.*
