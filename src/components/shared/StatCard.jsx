import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
// StatCard uses brand accent color for icons

export default function StatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <Card className={cn("p-5 relative overflow-hidden group hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-2 text-foreground">{value}</p>
          {trend && (
            <p className="text-xs text-muted-foreground mt-1">{trend}</p>
          )}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-lg bg-accent/10">
            <Icon className="w-5 h-5 text-accent" />
          </div>
        )}
      </div>
    </Card>
  );
}