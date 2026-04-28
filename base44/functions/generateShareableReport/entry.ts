import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('[STEP 1] Function reached');
  
  try {
    console.log('[STEP 2] Verifying POST method');
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed', step: 2 }, { status: 405 });
    }

    console.log('[STEP 3] Creating base44 client');
    const base44 = createClientFromRequest(req);

    console.log('[STEP 4] Authenticating user');
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized', step: 4 }, { status: 401 });
    }

    console.log('[STEP 5] Reading request body');
    const body = await req.json();
    const expires_in_days = body.expires_in_days;
    console.log('[STEP 5] expires_in_days:', expires_in_days);

    console.log('[STEP 6] Generating token using crypto.randomUUID()');
    const token = crypto.randomUUID();
    console.log('[STEP 6] Token generated:', token);

    console.log('[STEP 7] Fetching financial data');
    const today = new Date().toISOString().split('T')[0];
    const ytdStart = `2026-01-01`;
    
    // Fetch invoices and expenses
    const [invoices, expenses] = await Promise.all([
      base44.asServiceRole.entities.Invoice.list('-updated_date', 2000),
      base44.asServiceRole.entities.Expense.list('-date', 2000),
    ]);
    
    console.log('[DEBUG] Total invoices fetched:', invoices.length);
    console.log('[DEBUG] Sample invoices:', invoices.slice(0, 3).map(inv => ({ id: inv.id, status: inv.status, date_sent: inv.date_sent, amount: inv.amount })));
    
    // Calculate revenue YTD (paid invoices in 2026)
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    console.log('[DEBUG] Paid invoices found:', paidInvoices.length);
    
    const paid2026Invoices = paidInvoices.filter(inv => inv.date_sent && inv.date_sent.startsWith('2026'));
    console.log('[DEBUG] Paid invoices in 2026:', paid2026Invoices.length);
    console.log('[DEBUG] Sample 2026 paid invoices:', paid2026Invoices.slice(0, 3).map(inv => ({ id: inv.id, date_sent: inv.date_sent, amount: inv.amount })));
    
    const revenueYTD = paid2026Invoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
    console.log('[DEBUG] Revenue YTD sum:', revenueYTD);
    
    // Calculate AR outstanding (unpaid or partial invoices)
    const arOutstanding = invoices
      .filter(inv => inv.status === 'unpaid' || inv.status === 'partial')
      .reduce((sum, inv) => sum + (inv.open_balance ?? 0), 0);
    
    // Get contract backlog
    const backlogRes = await base44.asServiceRole.functions.invoke('getContractBacklog', {});
    const totalBacklog = (backlogRes.summary?.total_remaining_backlog ?? 0);
    
    // Calculate expenses for 2026
    const expensesYTD = expenses
      .filter(exp => exp.date && exp.date.startsWith('2026'))
      .reduce((sum, exp) => sum + (exp.amount ?? 0), 0);
    
    const cogsYTD = expenses
      .filter(exp => exp.expense_type === 'cogs' && exp.date && exp.date.startsWith('2026'))
      .reduce((sum, exp) => sum + (exp.amount ?? 0), 0);
    
    const laborCostYTD = expenses
      .filter(exp => exp.expense_type === 'labor' && exp.date && exp.date.startsWith('2026'))
      .reduce((sum, exp) => sum + (exp.amount ?? 0), 0);
    
    // Calculate derived metrics
    const grossProfit = revenueYTD - cogsYTD;
    const grossMargin = revenueYTD > 0 ? (grossProfit / revenueYTD) * 100 : 0;
    const operatingExpenses = expensesYTD - cogsYTD - laborCostYTD;
    const netProfit = grossProfit - operatingExpenses - laborCostYTD;
    const netMargin = revenueYTD > 0 ? (netProfit / revenueYTD) * 100 : 0;
    
    const reportData = {
      revenue: revenueYTD,
      cogs: cogsYTD,
      gross_profit: grossProfit,
      gross_margin: grossMargin,
      labor: laborCostYTD,
      opex: operatingExpenses,
      net_profit: netProfit,
      net_margin: netMargin,
      ar_outstanding: arOutstanding,
      total_backlog: totalBacklog,
      period: 'YTD 2026',
    };
    
    console.log('[STEP 8] Creating SharedReport record');
    let finalExpiresAt = '2099-12-31'; // Default to never expires
    
    if (expires_in_days !== null && expires_in_days !== undefined && expires_in_days > 0) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + expires_in_days);
      finalExpiresAt = futureDate.toISOString().split('T')[0];
    }
    
    const sharedReport = await base44.asServiceRole.entities.SharedReport.create({
      token: token,
      report_data: JSON.stringify(reportData),
      created_at: today,
      expires_at: finalExpiresAt,
      created_by: 'system',
    });
    console.log('[STEP 8] SharedReport created successfully:', sharedReport.id);

    const shareUrl = `https://brothers-build-hub.base44.app/report/${token}`;
    console.log('[STEP 9] Returning success response');

    return Response.json({
      success: true,
      token: token,
      share_url: shareUrl,
    });
  } catch (error) {
    console.error('[ERROR] Function failed');
    console.error('[ERROR] Message:', error.message);
    console.error('[ERROR] Type:', error.name);
    console.error('[ERROR] Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      errorType: error.name,
      errorStack: error.stack,
    }, { status: 500 });
  }
});