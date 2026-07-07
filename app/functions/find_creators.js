// CastGraph — find_creators
// Flow: brief in -> RocketRide Cloud pipeline (Neo4j audience-overlap graph traversal)
//       -> enrich each match with a one-sentence "why" via Butterbase AI gateway
//       -> persist the brief -> return ranked creators + visual why-path.
// If the live RocketRide call fails for any reason, we fall back to a pre-verified
// canned result so the stage demo never breaks. Both paths return the same shape.

const ALLOWED_SEGMENTS = { CS_Hero: 1, CS_Home: 1, CS_FitMale: 1 };

// Pre-verified hero result (also the stage-safe fallback). These are the exact rows
// the Neo4j hero query returns for a matcha / Gen-Z brief against CS_Hero.
const CANNED_HERO = [
  { creator: "@matchamaven",   platform: "TikTok",    followers: 92000,  topAudience: "Matcha & wellness drinks, Gen-Z women", overlapPct: 88, brand: "Oatly",         campaign: "Oat-Milk Barista",       lift: 38, audienceFit: 85.0, score: 96.4 },
  { creator: "@sipwithsoraya", platform: "TikTok",    followers: 61000,  topAudience: "That-girl aesthetic lifestyle, Gen-Z",  overlapPct: 74, brand: "Poppi",         campaign: "Prebiotic Soda Launch",  lift: 33, audienceFit: 79.8, score: 89.7 },
  { creator: "@cleanfuelkate", platform: "Instagram", followers: 138000, topAudience: "Clean-eating wellness, young women",     overlapPct: 80, brand: "VitalProteins", campaign: "Glow Collagen",          lift: 27, audienceFit: 78.4, score: 86.5 },
];

function buildCypher(segId) {
  const seg = ALLOWED_SEGMENTS[segId] ? segId : "CS_Hero";
  return "MATCH (c:Creator)-[r:REACHES]->(a:AudienceSegment)-[o:OVERLAPS]->(cs:CustomerSegment {id:'" + seg + "'}) " +
    "WITH c, sum(r.sharePct/100.0 * o.pct) AS audienceFit, collect({seg:a.name, overlap:o.pct, contrib:r.sharePct/100.0*o.pct}) AS segs " +
    "OPTIONAL MATCH (c)-[:RAN]->(k:Campaign)-[p:PERFORMED]->(b:Brand) " +
    "WITH c, audienceFit, segs, collect({campaign:k.name, lift:p.lift, brand:b.name}) AS camps " +
    "WITH c, audienceFit, reduce(best=segs[0], s IN segs | CASE WHEN s.contrib > best.contrib THEN s ELSE best END) AS topSeg, " +
    "reduce(bc=camps[0], x IN camps | CASE WHEN coalesce(x.lift,0) > coalesce(bc.lift,0) THEN x ELSE bc END) AS topCamp " +
    "RETURN c.handle AS creator, c.platform AS platform, c.followers AS followers, topSeg.seg AS topAudience, topSeg.overlap AS overlapPct, " +
    "coalesce(topCamp.brand,'') AS brand, coalesce(topCamp.campaign,'') AS campaign, coalesce(topCamp.lift,0) AS lift, " +
    "round(audienceFit,1) AS audienceFit, round(audienceFit + coalesce(topCamp.lift,0)*0.3,1) AS score ORDER BY score DESC LIMIT 3";
}

// Best-effort extraction of an array-of-row-objects from RocketRide's response JSON,
// tolerant to the exact envelope shape (objects.body.rows / data.rows / arrays of records).
function extractRows(payload) {
  const wanted = ["creator", "handle"];
  const looksLikeRow = (o) => o && typeof o === "object" && wanted.some((k) => k in o);
  const found = [];
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      if (v.length && v.every(looksLikeRow)) found.push(v);
      v.forEach(walk);
    } else {
      if (looksLikeRow(v)) found.push([v]);
      Object.values(v).forEach(walk);
    }
  };
  walk(payload);
  // Prefer the largest coherent array of rows
  found.sort((a, b) => b.length - a.length);
  return found[0] || null;
}

function normalize(r) {
  return {
    creator: r.creator || r.handle,
    platform: r.platform || "",
    followers: Number(r.followers) || 0,
    topAudience: r.topAudience || r.top_audience || "",
    overlapPct: Number(r.overlapPct ?? r.overlap_pct ?? r.overlap) || 0,
    brand: r.brand || "",
    campaign: r.campaign || "",
    lift: Number(r.lift) || 0,
    audienceFit: Number(r.audienceFit ?? r.audience_fit) || 0,
    score: Number(r.score) || 0,
  };
}

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// ---- RocketRide Cloud pipeline invocation (DAP over WebSocket) ----
// The deployed `castgraph_match` pipeline runs our Cypher through a tool_http_request
// node against Neo4j Aura. Tool invocation is only exposed over RocketRide's WebSocket
// protocol, so the app speaks it directly (Deno's standard WebSocket client).
const RR_WS = "wss://api.rocketride.ai/task/service";
const NEO4J_QUERY_URL = "https://22ad19fc.databases.neo4j.io/db/22ad19fc/query/v2";
const NEO4J_USER = "22ad19fc";

