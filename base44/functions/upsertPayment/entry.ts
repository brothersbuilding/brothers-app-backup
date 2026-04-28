import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { date, customer, invoice_number, amount, qb_payment_id, payment_method } = body;

  if (!date || !amount || !qb_payment_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const paymentData = {
    date,
    customer: customer ?? null,
    invoice_number: invoice_number ?? null,
    amount,
    qb_payment_id,
    payment_method: payment_method ?? null,
  };

  // Try to find existing payment by qb_payment_id
  const existing = await base44.asServiceRole.entities.Payment.filter({ qb_payment_id });

  if (existing.length > 0) {
    // Update existing
    await base44.asServiceRole.entities.Payment.update(existing[0].id, paymentData);
  } else {
    // Create new
    await base44.asServiceRole.entities.Payment.create(paymentData);
  }

  return Response.json({ success: true });
});