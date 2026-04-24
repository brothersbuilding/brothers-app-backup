import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Clock, DollarSign, FileText, MapPin, Calendar, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import StatusBadge from "@/components/shared/StatusBadge";
import ProjectForm from "@/components/projects/ProjectForm";

export default function ProjectDetail() {
  const params = new URLSearchParams(window.location.search);
  const projectId = window.location.pathname.split("/projects/")[1];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });
  const project = projects.find((p) => p.id === projectId);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["time-project", projectId],
    queryFn: () => base44.entities.TimeEntry.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-project", projectId],
    queryFn: () => base44.entities.Expense.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Project.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/projects");
    },
  });

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  const totalHours = timeEntries.reduce((s, t) => s + (t.hours || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const budgetPct = project.budget > 0 ? Math.min((totalExpenses / project.budget) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          {project.client_name && <p className="text-sm text-muted-foreground">{project.client_name}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete project?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50"><Clock className="w-4 h-4 text-blue-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Hours Logged</p>
            <p className="font-bold text-lg">{totalHours.toFixed(1)}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50"><DollarSign className="w-4 h-4 text-amber-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="font-bold text-lg">${totalExpenses.toLocaleString()}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50"><FileText className="w-4 h-4 text-emerald-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Time Entries</p>
            <p className="font-bold text-lg">{timeEntries.length}</p>
          </div>
        </Card>
      </div>

      {/* Details */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Project Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {project.address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Address</p>
                <p>{project.address}</p>
              </div>
            </div>
          )}
          {project.start_date && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Timeline</p>
                <p>
                  {format(new Date(project.start_date), "MMM d, yyyy")}
                  {project.end_date && ` — ${format(new Date(project.end_date), "MMM d, yyyy")}`}
                </p>
              </div>
            </div>
          )}
          {project.description && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-xs mb-1">Description</p>
              <p className="text-foreground">{project.description}</p>
            </div>
          )}
        </div>

        {project.budget > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Budget Progress</span>
              <span className="font-medium">${totalExpenses.toLocaleString()} / ${project.budget.toLocaleString()}</span>
            </div>
            <Progress value={budgetPct} className="h-2" />
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Recent Time Entries</h2>
          {timeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No time entries yet</p>
          ) : (
            <div className="space-y-3">
              {timeEntries.slice(0, 5).map((t) => (
                <div key={t.id} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-muted/50">
                  <div>
                    <p className="font-medium">{t.employee_name || "Employee"}</p>
                    <p className="text-xs text-muted-foreground">{t.description || "No description"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{t.hours}h</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(t.date), "MMM d")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Recent Expenses</h2>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No expenses yet</p>
          ) : (
            <div className="space-y-3">
              {expenses.slice(0, 5).map((e) => (
                <div key={e.id} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-muted/50">
                  <div>
                    <p className="font-medium">{e.description || e.vendor || "Expense"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{e.category?.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${e.amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(e.date), "MMM d")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <ProjectForm
            project={project}
            onSubmit={(data) => updateMutation.mutate(data)}
            onCancel={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}