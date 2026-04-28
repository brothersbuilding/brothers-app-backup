import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    console.log('[INFO] upsertExpense incoming request body:', JSON.stringify(body, null, 2));
    
    const { date, vendor, category, amount, project, qb_transaction_id, notes } = body;

    if (!date || !category || amount === undefined || !qb_transaction_id) {
      const missingFields = [];
      if (!date) missingFields.push('date');
      if (!category) missingFields.push('category');
      if (amount === undefined) missingFields.push('amount');
      if (!qb_transaction_id) missingFields.push('qb_transaction_id');
      return Response.json({ error: `Missing required fields: ${missingFields.join(', ')}` }, { status: 400 });
    }

    // Determine expense_type
    const catLower = (category ?? '').toLowerCase();
    let expense_type = 'operating';
    if (/labor|wages|payroll|salary/.test(catLower)) {
      expense_type = 'labor';
    } else if (/materials|supplies|subcontractor|cogs/.test(catLower)) {
      expense_type = 'cogs';
    }

    console.log('[INFO] Determined expense_type:', expense_type, 'for category:', category);

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

    // Try to find existing expense by qb_transaction_id using service role
    const existing = await base44.asServiceRole.entities.Expense.filter({ qb_transaction_id });
    
    console.log('[INFO] Found', existing.length, 'existing expenses with qb_transaction_id:', qb_transaction_id);

    if (existing.length > 0) {
      // Update existing
      console.log('[INFO] Updating existing expense:', existing[0].id);
      await base44.asServiceRole.entities.Expense.update(existing[0].id, expenseData);
    } else {
      // Create new
      console.log('[INFO] Creating new expense');
      await base44.asServiceRole.entities.Expense.create(expenseData);
    }

    console.log('[INFO] upsertExpense completed successfully');
    return Response.json({ success: true });
  } catch (error) {
    console.error('[ERROR] upsertExpense error:', error.message);
    console.error('[ERROR] Stack trace:', error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack,
      name: error.name
    }, { status: 500 });
  }
});