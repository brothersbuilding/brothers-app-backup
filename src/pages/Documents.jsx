import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Trash2, Download, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const categories = {
  safety: "Safety",
  plans: "Plans",
  contracts: "Contracts",
  permits: "Permits",
  reports: "Reports",
  general: "General",
};

export default function Documents() {
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list("-created_date", 100),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 100),
  });

  const [form, setForm] = useState({
    title: "",
    category: "general",
    project_id: "",
    description: "",
    file_url: "",
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm({ ...form, file_url });
    setUploading(false);
  };

  const createMutation = useMutation({
    mutationFn: (data) => {
      const project = projects.find((p) => p.id === data.project_id);
      return base44.entities.Document.create({
        ...data,
        project_name: project?.name || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setShowForm(false);
      setForm({ title: "", category: "general", project_id: "", description: "", file_url: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const filtered = filterCat === "all" ? documents : documents.filter((d) => d.category === filterCat);

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Company files and project documents"
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Upload Document
          </Button>
        }
      />

      <div className="mb-6">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categories).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description="Upload your first document to get started"
          action={<Button onClick={() => setShowForm(true)}>Upload Document</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <Card key={doc.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(doc.created_date), "MMM d, yyyy")}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => deleteMutation.mutate(doc.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary" className="text-xs">{categories[doc.category] || doc.category}</Badge>
                {doc.project_name && (
                  <span className="text-xs text-muted-foreground truncate">{doc.project_name}</span>
                )}
              </div>
              {doc.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{doc.description}</p>
              )}
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-3 hover:underline"
                >
                  <Download className="w-3 h-3" /> Download
                </a>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Document title"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categories).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>File *</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {form.file_url ? (
                  <p className="text-sm text-green-600 font-medium">File uploaded successfully</p>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {uploading ? "Uploading..." : "Click to select a file"}
                    </p>
                  </>
                )}
                <Input
                  type="file"
                  className="mt-2"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={!form.title || !form.file_url || uploading}>Upload</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}