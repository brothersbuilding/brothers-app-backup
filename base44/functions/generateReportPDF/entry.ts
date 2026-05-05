import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@2.5.1';
import { format, isAfter } from 'npm:date-fns@3.6.0';

// ─── BRAND COLORS — NO GREEN ──────────────────────────────────────────────────
// navy:     [28, 35, 49]    = #1C2331
// gold:     [201, 169, 110] = #C9A96E
// bg:       [255, 255, 255] = #FFFFFF
// sectionBg:[247, 246, 243] = #F7F6F3
// border:   [226, 221, 214] = #E2DDD6
// text:     [26, 26, 26]    = #1A1A1A
// muted:    [107, 114, 128] = #6B7280
// positive: [21, 128, 61]   = #15803D
// negative: [220, 38, 38]   = #DC2626
// amber:    [217, 119, 6]   = #D97706
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  navy:     [28, 35, 49],
  gold:     [201, 169, 110],
  bg:       [255, 255, 255],
  sectionBg:[247, 246, 243],
  border:   [226, 221, 214],
  text:     [26, 26, 26],
  muted:    [107, 114, 128],
  mutedLight:[156, 163, 175],
  positive: [21, 128, 61],
  negative: [220, 38, 38],
  amber:    [217, 119, 6],
  white:    [255, 255, 255],
};

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => { const v = n ?? 0; return isFinite(v) ? `${v.toFixed(1)}%` : '—'; };

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token } = body;
    if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

    const results = await base44.asServiceRole.entities.SharedReport.filter({ token });
    if (!results || results.length === 0) return Response.json({ error: 'Report not found' }, { status: 404 });

    const sharedReport = results[0];
    if (sharedReport.expires_at && sharedReport.expires_at !== '2099-12-31') {
      if (!isAfter(new Date(sharedReport.expires_at), new Date())) {
        return Response.json({ error: 'Report has expired' }, { status: 410 });
      }
    }

    const d = JSON.parse(sharedReport.report_data ?? '{}');

    // ─── PDF setup ───────────────────────────────────────────────────────────
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = pdf.internal.pageSize.getWidth();
    const PH = pdf.internal.pageSize.getHeight();
    const M = 14;
    const CW = PW - 2 * M;
    let y = 0;

    const setFill = (arr) => pdf.setFillColor(...arr);
    const setColor = (arr) => pdf.setTextColor(...arr);
    const setDraw = (arr) => pdf.setDrawColor(...arr);

    const checkPage = (needed = 20) => {
      if (y + needed > PH - 16) { pdf.addPage(); y = M; }
    };

    const drawFooter = () => {
      const totalPages = pdf.getNumberOfPages();
      const footerDate = format(new Date(), 'MMM d, yyyy');
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        // Gold top line on footer
        setFill(C.gold);
        pdf.rect(0, PH - 13, PW, 1, 'F');
        setFill(C.sectionBg);
        pdf.rect(0, PH - 12, PW, 12, 'F');
        pdf.setFontSize(7); pdf.setFont(undefined, 'normal'); setColor(C.mutedLight);
        pdf.text('Brothers Building LLC — Confidential', M, PH - 5);
        pdf.text(`Generated ${footerDate}`, PW - M, PH - 5, { align: 'right' });
        pdf.text(`Page ${i} of ${totalPages}`, PW / 2, PH - 5, { align: 'center' });
      }
    };

    // Helper: section header bar
    const sectionHeader = (title) => {
      checkPage(18);
      y += 6;
      // Gold left accent bar
      setFill(C.gold);
      pdf.rect(M, y - 5, 3, 8, 'F');
      // Navy background
      setFill(C.navy);
      pdf.rect(M + 3, y - 5, CW - 3, 8, 'F');
      pdf.setFontSize(9); pdf.setFont(undefined, 'bold'); setColor(C.white);
      pdf.text(title.toUpperCase(), M + 8, y);
      y += 6;
    };

    // Helper: horizontal rule
    const hr = () => {
      setDraw(C.border); pdf.setLineWidth(0.3);
      pdf.line(M, y, PW - M, y); y += 4;
    };

    // ─── HEADER ──────────────────────────────────────────────────────────────
    // 8px navy top bar
    setFill(C.navy);
    pdf.rect(0, 0, PW, 6, 'F');
    y = 12;

    // Company name
    pdf.setFontSize(16); pdf.setFont(undefined, 'bold'); setColor(C.navy);
    pdf.text('BROTHERS BUILDING LLC', M, y);
    y += 6;

    // Gold accent underline
    setFill(C.gold);
    pdf.rect(M, y, 48, 1, 'F');
    y += 5;

    // Period + generated
    pdf.setFontSize(10); pdf.setFont(undefined, 'normal'); setColor(C.muted);
    const genDate = d.generated_at ? format(new Date(d.generated_at), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy');
    pdf.text(`Financial Report  ·  ${d.period || 'YTD 2026'}`, M, y);
    y += 5;
    pdf.setFontSize(8); setColor(C.mutedLight);
    pdf.text(`Generated ${genDate}`, M, y);
    y += 6;
    hr();

    // ─── SECTION 1: KEY METRICS (3-col grid) ─────────────────────────────────
    sectionHeader('Key Metrics');
    checkPage(60);

    const kpiItems = [
      { label: 'Revenue',             value: fmt(d.revenue) },
      { label: 'COGS',                value: fmt(d.cogs) },
      { label: 'Gross Profit',        value: fmt(d.gross_profit) },
      { label: 'Gross Margin %',      value: fmtPct(d.gross_margin) },
      { label: 'Labor Cost',          value: fmt(d.labor) },
      { label: 'Labor % of Revenue',  value: fmtPct(d.labor_pct) },
      { label: 'Operating Expenses',  value: fmt(d.opex) },
      { label: 'Net Profit',          value: fmt(d.net_profit) },
      { label: 'Net Margin %',        value: fmtPct(d.net_margin) },
    ];

    const cardW = (CW - 8) / 3;
    const cardH = 18;
    const cardGap = 4;

    for (let row = 0; row < 3; row++) {
      checkPage(cardH + cardGap + 2);
      for (let col = 0; col < 3; col++) {
        const item = kpiItems[row * 3 + col];
        if (!item) continue;
        const cx = M + col * (cardW + cardGap);
        const cy = y;
        // Card bg
        setFill(C.bg); setDraw(C.border);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD');
        // Gold top border
        setFill(C.gold);
        pdf.rect(cx, cy, cardW, 1.5, 'F');
        // Label
        pdf.setFontSize(7); pdf.setFont(undefined, 'normal'); setColor(C.muted);
        pdf.text(item.label.toUpperCase(), cx + 3, cy + 7);
        // Value
        pdf.setFontSize(12); pdf.setFont(undefined, 'bold'); setColor(C.text);
        pdf.text(item.value, cx + 3, cy + 15);
      }
      y += cardH + cardGap;
    }
    y += 2;

    // ─── SECTION 2: PERFORMANCE TRENDS ───────────────────────────────────────
    const trendPeriods = d.trend_periods ?? [];
    if (trendPeriods.length > 0) {
      sectionHeader('Performance Trends');
      checkPage(50);

      const tCols = trendPeriods.length;
      const tLabelW = 36;
      const tColW = (CW - tLabelW) / tCols;

      // Table header
      setFill(C.navy);
      pdf.rect(M, y - 4, CW, 7, 'F');
      pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); setColor(C.white);
      pdf.text('Metric', M + 2, y);
      trendPeriods.forEach((p, i) => {
        pdf.text(p.label ?? '', M + tLabelW + i * tColW + tColW, y, { align: 'right' });
      });
      y += 6;

      const trendRows = [
        { label: 'Revenue', key: 'revenue', format: fmt, higherBetter: true, isRevenue: true },
        { label: 'Gross Margin %', key: 'gross_margin', format: fmtPct, higherBetter: true },
        { label: 'Net Margin %', key: 'net_margin', format: fmtPct, higherBetter: true },
        { label: 'Labor % of Rev', key: 'labor_pct', format: fmtPct, higherBetter: false },
      ];

      const maxRevenue = Math.max(...trendPeriods.map(p => p.revenue ?? 0), 1);

      trendRows.forEach((row, ri) => {
        checkPage(10);
        if (ri % 2 === 0) { setFill(C.bg); } else { setFill(C.sectionBg); }
        setDraw(C.border); pdf.setLineWidth(0.2);
        pdf.rect(M, y - 4, CW, ri === 0 ? 14 : 8, 'F');
        pdf.line(M, y + (ri === 0 ? 10 : 4), PW - M, y + (ri === 0 ? 10 : 4));

        pdf.setFontSize(9); pdf.setFont(undefined, 'bold'); setColor(C.text);
        pdf.text(row.label, M + 2, y);

        trendPeriods.forEach((p, i) => {
          const val = p[row.key] ?? null;
          const prevVal = i > 0 ? (trendPeriods[i - 1][row.key] ?? null) : null;
          const xRight = M + tLabelW + i * tColW + tColW;

          if (val === null) {
            pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); setColor(C.mutedLight);
            pdf.text('—', xRight, y, { align: 'right' });
          } else {
            // Color coding
            let valColor = C.text;
            if (row.key === 'gross_margin') {
              valColor = val > 25 ? C.positive : val >= 15 ? C.amber : C.negative;
            } else if (row.key === 'net_margin') {
              valColor = val > 10 ? C.positive : val >= 5 ? C.amber : C.negative;
            } else if (row.key === 'labor_pct') {
              valColor = val < 20 ? C.positive : val <= 30 ? C.amber : C.negative;
            }

            pdf.setFontSize(9); pdf.setFont(undefined, 'bold'); setColor(valColor);
            pdf.text(row.format(val), xRight, y, { align: 'right' });

            // Trend arrow
            if (prevVal !== null) {
              const improved = row.higherBetter ? val > prevVal : val < prevVal;
              const arrow = improved ? '▲' : '▼';
              setColor(improved ? C.positive : C.negative);
              pdf.setFontSize(7);
              pdf.text(arrow, xRight + 3, y);
            }

            // Revenue bar
            if (row.isRevenue) {
              const barW = Math.round((val / maxRevenue) * tColW * 0.85);
              setFill(C.gold);
              pdf.rect(xRight - tColW + 2, y + 3, barW, 2, 'F');
            }
          }
        });

        y += ri === 0 ? 14 : 8;
      });
      y += 2;
    }

    // ─── SECTION 3: LABOR P&L ────────────────────────────────────────────────
    sectionHeader('Labor P&L');
    checkPage(36);

    // Header row
    setFill(C.navy);
    pdf.rect(M, y - 4, CW, 7, 'F');
    pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); setColor(C.white);
    pdf.text('Line Item', M + 2, y);
    pdf.text('Amount', PW - M, y, { align: 'right' });
    y += 6;

    const laborRows = [
      { label: 'Labor Cost', value: fmt(d.labor), bold: false },
      { label: 'Total Revenue', value: fmt(d.revenue), bold: false },
      { label: 'Labor as % of Revenue', value: fmtPct(d.labor_pct), bold: true },
    ];
    laborRows.forEach((row, i) => {
      checkPage(8);
      setFill(i % 2 === 0 ? C.bg : C.sectionBg);
      setDraw(C.border); pdf.setLineWidth(0.2);
      pdf.rect(M, y - 4, CW, 8, 'F');
      pdf.line(M, y + 4, PW - M, y + 4);
      pdf.setFontSize(9); pdf.setFont(undefined, row.bold ? 'bold' : 'normal'); setColor(C.text);
      pdf.text(row.label, M + 2, y);
      pdf.setFont(undefined, 'bold');
      pdf.text(row.value, PW - M, y, { align: 'right' });
      y += 8;
    });
    y += 2;

    // ─── SECTION 4: PROJECTED REVENUE ────────────────────────────────────────
    const contractRows = d.contract_rows ?? [];
    if (contractRows.length > 0) {
      sectionHeader('Projected Revenue');
      checkPage(14);

      // Header
      setFill(C.navy);
      pdf.rect(M, y - 4, CW, 7, 'F');
      pdf.setFontSize(7); pdf.setFont(undefined, 'bold'); setColor(C.white);
      const cCols = [M + 2, M + CW * 0.28, M + CW * 0.42, M + CW * 0.56, M + CW * 0.70, M + CW * 0.83, M + CW];
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
        setFill(i % 2 === 0 ? C.bg : C.sectionBg);
        setDraw(C.border); pdf.setLineWidth(0.2);
        pdf.rect(M, y - 3, CW, 6, 'F');
        pdf.line(M, y + 3, PW - M, y + 3);

        pdf.setFontSize(8); pdf.setFont(undefined, 'normal'); setColor(C.text);
        let projName = (row.name ?? '').substring(0, 18);
        if ((row.name ?? '').length > 18) projName = projName.substring(0, 15) + '…';
        pdf.text(projName, cCols[0], y);
        pdf.text((row.type ?? '').substring(0, 10), cCols[1], y);
        pdf.text(fmt(row.value), cCols[2], y, { align: 'right' });
        pdf.text(fmt(row.invoiced), cCols[3], y, { align: 'right' });
        pdf.text(fmt(row.remaining), cCols[4], y, { align: 'right' });

        // % billed color: <50% text, 50-80% amber, >80% positive, >100% negative
        const pct = row.pctBilled ?? 0;
        const pctColor = pct > 100 ? C.negative : pct > 80 ? C.positive : pct >= 50 ? C.amber : C.text;
        setColor(pctColor); pdf.setFont(undefined, 'bold');
        pdf.text(fmtPct(pct), cCols[5], y, { align: 'right' });
        setColor(C.text); pdf.setFont(undefined, 'normal');
        pdf.text(row.endDate ? row.endDate.substring(0, 10) : '—', cCols[6], y, { align: 'right' });
        y += 6;
      });

      // Totals row
      checkPage(8);
      setFill(C.sectionBg); pdf.rect(M, y - 3, CW, 7, 'F');
      pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); setColor(C.text);
      pdf.text('Total', cCols[0], y);
      pdf.text(fmt(contractRows.reduce((s, r) => s + (r.value ?? 0), 0)), cCols[2], y, { align: 'right' });
      pdf.text(fmt(contractRows.reduce((s, r) => s + (r.invoiced ?? 0), 0)), cCols[3], y, { align: 'right' });
      pdf.text(fmt(contractRows.reduce((s, r) => s + (r.remaining ?? 0), 0)), cCols[4], y, { align: 'right' });
      y += 8;
    }

    // ─── SECTION 5: BUDGET VS ACTUAL ─────────────────────────────────────────
    const budgetRows = (d.budget_rows ?? []).slice(0, 15);
    if (budgetRows.length > 0) {
      sectionHeader('Budget vs Actual');
      checkPage(14);

      setFill(C.navy);
      pdf.rect(M, y - 4, CW, 7, 'F');
      pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); setColor(C.white);
      const bCols = [M + 2, M + CW * 0.38, M + CW * 0.55, M + CW * 0.72, M + CW];
      pdf.text('Category', bCols[0], y);
      pdf.text('Budget', bCols[1], y, { align: 'right' });
      pdf.text('YTD Actual', bCols[2], y, { align: 'right' });
      pdf.text('Variance $', bCols[3], y, { align: 'right' });
      pdf.text('Variance %', bCols[4], y, { align: 'right' });
      y += 6;

      budgetRows.forEach((row, i) => {
        checkPage(7);
        setFill(i % 2 === 0 ? C.bg : C.sectionBg);
        setDraw(C.border); pdf.setLineWidth(0.2);
        pdf.rect(M, y - 3, CW, 6, 'F');
        pdf.line(M, y + 3, PW - M, y + 3);

        pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); setColor(C.text);
        pdf.text((row.category ?? '').substring(0, 22), bCols[0], y);
        pdf.text(fmt(row.budget), bCols[1], y, { align: 'right' });
        pdf.text(fmt(row.actual), bCols[2], y, { align: 'right' });

        const isPos = (row.variance ?? 0) >= 0;
        setColor(isPos ? C.positive : C.negative);
        pdf.setFont(undefined, 'bold');
        pdf.text((isPos ? '+' : '') + fmt(row.variance), bCols[3], y, { align: 'right' });
        pdf.text((isPos ? '+' : '') + fmtPct(row.variancePct), bCols[4], y, { align: 'right' });
        setColor(C.text); pdf.setFont(undefined, 'normal');
        y += 6;
      });
      y += 2;
    }

    // ─── SECTION 6: ACCOUNTS RECEIVABLE ──────────────────────────────────────
    sectionHeader('Accounts Receivable');
    checkPage(60);

    // Summary header
    setFill(C.navy);
    pdf.rect(M, y - 4, CW, 7, 'F');
    pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); setColor(C.white);
    pdf.text('Metric', M + 2, y);
    pdf.text('Amount', PW - M, y, { align: 'right' });
    y += 6;

    const arRows = [
      { label: 'Total Outstanding', value: fmt(d.ar_outstanding), bold: true },
      { label: 'Open Invoices', value: String(d.ar_invoice_count ?? 0), bold: false },
      { label: '0–30 Days', value: fmt(d.ar_0_30), bold: false },
      { label: '31–60 Days', value: fmt(d.ar_31_60), bold: false },
      { label: '61–90 Days', value: fmt(d.ar_61_90), bold: false, warn: true },
      { label: '90+ Days', value: fmt(d.ar_90_plus), bold: false, warn: true },
    ];
    arRows.forEach((row, i) => {
      checkPage(8);
      setFill(i % 2 === 0 ? C.bg : C.sectionBg);
      setDraw(C.border); pdf.setLineWidth(0.2);
      pdf.rect(M, y - 4, CW, 8, 'F');
      pdf.line(M, y + 4, PW - M, y + 4);
      pdf.setFontSize(9); pdf.setFont(undefined, row.bold ? 'bold' : 'normal'); setColor(C.text);
      pdf.text(row.label, M + 2, y);
      const valColor = row.warn ? C.negative : C.text;
      setColor(valColor); pdf.setFont(undefined, row.bold ? 'bold' : 'normal');
      pdf.text(row.value, PW - M, y, { align: 'right' });
      y += 8;
    });

    // Top unpaid invoices sub-table
    const topUnpaid = d.top_unpaid_invoices ?? [];
    if (topUnpaid.length > 0) {
      checkPage(14);
      y += 4;
      setFill(C.navy);
      pdf.rect(M, y - 4, CW, 7, 'F');
      pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); setColor(C.white);
      pdf.text('Invoice #', M + 2, y);
      pdf.text('Customer', M + 30, y);
      pdf.text('Balance', M + CW * 0.65, y, { align: 'right' });
      pdf.text('Days Overdue', M + CW, y, { align: 'right' });
      y += 6;

      topUnpaid.slice(0, 5).forEach((inv, i) => {
        checkPage(7);
        setFill(i % 2 === 0 ? C.bg : C.sectionBg);
        setDraw(C.border); pdf.setLineWidth(0.2);
        pdf.rect(M, y - 3, CW, 6, 'F');
        pdf.line(M, y + 3, PW - M, y + 3);

        pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); setColor(C.text);
        pdf.text((inv.invoice_number ?? '—').substring(0, 12), M + 2, y);
        let cust = (inv.customer ?? '').substring(0, 26);
        if ((inv.customer ?? '').length > 26) cust = cust.substring(0, 23) + '…';
        pdf.text(cust, M + 30, y);
        pdf.setFont(undefined, 'bold');
        pdf.text(fmt(inv.open_balance), M + CW * 0.65, y, { align: 'right' });
        const od = inv.days_overdue ?? 0;
        setColor(od > 60 ? C.negative : od > 30 ? C.amber : C.text);
        pdf.setFont(undefined, od > 30 ? 'bold' : 'normal');
        pdf.text(od <= 0 ? 'Current' : `${od}d`, M + CW, y, { align: 'right' });
        setColor(C.text); pdf.setFont(undefined, 'normal');
        y += 6;
      });
    }

    // ─── FOOTER ──────────────────────────────────────────────────────────────
    drawFooter();

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