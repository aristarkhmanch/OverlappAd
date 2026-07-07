// OverlappAd — get the 3 winning creators from the deployed RocketRide pipeline.
//
// RocketRide runs raw Cypher through a `tool_http_request` node that hits Neo4j
// Aura's HTTP Query API. Tool invocation is only available over RocketRide's
// WebSocket DAP protocol (there is NO REST endpoint for it), so this function
// speaks that protocol directly with the standard WebSocket API (works in
// Cloudflare Workers / Butterbase).
//
// Secrets come from the environment — NEVER hard-code them:
//   env.ROCKETRIDE_AUTH   -> RocketRide bearer key
//   env.NEO4J_PASSWORD    -> Neo4j Aura password
//
// Returns: array of 3 winner objects (creator, platform, followers, ...score).

const WS_URL = "wss://api.rocketride.ai/task/service";
const NEO4J_URL = "https://22ad19fc.databases.neo4j.io/db/22ad19fc/query/v2";
const NEO4J_USER = "22ad19fc";

const CYPHER =
  "MATCH (c:Creator)-[r:REACHES]->(a:AudienceSegment)-[o:OVERLAPS]->(cs:CustomerSegment {id:'CS_Hero'}) " +
  "WITH c, sum(r.sharePct/100.0 * o.pct) AS audienceFit, collect({seg:a.name, overlap:o.pct, contrib:r.sharePct/100.0*o.pct}) AS segs " +
  "OPTIONAL MATCH (c)-[:RAN]->(k:Campaign)-[p:PERFORMED]->(b:Brand) " +
  "WITH c, audienceFit, segs, collect({campaign:k.name, lift:p.lift, brand:b.name}) AS camps " +
  "WITH c, audienceFit, reduce(best=segs[0], s IN segs | CASE WHEN s.contrib > best.contrib THEN s ELSE best END) AS topSeg, " +
  "reduce(bc=camps[0], x IN camps | CASE WHEN coalesce(x.lift,0) > coalesce(bc.lift,0) THEN x ELSE bc END) AS topCamp " +
  "RETURN c.handle AS creator, c.platform AS platform, c.followers AS followers, topSeg.seg AS topAudience, " +
  "topSeg.overlap AS overlapPct, coalesce(topCamp.brand,'') AS brand, coalesce(topCamp.campaign,'') AS campaign, " +
  "coalesce(topCamp.lift,0) AS lift, round(audienceFit,1) AS audienceFit, " +
  "round(audienceFit + coalesce(topCamp.lift,0)*0.3,1) AS score ORDER BY score DESC LIMIT 3";

function pipelineConfig(neo4jPassword) {
  return {
    name: "castgraph_match",
    project_id: "castgraph_match",
    source: "in",
    components: [
      { id: "in", provider: "webhook", config: {} },
      { id: "agent", provider: "agent_rocketride",
        config: { agent_description: "OverlappAd match agent", instructions: ["Use the http tool."], max_waves: 1 },
        input: [{ lane: "questions", from: "in" }] },
      { id: "llm", provider: "llm_openai",
        config: { profile: "openai-4o-mini", "openai-4o-mini": { apikey: "sk-not-invoked", modelSource: "" } },
        control: [{ classType: "llm", from: "agent" }] },
      { id: "mem", provider: "memory_internal", config: { type: "memory_internal" },
        control: [{ classType: "memory", from: "agent" }] },
      { id: "http", provider: "tool_http_request",
        config: { type: "tool_http_request", serverName: "http", allowGET: true, allowPOST: true, allowPUT: true,
                  allowPATCH: true, allowDELETE: true, allowHEAD: false, allowOPTIONS: false,
                  rateLimitPerSecond: 10, rateLimitPerMinute: 100, maxConcurrentRequests: 5, urlWhitelist: [] },
        control: [{ classType: "tool", from: "agent" }] },
      { id: "neo", provider: "db_neo4j",
        config: { profile: "default", default: { uri: "neo4j+s://22ad19fc.databases.neo4j.io",
                  auth_method: "userpass", user: "22ad19fc", password: neo4jPassword,
                  database: "22ad19fc", allow_execute: true } },
        control: [{ classType: "tool", from: "agent" }] },
    ],
  };
}

// Minimal DAP client: send a request frame, resolve on the matching response.
async function openDap(env) {
  // Cloudflare Workers style outbound WebSocket:
  const resp = await fetch(WS_URL.replace(/^wss:/, "https:"), { headers: { Upgrade: "websocket" } });
  const ws = resp.webSocket;
  if (!ws) throw new Error("WebSocket upgrade failed");
  ws.accept();

  let seq = 0;
  const waiters = new Map(); // request_seq -> {resolve,reject}
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data));
    if (msg.type === "response" && waiters.has(msg.request_seq)) {
      const w = waiters.get(msg.request_seq); waiters.delete(msg.request_seq);
      msg.success ? w.resolve(msg.body || {}) : w.reject(new Error(msg.message || "request failed"));
    }
  });
  ws.addEventListener("close", () => { for (const w of waiters.values()) w.reject(new Error("closed")); });

  const call = (command, args) => new Promise((resolve, reject) => {
    const s = ++seq; waiters.set(s, { resolve, reject });
    ws.send(JSON.stringify({ type: "request", seq: s, command, arguments: args || {} }));
  });
  return { ws, call };
}

export async function getOverlappAdWinners(env) {
  const { ws, call } = await openDap(env);
  try {
    // 1) authenticate
    await call("auth", { auth: env.ROCKETRIDE_AUTH, clientName: "butterbase", clientVersion: "1" });
    // 2) start (or reuse) the persistent pipeline; returns a task token
    const started = await call("execute", {
      pipeline: pipelineConfig(env.NEO4J_PASSWORD),
      useExisting: true,
      ttl: 0,
    });
    const token = started.token;
    // 3) invoke the http_request tool -> RocketRide POSTs the Cypher to Neo4j Aura.
    //    Retry: Aura free tier cold-starts (transient 400/500 with empty routing table).
    let winners = null;
    for (let i = 0; i < 5 && !winners; i++) {
      const body = await call("rrext_process", {
        token,
        subcommand: "tool",
        tool: "http_request",
        nodeId: "http",
        input: {
          method: "POST",
          url: NEO4J_URL,
          basic_auth: { username: NEO4J_USER, password: env.NEO4J_PASSWORD },
          headers: { Accept: "application/json" },
          body_json: { statement: CYPHER },
          timeout: 90,
        },
      });
      const r = body.result || {};
      if (r.status_code === 202 && r.json?.data?.values) {
        const f = r.json.data.fields;
        winners = r.json.data.values.map((row) => Object.fromEntries(f.map((k, j) => [k, row[j]])));
      } else {
        await new Promise((res) => setTimeout(res, 1500)); // brief backoff, then retry
      }
    }
    await call("deauth", {}).catch(() => {});
    if (!winners) throw new Error("Neo4j did not return rows (Aura cold start?)");
    return winners; // [{creator:'@matchamaven', ..., score:96.4}, ... x3]
  } finally {
    try { ws.close(); } catch {}
  }
}
