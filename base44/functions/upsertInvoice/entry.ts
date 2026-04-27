import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  const { qb_invoice_id, invoice_number, project, amount, due_date, date_sent, status } = await req.json();

  if (!qb_invoice_id) {
    return Response.json({ error: 'Must provide qb_invoice_id' }, { status: 400 });
  }

  const resolvedStatus = status === '0' ? 'paid' : 'unpaid';

  const payload = {
    ...(qb_invoice_id && { qb_invoice_id }),
    ...(invoice_number && { invoice_number }),
    ...(project !== undefined && { project }),
    ...(amount !== undefined && { amount: Number(amount) }),
    ...(due_date !== undefined && { due_date }),
    ...(date_sent !== undefined && { date_sent }),
    status: resolvedStatus,
  };

  const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 500);
  const existing = allInvoices.find((inv) => inv.qb_invoice_id === qb_invoice_id);

  let invoice;
  if (existing) {
    invoice = await base44.asServiceRole.entities.Invoice.update(existing.id, payload);
  } else {
    invoice = await base44.asServiceRole.entities.Invoice.create(payload);
  }

  return Response.json({ success: true, invoice });
});