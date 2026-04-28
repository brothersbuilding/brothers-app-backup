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
    
    // Calculate AR outstanding with aging buckets
    const unpaidInvoices = invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'partial');
    const todayDate = new Date();
    
    const agingBuckets = {
      ar_0_30: 0,
      ar_31_60: 0,
      ar_61_90: 0,
      ar_90_plus: 0,
    };
    
    const unpaidWithDays = unpaidInvoices.map(inv => {
      const daysOverdue = inv.due_date 
        ? Math.floor((todayDate - new Date(inv.due_date)) / (1000 * 60 * 60 * 24))
        : 0;
      return { ...inv, daysOverdue };
    });
    
    unpaidWithDays.forEach(inv => {
      const balance = inv.open_balance ?? 0;
      if (inv.daysOverdue <= 30) agingBuckets.ar_0_30 += balance;
      else if (inv.daysOverdue <= 60) agingBuckets.ar_31_60 += balance;
      else if (inv.daysOverdue <= 90) agingBuckets.ar_61_90 += balance;
      else agingBuckets.ar_90_plus += balance;
    });
    
    const arOutstanding = unpaidInvoices.reduce((sum, inv) => sum + (inv.open_balance ?? 0), 0);
    const arInvoiceCount = unpaidInvoices.length;
    const topUnpaidInvoices = unpaidWithDays.sort((a, b) => (b.open_balance ?? 0) - (a.open_balance ?? 0)).slice(0, 5);
    
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
    
    // Fetch contracts for backlog summary
    const contracts = await base44.asServiceRole.entities.Contract.list();
    const totalContractValue = contracts.reduce((sum, c) => sum + (c.contract_value ?? 0), 0);
    
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
      ar_invoice_count: arInvoiceCount,
      ar_0_30: agingBuckets.ar_0_30,
      ar_31_60: agingBuckets.ar_31_60,
      ar_61_90: agingBuckets.ar_61_90,
      ar_90_plus: agingBuckets.ar_90_plus,
      top_unpaid_invoices: topUnpaidInvoices.map(inv => ({
        invoice_number: inv.invoice_number,
        customer: inv.customer,
        project: inv.project,
        open_balance: inv.open_balance,
        days_overdue: inv.daysOverdue,
      })),
      total_backlog: totalBacklog,
      total_contract_value: totalContractValue,
      period: 'YTD 2026',
      expenses_connected: false,
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