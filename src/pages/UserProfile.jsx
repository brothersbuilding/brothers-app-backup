import React, { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Save, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.find((u) => u.id === id) || null;
    },
  });

  const { data: allTeamMembers = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users;
    },
  });

  const [phone, setPhone] = useState(user?.phone || "");
  const [dob, setDob] = useState(user?.dob || "");
  const [address, setAddress] = useState(user?.address || "");
  const [hourlyWage, setHourlyWage] = useState(user?.hourly_wage || "");
  const [supervisorId, setSupervisorId] = useState(user?.supervisor_id || "");
  const [supervisorName, setSupervisorName] = useState(user?.supervisor_name || "");
  const [role, setRole] = useState(user?.role || "labor");
  const [allowedPages, setAllowedPages] = useState(
    user?.role === "admin" || !user?.allowed_pages?.length
      ? ALL_PAGES.map((p) => p.key)
      : user?.allowed_pages || []
  );
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [supervisorOpen, setSupervisorOpen] = useState(false);

  const filteredSupervisors = useMemo(() => {
    return allTeamMembers.filter((member) =>
      member.full_name.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
      member.email.toLowerCase().includes(supervisorSearch.toLowerCase())
    );
  }, [supervisorSearch, allTeamMembers]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await base44.functions.invoke("updateUserRole", {
        userId: id,
        role,
        allowed_pages: role === "admin" ? ALL_PAGES.map((p) => p.key) : allowedPages,
        phone,
        dob,
        address,
        hourly_wage: hourlyWage ? Number(hourlyWage) : undefined,
        supervisor_id: supervisorId,
        supervisor_name: supervisorName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const togglePage = (key) => {
    setAllowedPages((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/team" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">User Profile</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left side - Avatar & basic info */}
        <Card className="p-6 lg:col-span-1 h-fit">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-semibold">{user.full_name || "Unknown"}</h2>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
            {user.role && (
              <Badge className="mt-3 capitalize">{user.role}</Badge>
            )}
          </div>
        </Card>

        {/* Right side - Form */}
        <Card className="p-6 lg:col-span-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
            className="space-y-6"
          >
            {/* Contact Info */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(503) 555-0100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date of Birth</Label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5 mt-4">
                <Label className="text-xs">Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Portland, OR 97201"
                />
              </div>
            </div>

            {/* Employment Info */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-sm mb-3">Employment Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Role</Label>
                  <Select value={role} onValueChange={(v) => {
                    setRole(v);
                    if (v === "admin") setAllowedPages(ALL_PAGES.map((p) => p.key));
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
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hourly Wage ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    value={hourlyWage}
                    onChange={(e) => setHourlyWage(e.target.value)}
                    placeholder="e.g. 25.00"
                  />
                </div>
              </div>
              <div className="space-y-1.5 mt-4">
                <Label className="text-xs">Supervisor</Label>
                <Popover open={supervisorOpen} onOpenChange={setSupervisorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {supervisorName || "Select supervisor..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search by name or email..."
                        value={supervisorSearch}
                        onValueChange={setSupervisorSearch}
                      />
                      <CommandEmpty>No team members found.</CommandEmpty>
                      <CommandGroup>
                        {filteredSupervisors.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={member.id}
                            onSelect={() => {
                              setSupervisorId(member.id);
                              setSupervisorName(member.full_name);
                              setSupervisorOpen(false);
                              setSupervisorSearch("");
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{member.full_name}</span>
                              <span className="text-xs text-muted-foreground">{member.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                {supervisorId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSupervisorId("");
                      setSupervisorName("");
                    }}
                    className="text-xs text-muted-foreground"
                  >
                    <X className="w-3 h-3 mr-1" /> Clear supervisor
                  </Button>
                )}
              </div>
            </div>

            {/* Page Access */}
            {role === "manager" && (
              <div className="border-t pt-6">
                <h3 className="font-semibold text-sm mb-3">Page Access</h3>
                <div className="grid grid-cols-2 gap-3">
                  {ALL_PAGES.map((page) => (
                    <label key={page.key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={allowedPages.includes(page.key)}
                        onChange={() => togglePage(page.key)}
                        className="w-4 h-4 rounded border-input"
                      />
                      <span className="text-sm">{page.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-6 flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate("/team")}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
                <Save className="w-4 h-4" /> Save Profile
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}