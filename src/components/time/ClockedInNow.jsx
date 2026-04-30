import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { differenceInSeconds, format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function ElapsedTimer({ clockIn }) {
  const [secs, setSecs] = useState(differenceInSeconds(new Date(), new Date(clockIn)));

  useEffect(() => {
    const interval = setInterval(() => {
      setSecs(differenceInSeconds(new Date(), new Date(clockIn)));
    }, 1000);
    return () => clearInterval(interval);
  }, [clockIn]);

  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return <span className="font-mono font-bold text-emerald-700">{h}:{m}:{s}</span>;
}

function Initials({ name }) {
  const parts = (name || "?").trim().split(" ");
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0][0];
  return (
    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
      {initials}
    </div>
  );
}

export default function ClockedInNow({ isAdmin }) {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [confirmEntry, setConfirmEntry] = useState(null); // entry to clock out
  const [secondsAgo, setSecondsAgo] = useState(0);

  const { data: activeEntries = [] } = useQuery({
    queryKey: ["clocked-in-now"],
    queryFn: async () => {
      const entries = await base44.entities.TimeEntry.filter({ clock_status: "active" });
      return entries.filter(e => e.clock_in && !e.clock_out);
    },
    refetchInterval: 60000,
    onSuccess: () => setLastUpdated(new Date()),
  });

  // Tick "last updated X seconds ago"
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(differenceInSeconds(new Date(), lastUpdated));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const clockOutMutation = useMutation({
    mutationFn: ({ id, clockIn }) => {
      const clockOut = new Date().toISOString();
      const totalHours = Math.max(0.25, Math.round((differenceInSeconds(new Date(), new Date(clockIn)) / 3600) * 4) / 4);
      return base44.entities.TimeEntry.update(id, {
        clock_out: clockOut,
        clock_status: "complete",
        hours: totalHours,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clocked-in-now"] });
      queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
      setConfirmEntry(null);
    },
  });

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="font-semibold text-base">
            Currently Clocked In
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
              {activeEntries.length}
            </span>
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Last updated {secondsAgo}s ago
        </span>
      </div>

      {/* Grid */}
      {activeEntries.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No employees currently clocked in.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {activeEntries.map((entry) => (
            <Card key={entry.id} className="p-4 border-l-4 border-l-emerald-400">
              <div className="flex items-start gap-3">
                <Initials name={entry.employee_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <p className="font-semibold text-sm truncate">{entry.employee_name || "Unknown"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    In at {format(new Date(entry.clock_in), "h:mm a")}
                  </p>
                  {entry.project_name && (
                    <p className="text-xs text-muted-foreground truncate">{entry.project_name}</p>
                  )}
                  <div className="mt-1 text-sm">
                    <ElapsedTimer clockIn={entry.clock_in} />
                  </div>
                </div>
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setConfirmEntry(entry)}
                >
                  <Square className="w-3 h-3" />
                  Clock Out
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={!!confirmEntry} onOpenChange={(open) => !open && setConfirmEntry(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clock Out Employee?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Clock out <strong>{confirmEntry?.employee_name}</strong>? This will record the current time as their clock-out.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmEntry(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={clockOutMutation.isPending}
              onClick={() => clockOutMutation.mutate({ id: confirmEntry.id, clockIn: confirmEntry.clock_in })}
            >
              {clockOutMutation.isPending ? "Clocking Out…" : "Confirm Clock Out"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}