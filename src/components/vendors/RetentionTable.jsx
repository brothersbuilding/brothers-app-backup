import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function RetentionTable() {
  const queryClient = useQueryClient();
  const [sortColumn, setSortColumn] = useState("vendor");
  const [sortDirection, setSortDirection] = useState("asc");
  const [vendorFilter, setVendorFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [checksPerPage, setChecksPerPage] = useState(5);
  const [checksPage, setChecksPage] = useState(0);

  const { data: checks = [] } = useQuery({
    queryKey: ["outstanding-checks"],
    queryFn: () => base44.entities.OutstandingCheck.list("-updated_date", 100),
  });

  const createCheckMutation = useMutation({
    mutationFn: (data) => base44.entities.OutstandingCheck.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outstanding-checks"] });
    },
  });

  const allRetentionChecks = checks.filter(check => check.approved && check.retention > 0);
  
  const retentionChecks = allRetentionChecks.filter(check => {
    const vendorMatch = !vendorFilter || check.vendor === vendorFilter;
    const projectMatch = !projectFilter || check.project === projectFilter;
    return vendorMatch && projectMatch;
  });

  const uniqueVendors = Array.from(new Set(allRetentionChecks.map(c => c.vendor).filter(Boolean)));
  const uniqueProjects = Array.from(new Set(allRetentionChecks.map(c => c.project).filter(Boolean)));

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

  const handleCreateCheck = (retention) => {
    createCheckMutation.mutate({
      vendor: retention.vendor,
      amount: retention.retention,
      method: "",
      project: retention.project || "",
      retention: 0,
      approved: false,
    });
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-6 mb-4">
        <h2 className="text-xl font-semibold">Retention</h2>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vendor-filter" className="text-xs">Filter by Vendor</Label>
            <Popover open={vendorDropdownOpen} onOpenChange={setVendorDropdownOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-40 justify-between"
                  id="vendor-filter"
                >
                  <span className="truncate">{vendorFilter || "All Vendors"}</span>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-0">
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVendorFilter("");
                      setVendorDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                  >
                    All Vendors
                  </button>
                  {uniqueVendors.map((vendor) => (
                    <button
                      key={vendor}
                      type="button"
                      onClick={() => {
                        setVendorFilter(vendor);
                        setVendorDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    >
                      {vendor}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-filter" className="text-xs">Filter by Project</Label>
            <Popover open={projectDropdownOpen} onOpenChange={setProjectDropdownOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-40 justify-between"
                  id="project-filter"
                >
                  <span className="truncate">{projectFilter || "All Projects"}</span>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-0">
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProjectFilter("");
                      setProjectDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                  >
                    All Projects
                  </button>
                  {uniqueProjects.map((project) => (
                    <button
                      key={project}
                      type="button"
                      onClick={() => {
                        setProjectFilter(project);
                        setProjectDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    >
                      {project}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {retentionChecks.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">No retention amounts for selected filters.</div>
        ) : (
          <>
        <div className="overflow-y-auto overflow-x-hidden max-h-96">
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
                {sortedChecks.slice(checksPage * checksPerPage, (checksPage + 1) * checksPerPage).map((check) => (
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
                        onClick={() => handleCreateCheck(check)}
                        title="Create check from retention"
                      >
                        <span className="text-xs font-semibold">R</span>
                      </Button>
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
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/50 text-sm">
          <div className="font-semibold">
            Total: {formatCurrency(retentionChecks.reduce((sum, check) => sum + parseFloat(check.retention || 0), 0))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows per page:</span>
            {[5, 10, 20, 50, "All"].map((option) => (
              <Button
                key={option}
                variant={checksPerPage === (option === "All" ? retentionChecks.length : option) ? "default" : "outline"}
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  setChecksPerPage(option === "All" ? retentionChecks.length : option);
                  setChecksPage(0);
                }}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
          </>
        )}
      </Card>
    </div>
  );
}