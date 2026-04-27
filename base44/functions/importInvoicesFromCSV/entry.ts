import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Parse a simple CSV string (handles quoted fields with commas)
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(field); field = ''; }
      else { field += ch; }
    }
  }
  fields.push(field);
  return fields;
}

// Strip $, commas, whitespace and parse as float
function parseMoney(val) {
  if (!val) return null;
  const cleaned = String(val).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Convert M/D/YYYY or MM/DD/YYYY to YYYY-MM-DD
function parseDate(val) {
  if (!val) return null;
  const parts = val.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  const contentType = req.headers.get('content-type') || '';
  let csvText = '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });
    csvText = await file.text();
  } else {
    // Accept raw CSV text body as fallback
    csvText = await req.text();
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    return Response.json({ success: false, error: 'No rows found in CSV' }, { status: 400 });
  }

  // Load all existing invoices once for matching
  const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
  const byQBId = {};
  for (const inv of allInvoices) {
    if (inv.qb_invoice_id) byQBId[inv.qb_invoice_id] = inv;
  }

  let imported = 0;
  let failed = 0;

  for (const row of rows) {
    // QuickBooks export column names (case-insensitive, lowercased)
    const invoiceNumber = row['num'] || row['invoice number'] || row['invoice #'] || row['invoice_number'] || '';
    const project = row['customer'] || row['name'] || row['project'] || '';
    const amount = parseMoney(row['amount'] || row['total'] || row['invoice amount'] || '');
    const balance = parseMoney(row['open balance'] || row['balance'] || row['amount due'] || '');
    const dueDate = parseDate(row['due date'] || row['due_date'] || '');
    const dateSent = parseDate(row['date'] || row['invoice date'] || row['date_sent'] || '');
    const qbInvoiceId = row['txnid'] || row['transaction id'] || row['qb_invoice_id'] || invoiceNumber || '';

    if (!invoiceNumber && !qbInvoiceId) { failed++; continue; }

    const status = balance === 0 ? 'paid' : 'unpaid';

    const payload = {
      invoice_number: invoiceNumber,
      project,
      status,
      ...(amount !== null && { amount }),
      ...(dueDate && { due_date: dueDate }),
      ...(dateSent && { date_sent: dateSent }),
      ...(qbInvoiceId && { qb_invoice_id: qbInvoiceId }),
    };

    try {
      const existing = byQBId[qbInvoiceId] || allInvoices.find(inv => inv.invoice_number === invoiceNumber);
      if (existing) {
        await base44.asServiceRole.entities.Invoice.update(existing.id, payload);
      } else {
        await base44.asServiceRole.entities.Invoice.create(payload);
      }
      imported++;
    } catch {
      failed++;
    }
  }

  return Response.json({ success: true, imported, failed, total: rows.length });
});