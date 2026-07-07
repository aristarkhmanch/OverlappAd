#!/usr/bin/env python3
"""OverlappAd x Cognee — brand memory demo.

Gives OverlappAd an AI memory layer: it *remembers* which creators a brand has
booked and what worked, then *recalls* those facts in natural language to bias
future creator<->brand matches toward what a repeat brand actually likes.

Design:
  * Graph store  -> our existing Neo4j Aura (shared with the match graph).
                    Cognee writes its OWN labels (Entity / TextDocument /
                    DocumentChunk / EntityType / TextSummary / NodeSet), which do
                    NOT collide with OverlappAd's Creator / AudienceSegment /
                    CustomerSegment / Campaign / Brand labels, so the live match
                    Cypher is unaffected. Cognee nodes are further namespaced
                    into the NodeSet "OverlappAdBrandMemory".
  * LLM          -> Butterbase OpenAI-compatible AI gateway (entity extraction
                    during cognify + answer generation during search).
  * Embeddings   -> configured via env (Butterbase gateway when available;
                    local fastembed fallback for offline/demo).
  * Vector + relational stores stay LOCAL (lancedb + sqlite) so no embedding
                    vectors are written into the shared Neo4j.

NO SECRETS IN THIS FILE. All credentials are read from an env file (default
../_private/cognee.env, override with COGNEE_ENV_FILE) which is gitignored.
"""

import asyncio
import os
from pathlib import Path


def _load_env_file() -> None:
    """Load KEY=VALUE lines from the private env file into os.environ.

    Must run BEFORE `import cognee` so Cognee's pydantic settings pick them up.
    """
    env_path = Path(
        os.environ.get(
            "COGNEE_ENV_FILE",
            Path(__file__).resolve().parent.parent / "_private" / "cognee.env",
        )
    )
    if not env_path.exists():
        raise SystemExit(
            f"Missing env file: {env_path}\n"
            "Create it (gitignored) with GRAPH_DATABASE_* / LLM_* / EMBEDDING_* "
            "credentials, or set COGNEE_ENV_FILE. See cognee/README.md."
        )
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file()

import cognee  # noqa: E402  (must follow env loading)
from cognee.modules.search.types import SearchType  # noqa: E402

DATASET = "overlappad_brand_memory"
NODE_SET = "OverlappAdBrandMemory"  # namespace tag for every fact we add

# A few brand-memory facts. Keep the set small so cognify stays fast.
BRAND_MEMORIES = [
    (
        "Brand 'Matcha Co.' booked @matchamaven (TikTok, 92K followers, "
        "matcha/wellness niche) for a matcha drink launch. That booking drove a "
        "+38% sales lift for a comparable Oatly campaign. Matcha Co. prefers "
        "mid-tier wellness and Gen-Z creators with high audience overlap over "
        "big-follower celebrity accounts."
    ),
    (
        "Brand 'Matcha Co.' also booked @cleanfuelkate (Instagram, 60K followers, "
        "clean-wellness niche) and was happy with the authentic, aesthetic content "
        "and the strong overlap with matcha-curious Gen-Z women in CA and NY."
    ),
    (
        "Brand 'Matcha Co.' passed on @megastarfitness (2.1M followers) because the "
        "audience overlap with matcha-curious Gen-Z women was low and the cost per "
        "engaged viewer was poor. The brand explicitly deprioritizes vanity reach."
    ),
]

RECALL_QUESTION = (
    "What kind of creators does Matcha Co. prefer, and which creators have they "
    "booked or passed on?"
)


async def main() -> None:
    print("== OverlappAd x Cognee brand-memory demo ==")
    print(f"LLM        : {os.environ.get('LLM_MODEL')} @ {os.environ.get('LLM_ENDPOINT')}")
    print(
        f"Embeddings : {os.environ.get('EMBEDDING_PROVIDER')} / "
        f"{os.environ.get('EMBEDDING_MODEL')}"
    )
    print(f"Graph store: neo4j {os.environ.get('GRAPH_DATABASE_URL')} "
          f"(db {os.environ.get('GRAPH_DATABASE_NAME')})")
    print()

    # 1) REMEMBER -------------------------------------------------------------
    print(f"[1/3] Adding {len(BRAND_MEMORIES)} brand-memory facts -> dataset "
          f"'{DATASET}', node_set '{NODE_SET}' ...")
    for fact in BRAND_MEMORIES:
        await cognee.add(fact, dataset_name=DATASET, node_set=[NODE_SET])
    print("      added.\n")

    # 2) COGNIFY (build the knowledge graph in Neo4j) -------------------------
    print("[2/3] cognify() -> extracting entities/relationships into Neo4j ...")
    await cognee.cognify(datasets=[DATASET])
    print("      knowledge graph built.\n")

    # 3) RECALL ---------------------------------------------------------------
    print(f"[3/3] search() GRAPH_COMPLETION\n      Q: {RECALL_QUESTION}\n")
    results = await cognee.search(
        query_text=RECALL_QUESTION,
        query_type=SearchType.GRAPH_COMPLETION,
        datasets=[DATASET],
    )
    print("      A:")
    for r in results:
        print("      " + str(r).replace("\n", "\n      "))


if __name__ == "__main__":
    asyncio.run(main())
