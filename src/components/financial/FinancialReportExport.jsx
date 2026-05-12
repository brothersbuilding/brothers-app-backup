import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportFinancialReport(periodLabel, onProgress) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const headerHeight = 38;

  document.body.classList.add("pdf-export-mode");

  try {
    // ── Helpers ──────────────────────────────────────────────────────────────

    function addPageHeader(title, pageNum, isFirstPage) {
      pdf.setFillColor(28, 35, 49);
      pdf.rect(0, 0, pageWidth, isFirstPage ? 48 : 38, "F");

      if (isFirstPage) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(180, 180, 180);
        pdf.text("BROTHERS BUILDING", margin, 13);

        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text("Financial Report", margin, 26);

        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(202, 159, 80);
        pdf.text(periodLabel || "", pageWidth - margin, 26, { align: "right" });

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(150, 150, 150);
        pdf.text(title, margin, 38);
        pdf.text(
          `Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
          pageWidth - margin, 38, { align: "right" }
        );
      } else {
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text(title, margin, 24);

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(202, 159, 80);
        pdf.text(periodLabel || "", pageWidth - margin, 24, { align: "right" });

        if (pageNum) {
          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          pdf.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 5, { align: "right" });
        }
      }

      pdf.setTextColor(0, 0, 0);
    }

    async function prepElement(elementId) {
      const el = document.getElementById(elementId);
      if (!el) return null;
      const original = { maxHeight: el.style.maxHeight, overflow: el.style.overflow, height: el.style.height };
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
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", xOffset, headerHeight, finalWidth, finalHeight);
    }

    // ── PAGE 1: Executive Summary (KPIs + Snapshots + Charts) ────────────────
    onProgress?.("Capturing summary…");

    const kpiCanvas = await html2canvas(document.getElementById("pdf-kpi-cards"), {
      scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 900, logging: false,
    });
    const snapshotCanvas = await html2canvas(document.getElementById("pdf-snapshot-tables"), {
      scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 900, logging: false,
    });
    const chartsCanvas = await html2canvas(document.getElementById("pdf-trend-charts"), {
      scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 900, logging: false,
    });

    addPageHeader("Executive Summary", 1, true);

    const availW = pageWidth - margin * 2;
    const availH = pageHeight - 52 - margin;

    const kpiH = (kpiCanvas.height / kpiCanvas.width) * availW;
    const snapH = (snapshotCanvas.height / snapshotCanvas.width) * availW;
    const chartH = (chartsCanvas.height / chartsCanvas.width) * availW;
    const totalNaturalH = kpiH + snapH + chartH + 8;

    const scale = totalNaturalH > availH ? availH / totalNaturalH : 1;
    const scaledW = availW * scale;
    const xOff = margin + (availW - scaledW) / 2;
    let y = 52;

    pdf.addImage(kpiCanvas.toDataURL("image/png"), "PNG", xOff, y, scaledW, kpiH * scale);
    y += kpiH * scale + 3;
    pdf.addImage(snapshotCanvas.toDataURL("image/png"), "PNG", xOff, y, scaledW, snapH * scale);
    y += snapH * scale + 3;
    pdf.addImage(chartsCanvas.toDataURL("image/png"), "PNG", xOff, y, scaledW, chartH * scale);

    // ── PAGE 2: Projected Revenue ─────────────────────────────────────────────
    onProgress?.("Capturing projected revenue…");
    await addScaledSection("pdf-projected-revenue", "Projected Revenue", 2);

    // ── PAGE 3: Profit & Loss ─────────────────────────────────────────────────
    onProgress?.("Capturing P&L…");
    await addScaledSection("pdf-pl-table", "Profit & Loss", 3);

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