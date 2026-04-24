import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  planning: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  on_hold: "bg-slate-50 text-slate-600 border-slate-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  normal: "bg-slate-50 text-slate-600 border-slate-200",
  important: "bg-amber-50 text-amber-700 border-amber-200",
  urgent: "bg-red-50 text-red-600 border-red-200",
};

const statusLabels = {
  planning: "Planning",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
};

export default function StatusBadge({ status }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", statusStyles[status] || statusStyles.normal)}
    >
      {statusLabels[status] || status}
    </Badge>
  );
}