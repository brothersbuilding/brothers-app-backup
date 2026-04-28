import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { date, vendor, category, amount, project, qb_transaction_id, notes } = body;

  if (!date || !category || amount === undefined || !qb_transaction_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Determine expense_type
  const catLower = (category ?? '').toLowerCase();
  let expense_type = 'operating';
  if (/labor|wages|payroll|salary/.test(catLower)) {
    expense_type = 'labor';
  } else if (/materials|supplies|subcontractor|cogs/.test(catLower)) {
    expense_type = 'cogs';
  }

  const expenseData = {
    date,
    vendor: vendor ?? null,
    category,
    amount,
    project: project ?? null,
    qb_transaction_id,
    expense_type,
    notes: notes ?? null,
  };

  // Try to find existing expense by qb_transaction_id
  const existing = await base44.entities.Expense.filter({ qb_transaction_id });

  if (existing.length > 0) {
    // Update existing
    await base44.entities.Expense.update(existing[0].id, expenseData);
  } else {
    // Create new
    await base44.entities.Expense.create(expenseData);
  }

  return Response.json({ success: true });
});