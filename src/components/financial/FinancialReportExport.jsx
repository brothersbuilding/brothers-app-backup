import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportFinancialReport(periodLabel) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  async function addSection(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return null;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const maxHeight = pageHeight - margin * 2 - 20;
    const finalHeight = imgHeight > maxHeight ? maxHeight : imgHeight;
    const finalWidth = imgHeight > maxHeight ? (imgWidth * maxHeight) / imgHeight : imgWidth;
    return { imgData, finalWidth, finalHeight };
  }

  // ── PAGE 1: KPI Cards + Snapshots + Trend Charts ──
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("Financial Report", margin, margin + 8);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 100, 100);
  pdf.text(periodLabel || "", margin, margin + 15);
  pdf.text(
    `Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    pageWidth - margin,
    margin + 15,
    { align: "right" }
  );
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, margin + 18, pageWidth - margin, margin + 18);

  let currentY = margin + 22;

  const kpiResult = await addSection("pdf-kpi-cards");
  if (kpiResult) {
    pdf.addImage(kpiResult.imgData, "PNG", margin, currentY, kpiResult.finalWidth, kpiResult.finalHeight);
    currentY += kpiResult.finalHeight + 6;
  }

  const snapshotResult = await addSection("pdf-snapshot-tables");
  if (snapshotResult) {
    if (currentY + snapshotResult.finalHeight > pageHeight - margin) {
      pdf.addPage();
      currentY = margin;
    }
    pdf.addImage(snapshotResult.imgData, "PNG", margin, currentY, snapshotResult.finalWidth, snapshotResult.finalHeight);
    currentY += snapshotResult.finalHeight + 6;
  }

  const chartsResult = await addSection("pdf-trend-charts");
  if (chartsResult) {
    if (currentY + chartsResult.finalHeight > pageHeight - margin) {
      pdf.addPage();
      currentY = margin;
    }
    pdf.addImage(chartsResult.imgData, "PNG", margin, currentY, chartsResult.finalWidth, chartsResult.finalHeight);
  }

  // ── PAGE 2: Projected Revenue Table ──
  pdf.addPage();
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("Projected Revenue", margin, margin + 8);
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, margin + 11, pageWidth - margin, margin + 11);

  const projResult = await addSection("pdf-projected-revenue");
  if (projResult) {
    pdf.addImage(projResult.imgData, "PNG", margin, margin + 15, projResult.finalWidth, projResult.finalHeight);
  }

  // ── PAGE 3: P&L Table ──
  pdf.addPage();
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("Profit & Loss", margin, margin + 8);
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, margin + 11, pageWidth - margin, margin + 11);

  const plResult = await addSection("pdf-pl-table");
  if (plResult) {
    pdf.addImage(plResult.imgData, "PNG", margin, margin + 15, plResult.finalWidth, plResult.finalHeight);
  }

  const filename = `financial-report-${(periodLabel || "export").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
  pdf.save(filename);
}

export function ExportPDFButton({ periodLabel }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportFinancialReport(periodLabel);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
    >
      {exporting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating PDF…
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Export PDF
        </>
      )}
    </button>
  );
}