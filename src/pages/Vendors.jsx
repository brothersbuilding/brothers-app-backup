import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit2, Trash2, Upload, X, ChevronDown, RefreshCw, Search, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { parseISO, format, isPast } from "date-fns";
import { formatCurrency, formatNumber } from "@/lib/utils";


const formatPhone = (phone) => {
  if (!phone) return "—";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length !== 10) return phone;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
};

export default function Vendors() {
  const queryClient = useQueryClient();
  const { user } = useOutletContext();
  const isAdmin = user?.role === "admin";
  const [scFormOpen, setScFormOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [editingScId, setEditingScId] = useState(null);
  const [sortScColumn, setSortScColumn] = useState("company_name");
  const [sortScDirection, setSortScDirection] = useState("asc");
  const [scFormData, setScFormData] = useState({ company_name: "", company_phone: "", company_email: "", mailing_address: "", contacts: [], w9_on_file: false, msa_on_file: false, coi_expiration_date: "" });
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [customerFormData, setCustomerFormData] = useState({ name: "", email: "", phone: "", street_address: "", city: "", state: "", zip: "" });
  const [syncing, setSyncing] = useState(false);
  const [syncingSubcontractor, setSyncingSubcontractor] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [scSearch, setScSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const scFileInputRef = useRef(null);
  const customerFileInputRef = useRef(null);

  const { data: subcontractors = [] } = useQuery({
    queryKey: ["vendors-subcontractors"],
    queryFn: () => base44.entities.SubContractor.list("-updated_date", 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["contacts-customers"],
    queryFn: () => base44.entities.Customer.list("-updated_date", 500),
  });





  const createScMutation = useMutation({
    mutationFn: (data) => base44.entities.SubContractor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors-subcontractors"] });
      setScFormData({ company_name: "", company_phone: "", company_email: "", mailing_address: "", contacts: [], w9_on_file: false, msa_on_file: false, coi_expiration_date: "" });
      setScFormOpen(false);
    },
  });

  const updateScMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SubContractor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors-subcontractors"] });
      setScFormData({ company_name: "", company_phone: "", company_email: "", mailing_address: "", contacts: [], w9_on_file: false, msa_on_file: false, coi_expiration_date: "" });
      setScFormOpen(false);
      setEditingScId(null);
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts-customers"] });
      setCustomerFormData({ name: "", email: "", phone: "", street_address: "", city: "", state: "", zip: "" });
      setCustomerFormOpen(false);
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts-customers"] });
      setCustomerFormData({ name: "", email: "", phone: "", street_address: "", city: "", state: "", zip: "" });
      setCustomerFormOpen(false);
      setEditingCustomerId(null);
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts-customers"] });
      setSelectedCustomer(null);
    },
  });


  const handleScSubmit = (e) => {
    e.preventDefault();
    if (editingScId) {
      updateScMutation.mutate({ id: editingScId, data: scFormData });
    } else {
      createScMutation.mutate(scFormData);
    }
  };

  const handleEditSc = (contractor) => {
   setEditingScId(contractor.id);
   setScFormData({ ...contractor, contacts: contractor.contacts || [] });
   setScFormOpen(true);
  };

  const handleCustomerSubmit = (e) => {
    e.preventDefault();
    if (editingCustomerId) {
      updateCustomerMutation.mutate({ id: editingCustomerId, data: customerFormData });
    } else {
      createCustomerMutation.mutate(customerFormData);
    }
  };

  const handleCustomerImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        // Strip BOM if present
        const csv = (event.target?.result || "").replace(/^\ufeff/, "");
        
        // Parse CSV properly handling quoted fields with embedded commas/newlines
        const parseCSVFull = (text) => {
          const result = [];
          let row = [];
          let field = "";
          let inQuotes = false;
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const next = text[i + 1];
            if (ch === '"' && inQuotes && next === '"') { field += '"'; i++; }
            else if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === ',' && !inQuotes) { row.push(field); field = ""; }
            else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
              if (ch === '\r') i++;
              row.push(field); field = "";
              result.push(row); row = [];
            } else { field += ch; }
          }
          if (field || row.length) { row.push(field); result.push(row); }
          return result;
        };

        const allRows = parseCSVFull(csv);
        const headers = allRows[0].map((h) => h.trim().toLowerCase());


        const rows = allRows.slice(1).map((values) => {
          const obj = {};
          headers.forEach((header, i) => { obj[header] = (values[i] || "").trim(); });
          return obj;
        });

        // Build a set of existing customer names to avoid duplicates
        const existingCustomers = await base44.entities.Customer.list("-updated_date", 500);
        const existingNames = new Set(existingCustomers.map(c => (c.name || "").trim().toLowerCase()));

        let count = 0;
        const skipped = [];
        for (const row of rows) {
          const name = row["name"] || row["customer"] || row["customer name"] || row["full name"] || row["display name"] || "";
          if (!name || !name.trim()) { skipped.push(JSON.stringify(row)); continue; }
          if (existingNames.has(name.trim().toLowerCase())) { skipped.push(name); continue; }

          const phone = row["phone"] || row["main phone"] || row["mobile"] || "";
          const email = row["email"] || row["main email"] || row["e-mail"] || "";

          const street_address = row["street"] || row["street_address"] || row["billing address"] || row["address"] || "";
          const city = row["city"] || "";
          const state = row["state"] || "";
          const zip = row["zip"] || row["zip code"] || "";


          await base44.entities.Customer.create({
            name: name.trim(),
            email,
            phone,
            street_address,
            city,
            state,
            zip,
          });
          count++;
        }

        queryClient.invalidateQueries({ queryKey: ["contacts-customers"] });
        setImportResult({ success: true, count, headers, skipped: skipped.length, firstSkipped: skipped[0] });
      } catch (err) {
        setImportResult({ success: false, error: err.message });
      } finally {
        setImporting(false);
        if (customerFileInputRef.current) customerFileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleSyncFromQB = async () => {
    setSyncing(true);
    try {
      await base44.functions.invoke('triggerQBSync', {});
      queryClient.invalidateQueries({ queryKey: ["contacts-customers"] });
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncSubcontractorFromQB = async () => {
    setSyncingSubcontractor(true);
    try {
      await base44.functions.invoke('triggerSubcontractorQBSync', {});
      queryClient.invalidateQueries({ queryKey: ["vendors-subcontractors"] });
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncingSubcontractor(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCustomerIds.size === 0) return;
    setDeletingSelected(true);
    for (const id of selectedCustomerIds) {
      await base44.entities.Customer.delete(id);
    }
    setSelectedCustomerIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["contacts-customers"] });
    setDeletingSelected(false);
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomerId(customer.id);
    setCustomerFormData(customer);
    setCustomerFormOpen(true);
  };

  const handleScSort = (column) => {
    if (sortScColumn === column) {
      setSortScDirection(sortScDirection === "asc" ? "desc" : "asc");
    } else {
      setSortScColumn(column);
      setSortScDirection("asc");
    }
  };

  const syncVendorToQB = async (contractor) => {
    try {
      await base44.functions.invoke('syncVendorToZapier', {
        vendor: {
          company_name: contractor.company_name,
          company_email: contractor.company_email,
          company_phone: contractor.company_phone,
          mailing_address: contractor.mailing_address,
          qb_vendor_id: contractor.qb_vendor_id,
          source: 'app'
        }
      });
      updateScMutation.mutate({ id: contractor.id, data: { ...contractor, qb_synced: true, last_synced: new Date().toISOString() } });
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const sortedSubcontractors = [...subcontractors]
    .filter(s => (s.company_name || "").toLowerCase().includes(scSearch.toLowerCase()))
    .sort((a, b) => {
      let aVal = (a[sortScColumn] || "").toString().toLowerCase();
      let bVal = (b[sortScColumn] || "").toString().toLowerCase();
      if (sortScDirection === "asc") return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      else return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    });

  const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || "";
      });
      return obj;
    });
    return rows;
  };

  const handleScImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result;
      const rows = parseCSV(csv);
      for (const row of rows) {
        if (row.company_name) {
          await createScMutation.mutateAsync({
            company_name: row.company_name || "",
            company_phone: row.company_phone || "",
            company_email: row.company_email || "",
            mailing_address: row.mailing_address || "",
            w9_on_file: row.w9_on_file === "true",
            msa_on_file: row.msa_on_file === "true",
            coi_expiration_date: row.coi_expiration_date || "",
          });
        }
      }
      if (scFileInputRef.current) scFileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const VendorTable = ({ title, data, columns, emptyMessage, onRowClick, isEditable, onColumnClick, sortColumn, sortDirection, onEdit, onDelete }) => (
    <Card className="overflow-hidden">
      <div className="hidden"></div>
      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">{emptyMessage}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.map((col) => (
                  <TableHead 
                    key={col.key} 
                    className={`${col.align ? "text-right" : ""} ${onColumnClick ? "cursor-pointer hover:bg-muted" : ""}`}
                    onClick={() => onColumnClick && onColumnClick(col.key)}
                  >
                    {col.label} {onColumnClick && sortColumn === col.key && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/50" onClick={() => onRowClick && onRowClick(item)}>
                  {columns.map((col) => {
                    let cellContent;
                    if (col.type === "checkbox") {
                      cellContent = (
                        <Checkbox 
                          checked={item[col.key] || false} 
                          onCheckedChange={(checked) => {
                            if (isEditable) {
                              updateScMutation.mutate({ id: item.id, data: { ...item, [col.key]: checked } });
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      );
                    } else if (col.key === "company_phone" || col.key === "phone") {
                      cellContent = formatPhone(item[col.key]);
                    } else if (col.key === "rate") {
                      cellContent = item[col.key] ? `${formatCurrency(item[col.key])}/hr` : "—";
                    } else if (col.key === "coi_expiration_date") {
                      const date = item[col.key];
                      const isExpired = date && isPast(new Date(date));
                      if (isEditable) {
                        cellContent = (
                          <input
                            type="date"
                            value={date || ""}
                            onChange={(e) => {
                              updateScMutation.mutate({ id: item.id, data: { ...item, coi_expiration_date: e.target.value } });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs border rounded px-2 py-1 ${isExpired ? "border-red-600 text-red-600" : "border-input"}`}
                          />
                        );
                      } else {
                        if (!date) {
                          cellContent = "—";
                        } else {
                          cellContent = (
                            <span className={isExpired ? "text-red-600 font-semibold" : ""}>
                              {format(parseISO(date), "MM/dd/yy")}
                            </span>
                          );
                        }
                      }
                    } else if (col.key === "qb_synced") {
                      cellContent = (
                        <div className="flex items-center gap-2">
                          <Circle className={`w-2 h-2 ${item.qb_synced ? "fill-green-500 text-green-500" : "fill-gray-400 text-gray-400"}`} />
                          <span className="text-xs">{item.qb_synced ? "Synced" : "Not synced"}</span>
                        </div>
                      );
                    } else {
                      cellContent = item[col.key] || "—";
                    }

                    return (
                      <TableCell
                        key={col.key}
                        className={`text-sm ${col.align ? "text-right" : ""} ${col.key === "company_name" ? "cursor-pointer hover:text-primary" : ""} ${(col.key === "company_phone" || col.key === "phone") ? "whitespace-nowrap" : ""}`}
                        onClick={() => col.key === "company_name" && onRowClick && onRowClick(item)}
                      >
                        {cellContent}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                   {onEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
                     <Edit2 className="w-4 h-4" />
                   </Button>}
                   {onDelete && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(item)}>
                     <Trash2 className="w-4 h-4 text-destructive" />
                   </Button>}
                  </TableCell>
                </TableRow>
              ))}
                  </TableBody>
                  </Table>
                  )}
                  </div>
                  </Card>
                  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Contacts</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage your contacts</p>
      </div>

                    {/* Contacts Section */}
                    <div className="mb-8">
                    <h2 className="text-xl font-bold text-foreground mb-4">Subcontractors/Suppliers</h2>
                    <div className="relative mb-3 max-w-xs">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name..."
                        value={scSearch}
                        onChange={(e) => setScSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="flex gap-2 mb-4 flex-wrap">
                    <Dialog open={scFormOpen} onOpenChange={setScFormOpen}>
                    <DialogTrigger asChild>
                    <Button className="gap-2">
                    <Plus className="w-4 h-4" /> Add Contact
                    </Button>
                    </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingScId ? "Edit Contact" : "Add Contact"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleScSubmit} className="space-y-4 pr-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sc-company-name" className="text-xs">Company Name</Label>
                  <Input
                    id="sc-company-name"
                    value={scFormData.company_name}
                    onChange={(e) => setScFormData({ ...scFormData, company_name: e.target.value })}
                    placeholder="Company name"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-company-phone" className="text-xs">Company Phone</Label>
                    <Input
                      id="sc-company-phone"
                      value={scFormData.company_phone}
                      onChange={(e) => setScFormData({ ...scFormData, company_phone: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-company-email" className="text-xs">Company Email</Label>
                    <Input
                      id="sc-company-email"
                      type="email"
                      value={scFormData.company_email}
                      onChange={(e) => setScFormData({ ...scFormData, company_email: e.target.value })}
                      placeholder="Email address"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sc-address" className="text-xs">Mailing Address</Label>
                  <Input
                    id="sc-address"
                    value={scFormData.mailing_address}
                    onChange={(e) => setScFormData({ ...scFormData, mailing_address: e.target.value })}
                    placeholder="Mailing address"
                  />
                </div>
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                     <Label className="text-xs font-semibold">Contact People</Label>
                     <Button
                       type="button"
                       variant="outline"
                       size="sm"
                       className="gap-1 h-7 text-xs"
                       onClick={() => setScFormData({
                         ...scFormData,
                         contacts: [...scFormData.contacts, { name: "", title: "", email: "", phone: "" }]
                       })}
                     >
                       <Plus className="w-3 h-3" /> Add Contact
                     </Button>
                   </div>
                   <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                   {(scFormData.contacts || []).map((contact, idx) => (
                    <Card key={idx} className="p-3 space-y-2 bg-muted/30">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setScFormData({
                            ...scFormData,
                            contacts: scFormData.contacts.filter((_, i) => i !== idx)
                          })}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={contact.name}
                            onChange={(e) => {
                              const newContacts = [...scFormData.contacts];
                              newContacts[idx].name = e.target.value;
                              setScFormData({ ...scFormData, contacts: newContacts });
                            }}
                            placeholder="Name"
                            className="text-xs h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={contact.title}
                            onChange={(e) => {
                              const newContacts = [...scFormData.contacts];
                              newContacts[idx].title = e.target.value;
                              setScFormData({ ...scFormData, contacts: newContacts });
                            }}
                            placeholder="Job title"
                            className="text-xs h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input
                            type="email"
                            value={contact.email}
                            onChange={(e) => {
                              const newContacts = [...scFormData.contacts];
                              newContacts[idx].email = e.target.value;
                              setScFormData({ ...scFormData, contacts: newContacts });
                            }}
                            placeholder="Email"
                            className="text-xs h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Phone</Label>
                          <Input
                            value={contact.phone}
                            onChange={(e) => {
                              const newContacts = [...scFormData.contacts];
                              newContacts[idx].phone = e.target.value;
                              setScFormData({ ...scFormData, contacts: newContacts });
                            }}
                            placeholder="Phone"
                            className="text-xs h-8"
                          />
                        </div>
                      </div>
                    </Card>
                    ))}
                    </div>
                    </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sc-w9"
                      checked={scFormData.w9_on_file}
                      onCheckedChange={(checked) => setScFormData({ ...scFormData, w9_on_file: checked })}
                    />
                    <Label htmlFor="sc-w9" className="text-xs cursor-pointer">W9 on File</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sc-msa"
                      checked={scFormData.msa_on_file}
                      onCheckedChange={(checked) => setScFormData({ ...scFormData, msa_on_file: checked })}
                    />
                    <Label htmlFor="sc-msa" className="text-xs cursor-pointer">MSA on File</Label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sc-coi" className="text-xs">COI Expiration Date</Label>
                  <Input
                    id="sc-coi"
                    type="date"
                    value={scFormData.coi_expiration_date}
                    onChange={(e) => setScFormData({ ...scFormData, coi_expiration_date: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">{editingScId ? "Update Contact" : "Add Contact"}</Button>
              </form>
            </DialogContent>
            </Dialog>
                    <Button variant="outline" className="gap-2" onClick={() => scFileInputRef.current?.click()}>
                    <Upload className="w-4 h-4" /> Import CSV
                    </Button>
                    <input
                    ref={scFileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleScImport}
                    className="hidden"
                    />
        </div>
        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
          <VendorTable
            title="Contacts"
            data={sortedSubcontractors}
          onColumnClick={handleScSort}
          sortColumn={sortScColumn}
          sortDirection={sortScDirection}
          columns={[
            { key: "company_name", label: "Company" },
            { key: "company_email", label: "Email" },
            { key: "company_phone", label: "Phone" },
            { key: "mailing_address", label: "Address" },
            { key: "w9_on_file", label: "W9 On File", type: "checkbox" },
            { key: "msa_on_file", label: "MSA On File", type: "checkbox" },
            { key: "coi_expiration_date", label: "COI Expiration" },
            { key: "qb_synced", label: "QB Status" },
          ]}
          emptyMessage="No contacts yet."
          onRowClick={setSelectedContractor}
          isEditable={true}
          onEdit={handleEditSc}
          />
        </div>

        {selectedContractor && (
          <Dialog open={!!selectedContractor} onOpenChange={(open) => !open && setSelectedContractor(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedContractor.company_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium">{selectedContractor.company_email || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p className="text-sm font-medium">{formatPhone(selectedContractor.company_phone)}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Mailing Address</Label>
                    <p className="text-sm font-medium">{selectedContractor.mailing_address || "—"}</p>
                  </div>
                </div>

                {selectedContractor.contacts && selectedContractor.contacts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Contact People</Label>
                    {selectedContractor.contacts.map((contact, idx) => (
                      <Card key={idx} className="p-3 bg-muted/30">
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Name</p>
                              <p className="font-medium">{contact.name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Title</p>
                              <p className="font-medium">{contact.title}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium">{contact.email}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Phone</p>
                              <p className="font-medium whitespace-nowrap">{formatPhone(contact.phone)}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-xs text-muted-foreground">W9 On File</Label>
                    <p className="text-sm">{selectedContractor.w9_on_file ? "✓ Yes" : "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">MSA On File</Label>
                    <p className="text-sm">{selectedContractor.msa_on_file ? "✓ Yes" : "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">COI Expiration Date</Label>
                    <p className={`text-sm font-medium ${selectedContractor.coi_expiration_date && isPast(new Date(selectedContractor.coi_expiration_date)) ? "text-red-600" : ""}`}>
                      {selectedContractor.coi_expiration_date ? format(parseISO(selectedContractor.coi_expiration_date), "MM/dd/yy") : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs text-muted-foreground">QB Status</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Circle className={`w-2 h-2 ${selectedContractor.qb_synced ? "fill-green-500 text-green-500" : "fill-gray-400 text-gray-400"}`} />
                          <span className="text-sm">{selectedContractor.qb_synced ? "Synced" : "Not synced"}</span>
                        </div>
                      </div>
                      {selectedContractor.last_synced && (
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(selectedContractor.last_synced), "MM/dd h:mm a")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <Button 
                  className="w-full gap-2 mt-4"
                  onClick={() => {
                    syncVendorToQB(selectedContractor);
                    setSelectedContractor(null);
                  }}
                >
                  <RefreshCw className="w-4 h-4" /> Sync to QuickBooks
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Customers Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-foreground mb-4">Customers</h2>
        <div className="relative mb-3 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          <Dialog open={customerFormOpen} onOpenChange={setCustomerFormOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Customer
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomerId ? "Edit Customer" : "Add Customer"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCustomerSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="customer-name" className="text-xs">Name</Label>
                <Input
                  id="customer-name"
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  placeholder="Customer name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-email" className="text-xs">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerFormData.email}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-phone" className="text-xs">Phone</Label>
                <Input
                  id="customer-phone"
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-street" className="text-xs">Street Address</Label>
                <Input
                  id="customer-street"
                  value={customerFormData.street_address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, street_address: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customer-city" className="text-xs">City</Label>
                  <Input
                    id="customer-city"
                    value={customerFormData.city}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customer-state" className="text-xs">State</Label>
                  <Input
                    id="customer-state"
                    value={customerFormData.state}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-zip" className="text-xs">ZIP</Label>
                <Input
                  id="customer-zip"
                  value={customerFormData.zip}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, zip: e.target.value })}
                  placeholder="ZIP code"
                />
              </div>
              <Button type="submit" className="w-full">{editingCustomerId ? "Update Customer" : "Add Customer"}</Button>
            </form>
          </DialogContent>
        </Dialog>
        <Button variant="outline" className="gap-2" onClick={() => customerFileInputRef.current?.click()} disabled={importing}>
          <Upload className="w-4 h-4" /> {importing ? "Importing..." : "Import QB CSV"}
        </Button>
        <input
          ref={customerFileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCustomerImport}
          className="hidden"
        />
        {importResult && (
          <span className={`text-sm font-medium ${importResult.success ? "text-green-600" : "text-red-600"}`}>
            {importResult.success
              ? `✓ Imported ${importResult.count} customers (${importResult.skipped} skipped). Headers: ${importResult.headers?.join(", ")}. First skipped row: ${importResult.firstSkipped || "none"}`
              : `✗ Error: ${importResult.error}`}
          </span>
        )}

        </div>

        <div>
          {(() => {
            const sortedCustomers = [...customers].filter(c => (c.name || "").toLowerCase().includes(customerSearch.toLowerCase())).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            return (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  {sortedCustomers.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground text-sm">No customers yet.</div>
                  ) : (
                    <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            {["Name","Email","Phone","Address"].map(label => (
                              <TableHead key={label} className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">{label}</TableHead>
                            ))}
                            <TableHead className="text-right sticky top-0 bg-muted/80 backdrop-blur-sm z-10">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedCustomers.map((customer) => (
                            <TableRow key={customer.id} className="hover:bg-muted/50">
                              <TableCell className="text-sm cursor-pointer hover:text-primary" onClick={() => setSelectedCustomer(customer)}>{customer.name || "—"}</TableCell>
                              <TableCell className="text-sm">{customer.email || "—"}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">{formatPhone(customer.phone)}</TableCell>
                              <TableCell className="text-sm">
                                {[customer.street_address, customer.city, customer.state, customer.zip].filter(Boolean).join(", ") || "—"}
                              </TableCell>
                              <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCustomer(customer)}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteCustomerMutation.mutate(customer.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}
        </div>

        {selectedCustomer && (
          <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{selectedCustomer.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="text-sm font-medium">{selectedCustomer.email || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p className="text-sm font-medium">{formatPhone(selectedCustomer.phone) || "—"}</p>
                </div>
                <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Street Address</Label>
                    <p className="text-sm font-medium">{selectedCustomer.street_address || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">City</Label>
                    <p className="text-sm font-medium">{selectedCustomer.city || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">State</Label>
                    <p className="text-sm font-medium">{selectedCustomer.state || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ZIP</Label>
                    <p className="text-sm font-medium">{selectedCustomer.zip || "—"}</p>
                  </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      handleEditCustomer(selectedCustomer);
                      setSelectedCustomer(null);
                    }}
                  >
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => deleteCustomerMutation.mutate(selectedCustomer.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}