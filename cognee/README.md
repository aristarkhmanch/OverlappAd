# OverlappAd x Cognee — AI brand memory

Cognee ([https://www.cognee.ai](https://www.cognee.ai)) gives OverlappAd a persistent **AI memory layer**.
It *remembers* which creators a brand has booked and what they liked, then
*recalls* those facts in natural language so future creator↔brand matches can be
biased toward what a repeat brand actually prefers.

`brand_memory.py` is a self-contained, runnable demo:

1. **Remember** — `cognee.add(...)` a few brand-memory facts (bookings, lift,
   stated preferences), then `cognee.cognify()` to extract a knowledge graph.
2. **Recall** — `cognee.search(..., SearchType.GRAPH_COMPLETION)` answers
   *"What kind of creators does Matcha Co. prefer, and who have they booked?"*
   from the graph.

## How it wires into our stack

| Concern | Store | Notes |
|---|---|---|
| Knowledge graph | **Neo4j Aura** (the same instance as the match graph) | Cognee writes its OWN labels — see "No collision" below |
| LLM (entity extraction + answer gen) | **Butterbase AI gateway** (OpenAI-compatible) | `openai/gpt-4o-mini` via litellm |
| Embeddings | Butterbase gateway when available; **local `fastembed`** fallback | see "Embeddings" |
| Vector store | **LanceDB** (local file) | kept off the shared Neo4j |
| Relational/bookkeeping | **SQLite** (local file) | Cognee's own metadata |

Only the **graph** goes to our shared Neo4j; vectors and metadata stay local, so
Cognee never writes embedding blobs into the production graph.

## No collision with the OverlappAd match query

The live match Cypher depends on labels
`Creator / AudienceSegment / CustomerSegment / Campaign / Brand` and rels
`REACHES / OVERLAPS / RAN / PERFORMED` (see `pipeline/butterbase-castgraph.js`).

Cognee creates a **disjoint** label set — `Entity`, `EntityType`,
`TextDocument`, `DocumentChunk`, `TextSummary`, `NodeSet` — so the match query is
unaffected. Every fact we add is additionally tagged into the NodeSet
**`OverlappAdBrandMemory`** for clean namespacing/retrieval and easy cleanup.

## Run it

```bash
# 1. Python 3.11 venv (3.10+ required; system python3 is 3.9)
/opt/homebrew/bin/python3.11 -m venv _private/cognee-venv
_private/cognee-venv/bin/pip install cognee fastembed

# 2. Provide credentials (gitignored). See _private/cognee.env — it holds the
#    real GRAPH_DATABASE_* / LLM_* / EMBEDDING_* values. The script reads them
#    from that file into os.environ; nothing secret lives in this repo.

# 3. Run
_private/cognee-venv/bin/python cognee/brand_memory.py
```

The script loads `../_private/cognee.env` by default (override with
`COGNEE_ENV_FILE=/path/to/env`).

## Configuration (env var names; values live only in `_private/cognee.env`)

```dotenv
# Graph store = our Neo4j Aura
GRAPH_DATABASE_PROVIDER=neo4j
GRAPH_DATABASE_URL=neo4j+s://<instance>.databases.neo4j.io
GRAPH_DATABASE_NAME=<db>           # this instance: db name == username == 22ad19fc
GRAPH_DATABASE_USERNAME=<user>
GRAPH_DATABASE_PASSWORD=<secret>

# LLM = Butterbase OpenAI-compatible gateway
LLM_PROVIDER=openai
LLM_MODEL=openai/openai/gpt-4o-mini   # double prefix: litellm strips one 'openai/',
                                      # Butterbase's model id is 'openai/gpt-4o-mini'
LLM_ENDPOINT=https://api.butterbase.ai/v1
LLM_API_KEY=<butterbase key>

# Embeddings — local fallback (see below)
EMBEDDING_PROVIDER=fastembed
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384

# Keep vector + relational stores local
VECTOR_DB_PROVIDER=lancedb
DB_PROVIDER=sqlite
ENABLE_BACKEND_ACCESS_CONTROL=false
```

### Embeddings

Butterbase exposes embedding model ids (`openai/text-embedding-004`,
`google/gemini-embedding-001`, `amazon/amazon.titan-embed-text-v2:0`), but during
this build every embedding call returned `model_unavailable` (the chat endpoint
was fine). Cognee needs embeddings for cognify + search, so the demo uses a
**local `fastembed`** model (`all-MiniLM-L6-v2`, 384-dim) — no external embedding
API required. To switch to Butterbase embeddings once the endpoint recovers, set
in `_private/cognee.env`:

```dotenv
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=openai/openai/text-embedding-004   # double prefix, same reason as the LLM
EMBEDDING_ENDPOINT=https://api.butterbase.ai/v1
EMBEDDING_API_KEY=<butterbase key>
EMBEDDING_DIMENSIONS=<model dim>
```

## How this integrates into the live app

At match time OverlappAd would call `cognee.search()` for the requesting brand to
pull its remembered preferences and past winners, and feed that natural-language
context into the ranking prompt / as a re-ranking signal on top of the Neo4j
graph-overlap score — so a repeat brand's proven creators and stated tastes
(mid-tier, high-overlap, Gen-Z) surface first. After each campaign, a one-line
`cognee.add()` of the result (creator, lift, fit) keeps the memory compounding.
Because Cognee's graph shares the Aura instance but uses disjoint labels, this
adds a memory layer with zero schema changes to the existing match pipeline.
