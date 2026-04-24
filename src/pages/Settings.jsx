import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

const DEFAULT_COST_CODES = [
  "Concrete", "Electrical", "Excavation", "Finish Carpentry", "Framing",
  "General Labor", "HVAC", "Insulation", "Landscaping", "Masonry",
  "Painting", "Plumbing", "Roofing", "Siding", "Site Work", "Windows & Doors",
];

const DEFAULT_SAIF_CODES = [
  { name: "Concrete", rate: "" },
  { name: "Carp 3 or Less", rate: "" },
  { name: "Int Carp", rate: "" },
  { name: "Commercial Carp", rate: "" },
  { name: "Estimator", rate: "" },
  { name: "Office", rate: "" },
];
// rate field = percentage (e.g. 12.5 means 12.5%)

// Default mapping: cost code -> saif code
const DEFAULT_SAIF_MAPPING = {
  "Concrete": "Concrete",
  "Electrical": "Commercial Carp",
  "Excavation": "Concrete",
  "Finish Carpentry": "Int Carp",
  "Framing": "Carp 3 or Less",
  "General Labor": "Commercial Carp",
  "HVAC": "Commercial Carp",
  "Insulation": "Commercial Carp",
  "Landscaping": "Commercial Carp",
  "Masonry": "Concrete",
  "Painting": "Commercial Carp",
  "Plumbing": "Commercial Carp",
  "Roofing": "Commercial Carp",
  "Siding": "Commercial Carp",
  "Site Work": "Concrete",
  "Windows & Doors": "Commercial Carp",
};

function useSetting(records, key) {
  const record = records.find((s) => s.key === key);
  return { record, value: record ? JSON.parse(record.value) : null };
}

