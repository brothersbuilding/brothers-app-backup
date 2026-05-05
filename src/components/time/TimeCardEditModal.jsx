import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toDateStr(iso) {
  if (!iso) return "";
  return format(new Date(iso), "yyyy-MM-dd");
}

function toHHMM(iso) {
  if (!iso) return "";
  return format(new Date(iso), "HH:mm");
}

function buildISO(dateStr, timeHHMM) {
  if (!dateStr || !timeHHMM) return null;
  return new Date(`${dateStr}T${timeHHMM}:00`).toISOString();
}

function calcTotalHours(clockInISO, clockOutISO) {
  if (!clockInISO || !clockOutISO) return null;
  const diff = (new Date(clockOutISO) - new Date(clockInISO)) / 3600000;
  if (diff <= 0) return null;
  return Math.round(diff * 10) / 10;
}

export default function TimeCardEditModal({ entry, projects, costCodes, open, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [timeError, setTimeError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setTimeError("");

    const clockInDate = entry.clock_in ? toDateStr(entry.clock_in) : (entry.date || "");
    const clockOutDate = entry.clock_out
      ? toDateStr(entry.clock_out)
      : (entry.clock_in ? toDateStr(entry.clock_in) : (entry.date || ""));

    setForm({
      clockInDate,
      clockInTime: toHHMM(entry.clock_in),
      clockOutDate,
      clockOutTime: toHHMM(entry.clock_out),
      date: entry.date || clockInDate,
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
  const headerTitle = `${entry.employee_name || "Employee"} — ${DOW[entryDate.getDay()]} ${format(entryDate, "MM/dd")}`;

  const recalcHours = (updated) => {
    const newClockIn = buildISO(updated.clockInDate, updated.clockInTime);
    const newClockOut = buildISO(updated.clockOutDate, updated.clockOutTime);

    if (newClockIn && newClockOut) {
      if (new Date(newClockOut) <= new Date(newClockIn)) {
        setTimeError("Clock out must be after clock in");
        return updated;
      }
      setTimeError("");
      const total = calcTotalHours(newClockIn, newClockOut);
      if (total !== null) {
        updated.reg_hours = String(Math.min(total, 8).toFixed(1));
        updated.ot_hours = String(Math.max(0, Math.round((total - 8) * 10) / 10).toFixed(1));
      }
    } else {
      setTimeError("");
    }
    return updated;
  };

  const handleChange = (field, val) => {
    const updated = recalcHours({ ...form, [field]: val });
    setForm(updated);
  };

  const handleProjectChange = (val) => {
    const proj = projects.find((p) => p.id === val);
    setForm({ ...form, project_id: val, project_name: proj?.name || "" });
  };

  const buildPayload = () => ({
    date: form.clockInDate || form.date,
    clock_in: buildISO(form.clockInDate, form.clockInTime),
    clock_out: buildISO(form.clockOutDate, form.clockOutTime),
    clock_status: form.clockOutTime ? "complete" : entry.clock_status,
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
          {/* Clock In — Date + Time */}
          {field("Clock In Date",
            <Input type="date" value={form.clockInDate} onChange={(e) => handleChange("clockInDate", e.target.value)} className="h-8 text-sm" />
          )}
          {field("Clock In Time",
            <Input type="time" value={form.clockInTime} onChange={(e) => handleChange("clockInTime", e.target.value)} className="h-8 text-sm" />
          )}

          {/* Clock Out — Date + Time */}
          {field("Clock Out Date",
            <Input type="date" value={form.clockOutDate} onChange={(e) => handleChange("clockOutDate", e.target.value)} className="h-8 text-sm" />
          )}
          <div>
            {field("Clock Out Time",
              <Input type="time" value={form.clockOutTime} onChange={(e) => handleChange("clockOutTime", e.target.value)} className="h-8 text-sm" />
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