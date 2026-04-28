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
        const customer = row['Name'] || '';
        const amountStr = (row['Amount'] || '0').toString();
        
        // Strip negatives and commas, convert to number
        const amount = Math.abs(parseFloat(amountStr.replace(/,/g, '')));

        if (!date || !amount) {
          errors.push(`Skipped row: missing required fields (Date or Amount)`);
          continue;
        }

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

        // Upsert: find existing by qb_payment_id
        const existing = await base44.asServiceRole.entities.Payment.filter({ qb_payment_id });
        
        if (existing.length > 0) {
          await base44.asServiceRole.entities.Payment.update(existing[0].id, paymentData);
        } else {
          await base44.asServiceRole.entities.Payment.create(paymentData);
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
    console.error('[importPaymentsFromCSV] Error:', error.message, error.stack);
    return Response.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});