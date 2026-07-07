// CastGraph — explain_matches
// Progressive enhancement: turns the structured graph paths into punchy, grounded
// one-liners via the Butterbase AI gateway. The UI calls this AFTER the match cards
// render, so the wow is never gated on model latency, yet Butterbase AI stays
// load-bearing in the product experience.
async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}
function templateWhy(r) {
  const perf = r.brand ? ` and drove +${r.lift}% for ${r.brand}` : "";
  return `${r.overlapPct}% of ${r.creator}'s audience — ${r.topAudience} — overlaps your customers${perf}.`;
}
export default async function handler(req, ctx) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const creators = Array.isArray(body.creators) ? body.creators.slice(0, 5) : [];
    const brief = (body.brief || "a product launch").toString().slice(0, 300);
    if (!creators.length) return new Response(JSON.stringify({ whys: [] }), { status: 200, headers: cors });

    const { BUTTERBASE_APP_ID, BUTTERBASE_API_URL, BUTTERBASE_API_KEY } = ctx.env;
    const sys = "You explain influencer-brand matches to a DTC marketer. For each creator write ONE punchy sentence (max 22 words), grounded ONLY in the given numbers: that the creator's audience IS the brand's customer (overlap %) and past campaign lift. No hype, no emojis. Return a JSON array of strings, same order.";
    const usr = `Brief: ${brief}\nCreators:\n` + creators.map((r, i) =>
      `${i + 1}. ${r.creator} — audience "${r.topAudience}", ${r.overlapPct}% overlap with our customers, past: ${r.brand ? `+${r.lift}% for ${r.brand}` : "no campaign"}`).join("\n");

    let whys;
    try {
      const resp = await fetchWithTimeout(`${BUTTERBASE_API_URL}/v1/${BUTTERBASE_APP_ID}/chat/completions`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${BUTTERBASE_API_KEY}` },
        body: JSON.stringify({ model: "anthropic/claude-3-haiku", max_tokens: 400, temperature: 0.4,
          messages: [{ role: "system", content: sys }, { role: "user", content: usr }] }),
      }, 12000);
      const j = await resp.json();
      const txt = j?.choices?.[0]?.message?.content || "";
      const arr = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1));
      whys = Array.isArray(arr) && arr.length === creators.length ? arr.map(String) : creators.map(templateWhy);
    } catch (_) { whys = creators.map(templateWhy); }

    return new Response(JSON.stringify({ whys }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, whys: [] }), { status: 200, headers: cors });
  }
}
