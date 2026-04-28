import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { rows } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: 'No data rows provided' }, { status: 400 });
    }

    let importedCount = 0;
    const errors = [];

    for (const row of rows) {
      try {
        const date = row['Date'];
        const vendor = row['Name'] || '';
        const category = row['Account'] || '';
        const amountStr = (row['Amount'] || '0').toString();
        
        // Strip negatives and commas, convert to number
        const amount = Math.abs(parseFloat(amountStr.replace(/,/g, '')));

        if (!date || !category || !amount) {
          errors.push(`Skipped row: missing required fields (Date, Account, or Amount)`);
          continue;
        }

        const qb_transaction_id = `bill_${date}_${vendor}_${category}`.replace(/\s+/g, '_');

        // Determine expense_type based on category
        const catLower = category.toLowerCase();
        let expense_type = 'operating';
        if (/labor|wages|payroll|salary/.test(catLower)) {
          expense_type = 'labor';
        } else if (/materials|supplies|subcontractor|cogs|inventory/.test(catLower)) {
          expense_type = 'cogs';
        }

        const expenseData = {
          date,
          vendor,
          category,
          amount,
          qb_transaction_id,
          expense_type,
          project: null,
          notes: row['Memo/Description'] || null,
        };

        // Upsert: find existing by qb_transaction_id
        const existing = await base44.asServiceRole.entities.Expense.filter({ qb_transaction_id });
        
        if (existing.length > 0) {
          await base44.asServiceRole.entities.Expense.update(existing[0].id, expenseData);
        } else {
          await base44.asServiceRole.entities.Expense.create(expenseData);
        }

        importedCount++;
      } catch (rowError) {
        errors.push(`Row error: ${rowError.message}`);
      }
    }

    return Response.json({
      success: true,
      importedCount,
      totalRows: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[importBillsFromCSV] Error:', error.message, error.stack);
    return Response.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});