import React, { useState } from "react";
import PLImportSection from "@/components/financial/PLImportSection";
import PLViewSection from "@/components/financial/PLViewSection";
import PLKPICards from "@/components/financial/PLKPICards";
import ProjectedRevenueSection from "@/components/financial/ProjectedRevenueSection";
import { ExportPDFButton } from "@/components/financial/FinancialReportExport";
import FinancialReportViewer from "@/components/financial/FinancialReportViewer";
import FinancialReportEmail from "@/components/financial/FinancialReportEmail";
import { ChevronDown, ChevronRight, Eye, Mail } from "lucide-react";

function CollapsibleSection({ title, defaultOpen = false, forceOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen || open;
  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="font-semibold text-base font-barlow uppercase tracking-wider">{title}</span>
        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && <div className="border-t">{children}</div>}
    </div>
  );
}

export default function FinancialDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [periodLabel, setPeriodLabel] = useState("");
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [reportData, setReportData] = useState({});
  const [exportMode, setExportMode] = useState(false);

  const handleBeforeExport = async () => {
    setExportMode(true);
    // Wait for collapsible sections to render open
    await new Promise(r => setTimeout(r, 500));
  };

  const handleAfterExport = async () => {
    setExportMode(false);
  };

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
          <button
            onClick={() => setEmailModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            <Mail className="w-4 h-4" />
            Email Report
          </button>
          <ExportPDFButton
            periodLabel={periodLabel}
            onBeforeExport={handleBeforeExport}
            onAfterExport={handleAfterExport}
          />
        </div>
      </div>

      <PLKPICards refreshKey={refreshKey} onPeriodChange={setPeriodLabel} onDataChange={setReportData} />

      <ProjectedRevenueSection />

      <CollapsibleSection title="Profit & Loss" defaultOpen={true} forceOpen={exportMode}>
        <PLViewSection refreshKey={refreshKey} />
      </CollapsibleSection>

      <CollapsibleSection title="Import Financial Statements" defaultOpen={false}>
        <PLImportSection onImported={() => setRefreshKey((k) => k + 1)} />
      </CollapsibleSection>

      <FinancialReportEmail
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        periodLabel={periodLabel}
        allEntries={reportData.allEntries || []}
        projects={reportData.projects || []}
        billings={reportData.billings || []}
        viewMode={reportData.viewMode}
        effectiveMonth={reportData.effectiveMonth}
        effectiveQuarter={reportData.effectiveQuarter}
        effectiveQuarterYear={reportData.effectiveQuarterYear}
        effectiveYear={reportData.effectiveYear}
      />

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