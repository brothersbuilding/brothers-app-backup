import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  const { invoice_number, qb_invoice_id, project, amount, due_date, date_sent, status, paid_date } = await req.json();

  if (!invoice_number && !qb_invoice_id) {
    return Response.json({ error: 'Must provide invoice_number or qb_invoice_id' }, { status: 400 });
  }

  const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 500);

  const existing = allInvoices.find((inv) =>
    (qb_invoice_id && inv.qb_invoice_id === qb_invoice_id) ||
    (invoice_number && inv.invoice_number === invoice_number)
  );

  const payload = {
    ...(invoice_number && { invoice_number }),
    ...(qb_invoice_id && { qb_invoice_id }),
    ...(project !== undefined && { project }),
    ...(amount !== undefined && { amount }),
    ...(due_date !== undefined && { due_date }),
    ...(date_sent !== undefined && { date_sent }),
    ...(status !== undefined && { status }),
    ...(paid_date !== undefined && { paid_date }),
  };

  let result;
  if (existing) {
    result = await base44.asServiceRole.entities.Invoice.update(existing.id, payload);
  } else {
    result = await base44.asServiceRole.entities.Invoice.create(payload);
  }

  return Response.json({ success: true, created: !existing, invoice: result });
});