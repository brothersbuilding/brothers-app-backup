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
      } else {
        field += ch;
      }
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

const cleanNumber = (raw) => {
  if (!raw) return null;
  const cleaned = raw.replace(/[\xa0\s$,]/g, '');
  if (cleaned === '') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const parseDate = (raw) => {
  if (!raw) return '';
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return '';
  const [month, day, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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

  const rows = parseCSV(csv).filter(r => r['num'] && r['num'] !== 'Total');

  // Load existing invoices for upsert matching
  const existing = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
  const byNumber = {};
  for (const inv of existing) {
    if (inv.invoice_number) byNumber[inv.invoice_number] = inv;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const invoiceNumber = (row['num'] || '').trim();
    if (!invoiceNumber || isNaN(Number(invoiceNumber))) { skipped++; continue; }

    const openBalance = cleanNumber(row['open balance']);
    const status = openBalance !== null && openBalance === 0 ? 'paid' : 'unpaid';

    const payload = {
      invoice_number: invoiceNumber,
      project: row['customer'] || '',
      amount: cleanNumber(row['amount']) ?? 0,
      due_date: parseDate(row['due date']),
      date_sent: parseDate(row['date']),
      status,
    };

    try {
      const match = byNumber[invoiceNumber];
      if (match) {
        await base44.asServiceRole.entities.Invoice.update(match.id, payload);
        updated++;
      } else {
        await base44.asServiceRole.entities.Invoice.create(payload);
        byNumber[invoiceNumber] = { id: 'pending' }; // prevent duplicates within same import
        created++;
      }
    } catch {
      skipped++;
    }
  }

  const message = `Imported ${created} new, updated ${updated} existing, skipped ${skipped} invalid rows`;
  return Response.json({ success: true, message, created, updated, skipped });
});