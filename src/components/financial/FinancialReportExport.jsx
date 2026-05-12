import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

async function captureElement(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return null;
  const canvas = await html2canvas(el, {
    scale: 3,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: 1400,
  });
  return canvas;
}

export async function exportFinancialReport(periodLabel, onProgress) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const headerHeight = 38;
  const contentY = headerHeight + 6;
  const maxContentHeight = pageHeight - contentY - margin;

  // Enable PDF export mode for cleaner screenshots
  document.body.classList.add("pdf-export-mode");

  try {
    // ── Helpers ──────────────────────────────────────────────────────────────

    function addPageHeader(title, pageNum) {
      pdf.setFillColor(28, 35, 49);
      pdf.rect(0, 0, pageWidth, headerHeight, "F");

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(title, margin, 24);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(202, 159, 80);
      pdf.text(periodLabel || "", pageWidth - margin, 24, { align: "right" });

      if (pageNum != null) {
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 4, { align: "right" });
      }

      pdf.setTextColor(0, 0, 0);
    }

    function addCoverPage() {
      pdf.setFillColor(28, 35, 49);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      pdf.setDrawColor(202, 159, 80);
      pdf.setLineWidth(0.8);
      pdf.line(margin, pageHeight * 0.35, pageWidth - margin, pageHeight * 0.35);

      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("Brothers Building", pageWidth / 2, pageHeight * 0.28, { align: "center" });

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(200, 200, 200);
      pdf.text("Financial Report", pageWidth / 2, pageHeight * 0.42, { align: "center" });

      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(202, 159, 80);
      pdf.text(periodLabel || "", pageWidth / 2, pageHeight * 0.52, { align: "center" });

      pdf.setDrawColor(202, 159, 80);
      pdf.line(margin, pageHeight * 0.75, pageWidth - margin, pageHeight * 0.75);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
        pageWidth / 2,
        pageHeight * 0.82,
        { align: "center" }
      );
    }

    // Adds a normal-height section; scales down if needed to fit on one page
    function placeCanvas(canvas, startY) {
      const imgWidthMM = contentWidth;
      const imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;
      const availH = pageHeight - startY - margin;
      let finalW = imgWidthMM;
      let finalH = imgHeightMM;
      if (finalH > availH) {
        const scale = availH / finalH;
        finalW = imgWidthMM * scale;
        finalH = availH;
      }
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, startY, finalW, finalH);
      return finalH;
    }

    async function prepElement(elementId) {
      const el = document.getElementById(elementId);
      if (!el) return null;
      const original = {
        maxHeight: el.style.maxHeight,
        overflow: el.style.overflow,
        height: el.style.height,
      };
      el.style.maxHeight = "none";
      el.style.overflow = "visible";
      el.style.height = "auto";
      return () => {
        el.style.maxHeight = original.maxHeight;
        el.style.overflow = original.overflow;
        el.style.height = original.height;
      };
    }

    async function addScaledSection(elementId, sectionTitle, pageNum) {
      const el = document.getElementById(elementId);
      if (!el) return;

      pdf.addPage();
      addPageHeader(sectionTitle, pageNum);

      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - headerHeight - margin;

      const restore = await prepElement(elementId);
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 1400,
        logging: false,
      });
      restore?.();

      const canvasAspect = canvas.height / canvas.width;
      let finalWidth = availableWidth;
      let finalHeight = availableWidth * canvasAspect;

      if (finalHeight > availableHeight) {
        finalHeight = availableHeight;
        finalWidth = availableHeight / canvasAspect;
      }

      const xOffset = margin + (availableWidth - finalWidth) / 2;
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", xOffset, headerHeight, finalWidth, finalHeight);
    }

    // ── PAGE 1: Cover ─────────────────────────────────────────────────────────
    addCoverPage();

    // ── PAGE 2: Executive Summary ─────────────────────────────────────────────
    onProgress?.("Capturing summary…");
    const kpiCanvas = await captureElement("pdf-kpi-cards");
    const snapshotCanvas = await captureElement("pdf-snapshot-tables");

    pdf.addPage();
    let pageNum = 2;
    addPageHeader("Executive Summary", pageNum);

    let currentY = contentY;
    if (kpiCanvas) {
      const h = placeCanvas(kpiCanvas, currentY);
      currentY += h + 5;
    }
    if (snapshotCanvas) {
      if (currentY + 30 > pageHeight - margin) {
        pdf.addPage();
        pageNum++;
        addPageHeader("Executive Summary (continued)", pageNum);
        currentY = contentY;
      }
      placeCanvas(snapshotCanvas, currentY);
    }

    // ── PAGE 3: Trend Analysis ────────────────────────────────────────────────
    onProgress?.("Capturing charts…");
    const chartsCanvas = await captureElement("pdf-trend-charts");

    pdf.addPage();
    pageNum++;
    addPageHeader("Trend Analysis", pageNum);
    if (chartsCanvas) {
      placeCanvas(chartsCanvas, contentY);
    }

    // ── PAGE 4: Projected Revenue ─────────────────────────────────────────────
    onProgress?.("Capturing projected revenue…");
    pageNum++;
    await addScaledSection("pdf-projected-revenue", "Projected Revenue", pageNum);

    // ── PAGE 5: Profit & Loss ─────────────────────────────────────────────────
    onProgress?.("Capturing P&L…");
    pageNum++;
    await addScaledSection("pdf-pl-table", "Profit & Loss", pageNum);

    // ── Save ──────────────────────────────────────────────────────────────────
    const filename = `financial-report-${(periodLabel || "export").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(filename);
  } finally {
    document.body.classList.remove("pdf-export-mode");
  }
}

export function ExportPDFButton({ periodLabel }) {
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setExportStep("Preparing…");
    try {
      await exportFinancialReport(periodLabel, setExportStep);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
      setExportStep("");
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
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span className="text-muted-foreground">{exportStep}</span>
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