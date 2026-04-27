import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2 } from "lucide-react";
import EmployeeCSVImport from "@/components/employees/EmployeeCSVImport";

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

const formatPhone = (raw) => {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
};

const permissionColors = {
  admin: "bg-red-100 text-red-800",
  manager: "bg-blue-100 text-blue-800",
  labor: "bg-gray-100 text-gray-800",
};

export default function Employees() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [permissionFilter, setPermissionFilter] = useState("all");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list("-updated_date", 500),
    enabled: user?.role === "admin",
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch = (emp.full_name || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = permissionFilter === "all" || emp.permission_level === permissionFilter;
      return matchesSearch && matchesFilter;
    });
  }, [employees, searchTerm, permissionFilter]);

  // Admin-only check
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Access restricted to admins only</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Employees</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage employee profiles</p>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mb-6 flex-wrap items-end">
        <div className="flex-1 min-w-xs">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Select value={permissionFilter} onValueChange={setPermissionFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="labor">Labor</SelectItem>
          </SelectContent>
        </Select>
        <EmployeeCSVImport onImported={() => queryClient.invalidateQueries({ queryKey: ["employees"] })} />
        <Link to="/employees/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Add Employee
          </Button>
        </Link>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {filteredEmployees.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No employees found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Photo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Regular Pay</TableHead>
                  <TableHead>Permission Level</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => {
                  const addressLine1Parts = [emp.address_line1, emp.address_line2].filter(Boolean);
                  const addressLine2Parts = [emp.city, emp.state && emp.zip_code ? `${emp.state} ${emp.zip_code}` : emp.state || emp.zip_code].filter(Boolean);
                  const addrL1 = addressLine1Parts.join(", ");
                  const addrL2 = addressLine2Parts.join(", ");

                  const regularRate = emp.hourly_rates?.find((r) => r.pay_type_label === "Regular");
                  const regularPay = regularRate?.hourly_amount != null
                    ? `$${Number(regularRate.hourly_amount).toFixed(2)}/hr`
                    : "—";

                  return (
                  <TableRow key={emp.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={emp.profile_photo} alt={emp.full_name} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                          {getInitials(emp.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <Link to={`/employees/${emp.id}`} className="font-medium hover:text-primary cursor-pointer">
                        {emp.full_name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.job_title || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatPhone(emp.phone)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-48">
                      {addrL1 && <div className="truncate">{addrL1}</div>}
                      {addrL2 && <div className="truncate text-muted-foreground/70">{addrL2}</div>}
                      {!addrL1 && !addrL2 && "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{regularPay}</TableCell>
                    <TableCell>
                      <Badge className={permissionColors[emp.permission_level] || "bg-gray-100 text-gray-800"}>
                        {emp.permission_level || "labor"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteEmployeeMutation.mutate(emp.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}