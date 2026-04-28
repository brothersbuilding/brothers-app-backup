import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import jsPDF from 'npm:jspdf@4.0.0';
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
    const kpi = reportData.kpi || {};
    const summary = reportData.summary || {};
    const contracts = reportData.contracts || [];
    const budgetVsActual = reportData.budgetVsActual || {};

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

    // Section 2: Contract Backlog
    if (summary.total_remaining_backlog !== undefined && contracts.length > 0) {
      addSection('CONTRACT BACKLOG');
      
      const activeContracts = contracts.filter(c => c.status === 'active').slice(0, 8);
      
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(60, 60, 60);
      pdf.text('Project', margin, yPos);
      pdf.text('Value', margin + contentWidth * 0.5, yPos);
      pdf.text('Remaining', margin + contentWidth * 0.75, yPos, { align: 'right' });
      yPos += 7;
      
      pdf.setDrawColor(180, 180, 180);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      activeContracts.forEach(c => {
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(50, 50, 50);
        
        const projName = (c.project_name ?? '').substring(0, 20);
        pdf.text(projName, margin, yPos);
        pdf.text(fmt(c.contract_value), margin + contentWidth * 0.5, yPos);
        pdf.text(fmt(c.remaining_backlog), margin + contentWidth * 0.75, yPos, { align: 'right' });
        yPos += 6;

        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = 15;
        }
      });

      yPos += 3;
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(20, 20, 40);
      pdf.text(`Total Backlog: ${fmt(summary.total_remaining_backlog)}`, margin, yPos);
      yPos += 8;
    }

    // Section 3: AR Outstanding
    if (summary.total_outstanding !== undefined) {
      addSection('ACCOUNTS RECEIVABLE');
      
      addMetricRow('Total Outstanding:', fmt(summary.total_outstanding));
      addMetricRow('Number of Invoices:', `${summary.unpaid_invoice_count || 0}`);
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
      yPos += 3;
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