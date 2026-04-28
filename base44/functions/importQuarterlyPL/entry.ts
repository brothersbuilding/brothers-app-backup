import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const formData = await req.formData();
    const csvFile = formData.get('csv');
    const period = formData.get('period');

    if (!csvFile || !period) {
      return Response.json({ error: 'Missing csv or period field' }, { status: 400 });
    }

    const csvText = await csvFile.text();
    const lines = csvText.trim().split('\n');

    // Parse CSV rows: look for account name and amount (usually last column)
    const data = {};
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) continue;
      
      const label = parts[0].toLowerCase();
      const amount = parseFloat(parts[parts.length - 1].replace(/[$,]/g, ''));

      if (isNaN(amount)) continue;

      // Match key line items
      if (label.includes('total income')) {
        data.revenue = Math.abs(amount);
      } else if (label.includes('total cost of goods sold')) {
        data.cogs = Math.abs(amount);
      } else if (label.includes('gross profit')) {
        data.gross_profit = Math.abs(amount);
      } else if (label.includes('total expenses')) {
        data.operating_expenses = Math.abs(amount);
      } else if (label.includes('net income')) {
        data.net_profit = Math.abs(amount);
      } else if (label.includes('wages') || label.includes('payroll')) {
        data.labor_cost = (data.labor_cost || 0) + Math.abs(amount);
      }
    }

    // Calculate margins
    const revenue = data.revenue || 0;
    const gross_profit = data.gross_profit || 0;
    const net_profit = data.net_profit || 0;
    
    data.gross_margin = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
    data.net_margin = revenue > 0 ? (net_profit / revenue) * 100 : 0;

    // Parse period (e.g. "Q1 2026")
    const periodMatch = period.match(/Q(\d)\s+(\d{4})/i);
    if (!periodMatch) {
      return Response.json({ error: 'Invalid period format. Use "Q1 2026"' }, { status: 400 });
    }

    const quarter = parseInt(periodMatch[1]);
    const year = parseInt(periodMatch[2]);
    let month_start, month_end;

    switch (quarter) {
      case 1: month_start = 0; month_end = 2; break;
      case 2: month_start = 3; month_end = 5; break;
      case 3: month_start = 6; month_end = 8; break;
      case 4: month_start = 9; month_end = 11; break;
      default: return Response.json({ error: 'Invalid quarter' }, { status: 400 });
    }

    const period_start = new Date(year, month_start, 1).toISOString().split('T')[0];
    const period_end = new Date(year, month_end + 1, 0).toISOString().split('T')[0];

    // Upsert into FinancialSnapshot
    const existing = await base44.asServiceRole.entities.FinancialSnapshot.filter({ period });
    
    const snapshotData = {
      period,
      period_start,
      period_end,
      revenue: data.revenue || 0,
      cogs: data.cogs || 0,
      gross_profit: data.gross_profit || 0,
      gross_margin: data.gross_margin || 0,
      operating_expenses: data.operating_expenses || 0,
      labor_cost: data.labor_cost || 0,
      net_profit: data.net_profit || 0,
      net_margin: data.net_margin || 0,
    };

    if (existing.length > 0) {
      await base44.asServiceRole.entities.FinancialSnapshot.update(existing[0].id, snapshotData);
    } else {
      await base44.asServiceRole.entities.FinancialSnapshot.create(snapshotData);
    }

    const revenueFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.revenue || 0);
    const netProfitFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.net_profit || 0);

    return Response.json({
      success: true,
      message: `Imported ${period} — Revenue: ${revenueFormatted}, Net Profit: ${netProfitFormatted}`,
      data: snapshotData,
    });
  } catch (error) {
    console.error('[importQuarterlyPL] Error:', error.message, error.stack);
    return Response.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});