function pipelineConfig(neo4jPassword) {
  return { name: "castgraph_match", project_id: "castgraph_match", source: "in", components: [
    { id: "in", provider: "webhook", config: {} },
    { id: "agent", provider: "agent_rocketride",
      config: { agent_description: "CastGraph match agent", instructions: ["Use the http tool."], max_waves: 1 },
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
        auth_method: "userpass", user: "22ad19fc", password: neo4jPassword, database: "22ad19fc", allow_execute: true } },
      control: [{ classType: "tool", from: "agent" }] },
  ] };
}

function openDap() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(RR_WS);
    const waiters = new Map(); let seq = 0;
    const call = (command, args) => new Promise((res, rej) => {
      const s = ++seq; waiters.set(s, { res, rej });
      ws.send(JSON.stringify({ type: "request", seq: s, command, arguments: args || {} }));
    });
    ws.onopen = () => resolve({ ws, call });
    ws.onerror = () => reject(new Error("ws error"));
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "response" && waiters.has(msg.request_seq)) {
        const w = waiters.get(msg.request_seq); waiters.delete(msg.request_seq);
        msg.success ? w.res(msg.body || {}) : w.rej(new Error(msg.message || "request failed"));
      }
    };
    ws.onclose = () => { for (const w of waiters.values()) w.rej(new Error("ws closed")); };
  });
}

async function callRocketRide(env, segId) {
  if (!env.ROCKETRIDE_AUTH || !env.NEO4J_PASSWORD) throw new Error("rocketride env not configured");
  const { ws, call } = await openDap();
  try {
    await call("auth", { auth: env.ROCKETRIDE_AUTH, clientName: "castgraph", clientVersion: "1" });
    const started = await call("execute", { pipeline: pipelineConfig(env.NEO4J_PASSWORD), useExisting: true, ttl: 0 });
    const token = started.token;
    let winners = null;
    for (let i = 0; i < 4 && !winners; i++) {
      const body = await call("rrext_process", { token, subcommand: "tool", tool: "http_request", nodeId: "http",
        input: { method: "POST", url: NEO4J_QUERY_URL, basic_auth: { username: NEO4J_USER, password: env.NEO4J_PASSWORD },
          headers: { Accept: "application/json" }, body_json: { statement: buildCypher(segId) }, timeout: 30 } });
      const r = body.result || {};
      if (r.status_code === 202 && r.json?.data?.values) {
        const f = r.json.data.fields;
        winners = r.json.data.values.map((row) => Object.fromEntries(f.map((k, j) => [k, row[j]])));
      } else { await new Promise((res) => setTimeout(res, 1300)); }
    }
    await call("deauth", {}).catch(() => {});
    if (!winners || !winners.length) throw new Error("neo4j returned no rows (aura cold start?)");
    return winners.map(normalize);
  } finally { try { ws.close(); } catch (_) {} }
}

function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(label + " timeout")), ms))]);
}

function whyPath(r) {
  return [
    { type: "creator", label: r.creator },
    { type: "edge", label: "reaches" },
    { type: "audience", label: r.topAudience },
    { type: "edge", label: `${r.overlapPct}% overlaps` },
    { type: "customer", label: "YOUR customers" },
  ];
}

function templateWhy(r) {
  const perf = r.brand ? ` and drove +${r.lift}% for ${r.brand}` : "";
  return `${r.overlapPct}% of ${r.creator}'s audience — ${r.topAudience} — overlaps your customers${perf}.`;
}

export default async function handler(req, ctx) {
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const product = (body.product || "matcha drink launch").toString().slice(0, 200);
    const customerProfile = (body.customer_profile || "matcha-curious Gen-Z women, CA + NY, wellness + aesthetics").toString().slice(0, 500);
    const platforms = (body.platforms || "TikTok + Instagram").toString().slice(0, 120);
    const segmentId = ALLOWED_SEGMENTS[body.segment_id] ? body.segment_id : "CS_Hero";
    const userId = req.headers.get("x-user-id") || body.user_id || null;

    let rows, source;
    try { rows = await withTimeout(callRocketRide(ctx.env, segmentId), 10000, "rocketride"); source = "rocketride"; }
    catch (e) { console.warn("RocketRide fallback:", e.message); rows = CANNED_HERO.map(normalize); source = "fallback"; }

    // Instant grounded why-lines; the AI-polished versions arrive via explain_matches (off the wow's critical path).
    const creators = rows.map((r) => ({ ...r, why: templateWhy(r), path: whyPath(r) }));

    let briefId = null;
    try {
      const ins = await ctx.db.query(
        "INSERT INTO briefs (product, customer_profile, platforms, segment_id, user_id) VALUES ($1,$2,$3,$4,$5) RETURNING id",
        [product, customerProfile, platforms, segmentId, userId]);
      briefId = ins.rows?.[0]?.id ?? null;
    } catch (e) { console.error("brief insert failed:", e.message); }

    return new Response(JSON.stringify({ brief_id: briefId, source, segment_id: segmentId, creators }), {
      status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
}
