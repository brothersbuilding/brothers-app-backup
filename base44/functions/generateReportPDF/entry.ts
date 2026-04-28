import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@2.5.1';
import { parseISO, format, isAfter } from 'npm:date-fns@3.6.0';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }

    // Fetch SharedReport
    const results = await base44.asServiceRole.entities.SharedReport.filter({ token });
    if (!results || results.length === 0) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    const sharedReport = results[0];
    const expiresAt = new Date(sharedReport.expires_at);
    if (!isAfter(expiresAt, new Date())) {
      return Response.json({ error: 'Report has expired' }, { status: 410 });
    }

    const reportData = JSON.parse(sharedReport.report_data ?? '{}');
    
    // Fetch contracts and invoices for backlog calculations
    const [contracts, invoices] = await Promise.all([
      base44.asServiceRole.entities.Contract.list('-contract_value', 1000),
      base44.asServiceRole.entities.Invoice.list('-amount', 1000),
    ]);
    
    // Calculate contract totals
    const totalContractValue = contracts.reduce((sum, c) => sum + (c.contract_value ?? 0), 0);
    const totalInvoiced = invoices
      .filter(inv => inv.status === 'paid' && inv.date_sent && inv.date_sent.startsWith('2026'))
      .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
    const totalRemaining = totalContractValue - totalInvoiced;
    
    const kpi = {
      revenue: reportData.revenue ?? 0,
      cogs: reportData.cogs ?? 0,
      grossProfit: reportData.gross_profit ?? 0,
      grossMargin: reportData.gross_margin ?? 0,
      labor: reportData.labor ?? 0,
      opex: reportData.opex ?? 0,
      netProfit: reportData.net_profit ?? 0,
      netMargin: reportData.net_margin ?? 0,
    };
    const summary = {
      total_outstanding: reportData.ar_outstanding ?? 0,
      ar_invoice_count: reportData.ar_invoice_count ?? 0,
      ar_0_30: reportData.ar_0_30 ?? 0,
      ar_31_60: reportData.ar_31_60 ?? 0,
      ar_61_90: reportData.ar_61_90 ?? 0,
      ar_90_plus: reportData.ar_90_plus ?? 0,
      total_remaining_backlog: totalRemaining,
      total_contract_value: totalContractValue,
    };
    const topUnpaidInvoices = reportData.top_unpaid_invoices ?? [];
    const expensesConnected = reportData.expenses_connected ?? false;
    const budgetVsActual = {};

    // Create PDF
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = 15;
    const margin = 12;
    const contentWidth = pageWidth - 2 * margin;

    // Helper functions
    const addText = (text, options = {}) => {
      const { size = 12, bold = false, align = 'left', color = [0, 0, 0] } = options;
      pdf.setFontSize(size);
      pdf.setFont(undefined, bold ? 'bold' : 'normal');
      pdf.setTextColor(...color);
      pdf.text(text, align === 'center' ? pageWidth / 2 : margin, yPos, { align });
      yPos += size / 2 + 3;
      if (yPos > pageHeight - 15) {
        pdf.addPage();
        yPos = 15;
      }
    };

    const addSection = (title) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = 15;
      }
      addText(title, { size: 16, bold: true, color: [20, 20, 40] });
      yPos += 2;
    };

    const addMetricRow = (label, value) => {
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(label, margin, yPos);
      pdf.text(value, pageWidth - margin, yPos, { align: 'right' });
      yPos += 8;
    };

    // Header
    addText('BROTHERS BUILDING', { size: 18, bold: true, color: [32, 65, 48] });
    addText('Financial Report', { size: 14, bold: true });
    addText(reportData.period || 'Report', { size: 11, color: [100, 100, 100] });
    yPos += 5;

    // Expense Disclaimer
    if (!expensesConnected) {
      pdf.setFillColor(255, 235, 59);
      pdf.rect(margin, yPos, contentWidth, 12, 'F');
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(255, 152, 0);
      pdf.text('⚠️ Expense data not yet available — QuickBooks sync pending.', margin + 2, yPos + 4);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(200, 120, 0);
      pdf.setFontSize(8);
      pdf.text('COGS, operating expenses and net profit will update once connected.', margin + 2, yPos + 8);
      yPos += 15;
    }

    // Section 1: KPI Summary
    addSection('KEY METRICS');
    const metricsPerRow = 2;
    const colWidth = (contentWidth - 4) / metricsPerRow;

    const metrics = [
      { label: 'Revenue', value: fmt(kpi.revenue) },
      { label: 'COGS', value: fmt(kpi.cogs) },
      { label: 'Gross Profit', value: fmt(kpi.grossProfit) },
      { label: 'Gross Margin %', value: fmtPct(kpi.grossMargin) },
      { label: 'Net Profit', value: fmt(kpi.netProfit) },
      { label: 'Net Margin %', value: fmtPct(kpi.netMargin) },
    ];

    for (let i = 0; i < metrics.length; i += metricsPerRow) {
      const row = metrics.slice(i, i + metricsPerRow);
      const rowStart = yPos;
      
      row.forEach((m, idx) => {
        const x = margin + idx * (colWidth + 4);
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(m.label, x, yPos);
        
        pdf.setFontSize(13);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(20, 20, 40);
        pdf.text(m.value, x, yPos + 7);
      });

      yPos = rowStart + 18;
    }

    // Section 2: Contract Backlog Summary
    if (summary.total_contract_value > 0) {
      addSection('CONTRACT BACKLOG');
      
      addMetricRow('Total Contract Value:', fmt(summary.total_contract_value));
      addMetricRow('Total Invoiced (2026):', fmt(totalInvoiced));
      addMetricRow('Remaining Backlog:', fmt(summary.total_remaining_backlog));
      yPos += 3;
    }

    // Section 3: AR Outstanding
    if (summary.total_outstanding !== undefined) {
      addSection('ACCOUNTS RECEIVABLE');
      
      addMetricRow('Total Outstanding:', fmt(summary.total_outstanding));
      addMetricRow('Number of Invoices:', `${summary.ar_invoice_count || 0}`);
      yPos += 3;
      
      addText('Summary by Aging Bucket', { size: 12, bold: true, color: [80, 80, 80] });
      yPos -= 2;
      
      const agingData = [
        { days: '0–30 Days', amount: summary.ar_0_30 ?? 0 },
        { days: '31–60 Days', amount: summary.ar_31_60 ?? 0 },
        { days: '61–90 Days', amount: summary.ar_61_90 ?? 0 },
        { days: '90+ Days', amount: summary.ar_90_plus ?? 0 },
      ];

      agingData.forEach(a => {
        addMetricRow(a.days, fmt(a.amount));
      });
      yPos += 5;

      // Top 5 unpaid invoices
      if (topUnpaidInvoices.length > 0) {
        addText('Top Unpaid Invoices', { size: 11, bold: true, color: [80, 80, 80] });
        yPos -= 2;
        
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(60, 60, 60);
        pdf.text('Invoice #', margin, yPos);
        pdf.text('Customer', margin + 25, yPos);
        pdf.text('Amount', margin + contentWidth * 0.65, yPos);
        pdf.text('Days OD', margin + contentWidth * 0.85, yPos);
        yPos += 6;

        pdf.setDrawColor(180, 180, 180);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 3;

        topUnpaidInvoices.slice(0, 5).forEach(inv => {
          pdf.setFontSize(9);
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(50, 50, 50);
          
          const invNum = (inv.invoice_number ?? '').substring(0, 10);
          const custName = (inv.customer ?? '').substring(0, 18);
          pdf.text(invNum, margin, yPos);
          pdf.text(custName, margin + 25, yPos);
          pdf.text(fmt(inv.open_balance), margin + contentWidth * 0.65, yPos);
          pdf.text(`${inv.days_overdue}`, margin + contentWidth * 0.85, yPos);
          yPos += 5;

          if (yPos > pageHeight - 20) {
            pdf.addPage();
            yPos = 15;
          }
        });
        yPos += 3;
      }
    }



    // Section 4: Budget vs Actual
    if (budgetVsActual.budgetLines && budgetVsActual.budgetLines.length > 0) {
      addSection('BUDGET VS ACTUAL (YTD)');
      
      const budgets = budgetVsActual.budgetLines.slice(0, 8);
      
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(60, 60, 60);
      pdf.text('Category', margin, yPos);
      pdf.text('Budget', margin + contentWidth * 0.4, yPos);
      pdf.text('Actual', margin + contentWidth * 0.65, yPos);
      pdf.text('Var %', margin + contentWidth * 0.85, yPos);
      yPos += 7;

      pdf.setDrawColor(180, 180, 180);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      budgets.forEach(b => {
        const variance = b.budget_amount > 0 ? ((b.actual - b.budget_amount) / b.budget_amount) * 100 : 0;
        
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(50, 50, 50);
        
        const catName = (b.category ?? '').substring(0, 15);
        pdf.text(catName, margin, yPos);
        pdf.text(fmt(b.budget_amount), margin + contentWidth * 0.4, yPos);
        pdf.text(fmt(b.actual), margin + contentWidth * 0.65, yPos);
        pdf.text(`${variance >= 0 ? '+' : ''}${variance.toFixed(0)}%`, margin + contentWidth * 0.85, yPos);
        yPos += 6;

        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = 15;
        }
      });
    }

    // Footer
    yPos += 5;
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(150, 150, 150);
    const timestamp = format(new Date(), 'MMM d, yyyy h:mm a');
    pdf.text(`Generated on ${timestamp}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Convert to base64
    const pdfBase64 = pdf.output('dataurlstring').split(',')[1];

    return Response.json({
      success: true,
      pdf: pdfBase64,
      filename: `report_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.pdf`,
    });
  } catch (error) {
    console.error('[ERROR] generateReportPDF:', error.message);
    return Response.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});