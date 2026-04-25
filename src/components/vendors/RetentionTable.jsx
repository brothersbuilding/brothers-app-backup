import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function RetentionTable() {
  const [sortColumn, setSortColumn] = useState("vendor");
  const [sortDirection, setSortDirection] = useState("asc");

  const { data: checks = [] } = useQuery({
    queryKey: ["outstanding-checks"],
    queryFn: () => base44.entities.OutstandingCheck.list("-updated_date", 100),
  });

  const retentionChecks = checks.filter(check => check.approved && check.retention > 0);

  const sortedChecks = [...retentionChecks].sort((a, b) => {
    let aVal, bVal;
    
    if (sortColumn === "retention") {
      aVal = parseFloat(a.retention || 0);
      bVal = parseFloat(b.retention || 0);
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
        {retentionChecks.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">No retention amounts.</div>
        ) : (
          <>
            <Table className="table-auto w-full text-xs md:text-sm">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="cursor-pointer hover:bg-muted p-1 md:p-2" onClick={() => handleSort("vendor")}>Vendor {sortColumn === "vendor" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted p-1 md:p-2" onClick={() => handleSort("retention")}>Amt {sortColumn === "retention" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted p-1 md:p-2" onClick={() => handleSort("invoice")}>Invoice {sortColumn === "invoice" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("project")}>Project {sortColumn === "project" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedChecks.map((check) => (
                  <TableRow key={check.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium p-1 md:p-2">{check.vendor}</TableCell>
                    <TableCell className="text-right p-1 md:p-2">{formatCurrency(check.retention)}</TableCell>
                    <TableCell className="text-sm p-1 md:p-2">{check.invoice || "—"}</TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{check.project || "—"}</TableCell>
                    <TableCell className="text-right p-1 md:p-2 space-x-1 flex justify-end gap-0.5">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 md:h-7 md:w-7"
                      >
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-background text-sm">
              <span className="text-muted-foreground">Total Retention:</span>
              <span className="font-semibold">{formatCurrency(retentionChecks.reduce((sum, check) => sum + parseFloat(check.retention || 0), 0))}</span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}