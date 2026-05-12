import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportFinancialReport(periodLabel, onProgress) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageMargin = 10;

  document.body.classList.add("pdf-export-mode");

  try {
    // ── Page 1 header ────────────────────────────────────────────────────────
    function addPage1Header() {
      pdf.setFillColor(28, 35, 49);
      pdf.rect(0, 0, pageWidth, 48, "F");

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(180, 180, 180);
      pdf.text("BROTHERS BUILDING", pageMargin, 13);

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("Financial Report", pageMargin, 26);

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(202, 159, 80);
      pdf.text(periodLabel || "", pageWidth - pageMargin, 26, { align: "right" });

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
        pageWidth - pageMargin, 38, { align: "right" }
      );

      pdf.setTextColor(0, 0, 0);
    }

    // ── Minimal section label (no navy bar) ──────────────────────────────────
    function addMinimalLabel(sectionTitle) {
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(28, 35, 49);
      pdf.text(sectionTitle, pageMargin, 10);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(202, 159, 80);
      pdf.text(periodLabel || "", pageWidth - pageMargin, 10, { align: "right" });

      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(220, 220, 220);
      pdf.line(pageMargin, 13, pageWidth - pageMargin, 13);
    }

    // ── FIX 1: Capture helper ────────────────────────────────────────────────
    const headerH = 52;
    const availW = pageWidth - pageMargin * 2;
    const availH = pageHeight - headerH - pageMargin;

    async function captureElement(id) {
      const el = document.getElementById(id);
      if (!el) return null;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 900,
        logging: false,
      });
      const naturalH = (canvas.height / canvas.width) * availW;
      return { imgData: canvas.toDataURL("image/png"), naturalH };
    }

    // ── FIX 3: Projected Revenue — scaled section with minimal label ─────────
    async function addScaledSection(elementId, sectionTitle) {
      const el = document.getElementById(elementId);
      if (!el) return;

      const origMaxH = el.style.maxHeight;
      const origOverflow = el.style.overflow;
      el.style.maxHeight = "none";
      el.style.overflow = "visible";

      pdf.addPage();
      addMinimalLabel(sectionTitle);

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 900,
        logging: false,
      });

      el.style.maxHeight = origMaxH;
      el.style.overflow = origOverflow;

      const sectionAvailW = pageWidth - pageMargin * 2;
      const sectionAvailH = pageHeight - 16 - pageMargin;
      const canvasAspect = canvas.height / canvas.width;

      let finalW = sectionAvailW;
      let finalH = sectionAvailW * canvasAspect;

      if (finalH > sectionAvailH) {
        finalH = sectionAvailH;
        finalW = sectionAvailH / canvasAspect;
      }

      const xOff = pageMargin + (sectionAvailW - finalW) / 2;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", xOff, 15, finalW, finalH);
    }

    // ── FIX 2: P&L — flowing multi-page section with minimal first label ─────
    async function addFlowingSection(elementId, sectionTitle) {
      const el = document.getElementById(elementId);
      if (!el) return;

      const origMaxH = el.style.maxHeight;
      const origOverflow = el.style.overflow;
      el.style.maxHeight = "none";
      el.style.overflow = "visible";

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 900,
        logging: false,
      });

      el.style.maxHeight = origMaxH;
      el.style.overflow = origOverflow;

      const imgW = pageWidth - pageMargin * 2;
      const pxPerMM = canvas.width / imgW;
      const firstPageContentH = pageHeight - 24 - pageMargin;
      const fullPageContentH = pageHeight - pageMargin * 2;
      const firstPagePx = firstPageContentH * pxPerMM;
      const fullPagePx = fullPageContentH * pxPerMM;

      pdf.addPage();
      addMinimalLabel(sectionTitle);

      let srcOffsetY = 0;
      let isFirstSlice = true;

      while (srcOffsetY < canvas.height) {
        const slicePx = isFirstSlice ? firstPagePx : fullPagePx;
        const actualSlicePx = Math.min(slicePx, canvas.height - srcOffsetY);

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = actualSlicePx;
        const ctx = sliceCanvas.getContext("2d");
        ctx.drawImage(canvas, 0, -srcOffsetY);

        const sliceData = sliceCanvas.toDataURL("image/png");
        const sliceHmm = actualSlicePx / pxPerMM;
        const destY = isFirstSlice ? 15 : pageMargin;

        pdf.addImage(sliceData, "PNG", pageMargin, destY, imgW, sliceHmm);

        srcOffsetY += actualSlicePx;

        if (srcOffsetY < canvas.height) {
          pdf.addPage();
          isFirstSlice = false;
        }
      }
    }

    // ── PAGE 1: Executive Summary ────────────────────────────────────────────
    onProgress?.("Capturing summary…");
    const kpiCapture = await captureElement("pdf-kpi-cards");
    const snapCapture = await captureElement("pdf-snapshot-tables");

    onProgress?.("Capturing charts…");
    const chartCapture = await captureElement("pdf-trend-charts");

    addPage1Header();

    const gap = 4;
    const totalH =
      (kpiCapture?.naturalH || 0) +
      (snapCapture?.naturalH || 0) +
      (chartCapture?.naturalH || 0) +
      gap * 2;

    const scaleFactor = totalH > availH ? availH / totalH : 1;
    const finalW = availW * scaleFactor;
    const xOff = pageMargin + (availW - finalW) / 2;
    let currentY = headerH + 2;

    if (kpiCapture) {
      const h = kpiCapture.naturalH * scaleFactor;
      pdf.addImage(kpiCapture.imgData, "PNG", xOff, currentY, finalW, h);
      currentY += h + gap;
    }

    if (snapCapture) {
      const h = snapCapture.naturalH * scaleFactor;
      pdf.addImage(snapCapture.imgData, "PNG", xOff, currentY, finalW, h);
      currentY += h + gap;
    }

    if (chartCapture) {
      const h = chartCapture.naturalH * scaleFactor;
      pdf.addImage(chartCapture.imgData, "PNG", xOff, currentY, finalW, h);
    }

    // ── PAGE 2: Projected Revenue ────────────────────────────────────────────
    onProgress?.("Capturing projected revenue…");
    await addScaledSection("pdf-projected-revenue", "Projected Revenue");

    // ── PAGE 3+: Profit & Loss (flowing, multi-page) ─────────────────────────
    onProgress?.("Capturing P&L…");
    await addFlowingSection("pdf-pl-table", "Profit & Loss");

    // ── Save ─────────────────────────────────────────────────────────────────
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