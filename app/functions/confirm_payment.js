// OverlappAd — confirm_payment
// After the brand returns from Stripe test Checkout, verify the session actually paid
// and flip the matching booking row to "paid". Keeps the Butterbase bookings table
// truthful without needing a webhook endpoint.
export default async function handler(req, ctx) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const sid = (body.session_id || "").toString();
    if (!sid.startsWith("cs_")) return new Response(JSON.stringify({ paid: false, error: "bad session" }), { status: 200, headers: cors });
    const sk = ctx.env.STRIPE_SECRET_KEY;
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`, {
      headers: { Authorization: `Bearer ${sk}` } });
    const s = await r.json();
    const paid = s.payment_status === "paid" || s.status === "complete";
    let creator = null, amount = null;
    if (paid) {
      const upd = await ctx.db.query(
        "UPDATE bookings SET status='paid' WHERE payment_ref=$1 RETURNING creator_handle, amount_cents", [sid]);
      creator = upd.rows?.[0]?.creator_handle ?? null;
      amount = upd.rows?.[0]?.amount_cents ?? null;
    }
    return new Response(JSON.stringify({ paid, creator_handle: creator, amount_cents: amount }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ paid: false, error: e.message }), { status: 200, headers: cors });
  }
}
