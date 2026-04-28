import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Helper: get a setting value from AppSettings entity
async function getSetting(base44, key) {
  const results = await base44.asServiceRole.entities.AppSettings.filter({ key });
  return results && results.length > 0 ? results[0].value : null;
}

// Helper: upsert a setting value in AppSettings entity
async function setSetting(base44, key, value) {
  const results = await base44.asServiceRole.entities.AppSettings.filter({ key });
  if (results && results.length > 0) {
    await base44.asServiceRole.entities.AppSettings.update(results[0].id, { value });
  } else {
    await base44.asServiceRole.entities.AppSettings.create({ key, value, label: key });
  }
}

// Helper: refresh QB access token
async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return res.json();
}

// Helper: parse customer/project from QB CustomerRef.name
function parseName(name) {
  if (!name) return { customer: '', project: '' };
  const idx = name.indexOf(':');
  if (idx === -1) return { customer: name.trim(), project: '' };
  return { customer: name.slice(0, idx).trim(), project: name.slice(idx + 1).trim() };
}

// Helper: map QB invoice to Base44 Invoice fields
function mapInvoice(qbInv) {
  const { customer, project } = parseName(qbInv.CustomerRef?.name);
  const totalAmt = qbInv.TotalAmt ?? 0;
  const balance = qbInv.Balance ?? 0;
  let status = 'unpaid';
  if (balance === 0) status = 'paid';
  else if (balance > 0 && balance < totalAmt) status = 'partial';

  return {
    invoice_number: qbInv.DocNumber,
    qb_invoice_id: qbInv.Id,
    customer,
    project,
    amount: totalAmt,
    open_balance: balance,
    due_date: qbInv.DueDate ?? '',
    date_sent: qbInv.TxnDate ?? '',
    status,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Read stored credentials and tokens
  const [clientId, clientSecret, refreshToken, realmId] = await Promise.all([
    getSetting(base44, 'qb_client_id').then(v => v || Deno.env.get('QB_CLIENT_ID')),
    getSetting(base44, 'qb_client_secret').then(v => v || Deno.env.get('QB_CLIENT_SECRET')),
    getSetting(base44, 'qb_refresh_token'),
    getSetting(base44, 'qb_realm_id'),
  ]);

  if (!clientId || !clientSecret) throw new Error('Missing QB client credentials');
  if (!refreshToken) throw new Error('Missing qb_refresh_token — please connect QuickBooks first');
  if (!realmId) throw new Error('Missing qb_realm_id — please connect QuickBooks first');

  // Step 1: Refresh access token
  console.log('Refreshing QB access token...');
  const tokenData = await refreshAccessToken(clientId, clientSecret, refreshToken);
  const accessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token || refreshToken;

  await Promise.all([
    setSetting(base44, 'qb_access_token', accessToken),
    setSetting(base44, 'qb_refresh_token', newRefreshToken),
  ]);
  console.log('Access token refreshed and stored.');

  // Step 2: Fetch all invoices from QB
  const baseUrl = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}`;
  const query = encodeURIComponent('SELECT * FROM Invoice MAXRESULTS 1000');
  const qbRes = await fetch(`${baseUrl}/query?query=${query}&minorversion=65`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!qbRes.ok) {
    const err = await qbRes.text();
    throw new Error(`QB invoice fetch failed: ${err}`);
  }

  const qbData = await qbRes.json();
  const qbInvoices = qbData?.QueryResponse?.Invoice ?? [];
  console.log(`Fetched ${qbInvoices.length} invoices from QuickBooks`);

  // Step 3: Map QB invoices
  const mapped = qbInvoices.map(mapInvoice);
  const qbByNumber = {};
  for (const inv of mapped) {
    if (inv.invoice_number) qbByNumber[inv.invoice_number] = inv;
  }

  // Step 4: Fetch all existing Base44 invoices
  const existing = await base44.asServiceRole.entities.Invoice.list('-created_date', 2000);
  console.log(`Fetched ${existing.length} invoices from Base44`);

  const existingByNumber = {};
  for (const inv of existing) {
    if (inv.invoice_number) existingByNumber[inv.invoice_number] = inv;
  }

  // Step 5: Determine creates, updates, deletes
  const toCreate = [];
  const toUpdate = []; // { id, data }
  let unchanged = 0;

  for (const inv of mapped) {
    const ex = existingByNumber[inv.invoice_number];
    if (!ex) {
      toCreate.push(inv);
    } else {
      const changed =
        inv.status !== ex.status ||
        inv.open_balance !== ex.open_balance ||
        inv.customer !== ex.customer ||
        inv.project !== ex.project;
      if (changed) {
        toUpdate.push({ id: ex.id, data: inv });
      } else {
        unchanged++;
      }
    }
  }

  // Delete Base44 invoices NOT in QB results
  const toDelete = existing.filter(inv => inv.invoice_number && !qbByNumber[inv.invoice_number]);
  console.log(`${toCreate.length} to create, ${toUpdate.length} to update, ${toDelete.length} to delete, ${unchanged} unchanged`);

  // Step 6: Bulk create
  if (toCreate.length > 0) {
    await base44.asServiceRole.entities.Invoice.bulkCreate(toCreate);
    console.log(`Created ${toCreate.length} invoices`);
  }

  // Step 7: Update one at a time with 500ms delay
  for (let i = 0; i < toUpdate.length; i++) {
    const { id, data } = toUpdate[i];
    await base44.asServiceRole.entities.Invoice.update(id, {
      status: data.status,
      open_balance: data.open_balance,
      customer: data.customer,
      project: data.project,
    });
    console.log(`Updated invoice ${data.invoice_number}`);
    if (i < toUpdate.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Step 8: Delete
  for (const inv of toDelete) {
    await base44.asServiceRole.entities.Invoice.delete(inv.id);
    console.log(`Deleted invoice ${inv.invoice_number}`);
  }

  const message = `Synced: ${toCreate.length} new, ${toUpdate.length} updated, ${toDelete.length} deleted, ${unchanged} unchanged`;
  console.log(message);

  return Response.json({ success: true, message });
});