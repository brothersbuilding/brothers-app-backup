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

    let expensesImported = 0;
    let paymentsImported = 0;
    const errors = [];

    for (const row of rows) {
      try {
        const date = row['Date'];
        const transactionType = (row['Transaction Type'] || '').toLowerCase();
        const amountStr = (row['Amount'] || '0').toString();
        const amount = Math.abs(parseFloat(amountStr.replace(/,/g, '')));

        if (!date || !amount) {
          errors.push(`Skipped row: missing Date or Amount`);
          continue;
        }

        // Check transaction type to determine if it's an expense or payment
        const isPayment = /check|transfer|payment|deposit|refund/.test(transactionType);

        if (isPayment) {
          // Handle as Payment
          const customer = row['Name'] || '';
          const qb_payment_id = `payment_${date}_${customer}`.replace(/\s+/g, '_');
          const invoice_number = row['Num'] || null;
          const payment_method = row['Account'] || null;

          const paymentData = {
            date,
            customer,
            invoice_number,
            amount,
            qb_payment_id,
            payment_method,
          };

          const existing = await base44.asServiceRole.entities.Payment.filter({ qb_payment_id });
          
          if (existing.length > 0) {
            await base44.asServiceRole.entities.Payment.update(existing[0].id, paymentData);
          } else {
            await base44.asServiceRole.entities.Payment.create(paymentData);
          }

          paymentsImported++;
        } else {
          // Handle as Expense
          const vendor = row['Name'] || '';
          const category = row['Account'] || '';
          const qb_transaction_id = `bill_${date}_${vendor}_${category}`.replace(/\s+/g, '_');

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

          const existing = await base44.asServiceRole.entities.Expense.filter({ qb_transaction_id });
          
          if (existing.length > 0) {
            await base44.asServiceRole.entities.Expense.update(existing[0].id, expenseData);
          } else {
            await base44.asServiceRole.entities.Expense.create(expenseData);
          }

          expensesImported++;
        }
      } catch (rowError) {
        errors.push(`Row error: ${rowError.message}`);
      }
    }

    return Response.json({
      success: true,
      expensesImported,
      paymentsImported,
      totalImported: expensesImported + paymentsImported,
      totalRows: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[importTransactionsFromCSV] Error:', error.message, error.stack);
    return Response.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});