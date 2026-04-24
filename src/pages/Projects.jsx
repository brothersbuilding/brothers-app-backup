import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, FolderKanban, MapPin, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ProjectForm from "@/components/projects/ProjectForm";

export default function Projects() {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowForm(false);
    },
  });

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Manage all construction projects"
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        }
      />

      <div className="mb-6">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to get started"
          action={<Button onClick={() => setShowForm(true)}>Create Project</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const budgetPct = project.budget > 0 ? Math.min(((project.spent || 0) / project.budget) * 100, 100) : 0;
            return (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="p-5 hover:shadow-md transition-all duration-200 h-full">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-sm truncate pr-2 uppercase tracking-wide font-barlow">{project.name}</h3>
                    <StatusBadge status={project.status} />
                  </div>
                  {project.client_name && (
                    <p className="text-xs text-muted-foreground mb-2">{project.client_name}</p>
                  )}
                  {project.address && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <MapPin className="w-3 h-3" /> {project.address}
                    </div>
                  )}
                  {project.budget > 0 && (
                    <div className="mt-auto">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="font-medium">${(project.spent || 0).toLocaleString()} / ${project.budget.toLocaleString()}</span>
                      </div>
                      <Progress value={budgetPct} className="h-1.5" />
                    </div>
                  )}
                  {project.start_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(project.start_date), "MMM d, yyyy")}
                      {project.end_date && ` — ${format(new Date(project.end_date), "MMM d, yyyy")}`}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}