function CostCodesEditor({ codes, onChange }) {
   const [newCode, setNewCode] = useState("");

   const handleAdd = () => {
     const trimmed = newCode.trim();
     if (!trimmed || codes.includes(trimmed)) return;
     onChange([...codes, trimmed].sort((a, b) => a.localeCompare(b)));
     setNewCode("");
   };

   const handleRemove = (code) => onChange(codes.filter((c) => c !== code));

   return (
     <div className="space-y-3">
       <div className="flex gap-2">
         <Input
           value={newCode}
           onChange={(e) => setNewCode(e.target.value)}
           onKeyDown={(e) => e.key === "Enter" && handleAdd()}
           placeholder="Add new cost code..."
           className="flex-1"
         />
         <Button onClick={handleAdd} size="sm" className="gap-1.5">
           <Plus className="w-4 h-4" /> Add
         </Button>
       </div>
       <div className="flex flex-wrap gap-2">
         {codes.map((code) => (
           <div key={code} className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 text-sm">
             <span>{code}</span>
             <button onClick={() => handleRemove(code)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
               <Trash2 className="w-3.5 h-3.5" />
             </button>
           </div>
         ))}
       </div>
       {codes.length === 0 && <p className="text-sm text-muted-foreground italic">No cost codes — add some above.</p>}
     </div>
   );
 }

 function ProjectCostCodesEditor({ allCodes, onChange }) {
   const [open, setOpen] = useState(false);

   const handleSelect = (code) => {
     if (allCodes.includes(code)) {
       onChange(allCodes.filter((c) => c !== code));
     } else {
       onChange([...allCodes, code].sort((a, b) => a.localeCompare(b)));
     }
   };

   return (
     <Popover open={open} onOpenChange={setOpen}>
       <PopoverTrigger asChild>
         <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
           {allCodes.length > 0 ? `${allCodes.length} codes` : "Select cost codes..."}
           <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
         </Button>
       </PopoverTrigger>
       <PopoverContent className="w-full p-0" align="start">
         <Command>
           <CommandInput placeholder="Search cost codes..." />
           <CommandEmpty>No cost codes found.</CommandEmpty>
           <CommandGroup className="max-h-64 overflow-y-auto">
             {allCodes.map((code) => (
               <CommandItem
                 key={code}
                 value={code}
                 onSelect={() => handleSelect(code)}
                 className="flex items-center justify-between cursor-pointer"
               >
                 <span className="flex items-center">
                   <Check className="mr-2 h-4 w-4 opacity-100" />
                   {code}
                 </span>
               </CommandItem>
             ))}
           </CommandGroup>
         </Command>
       </PopoverContent>
     </Popover>
   );
 }

function SaifCodesManager({ saifCodes, onChange }) {
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed || saifCodes.find((s) => s.name === trimmed)) return;
    onChange([...saifCodes, { name: trimmed, rate: "" }]);
    setNewName("");
  };

  const handleRemove = (name) => onChange(saifCodes.filter((s) => s.name !== name));

  const handleRateChange = (name, rate) =>
    onChange(saifCodes.map((s) => (s.name === name ? { ...s, rate } : s)));

  const handleNameChange = (oldName, newNameVal) =>
    onChange(saifCodes.map((s) => (s.name === oldName ? { ...s, name: newNameVal } : s)));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_140px_36px] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
        <span>SAIF Code Name</span>
        <span>Rate (%)</span>
        <span />
      </div>
      {saifCodes.map((sc) => (
        <div key={sc.name} className="grid grid-cols-[1fr_140px_36px] gap-2 items-center">
          <Input
            value={sc.name}
            onChange={(e) => handleNameChange(sc.name, e.target.value)}
            className="h-8 text-sm"
          />
          <div className="relative">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={sc.rate}
              onChange={(e) => handleRateChange(sc.name, e.target.value)}
              className="h-8 text-sm pr-7"
              placeholder="0.00"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
          <button onClick={() => handleRemove(sc.name)} className="text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="New SAIF code name..."
          className="flex-1 h-8 text-sm"
        />
        <Button onClick={handleAdd} size="sm" className="gap-1.5 h-8">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
    </div>
  );
}

function SaifMappingEditor({ costCodes, mapping, onChange, saifCodes }) {
   return (
     <div className="space-y-2">
       {costCodes.map((code) => (
         <div key={code} className="flex items-center gap-3">
           <span className="text-sm font-medium w-44 shrink-0">{code}</span>
           <span className="text-muted-foreground text-sm">→</span>
           <Select
             value={mapping[code] || ""}
             onValueChange={(val) => onChange({ ...mapping, [code]: val })}
           >
             <SelectTrigger className="flex-1 h-8 text-sm">
               <SelectValue placeholder="Select SAIF code..." />
             </SelectTrigger>
             <SelectContent>
               {saifCodes.map((sc) => (
                 <SelectItem key={sc.name} value={sc.name}>{sc.name}</SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
       ))}
       {costCodes.length === 0 && <p className="text-sm text-muted-foreground italic">No cost codes defined yet.</p>}
     </div>
   );
 }

function TripFeesEditor({ tripFees, onChange, projects }) {
   const [newProject, setNewProject] = useState("");
   const [newAmount, setNewAmount] = useState("");

   const handleAdd = () => {
     const pid = newProject.trim();
     const amt = parseFloat(newAmount) || 0;
     if (!pid || amt <= 0 || tripFees[pid]) return;
     onChange({ ...tripFees, [pid]: amt });
     setNewProject("");
     setNewAmount("");
   };

   const handleRemove = (projectId) => {
     const updated = { ...tripFees };
     delete updated[projectId];
     onChange(updated);
   };

   const handleAmountChange = (projectId, amount) => {
     onChange({ ...tripFees, [projectId]: parseFloat(amount) || 0 });
   };

   return (
     <div className="space-y-3">
       <div className="grid grid-cols-[1fr_120px_36px] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
         <span>Project</span>
         <span>Amount ($)</span>
         <span />
       </div>
       {Object.entries(tripFees).map(([projectId, amount]) => {
         const project = projects.find((p) => p.id === projectId);
         return (
           <div key={projectId} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
             <span className="text-sm">{project?.name || projectId}</span>
             <div className="relative">
               <Input
                 type="number"
                 min="0"
                 step="0.01"
                 value={amount}
                 onChange={(e) => handleAmountChange(projectId, e.target.value)}
                 className="h-8 text-sm pr-7"
                 placeholder="0.00"
               />
               <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
             </div>
             <button onClick={() => handleRemove(projectId)} className="text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center">
               <Trash2 className="w-4 h-4" />
             </button>
           </div>
         );
       })}
       <div className="flex gap-2 pt-1">
         <Select value={newProject} onValueChange={setNewProject}>
           <SelectTrigger className="flex-1 h-8 text-sm">
             <SelectValue placeholder="Select project..." />
           </SelectTrigger>
           <SelectContent>
             {projects
               .filter((p) => !tripFees[p.id])
               .map((p) => (
                 <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
               ))}
           </SelectContent>
         </Select>
         <Input
           type="number"
           min="0"
           step="0.01"
           value={newAmount}
           onChange={(e) => setNewAmount(e.target.value)}
           placeholder="Amount"
           className="h-8 text-sm flex-1"
         />
         <Button onClick={handleAdd} size="sm" className="gap-1.5 h-8">
           <Plus className="w-4 h-4" /> Add
         </Button>
       </div>
     </div>
   );
 }

export default function Settings() {
   const queryClient = useQueryClient();

   const { data: settingsRecords = [], isLoading } = useQuery({
     queryKey: ["app-settings"],
     queryFn: () => base44.entities.AppSettings.list(),
   });

   const { data: projects = [] } = useQuery({
     queryKey: ["projects"],
     queryFn: () => base44.entities.Project.list(),
   });

   const { record: codesRecord, value: savedCodes } = useSetting(settingsRecords, "cost_codes");
   const { record: projectCodesRecord, value: savedProjectCodes } = useSetting(settingsRecords, "project_cost_codes");
   const { record: mappingRecord, value: savedMapping } = useSetting(settingsRecords, "saif_mapping");
   const { record: saifCodesRecord, value: savedSaifCodes } = useSetting(settingsRecords, "saif_codes");
   const { record: tripFeesRecord, value: savedTripFees } = useSetting(settingsRecords, "trip_fees");

   const [costCodes, setCostCodes] = useState(null);
   const [projectCostCodes, setProjectCostCodes] = useState(null);
   const [saifMapping, setSaifMapping] = useState(null);
   const [saifCodes, setSaifCodes] = useState(null);
   const [tripFees, setTripFees] = useState(null);

  // Sync state when records load
  useEffect(() => {
    if (settingsRecords.length > 0) {
      if (costCodes === null) setCostCodes(savedCodes ?? [...DEFAULT_COST_CODES].sort((a, b) => a.localeCompare(b)));
      if (projectCostCodes === null) setProjectCostCodes(savedProjectCodes ?? []);
      if (saifMapping === null) setSaifMapping(savedMapping ?? DEFAULT_SAIF_MAPPING);
      if (saifCodes === null) setSaifCodes(savedSaifCodes ?? DEFAULT_SAIF_CODES);
      if (tripFees === null) setTripFees(savedTripFees ?? {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRecords]);

  const displayCodes = costCodes ?? [...DEFAULT_COST_CODES].sort((a, b) => a.localeCompare(b));
  const displayProjectCodes = projectCostCodes ?? [];
  const displayMapping = saifMapping ?? DEFAULT_SAIF_MAPPING;
  const displaySaifCodes = saifCodes ?? DEFAULT_SAIF_CODES;
  const displayTripFees = tripFees ?? {};

  const upsert = async (key, label, value, existingRecord) => {
    const val = JSON.stringify(value);
    if (existingRecord) {
      return base44.entities.AppSettings.update(existingRecord.id, { value: val });
    } else {
      return base44.entities.AppSettings.create({ key, label, value: val });
    }
  };

  const saveCodesMutation = useMutation({
    mutationFn: () => upsert("cost_codes", "Time Card Cost Codes", displayCodes, codesRecord),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
  });

  const saveProjectCodesMutation = useMutation({
    mutationFn: () => upsert("project_cost_codes", "Project Cost Codes", displayProjectCodes, projectCodesRecord),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
  });

  const saveMappingMutation = useMutation({
    mutationFn: () => upsert("saif_mapping", "SAIF Mapping", displayMapping, mappingRecord),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
  });

  const saveSaifCodesMutation = useMutation({
    mutationFn: () => upsert("saif_codes", "SAIF Codes", displaySaifCodes, saifCodesRecord),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
  });

  const saveTripFeesMutation = useMutation({
     mutationFn: () => upsert("trip_fees", "Trip Fees", displayTripFees, tripFeesRecord),
     onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
   });

   const importCostCodesMutation = useMutation({
     mutationFn: () => base44.functions.invoke("importCostCodes", {}),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["app-settings"] });
       alert("Cost codes imported successfully!");
     },
   });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure app-wide settings" />

      <div className="max-w-2xl space-y-6">
        {/* Time Card Cost Codes */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base">Time Card Cost Codes</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Appear in the labor clock-in dropdown, sorted alphabetically.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => saveCodesMutation.mutate()}
              disabled={saveCodesMutation.isPending}
              className="gap-1.5 shrink-0 ml-4"
            >
              <Save className="w-4 h-4" />
              {saveCodesMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
          <CostCodesEditor codes={displayCodes} onChange={setCostCodes} />
        </Card>

        {/* Project Cost Codes */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base">Project Cost Codes</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Cost codes specific to projects.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => importCostCodesMutation.mutate()}
                disabled={importCostCodesMutation.isPending}
                className="gap-1.5"
              >
                <Upload className="w-4 h-4" />
                {importCostCodesMutation.isPending ? "Importing..." : "Import from PDF"}
              </Button>
              <Button
                size="sm"
                onClick={() => saveProjectCodesMutation.mutate()}
                disabled={saveProjectCodesMutation.isPending}
                className="gap-1.5"
              >
                <Save className="w-4 h-4" />
                {saveProjectCodesMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <ProjectCostCodesEditor allCodes={displayProjectCodes} onChange={setProjectCostCodes} />
        </Card>

        {/* SAIF Codes Manager */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base">SAIF Codes</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage SAIF workers' comp classifications and their percentage rates. SAIF cost = hourly wage × hours × rate%.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => saveSaifCodesMutation.mutate()}
              disabled={saveSaifCodesMutation.isPending}
              className="gap-1.5 shrink-0 ml-4"
            >
              <Save className="w-4 h-4" />
              {saveSaifCodesMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
          <SaifCodesManager saifCodes={displaySaifCodes} onChange={setSaifCodes} />
        </Card>

        {/* SAIF Code Mapping */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base">SAIF Code Mapping</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Map each cost code to its SAIF workers' comp classification.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => saveMappingMutation.mutate()}
              disabled={saveMappingMutation.isPending}
              className="gap-1.5 shrink-0 ml-4"
            >
              <Save className="w-4 h-4" />
              {saveMappingMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
          <SaifMappingEditor
            costCodes={displayCodes}
            mapping={displayMapping}
            onChange={setSaifMapping}
            saifCodes={displaySaifCodes}
          />
          </Card>

          {/* Trip Fees */}
          <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base">Trip Fees</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Set trip fee amounts per project. Employees can apply these when clocking out.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => saveTripFeesMutation.mutate()}
              disabled={saveTripFeesMutation.isPending}
              className="gap-1.5 shrink-0 ml-4"
            >
              <Save className="w-4 h-4" />
              {saveTripFeesMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
          <TripFeesEditor tripFees={displayTripFees} onChange={setTripFees} projects={projects} />
          </Card>
          </div>
          </div>
          );
          }