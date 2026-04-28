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

  // Parse CSV rows
  const allRows = parseCSV(csv).filter(r => {
    const num = (r['num'] || '').trim();
    if (!num) return false;
    if (num.toUpperCase().startsWith('TOTAL')) return false;
    if (isNaN(Number(num))) return false;
    return true;
  });

  console.log(`Parsed ${allRows.length} valid rows from CSV`);

  // Build invoice objects from CSV
  const parsedInvoices = allRows.map(row => {
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

  // Fetch all existing invoices and index by invoice_number
  const existing = await base44.asServiceRole.entities.Invoice.list('-created_date', 2000);
  const existingByNumber = {};
  for (const inv of existing) {
    if (inv.invoice_number) existingByNumber[inv.invoice_number] = inv;
  }
  console.log(`Loaded ${existing.length} existing invoices`);

  // Split into toCreate and toUpdate
  const toCreate = [];
  const toUpdate = []; // { id, data, existingRecord }

  for (const inv of parsedInvoices) {
    const match = existingByNumber[inv.invoice_number];
    if (!match) {
      toCreate.push(inv);
    } else {
      toUpdate.push({ id: match.id, data: inv, existing: match });
    }
  }

  console.log(`${toCreate.length} to create, ${toUpdate.length} to check for updates`);

  // Bulk create new records in one call
  if (toCreate.length > 0) {
    await base44.asServiceRole.entities.Invoice.bulkCreate(toCreate);
    console.log(`Bulk created ${toCreate.length} invoices`);
  }

  // Update existing records one at a time, only if open_balance or status changed
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < toUpdate.length; i++) {
    const { id, data, existing: ex } = toUpdate[i];

    const balanceChanged = data.open_balance !== ex.open_balance;
    const statusChanged = data.status !== ex.status;

    if (!balanceChanged && !statusChanged) {
      skipped++;
      continue;
    }

    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await base44.asServiceRole.entities.Invoice.update(id, {
      open_balance: data.open_balance,
      status: data.status,
    });
    console.log(`Updated invoice ${data.invoice_number}: balance=${data.open_balance}, status=${data.status}`);
    updated++;
  }

  const message = `Created ${toCreate.length}, updated ${updated}, skipped ${skipped} unchanged`;
  console.log(message);

  return Response.json({ success: true, message, created: toCreate.length, updated, skipped });
});