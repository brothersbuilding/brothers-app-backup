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

  const allRows = parseCSV(csv).filter(r => r['num'] && r['num'] !== 'Total' && !isNaN(Number(r['num'])));

  console.log(`Parsed ${allRows.length} valid rows`);
  if (allRows.length > 0) {
    console.log('First row keys:', JSON.stringify(Object.keys(allRows[0])));
    console.log('First row values:', JSON.stringify(allRows[0]));
  }

  const invoices = allRows.map(row => {
    const rawOpenBalance = row['open balance'] ?? row['Open balance'] ?? row['Open Balance'] ?? row['openbalance'] ?? null;
    const openBalance = cleanNumber(rawOpenBalance);
    const amount = cleanNumber(row['amount']) ?? 0;

    let status = 'unpaid';
    if (openBalance !== null && openBalance === 0) status = 'paid';
    else if (openBalance !== null && openBalance > 0 && openBalance < amount) status = 'partial';

    const rawName = (row['name'] || '').trim();
    const colonIdx = rawName.indexOf(':');
    const customer = colonIdx === -1 ? rawName : rawName.slice(0, colonIdx).trim();
    const project = colonIdx === -1 ? '' : rawName.slice(colonIdx + 1).trim();

    return {
      invoice_number: row['num'].trim(),
      customer,
      project,
      amount,
      open_balance: openBalance ?? amount,
      due_date: parseDate(row['due date']),
      date_sent: parseDate(row['date']),
      status,
    };
  });

  console.log(`Bulk inserting ${invoices.length} invoices...`);
  await base44.asServiceRole.entities.Invoice.bulkCreate(invoices);

  const message = `Created ${invoices.length} invoices`;
  console.log(message);

  return Response.json({ success: true, message, created: invoices.length });
});