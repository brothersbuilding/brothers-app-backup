import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const parseCSV = (text) => {
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(field); field = ''; }
      else if (ch === '\n') { fields.push(field); field = ''; rows.push(fields); fields = []; }
      else { field += ch; }
    }
  }
  if (field !== '' || fields.length > 0) { fields.push(field); rows.push(fields); }
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.replace(/\xa0/g, ' ').trim().toLowerCase());
  return rows.slice(1).map(values => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').replace(/\xa0/g, ' ').trim(); });
    return obj;
  });
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const csv = body.csv;
  if (!csv) {
    return Response.json({ error: 'Missing csv field' }, { status: 400 });
  }

  const rows = parseCSV(csv).filter(r => r['num'] && !isNaN(Number(r['num'])));

  // Load all existing invoices and index by invoice_number
  const existing = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
  const byNumber = {};
  for (const inv of existing) {
    if (inv.invoice_number) byNumber[inv.invoice_number] = inv;
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const invoiceNumber = (row['num'] || '').trim();
    const inv = byNumber[invoiceNumber];

    if (!inv) { skipped++; continue; }
    if (inv.customer) { skipped++; continue; } // already has customer, skip

    const rawName = (row['name'] || '').trim();
    if (!rawName) { skipped++; continue; }

    const colonIdx = rawName.indexOf(':');
    const customer = colonIdx === -1 ? rawName : rawName.slice(0, colonIdx).trim();
    const project = colonIdx === -1 ? '' : rawName.slice(colonIdx + 1).trim();

    console.log(`Backfilling invoice ${invoiceNumber}: customer="${customer}", project="${project}"`);

    await base44.asServiceRole.entities.Invoice.update(inv.id, { customer, project });
    updated++;
  }

  const message = `Backfilled ${updated} invoices, skipped ${skipped}`;
  console.log(message);
  return Response.json({ success: true, message, updated, skipped });
});