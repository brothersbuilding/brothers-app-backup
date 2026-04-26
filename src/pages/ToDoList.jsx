import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format, parseISO, isBefore, startOfDay } from "date-fns";

export default function ToDoList() {
  const queryClient = useQueryClient();
  const { user } = useOutletContext();
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", assigned_to_email: "", assigned_to_name: "", project_id: "", project_name: "", due_date: "", completed: false });
  const [selectedTeamMembers, setSelectedTeamMembers] = useState(new Set([user?.email]));
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [selectedDueDate, setSelectedDueDate] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-updated_date", 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["team-users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-updated_date", 500),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setFormData({ title: "", description: "", assigned_to_email: "", assigned_to_name: "", project_id: "", project_name: "", due_date: "", completed: false });
      setFormOpen(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createTaskMutation.mutate(formData);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const memberMatch = selectedTeamMembers.size === 0 || selectedTeamMembers.has(task.assigned_to_email);
      const projectMatch = selectedProjects.size === 0 || selectedProjects.has(task.project_id);
      const dateMatch = !selectedDueDate || task.due_date === selectedDueDate;
      return memberMatch && projectMatch && dateMatch;
    });
  }, [tasks, selectedTeamMembers, selectedProjects, selectedDueDate]);

  const toggleTeamMember = (email) => {
    const newSet = new Set(selectedTeamMembers);
    if (newSet.has(email)) {
      newSet.delete(email);
    } else {
      newSet.add(email);
    }
    setSelectedTeamMembers(newSet);
  };

  const toggleProject = (projectId) => {
    const newSet = new Set(selectedProjects);
    if (newSet.has(projectId)) {
      newSet.delete(projectId);
    } else {
      newSet.add(projectId);
    }
    setSelectedProjects(newSet);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">To-Do List</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage team tasks and assignments</p>
      </div>

      <div className="flex gap-2 mb-6">
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pr-4">
              <div className="space-y-1.5">
                <Label htmlFor="task-title" className="text-xs">Title</Label>
                <Input
                  id="task-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Task title"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-description" className="text-xs">Description</Label>
                <Input
                  id="task-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Task description"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-assignee" className="text-xs">Assign To</Label>
                <select
                  id="task-assignee"
                  value={formData.assigned_to_email}
                  onChange={(e) => {
                    const selected = users.find(u => u.email === e.target.value);
                    setFormData({ ...formData, assigned_to_email: e.target.value, assigned_to_name: selected?.full_name || "" });
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select team member</option>
                  {users.map(u => (
                    <option key={u.email} value={u.email}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-project" className="text-xs">Project</Label>
                <select
                  id="task-project"
                  value={formData.project_id}
                  onChange={(e) => {
                    const selected = projects.find(p => p.id === e.target.value);
                    setFormData({ ...formData, project_id: e.target.value, project_name: selected?.name || "" });
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due" className="text-xs">Due Date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">Add Task</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <Card className="p-4 h-fit">
          <h3 className="font-semibold text-sm mb-4">Filters</h3>
          
          <div className="space-y-4">
            {/* Team Members Filter */}
            <div>
              <Label className="text-xs font-semibold mb-2 block">Team Members</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {users.map(u => (
                  <div key={u.email} className="flex items-center gap-2">
                    <Checkbox
                      id={`member-${u.email}`}
                      checked={selectedTeamMembers.has(u.email)}
                      onCheckedChange={() => toggleTeamMember(u.email)}
                    />
                    <Label htmlFor={`member-${u.email}`} className="text-xs cursor-pointer">{u.full_name}</Label>
                  </div>
                ))}
              </div>
              {selectedTeamMembers.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs mt-2 w-full h-7"
                  onClick={() => setSelectedTeamMembers(new Set([user?.email]))}
                >
                  Reset
                </Button>
              )}
            </div>

            {/* Projects Filter */}
            <div className="pt-4 border-t">
              <Label className="text-xs font-semibold mb-2 block">Projects</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {projects.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`project-${p.id}`}
                      checked={selectedProjects.has(p.id)}
                      onCheckedChange={() => toggleProject(p.id)}
                    />
                    <Label htmlFor={`project-${p.id}`} className="text-xs cursor-pointer">{p.name}</Label>
                  </div>
                ))}
              </div>
              {selectedProjects.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs mt-2 w-full h-7"
                  onClick={() => setSelectedProjects(new Set())}
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Due Date Filter */}
            <div className="pt-4 border-t">
              <Label htmlFor="filter-due-date" className="text-xs font-semibold mb-2 block">Due Date</Label>
              <Input
                id="filter-due-date"
                type="date"
                value={selectedDueDate}
                onChange={(e) => setSelectedDueDate(e.target.value)}
                className="text-xs"
              />
              {selectedDueDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs mt-2 w-full h-7"
                  onClick={() => setSelectedDueDate("")}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Tasks List */}
        <div className="lg:col-span-3">
          <Card className="p-4">
            {filteredTasks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No tasks found</div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={task.completed || false}
                      onCheckedChange={(checked) => updateTaskMutation.mutate({ id: task.id, data: { ...task, completed: checked } })}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`task-${task.id}`} className={`text-sm cursor-pointer block ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </Label>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {task.assigned_to_name && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">{task.assigned_to_name}</span>
                        )}
                        {task.project_name && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">{task.project_name}</span>
                        )}
                        {task.due_date && (
                          <span className={`text-xs px-2 py-1 rounded ${isBefore(parseISO(task.due_date), startOfDay(new Date())) ? "bg-red-100 text-red-700" : "bg-muted"}`}>
                            Due: {format(parseISO(task.due_date), "MMM dd")}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => deleteTaskMutation.mutate(task.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}