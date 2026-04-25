import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { parseISO, format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export default function CompletedChecks() {
  const [sortColumn, setSortColumn] = useState("vendor");
  const [sortDirection, setSortDirection] = useState("asc");
  const [checksPerPage, setChecksPerPage] = useState(10);
  const [checksPage, setChecksPage] = useState(0);

  const { data: checks = [] } = useQuery({
    queryKey: ["outstanding-checks"],
    queryFn: () => base44.entities.OutstandingCheck.list("-updated_date", 100),
  });

  const completedChecks = checks.filter(check => check.completed);

  const sortedChecks = [...completedChecks].sort((a, b) => {
    let aVal, bVal;
    
    if (sortColumn === "amount" || sortColumn === "retention") {
      aVal = parseFloat(a[sortColumn] || 0);
      bVal = parseFloat(b[sortColumn] || 0);
    } else if (sortColumn === "issue_date") {
      aVal = a[sortColumn] ? new Date(a[sortColumn]).getTime() : 0;
      bVal = b[sortColumn] ? new Date(b[sortColumn]).getTime() : 0;
    } else {
      aVal = (a[sortColumn] || "").toString().toLowerCase();
      bVal = (b[sortColumn] || "").toString().toLowerCase();
    }
    
    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-y-auto overflow-x-hidden max-h-96">
        {completedChecks.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">No completed checks.</div>
        ) : (
          <>
            <Table className="table-auto w-full text-xs md:text-sm">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="cursor-pointer hover:bg-muted p-1 md:p-2" onClick={() => handleSort("vendor")}>Vendor {sortColumn === "vendor" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted p-1 md:p-2" onClick={() => handleSort("amount")}>Amount {sortColumn === "amount" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("retention")}>Retention {sortColumn === "retention" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("method")}>Method {sortColumn === "method" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("invoice")}>Invoice {sortColumn === "invoice" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("issue_date")}>Issue Date {sortColumn === "issue_date" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedChecks.slice(checksPage * checksPerPage, (checksPage + 1) * checksPerPage).map((check) => (
                  <TableRow key={check.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium p-1 md:p-2">{check.vendor}</TableCell>
                    <TableCell className="text-right p-1 md:p-2">{formatCurrency(check.amount)}</TableCell>
                    <TableCell className="text-right text-sm hidden md:table-cell">{formatCurrency(check.retention)}</TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{check.method}</TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{check.invoice || "—"}</TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{check.issue_date ? format(parseISO(check.issue_date), "MM/dd/yy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50">
                  <TableCell className="font-semibold text-sm">Totals</TableCell>
                  <TableCell className="text-right font-semibold text-sm">{formatCurrency(completedChecks.reduce((sum, check) => sum + parseFloat(check.amount || 0), 0))}</TableCell>
                  <TableCell className="text-right font-semibold text-sm hidden md:table-cell">{formatCurrency(completedChecks.reduce((sum, check) => sum + parseFloat(check.retention || 0), 0))}</TableCell>
                  <TableCell colSpan="3"></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-background text-sm">
              <span className="text-muted-foreground">Rows per page:</span>
              {[5, 10, 20, 50, "All"].map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setChecksPerPage(option === "All" ? completedChecks.length : option);
                    setChecksPage(0);
                  }}
                  className={`h-7 px-2 rounded text-xs transition-colors ${
                    checksPerPage === (option === "All" ? completedChecks.length : option)
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-accent"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}