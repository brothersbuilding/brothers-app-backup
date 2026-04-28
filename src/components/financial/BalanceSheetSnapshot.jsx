import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle } from "lucide-react";

const ASSETS = [
  { label: "Cash & Cash Equivalents", value: "—" },
  { label: "Accounts Receivable", value: "See AR section" },
  { label: "Inventory / Materials", value: "—" },
  { label: "Equipment & Fixed Assets", value: "—" },
  { label: "Other Assets", value: "—" },
];

const LIABILITIES = [
  { label: "Accounts Payable", value: "—" },
  { label: "Short-Term Debt", value: "—" },
  { label: "Long-Term Liabilities", value: "—" },
];

const EQUITY = [
  { label: "Owner's Equity", value: "—" },
  { label: "Retained Earnings", value: "—" },
];

function Section({ title, rows, color }) {
  return (
    <>
      <TableRow>
        <TableCell colSpan={2} className={`text-xs font-bold uppercase tracking-wide pt-4 pb-1 ${color}`}>{title}</TableCell>
      </TableRow>
      {rows.map(r => (
        <TableRow key={r.label} className="hover:bg-muted/20">
          <TableCell className="text-sm pl-6">{r.label}</TableCell>
          <TableCell className="text-sm text-right text-muted-foreground">{r.value}</TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function BalanceSheetSnapshot() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Balance Sheet Snapshot</h2>
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Placeholder data shown below. This section will populate automatically once the QuickBooks API direct balance sheet access is approved.</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Line Item</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <Section title="Assets" rows={ASSETS} color="text-green-700" />
            <Section title="Liabilities" rows={LIABILITIES} color="text-red-600" />
            <Section title="Equity" rows={EQUITY} color="text-blue-600" />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}