# OverlappAd — Architecture & Integration

This document details the problem, the Neo4j graph model, and exactly how Butterbase, Neo4j, and
RocketRide Cloud are woven into the core product — for the HackwithBay 3.0 judging criteria (*"how
meaningfully all three mandatory technologies are woven into the core product experience"*).

## Problem

DTC food-&-beverage marketers pick creators from flat marketplaces sorted by follower count. That
metric doesn't answer the only question that matters: **is this creator's audience actually my
customer?** So they guess and waste budget. OverlappAd reframes creator selection as a **graph
reasoning problem** over the relationships between creators, their audiences, and the brand's own
customers.

## The request path (all three sponsors, load-bearing)

A single "Find creators" click exercises all three mandatory technologies in sequence:

1. **Butterbase Auth** issues the brand a JWT (`demo_session` function → `/auth/{app}/login`). Every
   request carries it; briefs and bookings are stamped with the user's id.
2. **Butterbase function `find_creators`** is the app's entry point. It calls…
3. **RocketRide Cloud** — the deployed `castgraph_match` pipeline — over its WebSocket DAP protocol
   (`wss://api.rocketride.ai/task/service`). The pipeline is `webhook → agent_rocketride →
   tool_http_request → db_neo4j`. The function `execute`s the persistent pipeline (`useExisting`) then
   invokes the HTTP tool, which runs our Cypher against…
4. **Neo4j Aura** — the audience-overlap graph traversal that produces the ranked match and the
   why-path returned to the UI.
5. **Butterbase AI gateway** (`explain_matches`, progressive) turns each returned graph path into a
   grounded one-sentence explanation via Claude.
6. **Butterbase Postgres + payment** (`book_creator`) settles the booking checkout and persists the
   order.

If RocketRide is momentarily unreachable (e.g. Aura free-tier cold start), `find_creators` falls back
to a pre-verified result so the demo never breaks — but the default, live path goes through RocketRide.

## Neo4j — the reasoning layer

The graph is the point of the product. Nodes: `Creator`, `AudienceSegment`, `CustomerSegment`,
`Campaign`, `Brand`. The match is relationship-based and cannot be expressed as a clean SQL JOIN:

```
(Creator)-[:REACHES {sharePct}]->(AudienceSegment)-[:OVERLAPS {pct}]->(CustomerSegment)
(Creator)-[:RAN]->(Campaign)-[:PERFORMED {lift}]->(Brand)
```

`audienceFit = Σ (creator's share of an audience × that audience's overlap with the brand's customers)`,
then ranked with past campaign `lift`. The **why-path** rendered in the UI is literally the traversal
that justified the pick — an explainable recommendation, not a black box. See
[`../graph/seed-data.cypher`](../graph/seed-data.cypher) (42 curated creators; mid-tier high-overlap
winners vs. big-follower low-overlap decoys).

## RocketRide Cloud — the hosted pipeline

Pipeline config (portable JSON): [`../pipeline/castgraph-match.template.json`](../pipeline/castgraph-match.template.json).
Deployed to `api.rocketride.ai` via `POST /task` (see [`../pipeline/deploy.sh`](../pipeline/deploy.sh));
this is a managed, persistent production endpoint (`project_id: castgraph_match`), not a local/Docker
run. Notable engineering detail: tool invocation (the step that runs the Cypher) is only exposed over
RocketRide's WebSocket DAP protocol, so the Butterbase function speaks that protocol directly
(auth → execute → `rrext_process` tool call → parse `body.result.json.data.values`). Reference client:
[`../pipeline/butterbase-castgraph.js`](../pipeline/butterbase-castgraph.js); the production version is
inlined in [`../app/functions/find_creators.js`](../app/functions/find_creators.js) using Deno's native
`WebSocket`.

## Butterbase — the backend

- **Auth**: end-user accounts + JWT; `find_creators`/`book_creator` read the forwarded `x-user-id` and
  scope rows to the signed-in brand.
- **Database** (Postgres): `briefs`, `bookings` — see [`../graph/`](../graph/) for the graph and the
  Butterbase schema is provisioned via MCP (`briefs`, `bookings`).
- **Serverless functions**: `find_creators`, `explain_matches`, `book_creator`, `demo_session`.
- **AI model gateway**: Claude (`anthropic/claude-3-haiku`) writes the friendly "why", off the wow's
  critical path.
- **Payment**: booking checkout (`book_creator`) — provider-agnostic; drops in Stripe test Checkout
  when `STRIPE_SECRET_KEY` is set, otherwise a self-contained settled order.
- **Frontend**: the single-file UI is a Butterbase static deployment at `castgraph.butterbase.dev`.

## Bonus tracks

- **Cognee (memory)**: give the agent memory of a brand's liked/booked creators so repeat matches
  improve; configure Cognee Open Source against the same Neo4j instance. (Planned; not required.)

## Reliability notes (for the live demo)

- `find_creators` returns in ~2–3s (RocketRide + Neo4j warm); AI polish arrives a few seconds later
  without gating the result.
- Neo4j Aura free tier auto-pauses; the pipeline call retries cold starts. Pre-warm with one query
  before demoing.
- A canned fallback guarantees the hero scenario always renders.
