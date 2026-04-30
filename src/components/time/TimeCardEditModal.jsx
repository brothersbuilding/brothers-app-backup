import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInMinutes, parseISO } from "date-fns";

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toHHMM(iso) {
  if (!iso) return "";
  return format(new Date(iso), "HH:mm");
}

function buildISO(dateStr, timeHHMM) {
  if (!dateStr || !timeHHMM) return null;
  return new Date(`${dateStr}T${timeHHMM}:00`).toISOString();
}

function calcHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null;
  const diff = differenceInMinutes(new Date(clockOut), new Date(clockIn));
  if (diff <= 0) return null;
  return Math.round((diff / 60) * 4) / 4; // quarter-hour precision
}

export default function TimeCardEditModal({ entry, projects, costCodes, open, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [timeError, setTimeError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setTimeError("");
    setForm({
      date: entry.date || "",
      timeIn: toHHMM(entry.clock_in),
      timeOut: toHHMM(entry.clock_out),
      project_id: entry.project_id || "",
      project_name: entry.project_name || "",
      reg_hours: entry.hours != null ? String(Number(entry.hours).toFixed(1)) : "",
      ot_hours: "0.0",
      per_diem: entry.per_diem != null ? String(entry.per_diem) : "",
      trip_fee: entry.trip_fee != null ? String(entry.trip_fee) : "",
      markup: entry.markup != null ? String(entry.markup) : "",
      billable_rate: entry.billable_rate != null ? String(entry.billable_rate) : "",
      cost_code: entry.cost_code || "",
      description: entry.description || "",
    });
  }, [entry]);

  if (!entry) return null;

  const entryDate = new Date(entry.date + "T12:00:00");
  const dayName = DOW[entryDate.getDay()];
  const dateLabel = format(entryDate, "MM/dd");
  const headerTitle = `${entry.employee_name || "Employee"} — ${dayName} ${dateLabel}`;

  const handleTimeChange = (field, val) => {
    const updated = { ...form, [field]: val };

    // Rebuild ISO timestamps using current date
    const newClockIn = field === "timeIn" ? buildISO(updated.date, val) : buildISO(updated.date, updated.timeIn);
    const newClockOut = field === "timeOut" ? buildISO(updated.date, val) : buildISO(updated.date, updated.timeOut);

    if (newClockIn && newClockOut) {
      if (new Date(newClockOut) <= new Date(newClockIn)) {
        setTimeError("Time Out cannot be before or equal to Time In");
        setForm(updated);
        return;
      }
      setTimeError("");
      const total = calcHours(newClockIn, newClockOut);
      if (total !== null) {
        updated.reg_hours = String(total.toFixed(1));
      }
    } else {
      setTimeError("");
    }

    setForm(updated);
  };

  const handleProjectChange = (val) => {
    const proj = projects.find((p) => p.id === val);
    setForm({ ...form, project_id: val, project_name: proj?.name || "" });
  };

  const buildPayload = () => ({
    date: form.date,
    clock_in: buildISO(form.date, form.timeIn),
    clock_out: buildISO(form.date, form.timeOut),
    clock_status: form.timeOut ? "complete" : entry.clock_status,
    project_id: form.project_id,
    project_name: form.project_name,
    hours: parseFloat(form.reg_hours) || 0,
    per_diem: parseFloat(form.per_diem) || 0,
    trip_fee: parseFloat(form.trip_fee) || 0,
    markup: parseFloat(form.markup) || 0,
    billable_rate: parseFloat(form.billable_rate) || 0,
    cost_code: form.cost_code,
    description: form.description,
  });

  const handleSave = async (approve = false) => {
    if (timeError) return;
    setSaving(true);
    const payload = buildPayload();
    if (approve) payload.approved = true;
    await base44.entities.TimeEntry.update(entry.id, payload);
    setSaving(false);
    onSaved();
    onClose();
  };

  const field = (label, children) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{headerTitle}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {field("Date",
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-8 text-sm" />
          )}

          <div /> {/* spacer */}

          {field("Time In",
            <Input type="time" value={form.timeIn} onChange={(e) => handleTimeChange("timeIn", e.target.value)} className="h-8 text-sm" />
          )}
          <div>
            {field("Time Out",
              <Input type="time" value={form.timeOut} onChange={(e) => handleTimeChange("timeOut", e.target.value)} className="h-8 text-sm" />
            )}
            {timeError && <p className="text-xs text-destructive mt-1">{timeError}</p>}
          </div>

          <div className="col-span-2">
            {field("Project",
              <Select value={form.project_id} onValueChange={handleProjectChange}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {field("Regular Hours",
            <Input type="number" step="0.1" min="0" value={form.reg_hours} onChange={(e) => setForm({ ...form, reg_hours: e.target.value })} className="h-8 text-sm" />
          )}
          {field("OT Hours",
            <Input type="number" step="0.1" min="0" value={form.ot_hours} onChange={(e) => setForm({ ...form, ot_hours: e.target.value })} className="h-8 text-sm" />
          )}

          {field("Per Diem ($)",
            <Input type="number" step="0.01" min="0" value={form.per_diem} onChange={(e) => setForm({ ...form, per_diem: e.target.value })} className="h-8 text-sm" />
          )}
          {field("Trip Fee ($)",
            <Input type="number" step="0.01" min="0" value={form.trip_fee} onChange={(e) => setForm({ ...form, trip_fee: e.target.value })} className="h-8 text-sm" />
          )}

          {field("Markup %",
            <Input type="number" step="0.1" min="0" value={form.markup} onChange={(e) => setForm({ ...form, markup: e.target.value })} className="h-8 text-sm" />
          )}
          {field("Bill Rate ($/h)",
            <Input type="number" step="0.01" min="0" value={form.billable_rate} onChange={(e) => setForm({ ...form, billable_rate: e.target.value })} className="h-8 text-sm" />
          )}

          {field("Cost Code",
            costCodes.length > 0 ? (
              <Select value={form.cost_code} onValueChange={(v) => setForm({ ...form, cost_code: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {costCodes.map((c) => <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.cost_code} onChange={(e) => setForm({ ...form, cost_code: e.target.value })} className="h-8 text-sm" placeholder="e.g. 01-100" />
            )
          )}

          <div /> {/* spacer */}

          <div className="col-span-2">
            {field("Notes",
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="text-sm" placeholder="Work notes…" />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="default" onClick={() => handleSave(false)} disabled={saving || !!timeError}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={() => handleSave(true)}
            disabled={saving || !!timeError}
          >
            {saving ? "Saving…" : "Save & Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}