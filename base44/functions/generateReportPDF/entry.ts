import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@2.5.1';
import { format, isAfter } from 'npm:date-fns@3.6.0';

const C = {
  green: [34, 110, 60],
  navy: [20, 30, 55],
  dark: [30, 30, 30],
  gray: [100, 100, 100],
  lightGray: [230, 230, 230],
  veryLightGray: [247, 247, 247],
  white: [255, 255, 255],
  red: [200, 40, 40],
  amber: [180, 100, 0],
};

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDec = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);
const fmtPct = (n) => {
  const v = n ?? 0;
  return isFinite(v) ? `${v.toFixed(1)}%` : '—';
};

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

    const results = await base44.asServiceRole.entities.SharedReport.filter({ token });
    if (!results || results.length === 0) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    const sharedReport = results[0];
    const expiresAt = new Date(sharedReport.expires_at);
    if (!isAfter(expiresAt, new Date())) {
      return Response.json({ error: 'Report has expired' }, { status: 410 });
    }

    const d = JSON.parse(sharedReport.report_data ?? '{}');

    // ─── PDF setup ──────────────────────────────────────────────────────────────
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = pdf.internal.pageSize.getWidth();
    const PH = pdf.internal.pageSize.getHeight();
    const M = 14;
    const CW = PW - 2 * M;
    let y = M;

    const setColor = (arr) => pdf.setTextColor(...arr);
    const setFill = (arr) => pdf.setFillColor(...arr);
    const setDraw = (arr) => pdf.setDrawColor(...arr);

    const checkPage = (needed = 20) => {
      if (y + needed > PH - 18) { pdf.addPage(); y = M; }
    };

    const text = (str, x, options = {}) => {
      pdf.text(String(str ?? ''), x, y, options);
    };

    const hr = (color = C.lightGray) => {
      setDraw(color);
      pdf.setLineWidth(0.3);
      pdf.line(M, y, PW - M, y);
      y += 4;
    };

    const sectionHeader = (title) => {
      checkPage(16);
      y += 4;
      // Green left bar
      setFill(C.green);
      pdf.rect(M, y - 5, 3, 8, 'F');
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      setColor(C.navy);
      text(title.toUpperCase(), M + 6);
      y += 6;
      hr(C.lightGray);
    };

    // ─── HEADER ────────────────────────────────────────────────────────────────
    // Green accent bar at top
    setFill(C.green);
    pdf.rect(0, 0, PW, 16, 'F');

    // Company name
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    setColor(C.white);
    pdf.text('BROTHERS BUILDING LLC', M, 11);
    y = 22;

    // Period label
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    setColor(C.gray);
    text(`Financial Report  ·  ${d.period || 'YTD 2026'}`, M);
    y += 4;

    // Generation date
    pdf.setFontSize(8);
    setColor(C.lightGray);
    const genDate = d.generated_at ? format(new Date(d.generated_at), 'MMMM d, yyyy h:mm a') : format(new Date(), 'MMMM d, yyyy h:mm a');
    text(`Generated ${genDate}`, M);
    y += 6;
    hr();

    // ─── KPI GRID ──────────────────────────────────────────────────────────────
    sectionHeader('Key Metrics');

    const kpiItems = [
      { label: 'Revenue', value: fmt(d.revenue), accent: C.green },
      { label: 'COGS', value: fmt(d.cogs), accent: C.navy },
      { label: 'Gross Profit', value: fmt(d.gross_profit), accent: d.gross_profit >= 0 ? C.green : C.red },
      { label: 'Gross Margin', value: fmtPct(d.gross_margin), accent: d.gross_margin >= 20 ? C.green : C.amber },
      { label: 'Labor Cost', value: fmt(d.labor), accent: C.navy },
      { label: 'Labor % of Revenue', value: fmtPct(d.labor_pct), accent: C.navy },
      { label: 'Operating Expenses', value: fmt(d.opex), accent: C.navy },
      { label: 'Net Profit', value: fmt(d.net_profit), accent: d.net_profit >= 0 ? C.green : C.red },
      { label: 'Net Margin', value: fmtPct(d.net_margin), accent: d.net_margin >= 10 ? C.green : C.amber },
    ];

    const colW = (CW - 4) / 2;
    for (let i = 0; i < kpiItems.length; i += 2) {
      checkPage(20);
      const row = kpiItems.slice(i, i + 2);
      const rowY = y;

      row.forEach((item, idx) => {
        const x = M + idx * (colW + 4);
        // Card background
        setFill(C.veryLightGray);
        pdf.roundedRect(x, rowY - 1, colW, 16, 1.5, 1.5, 'F');
        // Colored top border
        setFill(item.accent);
        pdf.rect(x, rowY - 1, colW, 1.5, 'F');
        // Label
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'normal');
        setColor(C.gray);
        pdf.text(item.label, x + 4, rowY + 5);
        // Value
        pdf.setFontSize(13);
        pdf.setFont(undefined, 'bold');
        setColor(C.dark);
        pdf.text(item.value, x + 4, rowY + 13);
      });

      y = rowY + 20;
    }

    // ─── LABOR P&L ─────────────────────────────────────────────────────────────
    sectionHeader('Labor P&L');
    checkPage(30);

    const laborRows = [
      ['Labor Cost', fmt(d.labor)],
      ['Total Revenue', fmt(d.revenue)],
      ['Labor as % of Revenue', fmtPct(d.labor_pct)],
    ];
    laborRows.forEach((row, i) => {
      if (i % 2 === 0) { setFill(C.veryLightGray); pdf.rect(M, y - 3, CW, 7, 'F'); }
      pdf.setFontSize(10); pdf.setFont(undefined, i === 2 ? 'bold' : 'normal');
      setColor(C.dark); text(row[0], M + 2);
      pdf.setFont(undefined, 'bold');
      pdf.text(row[1], PW - M, y, { align: 'right' });
      y += 8;
    });

    // ─── AR OUTSTANDING ────────────────────────────────────────────────────────
    sectionHeader('Accounts Receivable');
    checkPage(40);

    const arSummary = [
      ['Total Outstanding', fmt(d.ar_outstanding)],
      ['Open Invoices', String(d.ar_invoice_count ?? 0)],
      ['0–30 Days', fmt(d.ar_0_30)],
      ['31–60 Days', fmt(d.ar_31_60)],
      ['61–90 Days', fmt(d.ar_61_90)],
      ['90+ Days', fmt(d.ar_90_plus)],
    ];
    arSummary.forEach((row, i) => {
      checkPage(8);
      if (i % 2 === 0) { setFill(C.veryLightGray); pdf.rect(M, y - 3, CW, 7, 'F'); }
      pdf.setFontSize(10); pdf.setFont(undefined, i === 0 ? 'bold' : 'normal');
      setColor(C.dark); text(row[0], M + 2);
      pdf.setFont(undefined, i === 0 ? 'bold' : 'normal');
      pdf.text(row[1], PW - M, y, { align: 'right' });
      y += 8;
    });

    // Top unpaid invoices table
    const topUnpaid = d.top_unpaid_invoices ?? [];
    if (topUnpaid.length > 0) {
      checkPage(14);
      y += 2;
      pdf.setFontSize(9); pdf.setFont(undefined, 'bold'); setColor(C.navy);
      text('Top Unpaid Invoices', M);
      y += 6;

      // Table header
      setFill(C.navy);
      pdf.rect(M, y - 4, CW, 7, 'F');
      pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); setColor(C.white);
      pdf.text('Invoice #', M + 2, y);
      pdf.text('Customer', M + 28, y);
      pdf.text('Balance', M + CW * 0.62, y, { align: 'right' });
      pdf.text('Days OD', M + CW, y, { align: 'right' });
      y += 6;

      topUnpaid.slice(0, 5).forEach((inv, i) => {
        checkPage(7);
        if (i % 2 === 0) { setFill(C.veryLightGray); pdf.rect(M, y - 3, CW, 6, 'F'); }
        pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); setColor(C.dark);
        let cust = (inv.customer ?? '').substring(0, 24);
        if ((inv.customer ?? '').length > 24) cust = cust.substring(0, 21) + '…';
        pdf.text((inv.invoice_number ?? '').substring(0, 12), M + 2, y);
        pdf.text(cust, M + 28, y);
        pdf.text(fmt(inv.open_balance), M + CW * 0.62, y, { align: 'right' });
        const od = inv.days_overdue ?? 0;
        setColor(od > 60 ? C.red : od > 30 ? C.amber : C.dark);
        pdf.text(od <= 0 ? 'Current' : `${od}`, M + CW, y, { align: 'right' });
        setColor(C.dark);
        y += 6;
      });
      y += 2;
    }

    // ─── BUDGET VS ACTUAL ──────────────────────────────────────────────────────
    const budgetRows = d.budget_rows ?? [];
    if (budgetRows.length > 0) {
      sectionHeader('Budget vs Actual (Top 10)');
      checkPage(14);

      // Table header
      setFill(C.navy);
      pdf.rect(M, y - 4, CW, 7, 'F');
      pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); setColor(C.white);
      const bCols = [M + 2, M + CW * 0.38, M + CW * 0.55, M + CW * 0.72, M + CW];
      pdf.text('Category', bCols[0], y);
      pdf.text('Budget', bCols[1], y, { align: 'right' });
      pdf.text('Actual YTD', bCols[2], y, { align: 'right' });
      pdf.text('Variance $', bCols[3], y, { align: 'right' });
      pdf.text('Var %', bCols[4], y, { align: 'right' });
      y += 6;

      budgetRows.forEach((row, i) => {
        checkPage(7);
        if (i % 2 === 0) { setFill(C.veryLightGray); pdf.rect(M, y - 3, CW, 6, 'F'); }
        pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); setColor(C.dark);
        pdf.text((row.category ?? '').substring(0, 22), bCols[0], y);
        pdf.text(fmt(row.budget), bCols[1], y, { align: 'right' });
        pdf.text(fmt(row.actual), bCols[2], y, { align: 'right' });
        const varColor = row.variance >= 0 ? C.green : C.red;
        setColor(varColor);
        pdf.setFont(undefined, 'bold');
        pdf.text(fmt(row.variance), bCols[3], y, { align: 'right' });
        pdf.text(fmtPct(row.variancePct), bCols[4], y, { align: 'right' });
        setColor(C.dark); pdf.setFont(undefined, 'normal');
        y += 6;
      });
      y += 2;
    }

    // ─── PROJECTED REVENUE / ACTIVE CONTRACTS ──────────────────────────────────
    const contractRows = d.contract_rows ?? [];
    if (contractRows.length > 0) {
      sectionHeader('Projected Revenue — Active Contracts');
      checkPage(14);

      // Header
      setFill(C.navy);
      pdf.rect(M, y - 4, CW, 7, 'F');
      pdf.setFontSize(7); pdf.setFont(undefined, 'bold'); setColor(C.white);
      const cCols = [M + 2, M + CW * 0.28, M + CW * 0.42, M + CW * 0.56, M + CW * 0.70, M + CW * 0.82, M + CW];
      pdf.text('Project', cCols[0], y);
      pdf.text('Type', cCols[1], y);
      pdf.text('Value', cCols[2], y, { align: 'right' });
      pdf.text('Invoiced', cCols[3], y, { align: 'right' });
      pdf.text('Remaining', cCols[4], y, { align: 'right' });
      pdf.text('% Billed', cCols[5], y, { align: 'right' });
      pdf.text('End Date', cCols[6], y, { align: 'right' });
      y += 6;

      contractRows.forEach((row, i) => {
        checkPage(7);
        if (i % 2 === 0) { setFill(C.veryLightGray); pdf.rect(M, y - 3, CW, 6, 'F'); }
        pdf.setFontSize(8); pdf.setFont(undefined, 'normal'); setColor(C.dark);
        let projName = (row.name ?? '').substring(0, 18);
        if ((row.name ?? '').length > 18) projName = projName.substring(0, 15) + '…';
        pdf.text(projName, cCols[0], y);
        pdf.text((row.type ?? '').substring(0, 12), cCols[1], y);
        pdf.text(fmt(row.value), cCols[2], y, { align: 'right' });
        pdf.text(fmt(row.invoiced), cCols[3], y, { align: 'right' });
        pdf.text(fmt(row.remaining), cCols[4], y, { align: 'right' });
        const pctColor = row.pctBilled >= 90 ? C.green : row.pctBilled >= 50 ? C.amber : C.dark;
        setColor(pctColor);
        pdf.text(fmtPct(row.pctBilled), cCols[5], y, { align: 'right' });
        setColor(C.dark);
        pdf.text(row.endDate ? row.endDate.substring(0, 10) : '—', cCols[6], y, { align: 'right' });
        y += 6;
      });
      y += 2;
    }

    // ─── FOOTER on every page ──────────────────────────────────────────────────
    const totalPages = pdf.getNumberOfPages();
    const footerDate = format(new Date(), 'MMM d, yyyy');
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      // Footer bar
      setFill([240, 240, 240]);
      pdf.rect(0, PH - 12, PW, 12, 'F');
      pdf.setFontSize(7); pdf.setFont(undefined, 'normal'); setColor(C.gray);
      pdf.text('Brothers Building LLC — Confidential', M, PH - 5);
      pdf.text(`Generated ${footerDate}`, PW / 2, PH - 5, { align: 'center' });
      pdf.text(`Page ${i} of ${totalPages}`, PW - M, PH - 5, { align: 'right' });
    }

    const pdfBase64 = pdf.output('dataurlstring').split(',')[1];

    return Response.json({
      success: true,
      pdf: pdfBase64,
      filename: `Brothers-Building-Report-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
    });
  } catch (error) {
    console.error('[ERROR] generateReportPDF:', error.message, error.stack);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});