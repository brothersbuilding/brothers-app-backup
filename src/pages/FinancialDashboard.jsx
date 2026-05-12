import React, { useState } from "react";
import PLImportSection from "@/components/financial/PLImportSection";
import PLViewSection from "@/components/financial/PLViewSection";
import PLKPICards from "@/components/financial/PLKPICards";
import ProjectedRevenueSection from "@/components/financial/ProjectedRevenueSection";
import { ExportPDFButton } from "@/components/financial/FinancialReportExport";
import FinancialReportViewer from "@/components/financial/FinancialReportViewer";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";

function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="font-semibold text-base font-barlow uppercase tracking-wider">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

export default function FinancialDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [periodLabel, setPeriodLabel] = useState("");
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportData, setReportData] = useState({});

  return (
    <div className="min-h-screen bg-background p-6 space-y-4 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-barlow uppercase tracking-wider">Financial Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Import and review QuickBooks Profit & Loss statements</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReportViewerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Eye className="w-4 h-4" />
            View Report
          </button>
          <ExportPDFButton periodLabel={periodLabel} />
        </div>
      </div>

      <PLKPICards refreshKey={refreshKey} onPeriodChange={setPeriodLabel} onDataChange={setReportData} />

      <ProjectedRevenueSection />

      <CollapsibleSection title="Profit & Loss" defaultOpen={true}>
        <PLViewSection refreshKey={refreshKey} />
      </CollapsibleSection>

      <CollapsibleSection title="Import Financial Statements" defaultOpen={false}>
        <PLImportSection onImported={() => setRefreshKey((k) => k + 1)} />
      </CollapsibleSection>

      <FinancialReportViewer
        open={reportViewerOpen}
        onClose={() => setReportViewerOpen(false)}
        periodLabel={periodLabel}
        viewMode={reportData.viewMode}
        effectiveMonth={reportData.effectiveMonth}
        effectiveQuarter={reportData.effectiveQuarter}
        effectiveQuarterYear={reportData.effectiveQuarterYear}
        effectiveYear={reportData.effectiveYear}
        allEntries={reportData.allEntries || []}
        projects={reportData.projects || []}
        billings={reportData.billings || []}
        labelTotals={reportData.labelTotals || {}}
        scopedMonthKeys={reportData.scopedMonthKeys || []}
        trendData={reportData.trendData || []}
      />
    </div>
  );
}