import React from "react";

const COLORS = {
  navy: "#1A1A2E",
  gold: "#C9A96E",
  bg: "#FFFFFF",
  sectionBg: "#F7F7F5",
  border: "#E8E4DC",
  text: "#1A1A1A",
  muted: "#6B7280",
  positive: "#15803D",
  negative: "#DC2626",
};

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;

const th = {
  backgroundColor: COLORS.navy,
  color: "#FFF",
  fontSize: 11,
  fontWeight: 600,
  padding: "8px 12px",
  letterSpacing: "0.04em",
  textAlign: "right",
  whiteSpace: "nowrap",
};
const thLeft = { ...th, textAlign: "left" };

function rowBg(i) {
  return i % 2 === 0 ? COLORS.bg : COLORS.sectionBg;
}

function trendArrow(current, prev, higherIsBetter = true) {
  if (current === null || prev === null) return null;
  if (current === prev) return null;
  const improved = higherIsBetter ? current > prev : current < prev;
  return improved
    ? <span style={{ color: COLORS.positive, fontSize: 10, marginLeft: 3 }}>▲</span>
    : <span style={{ color: COLORS.negative, fontSize: 10, marginLeft: 3 }}>▼</span>;
}

function grossMarginColor(v) {
  if (v === null) return COLORS.muted;
  if (v > 25) return COLORS.positive;
  if (v >= 15) return COLORS.gold;
  return COLORS.negative;
}

function netMarginColor(v) {
  if (v === null) return COLORS.muted;
  if (v > 10) return COLORS.positive;
  if (v >= 5) return COLORS.gold;
  return COLORS.negative;
}

function laborPctColor(v) {
  if (v === null) return COLORS.muted;
  if (v < 20) return COLORS.positive;
  if (v <= 30) return COLORS.gold;
  return COLORS.negative;
}

export default function PerformanceTrends({ periods, noHeader = false }) {
  if (!periods || periods.length === 0) return null;

  const maxRevenue = Math.max(...periods.map(p => p.revenue ?? 0), 1);

  const tdBase = (rowIdx) => ({
    padding: "10px 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    backgroundColor: rowBg(rowIdx),
    textAlign: "right",
    fontSize: 13,
    verticalAlign: "top",
  });

  const tdLeft = (rowIdx) => ({
    ...tdBase(rowIdx),
    textAlign: "left",
    fontWeight: 700,
    color: COLORS.text,
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.border}`, borderTop: "none", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
          <thead>
            <tr>
              <th style={{ ...thLeft, width: 140 }}>Metric</th>
              {periods.map(p => (
                <th key={p.label} style={th}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Row 0 — Revenue with bar chart */}
            <tr>
              <td style={tdLeft(0)}>Revenue</td>
              {periods.map((p, i) => {
                const barWidth = p.revenue !== null ? Math.round((p.revenue / maxRevenue) * 100) : 0;
                const arrow = trendArrow(p.revenue, periods[i - 1]?.revenue ?? null, true);
                return (
                  <td key={p.label} style={tdBase(0)}>
                    {p.revenue !== null ? (
                      <>
                        <div style={{ fontWeight: 600, color: COLORS.text }}>
                          {fmt(p.revenue)}{arrow}
                        </div>
                        <div style={{ marginTop: 5, height: 6, backgroundColor: "#E8E4DC", borderRadius: 3 }}>
                          <div style={{ width: `${barWidth}%`, height: "100%", backgroundColor: COLORS.gold, borderRadius: 3 }} />
                        </div>
                      </>
                    ) : (
                      <span style={{ color: COLORS.muted }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Row 1 — Gross Margin % */}
            <tr>
              <td style={tdLeft(1)}>Gross Margin %</td>
              {periods.map((p, i) => {
                const arrow = trendArrow(p.gross_margin, periods[i - 1]?.gross_margin ?? null, true);
                return (
                  <td key={p.label} style={tdBase(1)}>
                    {p.gross_margin !== null ? (
                      <span style={{ color: grossMarginColor(p.gross_margin), fontWeight: 700 }}>
                        {fmtPct(p.gross_margin)}{arrow}
                      </span>
                    ) : (
                      <span style={{ color: COLORS.muted }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Row 2 — Net Margin % */}
            <tr>
              <td style={tdLeft(2)}>Net Margin %</td>
              {periods.map((p, i) => {
                const arrow = trendArrow(p.net_margin, periods[i - 1]?.net_margin ?? null, true);
                return (
                  <td key={p.label} style={tdBase(2)}>
                    {p.net_margin !== null ? (
                      <span style={{ color: netMarginColor(p.net_margin), fontWeight: 700 }}>
                        {fmtPct(p.net_margin)}{arrow}
                      </span>
                    ) : (
                      <span style={{ color: COLORS.muted }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Row 3 — Labor % of Revenue */}
            <tr>
              <td style={tdLeft(3)}>Labor % of Rev</td>
              {periods.map((p, i) => {
                const arrow = trendArrow(p.labor_pct, periods[i - 1]?.labor_pct ?? null, false); // lower is better
                return (
                  <td key={p.label} style={tdBase(3)}>
                    {p.labor_pct !== null ? (
                      <span style={{ color: laborPctColor(p.labor_pct), fontWeight: 700 }}>
                        {fmtPct(p.labor_pct)}{arrow}
                      </span>
                    ) : (
                      <span style={{ color: COLORS.muted }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}