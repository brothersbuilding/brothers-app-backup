import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    console.log('[upsertPayment] ===== FUNCTION START =====');
    console.log('[upsertPayment] Method:', req.method);
    
    if (req.method !== 'POST') {
      console.log('[upsertPayment] ERROR: Invalid method');
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    console.log('[upsertPayment] Reading request body...');
    const body = await req.json();
    console.log('[upsertPayment] Raw incoming body:', JSON.stringify(body, null, 2));

    console.log('[upsertPayment] Creating base44 client...');
    const base44 = createClientFromRequest(req);

    console.log('[upsertPayment] Authenticating user...');
    const user = await base44.auth.me();
    console.log('[upsertPayment] Authenticated user:', user?.email ?? 'ANONYMOUS');
    
    if (!user) {
      console.log('[upsertPayment] ERROR: User not authenticated');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date, customer, invoice_number, amount, qb_payment_id, payment_method } = body;
    console.log('[upsertPayment] Extracted fields:', { date, customer, invoice_number, amount, qb_payment_id, payment_method });

    if (!date || !amount || !qb_payment_id) {
      console.log('[upsertPayment] ERROR: Missing required fields. date:', !!date, 'amount:', !!amount, 'qb_payment_id:', !!qb_payment_id);
      return Response.json({ error: 'Missing required fields: date, amount, qb_payment_id' }, { status: 400 });
    }

    const paymentData = {
      date,
      customer: customer ?? null,
      invoice_number: invoice_number ?? null,
      amount,
      qb_payment_id,
      payment_method: payment_method ?? null,
    };
    console.log('[upsertPayment] Payment data prepared:', JSON.stringify(paymentData, null, 2));

    console.log('[upsertPayment] Querying for existing payment with qb_payment_id:', qb_payment_id);
    const existing = await base44.asServiceRole.entities.Payment.filter({ qb_payment_id });
    console.log('[upsertPayment] Query result: found', existing.length, 'existing record(s)');

    if (existing.length > 0) {
      console.log('[upsertPayment] Updating existing payment record ID:', existing[0].id);
      await base44.asServiceRole.entities.Payment.update(existing[0].id, paymentData);
      console.log('[upsertPayment] Update successful');
    } else {
      console.log('[upsertPayment] Creating new payment record');
      await base44.asServiceRole.entities.Payment.create(paymentData);
      console.log('[upsertPayment] Create successful');
    }

    console.log('[upsertPayment] ===== FUNCTION SUCCESS =====');
    return Response.json({ success: true, message: 'Payment upserted successfully' });
  } catch (error) {
    console.error('[upsertPayment] ===== FUNCTION ERROR =====');
    console.error('[upsertPayment] Error name:', error.name);
    console.error('[upsertPayment] Error message:', error.message);
    console.error('[upsertPayment] Stack trace:', error.stack);
    console.error('[upsertPayment] Full error object:', JSON.stringify(error, null, 2));

    return Response.json({
      error: 'Payment upsert failed',
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
});