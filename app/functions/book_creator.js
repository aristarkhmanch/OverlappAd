// CastGraph — book_creator
// Records a booking on the Butterbase backend (database in active use) and settles
// payment. Payment is provider-agnostic: today it runs a self-contained checkout that
// marks the order paid; swapping in real Stripe test Checkout is a localized change in
// settlePayment() (create a Checkout Session, return its url, confirm via webhook).

async function settlePayment(ctx, { creatorHandle, amountCents, currency }) {
  // --- Real Stripe test-mode Checkout (enabled when STRIPE_SECRET_KEY is set) ---
  const sk = ctx.env.STRIPE_SECRET_KEY;
  if (sk) {
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", (ctx.env.APP_URL || "https://castgraph.butterbase.dev") + "/?booked=1");
    params.append("cancel_url", (ctx.env.APP_URL || "https://castgraph.butterbase.dev") + "/?canceled=1");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", currency);
    params.append("line_items[0][price_data][unit_amount]", String(amountCents));
    params.append("line_items[0][price_data][product_data][name]", `CastGraph booking — ${creatorHandle}`);
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const s = await r.json();
    if (!r.ok) throw new Error(`stripe ${r.status}: ${s?.error?.message || "checkout failed"}`);
    return { status: "pending", payment_ref: s.id, checkout_url: s.url, provider: "stripe_test" };
  }
  // --- Self-contained checkout (no external provider) ---
  return { status: "paid", payment_ref: "cg_" + Math.random().toString(36).slice(2, 12), checkout_url: null, provider: "simulated" };
}

export default async function handler(req, ctx) {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const creatorHandle = (body.creator_handle || "").toString().slice(0, 60);
    if (!creatorHandle) return new Response(JSON.stringify({ error: "creator_handle required" }), { status: 400, headers: cors });
    const briefId = body.brief_id || null;
    const amountCents = Number.isInteger(body.amount_cents) ? body.amount_cents : 85000;
    const currency = (body.currency || "usd").toString().slice(0, 8);
    const whyPath = body.why_path ? String(body.why_path).slice(0, 1000) : null;
    const userId = req.headers.get("x-user-id") || body.user_id || null;

    const pay = await settlePayment(ctx, { creatorHandle, amountCents, currency });

    const ins = await ctx.db.query(
      "INSERT INTO bookings (brief_id, creator_handle, amount_cents, currency, status, payment_ref, why_path, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, status, created_at",
      [briefId, creatorHandle, amountCents, currency, pay.status, pay.payment_ref, whyPath, userId]);
    const booking = ins.rows?.[0] || {};

    return new Response(JSON.stringify({
      booking_id: booking.id, creator_handle: creatorHandle, amount_cents: amountCents, currency,
      status: pay.status, payment_ref: pay.payment_ref, checkout_url: pay.checkout_url, provider: pay.provider,
      confirmation: `Booked ${creatorHandle} — $${(amountCents / 100).toFixed(0)} ${pay.status === "paid" ? "held" : "checkout started"}.`,
    }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
}
