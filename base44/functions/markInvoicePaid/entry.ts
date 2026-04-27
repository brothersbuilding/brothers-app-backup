import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  const { qb_invoice_id, invoice_number, paid_date } = await req.json();

  if (!qb_invoice_id && !invoice_number) {
    return Response.json({ error: 'Must provide qb_invoice_id or invoice_number' }, { status: 400 });
  }

  const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 500);

  const existing = allInvoices.find((inv) =>
    (qb_invoice_id && inv.qb_invoice_id === qb_invoice_id) ||
    (invoice_number && inv.invoice_number === invoice_number)
  );

  if (!existing) {
    return Response.json({ success: false, message: 'Invoice not found' });
  }

  const invoice = await base44.asServiceRole.entities.Invoice.update(existing.id, {
    status: 'paid',
    paid_date: paid_date || null,
  });

  return Response.json({ success: true, invoice });
});