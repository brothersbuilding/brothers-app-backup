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

  // Separate rows into to-update vs skipped
  const toUpdate = [];
  let skipped = 0;

  for (const row of rows) {
    const invoiceNumber = (row['num'] || '').trim();
    const rawName = (row['name'] || '').trim();
    const match = byNumber[invoiceNumber];

    if (!match) {
      console.log(`[SKIP] Invoice ${invoiceNumber} — not found in database`);
      skipped++;
      continue;
    }

    const colonIdx = rawName.indexOf(':');
    const customer = colonIdx === -1 ? rawName : rawName.slice(0, colonIdx).trim();
    const project = colonIdx === -1 ? '' : rawName.slice(colonIdx + 1).trim();

    const rawOpenBalance = row['open balance'] ?? row['Open balance'] ?? row['Open Balance'] ?? row['openbalance'] ?? null;
    if (toUpdate.length + skipped < 3) console.log(`[ROW ${toUpdate.length + skipped + 1}] open balance raw: "${rawOpenBalance}" (invoice: ${invoiceNumber})`);
    const openBalance = (() => {
      const raw = rawOpenBalance || '';
      const cleaned = raw.replace(/[\xa0\s$,]/g, '');
      if (cleaned === '') return null;
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    })();
    const amount = match.amount ?? 0;
    let status = 'unpaid';
    if (openBalance !== null && openBalance === 0) status = 'paid';
    else if (openBalance !== null && openBalance > 0 && openBalance < amount) status = 'partial';

    toUpdate.push({ invoiceNumber, id: match.id, customer, project, open_balance: openBalance ?? amount, status });
  }


  console.log(`${toUpdate.length} to update, ${skipped} skipped (not in DB)`);

  // Process in batches of 10 concurrently, 1000ms pause between batches
  let succeeded = 0;
  let failed = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toUpdate.length / BATCH_SIZE);
    console.log(`[BATCH ${batchNum}/${totalBatches}] Processing ${batch.length} records concurrently`);

    const results = await Promise.all(batch.map(async ({ invoiceNumber, id, customer, project, open_balance, status }) => {
      try {
        await base44.asServiceRole.entities.Invoice.update(id, { customer, project, open_balance, status });
        console.log(`[DONE] Invoice ${invoiceNumber} → customer="${customer}", project="${project}"`);
        return 'succeeded';
      } catch (err) {
        console.error(`[FAIL] Invoice ${invoiceNumber} — ${err.message}`);
        return 'failed';
      }
    }));

    succeeded += results.filter(r => r === 'succeeded').length;
    failed += results.filter(r => r === 'failed').length;

    // Pause between batches (skip pause after last batch)
    if (i + BATCH_SIZE < toUpdate.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
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