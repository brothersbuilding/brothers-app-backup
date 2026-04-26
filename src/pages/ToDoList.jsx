import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Upload, X, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";

export default function ToDoList() {
  const queryClient = useQueryClient();
  const { user } = useOutletContext();
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", assigned_to_email: "", assigned_to_name: "", project_id: "", project_name: "", due_date: "", completed: false, attachment_url: "" });
  const [taskFilter, setTaskFilter] = useState({ type: null, value: null });
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

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

  const { data: allComments = [] } = useQuery({
    queryKey: ["task-comments"],
    queryFn: () => base44.entities.TaskComment.list("-updated_date", 1000),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setFormData({ title: "", description: "", assigned_to_email: "", assigned_to_name: "", project_id: "", project_name: "", due_date: "", completed: false, attachment_url: "" });
      setUploadedFileName("");
      setFormOpen(false);
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, attachment_url: response.file_url });
      setUploadedFileName(file.name);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

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

  const applyFilter = (list, filter) => {
    if (!filter.type || !filter.value) return list.filter(t => t.assigned_to_email === user?.email);
    return list.filter((task) => {
      if (filter.type === "assigned_to_name") return task.assigned_to_name === filter.value;
      if (filter.type === "due_date") return task.due_date === filter.value;
      if (filter.type === "project_name") return task.project_name === filter.value;
      return true;
    });
  };

  const getUniqueValues = (list, field) => [...new Set(list.map((t) => t[field]))].filter(Boolean).sort();

  const filteredTasks = applyFilter(tasks, taskFilter);

  const getCommentCount = (taskId) => allComments.filter(c => c.task_id === taskId).length;

  const getTaskComments = (taskId) => allComments.filter(c => c.task_id === taskId).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div>
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogTrigger asChild>
          <div style={{ display: 'none' }} />
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
            <div className="space-y-1.5">
              <Label className="text-xs">Attachment</Label>
              {uploadedFileName ? (
                <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <span className="text-xs text-foreground">{uploadedFileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setFormData({ ...formData, attachment_url: "" });
                      setUploadedFileName("");
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{uploading ? "Uploading..." : "Click to upload"}</span>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                </label>
              )}
            </div>
            <Button type="submit" className="w-full">Add Task</Button>
          </form>
        </DialogContent>
      </Dialog>

      <PageHeader
        title="To-Do List"
        subtitle={`${filteredTasks.length} tasks`}
        action={
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Task
          </Button>
        }
      />

      {/* Filter Section */}
      <Card className="overflow-hidden mb-6">
        <div className="bg-muted/50 p-4 border-b border-border">
          <div className="grid grid-cols-3 gap-2">
            <Select value={taskFilter.type || ""} onValueChange={(val) => setTaskFilter({ type: val, value: null })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Filter by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assigned_to_name">Assigned To</SelectItem>
                <SelectItem value="project_name">Project</SelectItem>
                <SelectItem value="due_date">Due Date</SelectItem>
              </SelectContent>
            </Select>
            {taskFilter.type && (
              <Select value={taskFilter.value || ""} onValueChange={(val) => setTaskFilter({ ...taskFilter, value: val })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {getUniqueValues(tasks, taskFilter.type).map((val) => (
                    <SelectItem key={val} value={val}>{val}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {taskFilter.value && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setTaskFilter({ type: null, value: null })}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tasks List */}
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setSelectedTask(task);
                      setDetailDialogOpen(true);
                    }}
                    className="relative p-1 hover:bg-muted rounded transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    {getCommentCount(task.id) > 0 && (
                      <span className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {getCommentCount(task.id)}
                      </span>
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => deleteTaskMutation.mutate(task.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          comments={getTaskComments(selectedTask.id)}
          user={user}
        />
      )}
    </div>
  );
}