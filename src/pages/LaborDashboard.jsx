import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Play, Square, Megaphone, CalendarDays, Menu, Umbrella, PlusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import SearchableSelect from "@/components/labor/SearchableSelect";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, differenceInMinutes } from "date-fns";
import StatusBadge from "@/components/shared/StatusBadge";
import LaborNavDrawer from "@/components/labor/LaborNavDrawer";

// Pay periods: 11th-26th and 27th-10th of following month
function getPayPeriod(now) {
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();

  let start, end;
  if (day >= 11 && day <= 26) {
    // Period: 11th to 26th of current month
    start = new Date(year, month, 11);
    end = new Date(year, month, 26);
  } else if (day >= 27) {
    // Period: 27th of current month to 10th of next month
    start = new Date(year, month, 27);
    end = new Date(year, month + 1, 10);
  } else {
    // day <= 10: Period: 27th of previous month to 10th of current month
    start = new Date(year, month - 1, 27);
    end = new Date(year, month, 10);
  }
  return { start, end };
}

function getWeekStart(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d;
}

export default function LaborDashboard({ user }) {
  const queryClient = useQueryClient();
  const [navOpen, setNavOpen] = useState(false);

  // Clock state persisted in localStorage
  const [clockedIn, setClockedIn] = useState(() => {
    const saved = localStorage.getItem("bb_clock_in");
    return saved ? JSON.parse(saved) : null;
  });
  const [elapsed, setElapsed] = useState(0);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedCostCode, setSelectedCostCode] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ project: "", costCode: "", date: new Date().toISOString().split("T")[0], startTime: "", endTime: "", breakMins: "0", description: "" });

  const DEFAULT_COST_CODES = [
    "Concrete", "Electrical", "Excavation", "Finish Carpentry", "Framing",
    "General Labor", "HVAC", "Insulation", "Landscaping", "Masonry",
    "Painting", "Plumbing", "Roofing", "Siding", "Site Work", "Windows & Doors",
  ];

  const { data: appSettings = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const costCodesRecord = appSettings.find((s) => s.key === "cost_codes");
  const COST_CODES = (costCodesRecord ? JSON.parse(costCodesRecord.value) : DEFAULT_COST_CODES)
    .slice()
    .sort((a, b) => a.localeCompare(b));

  // Tick the elapsed timer
  useEffect(() => {
    if (!clockedIn) return;
    const interval = setInterval(() => {
      setElapsed(differenceInMinutes(new Date(), new Date(clockedIn.startTime)));
    }, 10000);
    setElapsed(differenceInMinutes(new Date(), new Date(clockedIn.startTime)));
    return () => clearInterval(interval);
  }, [clockedIn]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const { data: myEntries = [] } = useQuery({
    queryKey: ["my-time-entries", user?.email],
    queryFn: () => base44.entities.TimeEntry.filter({ employee_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: myUser } = useQuery({
    queryKey: ["my-user", user?.email],
    queryFn: () => base44.entities.User.filter({ email: user?.email }),
    enabled: !!user?.email,
    select: (data) => data?.[0],
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements-recent"],
    queryFn: () => base44.entities.Announcement.list("-created_date", 5),
  });

  const logTimeMutation = useMutation({
    mutationFn: (data) => base44.entities.TimeEntry.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-time-entries"] });
    },
  });

  const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));

  const handleClockIn = () => {
    if (!selectedProject || !selectedCostCode) return;
    const project = projects.find((p) => p.id === selectedProject);
    const clockData = {
      startTime: new Date().toISOString(),
      projectId: selectedProject,
      projectName: project?.name || "",
      costCode: selectedCostCode,
    };
    localStorage.setItem("bb_clock_in", JSON.stringify(clockData));
    setClockedIn(clockData);
  };

  const calcManualHours = () => {
    if (!manualForm.startTime || !manualForm.endTime) return 0;
    const [sh, sm] = manualForm.startTime.split(":").map(Number);
    const [eh, em] = manualForm.endTime.split(":").map(Number);
    const totalMins = (eh * 60 + em) - (sh * 60 + sm) - (parseFloat(manualForm.breakMins) || 0);
    return Math.max(0, Math.round((totalMins / 60) * 4) / 4);
  };

  const handleManualSubmit = async () => {
    const hours = calcManualHours();
    if (!manualForm.project || !manualForm.costCode || !manualForm.date || hours <= 0) return;
    const project = projects.find((p) => p.id === manualForm.project);
    await logTimeMutation.mutateAsync({
      project_id: manualForm.project,
      project_name: project?.name || "",
      date: manualForm.date,
      hours,
      description: manualForm.description || "",
      employee_email: user?.email || "",
      employee_name: user?.full_name || "",
      cost_code: manualForm.costCode,
    });
    setShowManual(false);
    setManualForm({ project: "", costCode: "", date: new Date().toISOString().split("T")[0], startTime: "", endTime: "", breakMins: "0", description: "" });
  };

  const handleClockOut = async () => {
    if (!clockedIn) return;
    const hours = Math.max(0.25, Math.round((elapsed / 60) * 4) / 4);

    await logTimeMutation.mutateAsync({
      project_id: clockedIn.projectId,
      project_name: clockedIn.projectName,
      date: new Date().toISOString().split("T")[0],
      hours,
      description: workDescription || "",
      employee_email: user?.email || "",
      employee_name: user?.full_name || "",
    });

    localStorage.removeItem("bb_clock_in");
    setClockedIn(null);
    setElapsed(0);
    setWorkDescription("");
    setSelectedProject("");
    setSelectedCostCode("");
  };

  // --- Time calculations ---
  const now = new Date();
  const weekStart = getWeekStart(now);
  const { start: payPeriodStart, end: payPeriodEnd } = getPayPeriod(now);
  const OVERTIME_THRESHOLD = 40; // hours/week

  const weekEntries = myEntries.filter((e) => new Date(e.date) >= weekStart);
  const weekTotal = weekEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const weekStraight = Math.min(weekTotal, OVERTIME_THRESHOLD);
  const weekOvertime = Math.max(0, weekTotal - OVERTIME_THRESHOLD);

  const payPeriodEntries = myEntries.filter((e) => {
    const d = new Date(e.date);
    return d >= payPeriodStart && d <= payPeriodEnd;
  });
  const payPeriodTotal = payPeriodEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  // Straight time is capped at 40hrs/week within the pay period
  const ppOvertime = Math.max(0, payPeriodTotal - OVERTIME_THRESHOLD);
  const ppStraight = Math.min(payPeriodTotal, OVERTIME_THRESHOLD);

  const ptoHours = myUser?.pto_hours || 0;

  const formatElapsed = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const greeting = now.getHours() < 12 ? "Morning" : now.getHours() < 17 ? "Afternoon" : "Evening";

  return (
    <div className="min-h-screen bg-background">
      <LaborNavDrawer open={navOpen} onClose={() => setNavOpen(false)} user={user} />

      {/* Header */}
      <div className="bg-sidebar px-5 pt-8 pb-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            {/* BB logo — tappable to open nav */}
            <button
              onClick={() => setNavOpen(true)}
              className="w-10 h-10 flex items-center justify-center shrink-0 active:opacity-70 transition-opacity"
              aria-label="Open navigation"
            >
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                <polygon points="24,2 46,24 24,46 2,24" fill="hsl(32,65%,52%)" />
                <text x="24" y="29" textAnchor="middle" fontFamily="serif" fontWeight="700" fontSize="14" fill="white">BB</text>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-barlow text-xs text-sidebar-primary/80 font-semibold tracking-widest uppercase">Brothers Building</p>
              <h1 className="font-barlow text-xl font-bold text-sidebar-foreground tracking-wider uppercase leading-tight">
                Good {greeting}, {user?.full_name?.split(" ")[0] || "there"}
              </h1>
            </div>
            <button
              onClick={() => setNavOpen(true)}
              className="text-sidebar-foreground/50 hover:text-sidebar-foreground p-1"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* This Week Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-sidebar-accent rounded-lg p-3">
              <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wide font-semibold">Straight Time</p>
              <p className="text-xs text-sidebar-foreground/40 mb-1">This Week</p>
              <p className="text-2xl font-bold text-sidebar-foreground">{weekStraight.toFixed(1)}<span className="text-sm font-normal text-sidebar-foreground/60 ml-1">hrs</span></p>
            </div>
            <div className="bg-sidebar-accent rounded-lg p-3">
              <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wide font-semibold">Overtime</p>
              <p className="text-xs text-sidebar-foreground/40 mb-1">This Week</p>
              <p className="text-2xl font-bold text-sidebar-primary">{weekOvertime.toFixed(1)}<span className="text-sm font-normal text-sidebar-foreground/60 ml-1">hrs</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4 pb-10">
        {/* Clock In / Out Card */}
        <Card className="p-5 shadow-lg border-0">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-sm uppercase tracking-wide font-barlow">Time Clock</h2>
          </div>

          {clockedIn ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Clocked In</span>
                </div>
                <p className="text-3xl font-bold text-emerald-800 font-barlow">{formatElapsed(elapsed)}</p>
                <p className="text-xs text-emerald-600 mt-1">{clockedIn.projectName}</p>
                {clockedIn.costCode && <p className="text-xs text-emerald-500 mt-0.5">Cost Code: {clockedIn.costCode}</p>}
                <p className="text-xs text-emerald-500 mt-0.5">
                  Started at {format(new Date(clockedIn.startTime), "h:mm a")}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">What did you work on? *</Label>
                <Textarea
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder="Brief description of work completed..."
                  rows={2}
                  className="text-sm"
                />
              </div>
              <Button
                onClick={handleClockOut}
                className="w-full bg-destructive hover:bg-destructive/90 text-white gap-2 h-12 text-base font-barlow font-semibold uppercase tracking-wide"
                disabled={logTimeMutation.isPending || !workDescription.trim()}
              >
                <Square className="w-4 h-4" />
                Clock Out
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Select Project *</Label>
                <SearchableSelect
                  options={sortedProjects.map((p) => ({ value: p.id, label: p.name }))}
                  value={selectedProject}
                  onValueChange={(val) => { setSelectedProject(val); setSelectedCostCode(""); }}
                  placeholder="Which job are you working?"
                />
              </div>
              {selectedProject && (
                <div className="space-y-2">
                  <Label className="text-xs">Cost Code *</Label>
                  <SearchableSelect
                    options={COST_CODES.map((code) => ({ value: code, label: code }))}
                    value={selectedCostCode}
                    onValueChange={setSelectedCostCode}
                    placeholder="Select a cost code..."
                  />
                </div>
              )}
              <Button
                onClick={handleClockIn}
                disabled={!selectedProject || !selectedCostCode}
                className="w-full bg-accent hover:bg-accent/90 text-white gap-2 h-12 text-base font-barlow font-semibold uppercase tracking-wide"
              >
                <Play className="w-4 h-4" />
                Clock In
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowManual(true)}
                className="w-full gap-2 font-barlow font-semibold uppercase tracking-wide"
              >
                <PlusCircle className="w-4 h-4" />
                Add Manual Hours
              </Button>
            </div>
          )}
        </Card>

        {/* Manual Hours Dialog */}
        <Dialog open={showManual} onOpenChange={setShowManual}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Manual Hours</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Project *</Label>
                <SearchableSelect
                  options={sortedProjects.map((p) => ({ value: p.id, label: p.name }))}
                  value={manualForm.project}
                  onValueChange={(val) => setManualForm((f) => ({ ...f, project: val, costCode: "" }))}
                  placeholder="Select a project..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cost Code *</Label>
                <SearchableSelect
                  options={COST_CODES.map((code) => ({ value: code, label: code }))}
                  value={manualForm.costCode}
                  onValueChange={(val) => setManualForm((f) => ({ ...f, costCode: val }))}
                  placeholder="Select a cost code..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date *</Label>
                <Input
                  type="date"
                  value={manualForm.date}
                  onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Time *</Label>
                  <Input
                    type="time"
                    value={manualForm.startTime}
                    onChange={(e) => setManualForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Time *</Label>
                  <Input
                    type="time"
                    value={manualForm.endTime}
                    onChange={(e) => setManualForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Break (mins)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    placeholder="0"
                    value={manualForm.breakMins}
                    onChange={(e) => setManualForm((f) => ({ ...f, breakMins: e.target.value }))}
                  />
                </div>
              </div>
              {manualForm.startTime && manualForm.endTime && calcManualHours() > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Total: <span className="font-semibold text-foreground">{calcManualHours()} hrs</span>
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Description *</Label>
                <Textarea
                  rows={2}
                  placeholder="What did you work on?"
                  value={manualForm.description}
                  onChange={(e) => setManualForm((f) => ({ ...f, description: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowManual(false)}>Cancel</Button>
                <Button
                  className="flex-1 bg-accent hover:bg-accent/90 text-white"
                  onClick={handleManualSubmit}
                  disabled={logTimeMutation.isPending || !manualForm.project || !manualForm.costCode || calcManualHours() <= 0 || !manualForm.description.trim()}
                >
                  Save Hours
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pay Period Summary */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-sm uppercase tracking-wide font-barlow">Pay Period Hours</h2>
            <span className="ml-auto text-xs text-muted-foreground">{format(payPeriodStart, "MMM d")} – {format(payPeriodEnd, "MMM d")}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Straight Time</p>
              <p className="text-2xl font-bold text-foreground font-barlow">{ppStraight.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">hrs</span></p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-700 uppercase tracking-wide font-semibold mb-1">Overtime</p>
              <p className="text-2xl font-bold text-amber-700 font-barlow">{ppOvertime.toFixed(1)}<span className="text-sm font-normal text-amber-500 ml-1">hrs</span></p>
            </div>
          </div>

          {/* PTO */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <Umbrella className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-semibold text-blue-800 font-barlow uppercase tracking-wide">Accumulated PTO</p>
            </div>
            <p className="text-xl font-bold text-blue-700 font-barlow">{ptoHours.toFixed(1)}<span className="text-sm font-normal text-blue-500 ml-1">hrs</span></p>
          </div>
        </Card>

        {/* Announcements */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-sm uppercase tracking-wide font-barlow">Announcements</h2>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No announcements</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="border-l-2 border-accent pl-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.priority !== "normal" && <StatusBadge status={a.priority} />}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.content}</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">{format(new Date(a.created_date), "MMM d")}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}