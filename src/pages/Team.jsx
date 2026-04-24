import React, { useState } from "react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Mail, Shield, UserPlus, Pencil, Phone, MapPin, DollarSign, Cake, Plus, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const ALL_PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Projects" },
  { key: "time", label: "Time Tracking" },
  { key: "costs", label: "Costs" },
  { key: "documents", label: "Documents" },
  { key: "announcements", label: "Announcements" },
  { key: "team", label: "Team" },
  { key: "reports", label: "Reports" },
];

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "labor", label: "Labor" },
];

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

function UserFormDialog({ open, onOpenChange, editUser, onSave }) {
   const queryClient = useQueryClient();
   const isEdit = !!editUser;
   const [email, setEmail] = useState(editUser?.email || "");
   const [role, setRole] = useState(editUser?.role || "labor");
   const [allowedPages, setAllowedPages] = useState(
     editUser?.role === "admin" || !editUser?.allowed_pages?.length
       ? ALL_PAGES.map((p) => p.key)
       : editUser.allowed_pages
   );
   const [phone, setPhone] = useState(editUser?.phone || "");
   const [dob, setDob] = useState(editUser?.dob || "");
   const [address, setAddress] = useState(editUser?.address || "");
   const [hourlyWage, setHourlyWage] = useState(editUser?.hourly_wage || "");
   const [supervisorId, setSupervisorId] = useState(editUser?.supervisor_id || "");
   const [supervisorName, setSupervisorName] = useState(editUser?.supervisor_name || "");
   const [resetLoading, setResetLoading] = useState(false);

  const togglePage = (key) => {
    setAllowedPages((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSave = () => {
    onSave({
      email,
      role,
      allowed_pages: allowedPages,
      phone,
      dob,
      address,
      hourly_wage: hourlyWage ? Number(hourlyWage) : undefined,
    });
  };

  const handleResetPassword = async () => {
    if (!editUser?.id || !editUser?.email) return;
    setResetLoading(true);
    try {
      await base44.functions.invoke("resetUserPassword", {
        userId: editUser.id,
        userEmail: editUser.email,
        userName: editUser.full_name || "User"
      });
      alert("Temporary password sent to " + editUser.email);
    } catch (error) {
      alert("Error sending password: " + error.message);
    } finally {
      setResetLoading(false);
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
            <DialogTitle>{isEdit ? "Edit User" : "Invite User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  autoFocus
                />
              </div>
            )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(503) 555-0100"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Portland, OR 97201"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Hourly Wage ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.25"
              value={hourlyWage}
              onChange={(e) => setHourlyWage(e.target.value)}
              placeholder="e.g. 25.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => { 
              setRole(v); 
              if (v === "admin") setAllowedPages(ALL_PAGES.map(p => p.key));
              if (v === "manager") setAllowedPages(["projects", "time"]);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === "admin" && "Full access to all pages and admin controls."}
              {role === "manager" && "Access to Projects and Time Clock."}
              {role === "labor" && "Mobile clock-in dashboard only."}
            </p>
          </div>



          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {isEdit && (
              <Button 
                variant="outline" 
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="gap-2"
              >
                <Key className="w-4 h-4" />
                Reset Password
              </Button>
            )}
            <Button onClick={handleSave}>{editUser ? "Save Changes" : "Send Invite"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Team() {
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const [showInvite, setShowInvite] = useState(false);
   const [editUser, setEditUser] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) =>
      base44.functions.invoke("updateUserRole", { userId: id, role: data.role, allowed_pages: data.allowed_pages, phone: data.phone, dob: data.dob, address: data.address, hourly_wage: data.hourly_wage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const handleInvite = async ({ email, role, allowed_pages, phone, dob, address, hourly_wage }) => {
    const pages = role === "admin" ? ALL_PAGES.map((p) => p.key) : allowed_pages;

    // Invite the user
    await base44.users.inviteUser(email, role);

    // Update their profile with additional data
    const users = await base44.entities.User.list();
    const newUser = users.find((u) => u.email === email);

    if (newUser) {
      await base44.functions.invoke("updateUserRole", {
        userId: newUser.id,
        role,
        allowed_pages: pages,
        phone,
        dob,
        address,
        hourly_wage,
      });
    }

    setShowInvite(false);
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const handleEdit = async ({ role, allowed_pages, phone, dob, address, hourly_wage }) => {
    const pages = role === "admin" ? ALL_PAGES.map((p) => p.key) : allowed_pages;
    await updateMutation.mutateAsync({ id: editUser.id, data: { role, allowed_pages: pages, phone, dob, address, hourly_wage } });
    setEditUser(null);
    window.location.reload();
  };

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={`${users.length} team members`}
        action={
          <Button onClick={() => setShowInvite(true)} className="gap-2">
            <UserPlus className="w-4 h-4" /> Invite User
          </Button>
        }
      />

      {users.length === 0 && !isLoading ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description="Invite team members to get started"
          action={<Button onClick={() => setShowInvite(true)}>Invite User</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <Card
              key={user.id}
              className="p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/team/${user.id}`)}
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{user.full_name || "Unknown"}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {user.role && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        <Shield className="w-3 h-3 mr-1" />
                        {user.role}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setEditUser(user)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                   <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     <Phone className="w-3 h-3 shrink-0" />
                     <span>{user.phone || "—"}</span>
                   </div>
                   <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     <Cake className="w-3 h-3 shrink-0" />
                     <span>{user.dob ? format(new Date(user.dob), "MMM d, yyyy") : "—"}</span>
                   </div>
                   <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     <MapPin className="w-3 h-3 shrink-0" />
                     <span className="truncate">{user.address || "—"}</span>
                   </div>
                   <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     <DollarSign className="w-3 h-3 shrink-0" />
                     <span>{user.hourly_wage ? `$${Number(user.hourly_wage).toFixed(2)}/hr` : "—"}</span>
                   </div>
                 </div>
              {user.role === "manager" && user.allowed_pages?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1">
                  {user.allowed_pages.map((key) => {
                    const page = ALL_PAGES.find((p) => p.key === key);
                    return page ? (
                      <Badge key={key} variant="outline" className="text-xs">{page.label}</Badge>
                    ) : null;
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <UserFormDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        editUser={null}
        onSave={handleInvite}
      />

      {editUser && (
        <UserFormDialog
          open={!!editUser}
          onOpenChange={(o) => !o && setEditUser(null)}
          editUser={editUser}
          isCreating={false}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}