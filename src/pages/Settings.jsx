import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Plus, Trash2, GripVertical, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/shared/PageHeader";

const DEFAULT_COST_CODES = [
  "Concrete", "Electrical", "Excavation", "Finish Carpentry", "Framing",
  "General Labor", "HVAC", "Insulation", "Landscaping", "Masonry",
  "Painting", "Plumbing", "Roofing", "Siding", "Site Work", "Windows & Doors",
];

function CostCodesEditor({ codes, onChange }) {
  const [newCode, setNewCode] = useState("");

  const handleAdd = () => {
    const trimmed = newCode.trim();
    if (!trimmed || codes.includes(trimmed)) return;
    onChange([...codes, trimmed]);
    setNewCode("");
  };

  const handleRemove = (code) => {
    onChange(codes.filter((c) => c !== code));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add new cost code..."
          className="flex-1"
        />
        <Button onClick={handleAdd} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {codes.map((code) => (
          <div
            key={code}
            className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 text-sm"
          >
            <span>{code}</span>
            <button
              onClick={() => handleRemove(code)}
              className="text-muted-foreground hover:text-destructive transition-colors ml-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      {codes.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No cost codes — add some above.</p>
      )}
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: settingsRecords = [], isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const costCodesRecord = settingsRecords.find((s) => s.key === "cost_codes");
  const savedCodes = costCodesRecord ? JSON.parse(costCodesRecord.value) : DEFAULT_COST_CODES;
  const [costCodes, setCostCodes] = useState(null); // null = not yet modified

  const displayCodes = costCodes ?? savedCodes;

  const saveMutation = useMutation({
    mutationFn: async (codes) => {
      const val = JSON.stringify(codes);
      if (costCodesRecord) {
        return base44.entities.AppSettings.update(costCodesRecord.id, { value: val });
      } else {
        return base44.entities.AppSettings.create({ key: "cost_codes", label: "Cost Codes", value: val });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      setCostCodes(null);
    },
  });

  const isDirty = costCodes !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure app-wide settings"
      />

      <div className="max-w-2xl space-y-6">
        {/* Cost Codes */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base">Cost Codes</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                These appear in the labor clock-in dropdown. Add, remove, or rename as needed.
              </p>
            </div>
            {isDirty && (
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(displayCodes)}
                disabled={saveMutation.isPending}
                className="gap-1.5 shrink-0 ml-4"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
          <CostCodesEditor codes={displayCodes} onChange={setCostCodes} />
        </Card>
      </div>
    </div>
  );
}