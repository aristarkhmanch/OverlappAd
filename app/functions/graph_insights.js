// OverlappAd — graph_insights
// Surfaces the parts of the live Neo4j graph that otherwise stay "under the hood":
//   - real creators ingested live from TikTok (realData=true)
//   - the brand-memory Cognee wrote into Neo4j (booked / prefers / passed_on)
// so the homepage can show that both the TikTok ingestion and the Cognee memory
// are real, not claims. Read-only Cypher over the Neo4j HTTP Query API.
const NEO4J_URL = "https://22ad19fc.databases.neo4j.io/db/22ad19fc/query/v2";
const NEO4J_USER = "22ad19fc";

async function q(env, statement) {
  const auth = btoa(`${NEO4J_USER}:${env.NEO4J_PASSWORD}`);
  const r = await fetch(NEO4J_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ statement }),
  });
  const d = await r.json();
  return d?.data?.values || [];
}

export default async function handler(req, ctx) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const real = await q(ctx.env,
      "MATCH (c:Creator {realData:true}) RETURN c.handle, c.followers ORDER BY c.followers DESC");
    const counts = await q(ctx.env,
      "MATCH (c:Creator) RETURN count(c), sum(CASE WHEN coalesce(c.realData,false) THEN 1 ELSE 0 END)");
    const mem = await q(ctx.env,
      "MATCH (b:Entity)-[r]->(e:Entity) WHERE toLower(b.name) CONTAINS 'matcha co' AND type(r) IN ['booked','prefers','passed_on'] RETURN type(r), collect(DISTINCT e.name)");
    const memory = { booked: [], prefers: [], passed_on: [] };
    for (const row of mem) { const [rel, names] = row; if (memory[rel] !== undefined) memory[rel] = names; }
    return new Response(JSON.stringify({
      total: counts[0]?.[0] ?? 0,
      realCount: counts[0]?.[1] ?? 0,
      realCreators: real.map((row) => ({ handle: row[0], followers: row[1] })),
      memory,
    }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, realCreators: [], memory: {} }), { status: 200, headers: cors });
  }
}
