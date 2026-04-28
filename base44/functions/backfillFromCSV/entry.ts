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
  console.log(`Parsed ${rows.length} valid rows from CSV`);

  // Load all invoices and index by invoice_number
  const existing = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
  console.log(`Loaded ${existing.length} invoices from database`);

  const byNumber = {};
  for (const inv of existing) {
    if (inv.invoice_number) byNumber[inv.invoice_number] = inv;
  }

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const invoiceNumber = (row['num'] || '').trim();
    const rawName = (row['name'] || '').trim();

    const colonIdx = rawName.indexOf(':');
    const customer = colonIdx === -1 ? rawName : rawName.slice(0, colonIdx).trim();
    const project = colonIdx === -1 ? '' : rawName.slice(colonIdx + 1).trim();

    const match = byNumber[invoiceNumber];

    if (!match) {
      console.log(`[SKIP] Invoice ${invoiceNumber} — not found in database`);
      skipped++;
      continue;
    }

    try {
      console.log(`[UPDATE] Invoice ${invoiceNumber} (id=${match.id}) → customer="${customer}", project="${project}"`);
      await base44.asServiceRole.entities.Invoice.update(match.id, { customer, project });
      console.log(`[DONE] Invoice ${invoiceNumber} updated`);
      succeeded++;
    } catch (err) {
      console.error(`[FAIL] Invoice ${invoiceNumber} — ${err.message}`);
      failed++;
    }

    // Throttle to avoid 429 rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`Finished: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);

  return Response.json({
    success: true,
    updated: succeeded,
    succeeded,
    failed,
    skipped,
  });
});