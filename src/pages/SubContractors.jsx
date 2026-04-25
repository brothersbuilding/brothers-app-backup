import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function SubContractors() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    specialization: "",
    rate: "",
  });

  const { data: subcontractors = [] } = useQuery({
    queryKey: ["subcontractors"],
    queryFn: () => base44.entities.SubContractor.list("-updated_date", 100),
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await base44.entities.SubContractor.create(formData);
      setFormData({ name: "", company: "", email: "", phone: "", specialization: "", rate: "" });
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error creating subcontractor:", error);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Sub Contractors</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage external contractors and vendors</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Add Sub Contractor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Sub Contractor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Contractor name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-xs">Company</Label>
                <Input
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="contractor@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="specialization" className="text-xs">Specialization</Label>
                <Input
                  id="specialization"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleInputChange}
                  placeholder="e.g., Electrical, Plumbing"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate" className="text-xs">Rate ($/hr)</Label>
                <Input
                  id="rate"
                  name="rate"
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
              </div>
              <Button type="submit" className="w-full">Create Sub Contractor</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-medium text-muted-foreground">{subcontractors.length} sub contractors</p>
        </div>
        <div className="overflow-x-auto">
          {subcontractors.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No sub contractors yet. Add one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subcontractors.map((sc) => (
                  <TableRow key={sc.id}>
                    <TableCell className="font-medium text-sm">{sc.name || "—"}</TableCell>
                    <TableCell className="text-sm">{sc.company || "—"}</TableCell>
                    <TableCell className="text-sm">{sc.email || "—"}</TableCell>
                    <TableCell className="text-sm">{sc.phone || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {sc.specialization ? <Badge variant="outline">{sc.specialization}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {sc.rate ? `$${parseFloat(sc.rate).toFixed(2)}/hr` : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
    </div>
  );
}