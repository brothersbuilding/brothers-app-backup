import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Play, Square, CheckCircle2, Megaphone, HardHat, CalendarDays, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format, differenceInMinutes } from "date-fns";
import StatusBadge from "@/components/shared/StatusBadge";

export default function LaborDashboard({ user }) {
  const queryClient = useQueryClient();

  // Clock state persisted in localStorage
  const [clockedIn, setClockedIn] = useState(() => {
    const saved = localStorage.getItem("bb_clock_in");
    return saved ? JSON.parse(saved) : null;
  });
  const [elapsed, setElapsed] = useState(0);
  const [selectedProject, setSelectedProject] = useState("");
  const [workDescription, setWorkDescription] = useState("");

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

  const activeProjects = projects.filter((p) => p.status === "in_progress" || p.status === "planning");

  const handleClockIn = () => {
    if (!selectedProject) return;
    const project = projects.find((p) => p.id === selectedProject);
    const clockData = {
      startTime: new Date().toISOString(),
      projectId: selectedProject,
      projectName: project?.name || "",
    };
    localStorage.setItem("bb_clock_in", JSON.stringify(clockData));
    setClockedIn(clockData);
  };

  const handleClockOut = async () => {
    if (!clockedIn) return;
    const hours = Math.max(0.25, Math.round((elapsed / 60) * 4) / 4);
    const project = projects.find((p) => p.id === clockedIn.projectId);

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
  };

  const totalHoursThisWeek = myEntries
    .filter((e) => {
      const entryDate = new Date(e.date);
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      return entryDate >= weekStart;
    })
    .reduce((sum, e) => sum + (e.hours || 0), 0);

  const formatElapsed = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-sidebar px-5 pt-8 pb-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                <polygon points="24,2 46,24 24,46 2,24" fill="hsl(32,65%,52%)" />
                <text x="24" y="29" textAnchor="middle" fontFamily="serif" fontWeight="700" fontSize="14" fill="white">BB</text>
              </svg>
            </div>
            <div>
              <p className="font-barlow text-xs text-sidebar-primary/80 font-semibold tracking-widest uppercase">Brothers Building</p>
              <h1 className="font-barlow text-xl font-bold text-sidebar-foreground tracking-wider uppercase leading-tight">
                Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, {user?.full_name?.split(" ")[0] || "there"}
              </h1>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-sidebar-accent rounded-lg p-3">
              <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wide font-semibold">This Week</p>
              <p className="text-2xl font-bold text-sidebar-foreground mt-1">{totalHoursThisWeek.toFixed(1)}<span className="text-sm font-normal text-sidebar-foreground/60 ml-1">hrs</span></p>
            </div>
            <div className="bg-sidebar-accent rounded-lg p-3">
              <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wide font-semibold">Total Entries</p>
              <p className="text-2xl font-bold text-sidebar-foreground mt-1">{myEntries.length}</p>
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
              {/* Currently clocked in */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Clocked In</span>
                </div>
                <p className="text-3xl font-bold text-emerald-800 font-barlow">{formatElapsed(elapsed)}</p>
                <p className="text-xs text-emerald-600 mt-1">{clockedIn.projectName}</p>
                <p className="text-xs text-emerald-500 mt-0.5">
                  Started at {format(new Date(clockedIn.startTime), "h:mm a")}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">What did you work on?</Label>
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
                disabled={logTimeMutation.isPending}
              >
                <Square className="w-4 h-4" />
                Clock Out
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Select Project *</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Which job are you working?" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleClockIn}
                disabled={!selectedProject}
                className="w-full bg-accent hover:bg-accent/90 text-white gap-2 h-12 text-base font-barlow font-semibold uppercase tracking-wide"
              >
                <Play className="w-4 h-4" />
                Clock In
              </Button>
            </div>
          )}
        </Card>

        {/* Recent Time Entries */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-accent" />
              <h2 className="font-semibold text-sm uppercase tracking-wide font-barlow">Recent Hours</h2>
            </div>
          </div>
          {myEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No time entries yet</p>
          ) : (
            <div className="space-y-2">
              {myEntries.slice(0, 7).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{entry.project_name || "—"}</p>
                    {entry.description && (
                      <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-accent">{entry.hours}h</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(entry.date), "MMM d")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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

        {/* Active Projects */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <HardHat className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-sm uppercase tracking-wide font-barlow">Active Projects</h2>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active projects</p>
          ) : (
            <div className="space-y-2">
              {activeProjects.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {p.address && <p className="text-xs text-muted-foreground truncate">{p.address}</p>}
                  </div>
                  <div className="shrink-0 ml-3">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}