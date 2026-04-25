import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit2, Trash2, ChevronDown, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { parseISO, format, isPast } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export default function OutstandingChecks() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isDesktop = !isMobile;
  const [checkFormOpen, setCheckFormOpen] = useState(false);
  const [editingCheckId, setEditingCheckId] = useState(null);
  const [checkFormData, setCheckFormData] = useState({ vendor: "", amount: "", retention: "", method: "", project: "", sub_docs: "", notes: "", issue_date: "", due_date: "", invoice: "", approved: false });
  const [selectedCheckForDetail, setSelectedCheckForDetail] = useState(null);
  const [hoveredCheckId, setHoveredCheckId] = useState(null);
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [vendorFilter, setVendorFilter] = useState("");
  const [methodDropdownOpen, setMethodDropdownOpen] = useState(false);
  const [availableCash, setAvailableCash] = useState("");
  const [locBalance, setLocBalance] = useState("");
  const [editingCash, setEditingCash] = useState(false);
  const [editingLoc, setEditingLoc] = useState(false);
  const [checksPerPage, setChecksPerPage] = useState(10);
  const [checksPage, setChecksPage] = useState(0);
  const [sortColumn, setSortColumn] = useState("due_date");
  const [sortDirection, setSortDirection] = useState("asc");

  const { data: subcontractors = [] } = useQuery({
    queryKey: ["vendors-subcontractors"],
    queryFn: () => base44.entities.SubContractor.list("-updated_date", 100),
  });

  const { data: checks = [] } = useQuery({
    queryKey: ["outstanding-checks"],
    queryFn: () => base44.entities.OutstandingCheck.list("-updated_date", 100),
  });

  const createCheckMutation = useMutation({
    mutationFn: (data) => base44.entities.OutstandingCheck.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outstanding-checks"] });
      setCheckFormData({ vendor: "", amount: "", retention: "", method: "", project: "", sub_docs: "", notes: "", issue_date: "", due_date: "", invoice: "", approved: false });
      setCheckFormOpen(false);
    },
  });

  const updateCheckMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OutstandingCheck.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outstanding-checks"] });
      setCheckFormData({ vendor: "", amount: "", retention: "", method: "", project: "", sub_docs: "", notes: "", issue_date: "", due_date: "", invoice: "", approved: false });
      setCheckFormOpen(false);
      setEditingCheckId(null);
    },
  });

  const handleCheckSubmit = (e) => {
    e.preventDefault();
    const data = {
      vendor: checkFormData.vendor,
      amount: parseFloat(checkFormData.amount) || 0,
      retention: parseFloat(checkFormData.retention) || 0,
      method: checkFormData.method,
      project: checkFormData.project,
      sub_docs: checkFormData.sub_docs,
      notes: checkFormData.notes,
      issue_date: checkFormData.issue_date,
      due_date: checkFormData.due_date,
      invoice: checkFormData.invoice,
      approved: checkFormData.approved,
    };
    if (editingCheckId) {
      updateCheckMutation.mutate({ id: editingCheckId, data });
    } else {
      createCheckMutation.mutate(data);
    }
  };

  const allVendors = [
    ...subcontractors.map((sc) => sc.company_name),
  ].filter(Boolean);

  const filteredVendors = allVendors.filter((v) =>
    v.toLowerCase().includes(vendorFilter.toLowerCase())
  );

  const uniqueFilteredVendors = Array.from(new Set(filteredVendors));

  const outstandingChecks = checks.filter(check => !check.completed);

  const sortedChecks = [...outstandingChecks].sort((a, b) => {
    // Primary sort by due_date
    const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    
    if (aDate !== bDate) {
      return aDate - bDate;
    }
    
    // Secondary sort by vendor (A-Z)
    const aVendor = (a.vendor || "").toString().toLowerCase();
    const bVendor = (b.vendor || "").toString().toLowerCase();
    
    if (aVendor !== bVendor) {
      return aVendor > bVendor ? 1 : aVendor < bVendor ? -1 : 0;
    }
    
    // If custom sort column selected, apply it
    if (sortColumn !== "due_date" && sortColumn !== "vendor") {
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
    }
    
    return 0;
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
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Total Outstanding</p>
          <p className="text-lg font-semibold text-foreground">{formatCurrency(checks.filter(check => check.approved && !check.completed).reduce((sum, check) => sum + (parseFloat(check.amount || 0) - parseFloat(check.retention || 0)), 0))}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Available Cash</p>
          {editingCash ? (
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={availableCash}
                onChange={(e) => setAvailableCash(e.target.value)}
                placeholder="0.00"
                className="text-sm flex-1"
                autoFocus
              />
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setEditingCash(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          ) : (
            <p 
              className="text-lg font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={() => setEditingCash(true)}
            >
              {formatCurrency(parseFloat(availableCash || 0))}
            </p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Remaining</p>
          <p className="text-lg font-semibold text-foreground">{formatCurrency(parseFloat(availableCash || 0) + parseFloat(locBalance || 0) - checks.filter(check => check.approved).reduce((sum, check) => sum + (parseFloat(check.amount || 0) - parseFloat(check.retention || 0)), 0))}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">LOC Balance</p>
          {editingLoc ? (
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={locBalance}
                onChange={(e) => setLocBalance(e.target.value)}
                placeholder="0.00"
                className="text-sm flex-1"
                autoFocus
              />
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setEditingLoc(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          ) : (
            <p 
              className="text-lg font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={() => setEditingLoc(true)}
            >
              {formatCurrency(parseFloat(locBalance || 0))}
            </p>
          )}
        </div>
      </div>
      <Dialog open={checkFormOpen} onOpenChange={setCheckFormOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2 mb-4">
            <Plus className="w-4 h-4" /> Add Check
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCheckId ? "Edit Check" : "Add Outstanding Check"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCheckSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Vendor</Label>
              <Popover open={vendorDropdownOpen} onOpenChange={setVendorDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between"
                    type="button"
                  >
                    <span className="truncate">{checkFormData.vendor || "Select vendor..."}</span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <div className="p-2">
                    <Input
                      placeholder="Search vendors..."
                      value={vendorFilter}
                      onChange={(e) => setVendorFilter(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {uniqueFilteredVendors.length > 0 && (
                      <div className="border-t">
                        {uniqueFilteredVendors.map((vendor) => (
                          <button
                            key={vendor}
                            type="button"
                            onClick={() => {
                              setCheckFormData({ ...checkFormData, vendor });
                              setVendorDropdownOpen(false);
                              setVendorFilter("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                          >
                            {vendor}
                          </button>
                        ))}
                      </div>
                    )}
                    {vendorFilter && !uniqueFilteredVendors.includes(vendorFilter) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCheckFormData({ ...checkFormData, vendor: vendorFilter });
                          setVendorDropdownOpen(false);
                          setVendorFilter("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-t font-medium text-accent"
                      >
                        + Add "{vendorFilter}" as new vendor
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="check-amount" className="text-xs">Amount</Label>
                <Input
                  id="check-amount"
                  type="number"
                  step="0.01"
                  value={checkFormData.amount}
                  onChange={(e) => setCheckFormData({ ...checkFormData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="check-retention"
                  checked={checkFormData.retention > 0}
                  onCheckedChange={(checked) => setCheckFormData({ 
                    ...checkFormData, 
                    retention: checked ? (parseFloat(checkFormData.amount) * 0.05) : 0 
                  })}
                />
                <Label htmlFor="check-retention" className="text-xs cursor-pointer">Apply 5% Retention</Label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="check-method" className="text-xs">Method</Label>
              <Popover open={methodDropdownOpen} onOpenChange={setMethodDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between"
                    type="button"
                  >
                    <span className="truncate">{checkFormData.method || "Select method..."}</span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <div className="p-2">
                    <Input
                      placeholder="Search methods..."
                      value={checkFormData.methodFilter || ""}
                      onChange={(e) => setCheckFormData({ ...checkFormData, methodFilter: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  <div className="border-t">
                    {["Check", "ACH", "Credit Card", "Invoice"].filter(m => m.toLowerCase().includes((checkFormData.methodFilter || "").toLowerCase())).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          setCheckFormData({ ...checkFormData, method, methodFilter: "" });
                          setMethodDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="check-project" className="text-xs">Project</Label>
              <Input
                id="check-project"
                value={checkFormData.project}
                onChange={(e) => setCheckFormData({ ...checkFormData, project: e.target.value })}
                placeholder="Project name"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="check-issue-date" className="text-xs">Issue Date</Label>
                <Input
                  id="check-issue-date"
                  type="date"
                  value={checkFormData.issue_date}
                  onChange={(e) => setCheckFormData({ ...checkFormData, issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="check-due-date" className="text-xs">Due Date</Label>
                <Input
                  id="check-due-date"
                  type="date"
                  value={checkFormData.due_date}
                  onChange={(e) => setCheckFormData({ ...checkFormData, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="check-invoice" className="text-xs">Invoice</Label>
                <Input
                  id="check-invoice"
                  value={checkFormData.invoice}
                  onChange={(e) => setCheckFormData({ ...checkFormData, invoice: e.target.value })}
                  placeholder="Invoice number"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="check-notes" className="text-xs">Notes</Label>
              <Input
                id="check-notes"
                value={checkFormData.notes}
                onChange={(e) => setCheckFormData({ ...checkFormData, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="check-approved"
                checked={checkFormData.approved}
                onCheckedChange={(checked) => setCheckFormData({ ...checkFormData, approved: checked })}
              />
              <Label htmlFor="check-approved" className="text-xs cursor-pointer">Approved</Label>
            </div>
            <Button type="submit" className="w-full">{editingCheckId ? "Update Check" : "Add Check"}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Card className="overflow-hidden">
        <div className="overflow-y-auto overflow-x-hidden max-h-96">
          {outstandingChecks.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No outstanding checks.</div>
          ) : (
            <>
            <Table className="table-auto w-full text-xs md:text-sm">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-center p-1 md:p-2">Approved</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted p-1 md:p-2" onClick={() => handleSort("vendor")}>Vendor {sortColumn === "vendor" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                 <TableHead className="text-right cursor-pointer hover:bg-muted p-1 md:p-2" onClick={() => handleSort("amount")}>Inv Amt {sortColumn === "amount" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                 <TableHead className="text-right cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("retention")}>Retention {sortColumn === "retention" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                 <TableHead className="text-right p-1 md:p-2 hidden md:table-cell">Check Amt</TableHead>
                 <TableHead className="cursor-pointer hover:bg-muted p-1 md:p-2" onClick={() => handleSort("check_number")}>Check # {sortColumn === "check_number" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                 <TableHead className="cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("method")}>Method {sortColumn === "method" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                 <TableHead className="cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("invoice")}>Invoice {sortColumn === "invoice" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                 <TableHead className="cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("issue_date")}>Issue Date {sortColumn === "issue_date" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                 <TableHead className="cursor-pointer hover:bg-muted hidden md:table-cell" onClick={() => handleSort("due_date")}>Due Date {sortColumn === "due_date" && (sortDirection === "asc" ? "↑" : "↓")}</TableHead>
                 <TableHead className="hidden md:table-cell">Sub Docs</TableHead>
                 <TableHead className="text-right">Actions</TableHead>
               </TableRow>
              </TableHeader>
              <TableBody>
                {sortedChecks.slice(checksPage * checksPerPage, (checksPage + 1) * checksPerPage).map((check) => {
                  const vendor = subcontractors.find((sc) => sc.company_name === check.vendor);
                  const hasAllDocs = vendor && vendor.w9_on_file && vendor.msa_on_file && vendor.coi_expiration_date && !isPast(new Date(vendor.coi_expiration_date));
                  const getMissingDocs = () => {
                    if (!vendor) return "No vendor found";
                    const missing = [];
                    if (!vendor.w9_on_file) missing.push("No W9");
                    if (!vendor.msa_on_file) missing.push("No MSA");
                    if (!vendor.coi_expiration_date) missing.push("No COI");
                    else if (isPast(new Date(vendor.coi_expiration_date))) missing.push("COI Expired");
                    return missing.join(", ");
                  };
                  return (
                    <>
                       <TableRow 
                         key={check.id}
                         className={`cursor-pointer ${isDesktop ? "hover:bg-muted/50" : ""}`}
                         onMouseEnter={() => isDesktop && setHoveredCheckId(check.id)}
                         onMouseLeave={() => isDesktop && setHoveredCheckId(null)}
                         onClick={() => isDesktop ? (setEditingCheckId(check.id), setCheckFormData(check), setCheckFormOpen(true)) : setSelectedCheckForDetail(check)}
                       >
                           <TableCell className="text-center p-1 md:p-2" onClick={(e) => e.stopPropagation()}>
                             <Checkbox 
                               checked={check.approved} 
                               onCheckedChange={(checked) => updateCheckMutation.mutate({ id: check.id, data: { ...check, approved: checked } })}
                             />
                           </TableCell>
                           <TableCell className="font-medium p-1 md:p-2">{check.vendor}</TableCell>
                           <TableCell className="text-right p-1 md:p-2">{formatCurrency(check.amount)}</TableCell>
                           <TableCell className="text-right text-sm hidden md:table-cell">{formatCurrency(check.retention)}</TableCell>
                           <TableCell className="text-right text-sm hidden md:table-cell">{formatCurrency(check.amount - check.retention)}</TableCell>
                           <TableCell className="font-medium p-1 md:p-2">{check.check_number || "—"}</TableCell>
                           <TableCell className="text-sm hidden md:table-cell">{check.method}</TableCell>
                           <TableCell className="text-sm hidden md:table-cell">{check.invoice || "—"}</TableCell>
                           <TableCell className="text-sm hidden md:table-cell">{check.issue_date ? format(parseISO(check.issue_date), "MM/dd/yy") : "—"}</TableCell>
                           <TableCell className="text-sm hidden md:table-cell">{check.due_date ? format(parseISO(check.due_date), "MM/dd/yy") : "—"}</TableCell>
                           <TableCell className="text-sm hidden md:table-cell">
                             {isDesktop && hoveredCheckId === check.id ? (
                               <Popover open={true}>
                                 <PopoverContent className="w-auto p-2 text-xs">
                                   <p>{hasAllDocs ? "✓ All docs complete" : getMissingDocs()}</p>
                                 </PopoverContent>
                               </Popover>
                             ) : (
                               hasAllDocs ? "✓" : getMissingDocs()
                             )}
                           </TableCell>
                           <TableCell className="text-right p-1 md:p-2 space-x-1 flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-6 w-6 md:h-7 md:w-7"
                               onClick={() => updateCheckMutation.mutate({ id: check.id, data: { ...check, completed: true } })}
                             >
                               <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                             </Button>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-6 w-6 md:h-7 md:w-7"
                               onClick={() => {
                                 // TODO: Add delete mutation
                               }}
                             >
                               <Trash2 className="w-3 h-3 md:w-4 md:h-4 text-destructive" />
                             </Button>
                           </TableCell>
                         </TableRow>
                       {!isDesktop && selectedCheckForDetail?.id === check.id && (
                         <Dialog open={true} onOpenChange={(open) => !open && setSelectedCheckForDetail(null)}>
                           <DialogContent className="w-full max-w-sm">
                             <DialogHeader>
                               <div className="flex items-center justify-between">
                                 <DialogTitle>{check.vendor}</DialogTitle>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-7 w-7"
                                   onClick={() => {
                                     setEditingCheckId(check.id);
                                     setCheckFormData(check);
                                     setCheckFormOpen(true);
                                     setSelectedCheckForDetail(null);
                                   }}
                                 >
                                   <Edit2 className="w-4 h-4" />
                                 </Button>
                               </div>
                             </DialogHeader>
                             <div className="space-y-3 text-sm">
                               <div className="grid grid-cols-2 gap-4">
                                 <div>
                                   <p className="text-xs text-muted-foreground">Amount</p>
                                   <p className="font-medium">{formatCurrency(check.amount)}</p>
                                 </div>
                                 <div>
                                   <p className="text-xs text-muted-foreground">Retention</p>
                                   <p className="font-medium">{formatCurrency(check.retention)}</p>
                                 </div>
                               </div>
                               <div className="grid grid-cols-2 gap-4">
                                 <div>
                                   <p className="text-xs text-muted-foreground">Method</p>
                                   <p className="font-medium">{check.method}</p>
                                 </div>
                                 <div>
                                   <p className="text-xs text-muted-foreground">Issue Date</p>
                                   <p className="font-medium">{check.issue_date ? format(parseISO(check.issue_date), "MM/dd/yy") : "—"}</p>
                                 </div>
                               </div>
                               <div>
                                 <p className="text-xs text-muted-foreground">Due Date</p>
                                 <p className="font-medium">{check.due_date ? format(parseISO(check.due_date), "MM/dd/yy") : "—"}</p>
                               </div>
                               <div>
                                 <p className="text-xs text-muted-foreground">Invoice</p>
                                 <p className="font-medium">{check.invoice || "—"}</p>
                               </div>
                               <div>
                                 <p className="text-xs text-muted-foreground">Project</p>
                                 <p className="font-medium">{check.project || "—"}</p>
                               </div>
                               <div>
                                 <p className="text-xs text-muted-foreground">Notes</p>
                                 <p className="font-medium">{check.notes || "—"}</p>
                               </div>
                               <div>
                                 <p className="text-xs text-muted-foreground">Supporting Docs</p>
                                 <p className="font-medium">{check.sub_docs || "—"}</p>
                               </div>
                             </div>
                           </DialogContent>
                         </Dialog>
                       )}
                    </>
                  );
                })}
                </TableBody>
                <TableFooter>
                <TableRow className="bg-muted/50">
                <TableCell colSpan="2" className="font-semibold text-sm">Totals</TableCell>
                  <TableCell className="text-right font-semibold text-sm">{formatCurrency(outstandingChecks.reduce((sum, check) => sum + parseFloat(check.amount || 0), 0))}</TableCell>
                  <TableCell className="text-right font-semibold text-sm hidden md:table-cell">{formatCurrency(outstandingChecks.reduce((sum, check) => sum + parseFloat(check.retention || 0), 0))}</TableCell>
                  <TableCell className="text-right font-semibold text-sm hidden md:table-cell">{formatCurrency(outstandingChecks.reduce((sum, check) => sum + (parseFloat(check.amount || 0) - parseFloat(check.retention || 0)), 0))}</TableCell>
                  <TableCell colSpan="5"></TableCell>
                </TableRow>
                </TableFooter>
                </Table>
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-background text-sm">
                  <span className="text-muted-foreground">Rows per page:</span>
                  {[5, 10, 20, 50, "All"].map((option) => (
                    <Button
                      key={option}
                      variant={checksPerPage === (option === "All" ? outstandingChecks.length : option) ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        setChecksPerPage(option === "All" ? outstandingChecks.length : option);
                        setChecksPage(0);
                      }}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
                </>
                )}
                </div>
                </Card>
    </div>
  );
}