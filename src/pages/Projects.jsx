import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderKanban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export default function Projects() {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("name", 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowForm(false);
      setNewName("");
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), status: "in_progress" });
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="All active company projects"
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Project
          </Button>
        }
      />

      {projects.length === 0 && !isLoading ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Add your first project to get started"
          action={<Button onClick={() => setShowForm(true)}>Add Project</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {projects.map((project) => (
            <Card key={project.id} className="p-4 flex items-center justify-center text-center hover:shadow-md transition-all duration-200 cursor-default">
              <h3 className="font-semibold text-sm uppercase tracking-wide font-barlow leading-tight">{project.name}</h3>
            </Card>
          ))}
          {/* Quick-add tile */}
          <button
            onClick={() => setShowForm(true)}
            className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition-colors"
          >
            <Plus className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">Add</span>
          </button>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Windflower"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); setNewName(""); }}>Cancel</Button>
              <Button onClick={handleAdd} disabled={!newName.trim() || createMutation.isPending}>
                Add Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}