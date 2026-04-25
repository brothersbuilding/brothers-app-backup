import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit2, Trash2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { parseISO, format, isPast } from "date-fns";

const formatPhone = (phone) => {
  if (!phone) return "—";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length !== 10) return phone;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
};

export default function Vendors() {
  const queryClient = useQueryClient();
  const [scFormOpen, setScFormOpen] = useState(false);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [editingScId, setEditingScId] = useState(null);
  const [scFormData, setScFormData] = useState({ company_name: "", company_phone: "", company_email: "", mailing_address: "", contacts: [], w9_on_file: false, msa_on_file: false, coi_expiration_date: "" });
  const [supplierFormData, setSupplierFormData] = useState({ name: "", company: "", email: "", phone: "", category: "", rate: "" });
  const scFileInputRef = useRef(null);
  const supplierFileInputRef = useRef(null);

  const { data: subcontractors = [] } = useQuery({
    queryKey: ["vendors-subcontractors"],
    queryFn: () => base44.entities.SubContractor.list("-updated_date", 100),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["vendors-suppliers"],
    queryFn: () => base44.entities.Supplier.list("-updated_date", 100),
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

  const createSupplierMutation = useMutation({
    mutationFn: (data) => base44.entities.Supplier.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors-suppliers"] });
      setSupplierFormData({ name: "", company: "", email: "", phone: "", category: "", rate: "" });
      setSupplierFormOpen(false);
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
    setScFormData(contractor);
    setScFormOpen(true);
  };

  const handleSupplierSubmit = (e) => {
    e.preventDefault();
    createSupplierMutation.mutate(supplierFormData);
  };

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
        if (row.name) {
          await createScMutation.mutateAsync({
            name: row.name || "",
            company: row.company || "",
            email: row.email || "",
            phone: row.phone || "",
            specialization: row.specialization || "",
            rate: row.rate ? parseFloat(row.rate) : undefined,
          });
        }
      }
      if (scFileInputRef.current) scFileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleSupplierImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result;
      const rows = parseCSV(csv);
      for (const row of rows) {
        if (row.name) {
          await createSupplierMutation.mutateAsync({
            name: row.name || "",
            company: row.company || "",
            email: row.email || "",
            phone: row.phone || "",
            category: row.category || "",
            rate: row.rate ? parseFloat(row.rate) : undefined,
          });
        }
      }
      if (supplierFileInputRef.current) supplierFileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const VendorTable = ({ title, data, columns, emptyMessage, onRowClick }) => (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <p className="text-sm font-medium text-muted-foreground">{data.length} {title.toLowerCase()}</p>
      </div>
      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">{emptyMessage}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.align ? "text-right" : ""}>
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick && onRowClick(item)}>
                  {columns.map((col) => {
                    let cellContent;
                    if (col.type === "checkbox") {
                      cellContent = <Checkbox checked={item[col.key] || false} disabled />;
                    } else if (col.key === "company_phone" || col.key === "phone") {
                      cellContent = formatPhone(item[col.key]);
                    } else if (col.key === "rate") {
                      cellContent = item[col.key] ? `$${parseFloat(item[col.key]).toFixed(2)}/hr` : "—";
                    } else if (col.key === "coi_expiration_date") {
                      const date = item[col.key];
                      if (!date) {
                        cellContent = "—";
                      } else {
                        const isExpired = isPast(new Date(date));
                        cellContent = (
                          <span className={isExpired ? "text-red-600 font-semibold" : ""}>
                            {format(parseISO(date), "MM/dd/yy")}
                          </span>
                        );
                      }
                    } else {
                      cellContent = item[col.key] || "—";
                    }

                    return (
                      <TableCell
                        key={col.key}
                        className={`text-sm ${col.align ? "text-right" : ""} ${col.key === "company_name" ? "cursor-pointer hover:text-primary" : ""}`}
                        onClick={() => col.key === "company_name" && onRowClick && onRowClick(item)}
                      >
                        {cellContent}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right space-x-1">
                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditSc(item)}>
                     <Edit2 className="w-4 h-4" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-8 w-8">
                     <Trash2 className="w-4 h-4 text-destructive" />
                   </Button>
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
        <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Vendors</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage subcontractors and suppliers</p>
      </div>

      {/* Subcontractors Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-foreground">Sub Contractors</h2>
          <div className="flex gap-2">
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
            <Dialog open={scFormOpen} onOpenChange={setScFormOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Sub Contractor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingScId ? "Edit Sub Contractor" : "Add Sub Contractor"}</DialogTitle>
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
                   {scFormData.contacts.map((contact, idx) => (
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
                <Button type="submit" className="w-full">{editingScId ? "Update Sub Contractor" : "Add Sub Contractor"}</Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>
        <VendorTable
          title="Sub Contractors"
          data={subcontractors}
          columns={[
            { key: "company_name", label: "Company" },
            { key: "company_email", label: "Email" },
            { key: "company_phone", label: "Phone" },
            { key: "mailing_address", label: "Address" },
            { key: "w9_on_file", label: "W9 On File", type: "checkbox" },
            { key: "msa_on_file", label: "MSA On File", type: "checkbox" },
            { key: "coi_expiration_date", label: "COI Expiration" },
          ]}
          emptyMessage="No sub contractors yet."
          onRowClick={setSelectedContractor}
        />

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
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium">{contact.email}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Phone</p>
                              <p className="font-medium">{formatPhone(contact.phone)}</p>
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
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Suppliers Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-foreground">Suppliers</h2>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => supplierFileInputRef.current?.click()}>
              <Upload className="w-4 h-4" /> Import CSV
            </Button>
            <input
              ref={supplierFileInputRef}
              type="file"
              accept=".csv"
              onChange={handleSupplierImport}
              className="hidden"
            />
            <Dialog open={supplierFormOpen} onOpenChange={setSupplierFormOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Supplier</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSupplierSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-name" className="text-xs">Name</Label>
                  <Input
                    id="supplier-name"
                    value={supplierFormData.name}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                    placeholder="Supplier name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-company" className="text-xs">Company</Label>
                  <Input
                    id="supplier-company"
                    value={supplierFormData.company}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, company: e.target.value })}
                    placeholder="Company name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-email" className="text-xs">Email</Label>
                  <Input
                    id="supplier-email"
                    type="email"
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    placeholder="supplier@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-phone" className="text-xs">Phone</Label>
                  <Input
                    id="supplier-phone"
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-category" className="text-xs">Category</Label>
                  <Input
                    id="supplier-category"
                    value={supplierFormData.category}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, category: e.target.value })}
                    placeholder="e.g., Materials, Equipment"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-rate" className="text-xs">Rate ($/hr or unit price)</Label>
                  <Input
                    id="supplier-rate"
                    type="number"
                    step="0.01"
                    value={supplierFormData.rate}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, rate: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <Button type="submit" className="w-full">Add Supplier</Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>
        <VendorTable
          title="Suppliers"
          data={suppliers}
          columns={[
            { key: "name", label: "Name" },
            { key: "company", label: "Company" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "category", label: "Category" },
            { key: "rate", label: "Rate", align: "right" },
          ]}
          emptyMessage="No suppliers yet."
        />
      </div>
    </div>
  );
}