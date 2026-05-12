import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportFinancialReport(periodLabel, onProgress) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageMargin = 10;
  const headerH = 52;
  const availW = pageWidth - pageMargin * 2;
  const availH = pageHeight - headerH - pageMargin;

  document.body.classList.add("pdf-export-mode");

  try {
    // ── Page 1 navy header ───────────────────────────────────────────────────
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

    // ── FIX 1: Capture helper returning raw pixel dimensions ─────────────────
    async function captureEl(id) {
      const el = document.getElementById(id);
      if (!el) return null;
      const c = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 900,
        logging: false,
      });
      return { img: c.toDataURL("image/png"), w: c.width, h: c.height };
    }

    // ── FIX 2: Unified sliced section (replaces addScaledSection + addFlowingSection) ──
    async function addSlicedSection(elementId, sectionTitle) {
      const el = document.getElementById(elementId);
      if (!el) return;

      const prev = {
        maxHeight: el.style.maxHeight,
        overflow: el.style.overflow,
        height: el.style.height,
      };
      el.style.maxHeight = "none";
      el.style.overflow = "visible";
      el.style.height = "auto";

      await new Promise(r => setTimeout(r, 100));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 900,
        logging: false,
      });

      el.style.maxHeight = prev.maxHeight;
      el.style.overflow = prev.overflow;
      el.style.height = prev.height;

      const contentW = pageWidth - pageMargin * 2;
      const mmPerPx = contentW / canvas.width;

      const firstPageAvailH = pageHeight - pageMargin - 18;
      const otherPageAvailH = pageHeight - pageMargin * 2;
      const firstPagePx = Math.floor(firstPageAvailH / mmPerPx);
      const otherPagePx = Math.floor(otherPageAvailH / mmPerPx);

      let srcY = 0;
      let isFirst = true;

      while (srcY < canvas.height) {
        pdf.addPage();

        if (isFirst) {
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(28, 35, 49);
          pdf.text(sectionTitle, pageMargin, pageMargin + 3);

          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(202, 159, 80);
          pdf.text(periodLabel || "", pageWidth - pageMargin, pageMargin + 3, { align: "right" });

          pdf.setDrawColor(220, 220, 220);
          pdf.setLineWidth(0.3);
          pdf.line(pageMargin, pageMargin + 6, pageWidth - pageMargin, pageMargin + 6);
          pdf.setTextColor(0, 0, 0);
        }

        const slicePx = isFirst ? firstPagePx : otherPagePx;
        const actualPx = Math.min(slicePx, canvas.height - srcY);

        const sc = document.createElement("canvas");
        sc.width = canvas.width;
        sc.height = actualPx;
        const ctx = sc.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sc.width, sc.height);
        ctx.drawImage(canvas, 0, -srcY);

        const sliceHmm = actualPx * mmPerPx;
        const destY = isFirst ? pageMargin + 8 : pageMargin;

        pdf.addImage(sc.toDataURL("image/png"), "PNG", pageMargin, destY, contentW, sliceHmm);

        srcY += actualPx;
        isFirst = false;
      }
    }

    // ── PAGE 1: Executive Summary ────────────────────────────────────────────
    onProgress?.("Capturing summary…");
    const kpi = await captureEl("pdf-kpi-cards");
    const snap = await captureEl("pdf-snapshot-tables");

    onProgress?.("Capturing charts…");
    const charts = await captureEl("pdf-trend-charts");

    addPage1Header();

    if (kpi && snap && charts) {
      const gap = 3;

      const kpiH = (kpi.h / kpi.w) * availW;
      const snapH = (snap.h / snap.w) * availW;
      const chartH = (charts.h / charts.w) * availW;
      const totalH = kpiH + snapH + chartH + gap * 2;

      const sf = totalH > availH ? availH / totalH : 1;
      const fw = availW * sf;
      const xo = pageMargin + (availW - fw) / 2;
      let y = headerH + 2;

      pdf.addImage(kpi.img, "PNG", xo, y, fw, kpiH * sf);
      y += kpiH * sf + gap;

      pdf.addImage(snap.img, "PNG", xo, y, fw, snapH * sf);
      y += snapH * sf + gap;

      pdf.addImage(charts.img, "PNG", xo, y, fw, chartH * sf);
    }

    // ── PAGE 2: Projected Revenue (sliced) ───────────────────────────────────
    onProgress?.("Capturing projected revenue…");
    await addSlicedSection("pdf-projected-revenue", "Projected Revenue");

    // ── PAGE 3+: Profit & Loss (sliced, multi-page) ──────────────────────────
    onProgress?.("Capturing P&L…");
    await addSlicedSection("pdf-pl-table", "Profit & Loss");

    // ── Save ─────────────────────────────────────────────────────────────────
    const filename = `financial-report-${(periodLabel || "export").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(filename);
  } finally {
    document.body.classList.remove("pdf-export-mode");
  }
}

export function ExportPDFButton({ periodLabel, onBeforeExport, onAfterExport }) {
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setExportStep("Preparing…");
    try {
      await onBeforeExport?.();
      await exportFinancialReport(periodLabel, setExportStep);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + err.message);
    } finally {
      await onAfterExport?.();
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