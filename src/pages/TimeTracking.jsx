import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export default function TimeTracking() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const [editingCostCode, setEditingCostCode] = useState({});
  const [editingApproval, setEditingApproval] = useState({});

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["timeEntries"],
    queryFn: () => base44.entities.TimeEntry.list("-date", 100),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const PROJECT_COST_CODES = useMemo(() => {
    const record = appSettings.find((s) => s.key === "project_cost_codes");
    return record ? JSON.parse(record.value) : [];
  }, [appSettings]);

  const [form, setForm] = useState({
    project_id: "",
    date: new Date().toISOString().split("T")[0],
    hours: "",
    description: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      const project = projects.find((p) => p.id === data.project_id);
      return base44.entities.TimeEntry.create({
        ...data,
        hours: Number(data.hours),
        project_name: project?.name || "",
        employee_email: user.email,
        employee_name: user.full_name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
      setShowForm(false);
      setForm({ project_id: "", date: new Date().toISOString().split("T")[0], hours: "", description: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TimeEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["timeEntries"] }),
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TimeEntry.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
      setEditingCostCode({});
      setEditingApproval({});
    },
  });

  const groupedByWeek = useMemo(() => {
    const groups = {};
    entries.forEach((e) => {
      const d = parseISO(e.date);
      const weekStart = new Date(d);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = weekStart.toISOString();
      if (!groups[weekKey]) groups[weekKey] = [];
      groups[weekKey].push(e);
    });
    return groups;
  }, [entries]);

  const getRegOTHours = (entry, allEntriesForWeek) => {
    const entryIndex = allEntriesForWeek.findIndex((e) => e.id === entry.id);
    let cumulative = 0;
    for (let i = 0; i <= entryIndex; i++) {
      cumulative += allEntriesForWeek[i].hours || 0;
    }
    const prevCumulative = cumulative - (entry.hours || 0);
    const regHours = Math.max(0, Math.min(40, cumulative) - prevCumulative);
    const otHours = Math.max(0, (entry.hours || 0) - regHours);
    return { regHours, otHours };
  };

  const totalHours = entries.reduce((s, e) => s + (e.hours || 0), 0);

  return (
    <div>
      <PageHeader
        title="Time Cards"
        subtitle={`${entries.length} time cards`}
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Time
          </Button>
        }
      />

      {entries.length === 0 && !isLoading ? (
        <EmptyState
          icon={Clock}
          title="No time cards"
          description="Add your first time card to get started"
          action={<Button onClick={() => setShowForm(true)}>Add Time</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Reg Hours</TableHead>
                  <TableHead className="text-right">OT Hours</TableHead>
                  <TableHead>Cost Code</TableHead>
                  <TableHead className="text-center">Approved</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const weekKey = Object.keys(groupedByWeek).find((k) => groupedByWeek[k].includes(entry));
                  const { regHours, otHours } = weekKey ? getRegOTHours(entry, groupedByWeek[weekKey]) : { regHours: entry.hours, otHours: 0 };
                  const isEditingCostCode = editingCostCode[entry.id];
                  const isEditingApproval = editingApproval[entry.id];

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">{format(new Date(entry.date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-sm font-medium">{entry.employee_name || "—"}</TableCell>
                      <TableCell className="text-sm">{entry.project_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{entry.description || "—"}</TableCell>
                      <TableCell className="text-sm font-semibold text-right">{regHours > 0 ? `${regHours.toFixed(2)}h` : "—"}</TableCell>
                      <TableCell className="text-sm font-semibold text-right text-amber-700">{otHours > 0 ? `${otHours.toFixed(2)}h` : "—"}</TableCell>
                      <TableCell className="text-sm">
                        {isEditingCostCode ? (
                          <div className="flex gap-2">
                            <Select
                              value={entry.cost_code || ""}
                              onValueChange={(val) =>
                                updateEntryMutation.mutate({ id: entry.id, data: { cost_code: val } })
                              }
                            >
                              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PROJECT_COST_CODES.map((code) => (
                                  <SelectItem key={code} value={code}>{code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCostCode({ ...editingCostCode, [entry.id]: true })}
                            className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {entry.cost_code || "—"}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={entry.approved || false}
                          onCheckedChange={(checked) =>
                            updateEntryMutation.mutate({ id: entry.id, data: { approved: checked } })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(entry.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Time</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Hours *</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  placeholder="8"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What did you work on?"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={!form.project_id || !form.hours}>Log Time</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}