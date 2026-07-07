// OverlappAd — demo_session
// Mints a real end-user session (Butterbase auth) for the demo brand account so the
// frontend can sign in with one tap. Credentials live in encrypted function env vars,
// never in the shipped frontend or the public repo. This is what puts Butterbase auth
// "in active use": every find/book request carries this account's JWT and is scoped to it.
export default async function handler(req, ctx) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const { BUTTERBASE_API_URL, BUTTERBASE_APP_ID, DEMO_EMAIL, DEMO_PASSWORD } = ctx.env;
    const r = await fetch(`${BUTTERBASE_API_URL}/auth/${BUTTERBASE_APP_ID}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    const d = await r.json();
    if (!d.access_token) throw new Error(d.message || "login failed");
    return new Response(JSON.stringify({
      access_token: d.access_token,
      user: { id: d.user?.id, display_name: d.user?.display_name || "Demo Brand" },
    }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
}
