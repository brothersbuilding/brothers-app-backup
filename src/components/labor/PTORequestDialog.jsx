import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

export default function PTORequestDialog({ open, onOpenChange, onSubmit, isLoading, user, myUser }) {
  const [singleDay, setSingleDay] = useState(new Date().toISOString().split("T")[0]);
  const [multipledays, setMultipledays] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("8");

  const handleSubmit = () => {
    const start = multipledays ? startDate : singleDay;
    const end = multipledays ? endDate : singleDay;

    if (!start || !end || !hoursPerDay) return;

    const startD = new Date(start);
    const endD = new Date(end);
    const days = (endD - startD) / (1000 * 60 * 60 * 24) + 1;
    const totalHours = days * parseFloat(hoursPerDay);

    onSubmit({
      employee_id: user?.id || "",
      employee_email: user?.email || "",
      employee_name: user?.full_name || "",
      supervisor_id: myUser?.supervisor_id || "",
      supervisor_email: myUser?.supervisor_email || "",
      start_date: start,
      end_date: end,
      hours_per_day: parseFloat(hoursPerDay),
      total_hours: totalHours,
    });

    // Reset form
    setSingleDay(new Date().toISOString().split("T")[0]);
    setMultipledays(false);
    setStartDate("");
    setEndDate("");
    setHoursPerDay("8");
  };

  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      setSingleDay(new Date().toISOString().split("T")[0]);
      setMultipledays(false);
      setStartDate("");
      setEndDate("");
      setHoursPerDay("8");
    }
    onOpenChange(newOpen);
  };

  const isValid = multipledays
    ? startDate && endDate && hoursPerDay
    : singleDay && hoursPerDay;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Time Off</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {!multipledays ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Select Date *</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={singleDay}
                  onChange={(e) => setSingleDay(e.target.value)}
                />
              </div>
              {singleDay && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(singleDay), "EEEE, MMMM d, yyyy")}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date *</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                {startDate && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(startDate), "EEEE, MMMM d")}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date *</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                {endDate && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(endDate), "EEEE, MMMM d")}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex items-center gap-2 border-t pt-3">
            <Checkbox
              id="multiple-days"
              checked={multipledays}
              onCheckedChange={setMultipledays}
            />
            <Label htmlFor="multiple-days" className="text-xs cursor-pointer">
              Multiple days?
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Hours Per Day *</Label>
            <Input
              type="number"
              min="0.5"
              step="0.5"
              max="24"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              placeholder="e.g. 8"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-white"
              onClick={handleSubmit}
              disabled={isLoading || !isValid}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}