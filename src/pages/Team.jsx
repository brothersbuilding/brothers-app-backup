import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Mail, Shield, UserPlus, Pencil } from "lucide-react";
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
  const isEdit = !!editUser;
  const [email, setEmail] = useState(editUser?.email || "");
  const [role, setRole] = useState(editUser?.role || "labor");
  const [allowedPages, setAllowedPages] = useState(
    editUser?.allowed_pages || ALL_PAGES.map((p) => p.key)
  );

  const togglePage = (key) => {
    setAllowedPages((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSave = () => {
    onSave({ email, role, allowed_pages: allowedPages });
  };

  const showPagePerms = role !== "labor" && role !== "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
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

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => { setRole(v); if (v === "admin") setAllowedPages(ALL_PAGES.map(p => p.key)); }}>
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
              {role === "manager" && "Sidebar access — choose which pages they can see."}
              {role === "labor" && "Mobile clock-in dashboard only."}
            </p>
          </div>

          {showPagePerms && (
            <div className="space-y-2">
              <Label>Page Access</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PAGES.map((page) => (
                  <div key={page.key} className="flex items-center gap-2">
                    <Checkbox
                      id={page.key}
                      checked={allowedPages.includes(page.key)}
                      onCheckedChange={() => togglePage(page.key)}
                    />
                    <label htmlFor={page.key} className="text-sm cursor-pointer">{page.label}</label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!isEdit && !email.trim()}>
              {isEdit ? "Save Changes" : "Send Invite"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Team() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const handleInvite = async ({ email, role, allowed_pages }) => {
    await base44.users.inviteUser(email, role);
    if (role !== "labor") {
      const pages = role === "admin" ? ALL_PAGES.map((p) => p.key) : allowed_pages;
      // allowed_pages will be set when the user record is created via invite
    }
    setShowInvite(false);
  };

  const handleEdit = async ({ role, allowed_pages }) => {
    const pages = role === "admin" ? ALL_PAGES.map((p) => p.key) : allowed_pages;
    await updateMutation.mutateAsync({ id: editUser.id, data: { role, allowed_pages: pages } });
    setEditUser(null);
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
            <Card key={user.id} className="p-5 hover:shadow-md transition-shadow">
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
                  {user.role && (
                    <Badge variant="secondary" className="mt-2 text-xs capitalize">
                      <Shield className="w-3 h-3 mr-1" />
                      {user.role}
                    </Badge>
                  )}
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
          onSave={handleEdit}
        />
      )}
    </div>
  );
}