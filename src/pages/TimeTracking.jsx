import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { format, parseISO } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export default function TimeCards() {
   const [showForm, setShowForm] = useState(false);
   const queryClient = useQueryClient();
   const [editingCostCode, setEditingCostCode] = useState({});
   const [editingApproval, setEditingApproval] = useState({});
   const [pendingSortField, setPendingSortField] = useState("date");
   const [pendingSortDir, setPendingSortDir] = useState("desc");
   const [approvedSortField, setApprovedSortField] = useState("date");
   const [approvedSortDir, setApprovedSortDir] = useState("desc");
   const [pendingFilter, setPendingFilter] = useState({ type: null, value: null });
   const [approvedFilter, setApprovedFilter] = useState({ type: null, value: null });

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

  const pendingEntries = entries.filter((e) => !e.approved);
  const approvedEntries = entries.filter((e) => e.approved);

  const sortEntries = (list, field, dir) => {
    return [...list].sort((a, b) => {
      let va = a[field] ?? "";
      let vb = b[field] ?? "";
      if (field === "hours") { va = Number(va); vb = Number(vb); }
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedPending = sortEntries(pendingEntries, pendingSortField, pendingSortDir);
  const sortedApproved = sortEntries(approvedEntries, approvedSortField, approvedSortDir);

  const toggleSort = (field, current, setField, setDir) => {
    if (current === field) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setField(field);
      setDir("asc");
    }
  };

  const SortIndicator = ({ field, sortField, sortDir }) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const applyFilter = (list, filter) => {
    if (!filter.type || !filter.value) return list;
    return list.filter((e) => {
      if (filter.type === "employee") return e.employee_name === filter.value;
      if (filter.type === "date") return e.date === filter.value;
      if (filter.type === "project") return e.project_name === filter.value;
      return true;
    });
  };

  const getUniqueValues = (list, field) => [...new Set(list.map((e) => e[field]))].filter(Boolean).sort();

  const filteredPending = applyFilter(pendingEntries, pendingFilter);
  const filteredApproved = applyFilter(approvedEntries, approvedFilter);

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
        <div className="space-y-6">
          {/* Pending Timecards */}
          <Card className="overflow-hidden flex flex-col">
            <div className="bg-muted/50 p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-base">Timecards Needing Approval</h2>
                  <p className="text-xs text-muted-foreground mt-1">{filteredPending.length} of {pendingEntries.length} pending</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Select value={pendingFilter.type || ""} onValueChange={(val) => setPendingFilter({ type: val, value: null })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Filter by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
                {pendingFilter.type && (
                  <Select value={pendingFilter.value || ""} onValueChange={(val) => setPendingFilter({ ...pendingFilter, value: val })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getUniqueValues(pendingEntries, pendingFilter.type === "employee" ? "employee_name" : pendingFilter.type === "date" ? "date" : "project_name").map((val) => (
                        <SelectItem key={val} value={val}>{val}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {pendingFilter.value && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPendingFilter({ type: null, value: null })}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto flex-1 flex flex-col">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow className="bg-muted/30">
                    <TableHead className="cursor-pointer select-none text-xs" onClick={() => toggleSort("date", pendingSortField, setPendingSortField, setPendingSortDir)}>
                      Date<SortIndicator field="date" sortField={pendingSortField} sortDir={pendingSortDir} />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-xs" onClick={() => toggleSort("employee_name", pendingSortField, setPendingSortField, setPendingSortDir)}>
                      Employee<SortIndicator field="employee_name" sortField={pendingSortField} sortDir={pendingSortDir} />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-xs" onClick={() => toggleSort("project_name", pendingSortField, setPendingSortField, setPendingSortDir)}>
                      Project<SortIndicator field="project_name" sortField={pendingSortField} sortDir={pendingSortDir} />
                    </TableHead>
                    <TableHead className="text-right text-xs">Hours</TableHead>
                    <TableHead className="text-right text-xs">Per Diem</TableHead>
                    <TableHead className="text-right text-xs">Trip Fee</TableHead>
                    <TableHead className="text-right text-xs">Markup %</TableHead>
                    <TableHead className="text-right text-xs">Bill Rate</TableHead>
                    <TableHead className="text-xs">Cost Code</TableHead>
                    <TableHead className="text-center text-xs">Approve</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortEntries(filteredPending, pendingSortField, pendingSortDir).slice(0, 10).map((entry) => {
                    const weekKey = Object.keys(groupedByWeek).find((k) => groupedByWeek[k].includes(entry));
                    const { regHours, otHours } = weekKey ? getRegOTHours(entry, groupedByWeek[weekKey]) : { regHours: entry.hours, otHours: 0 };
                    const isEditingCostCode = editingCostCode[entry.id];

                    return (
                      <TableRow key={entry.id} className="text-xs">
                        <TableCell className="whitespace-nowrap">{format(new Date(entry.date), "MMM d")}</TableCell>
                        <TableCell className="font-medium truncate max-w-xs">{entry.employee_name || "—"}</TableCell>
                        <TableCell className="truncate max-w-xs">{entry.project_name || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{regHours > 0 ? `${regHours.toFixed(1)}h` : "—"}</TableCell>
                        <TableCell className="text-right">{entry.per_diem ? `$${entry.per_diem.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-right">{entry.trip_fee ? `$${entry.trip_fee.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-right">{entry.markup ? `${entry.markup}%` : "—"}</TableCell>
                        <TableCell className="text-right">{entry.billable_rate ? `$${entry.billable_rate.toFixed(2)}/h` : "—"}</TableCell>
                        <TableCell>
                          {isEditingCostCode ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="w-28 justify-between text-xs h-7">
                                  {entry.cost_code || "Select..."}
                                  <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-28 p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search..." className="text-xs" />
                                  <CommandEmpty className="text-xs">No codes.</CommandEmpty>
                                  <CommandGroup className="max-h-40 overflow-y-auto">
                                    {PROJECT_COST_CODES.map((code) => (
                                      <CommandItem
                                        key={code}
                                        value={code}
                                        onSelect={() =>
                                          updateEntryMutation.mutate({ id: entry.id, data: { cost_code: code } })
                                        }
                                        className="text-xs"
                                      >
                                        <Check className={`mr-2 h-3 w-3 ${entry.cost_code === code ? "opacity-100" : "opacity-0"}`} />
                                        {code}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <button
                              onClick={() => setEditingCostCode({ ...editingCostCode, [entry.id]: true })}
                              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              {entry.cost_code || "—"}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={false}
                            onCheckedChange={(checked) =>
                              updateEntryMutation.mutate({ id: entry.id, data: { approved: checked } })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(entry.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {sortEntries(filteredPending, pendingSortField, pendingSortDir).length > 10 && (
                <div className="py-2 px-4 text-xs text-muted-foreground border-t border-border">
                  Scroll to see {sortEntries(filteredPending, pendingSortField, pendingSortDir).length - 10} more...
                </div>
              )}
            </div>
          </Card>

          {/* Approved Timecards */}
          <Card className="overflow-hidden flex flex-col">
            <div className="bg-muted/50 p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-base">Approved Timecards</h2>
                  <p className="text-xs text-muted-foreground mt-1">{filteredApproved.length} of {approvedEntries.length} approved</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Select value={approvedFilter.type || ""} onValueChange={(val) => setApprovedFilter({ type: val, value: null })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Filter by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
                {approvedFilter.type && (
                  <Select value={approvedFilter.value || ""} onValueChange={(val) => setApprovedFilter({ ...approvedFilter, value: val })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getUniqueValues(approvedEntries, approvedFilter.type === "employee" ? "employee_name" : approvedFilter.type === "date" ? "date" : "project_name").map((val) => (
                        <SelectItem key={val} value={val}>{val}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {approvedFilter.value && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setApprovedFilter({ type: null, value: null })}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto flex-1 flex flex-col">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow className="bg-muted/30">
                    <TableHead className="cursor-pointer select-none text-xs" onClick={() => toggleSort("date", approvedSortField, setApprovedSortField, setApprovedSortDir)}>
                      Date<SortIndicator field="date" sortField={approvedSortField} sortDir={approvedSortDir} />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-xs" onClick={() => toggleSort("employee_name", approvedSortField, setApprovedSortField, setApprovedSortDir)}>
                      Employee<SortIndicator field="employee_name" sortField={approvedSortField} sortDir={approvedSortDir} />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-xs" onClick={() => toggleSort("project_name", approvedSortField, setApprovedSortField, setApprovedSortDir)}>
                      Project<SortIndicator field="project_name" sortField={approvedSortField} sortDir={approvedSortDir} />
                    </TableHead>
                    <TableHead className="text-right text-xs">Hours</TableHead>
                    <TableHead className="text-right text-xs">Per Diem</TableHead>
                    <TableHead className="text-right text-xs">Trip Fee</TableHead>
                    <TableHead className="text-right text-xs">Markup %</TableHead>
                    <TableHead className="text-right text-xs">Bill Rate</TableHead>
                    <TableHead className="text-xs">Cost Code</TableHead>
                    <TableHead className="text-center text-xs">Approved</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortEntries(filteredApproved, approvedSortField, approvedSortDir).slice(0, 10).map((entry) => {
                    const weekKey = Object.keys(groupedByWeek).find((k) => groupedByWeek[k].includes(entry));
                    const { regHours, otHours } = weekKey ? getRegOTHours(entry, groupedByWeek[weekKey]) : { regHours: entry.hours, otHours: 0 };
                    const isEditingCostCode = editingCostCode[entry.id];

                    return (
                      <TableRow key={entry.id} className="text-xs">
                        <TableCell className="whitespace-nowrap">{format(new Date(entry.date), "MMM d")}</TableCell>
                        <TableCell className="font-medium truncate max-w-xs">{entry.employee_name || "—"}</TableCell>
                        <TableCell className="truncate max-w-xs">{entry.project_name || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{regHours > 0 ? `${regHours.toFixed(1)}h` : "—"}</TableCell>
                        <TableCell className="text-right">{entry.per_diem ? `$${entry.per_diem.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-right">{entry.trip_fee ? `$${entry.trip_fee.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-right">{entry.markup ? `${entry.markup}%` : "—"}</TableCell>
                        <TableCell className="text-right">{entry.billable_rate ? `$${entry.billable_rate.toFixed(2)}/h` : "—"}</TableCell>
                        <TableCell>
                          {isEditingCostCode ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="w-28 justify-between text-xs h-7">
                                  {entry.cost_code || "Select..."}
                                  <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-28 p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search..." className="text-xs" />
                                  <CommandEmpty className="text-xs">No codes.</CommandEmpty>
                                  <CommandGroup className="max-h-40 overflow-y-auto">
                                    {PROJECT_COST_CODES.map((code) => (
                                      <CommandItem
                                        key={code}
                                        value={code}
                                        onSelect={() =>
                                          updateEntryMutation.mutate({ id: entry.id, data: { cost_code: code } })
                                        }
                                        className="text-xs"
                                      >
                                        <Check className={`mr-3 h-3 w-3 ${entry.cost_code === code ? "opacity-100" : "opacity-0"}`} />
                                        {code}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <button
                              onClick={() => setEditingCostCode({ ...editingCostCode, [entry.id]: true })}
                              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              {entry.cost_code || "—"}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={true}
                            onCheckedChange={(checked) =>
                              updateEntryMutation.mutate({ id: entry.id, data: { approved: checked } })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(entry.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {sortEntries(filteredApproved, approvedSortField, approvedSortDir).length > 10 && (
                <div className="py-2 px-4 text-xs text-muted-foreground border-t border-border">
                  Scroll to see {sortEntries(filteredApproved, approvedSortField, approvedSortDir).length - 10} more...
                </div>
              )}
            </div>
          </Card>
        </div>
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