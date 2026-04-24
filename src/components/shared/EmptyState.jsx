import React from "react";
import { Card } from "@/components/ui/card";

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <Card className="p-12 flex flex-col items-center justify-center text-center">
      {Icon && (
        <div className="p-4 rounded-full bg-muted mb-4">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}