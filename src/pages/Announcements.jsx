import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Megaphone, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";

export default function Announcements() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.list("-created_date", 50),
  });

  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "normal",
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      return base44.entities.Announcement.create({
        ...data,
        author_name: user.full_name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setShowForm(false);
      setForm({ title: "", content: "", priority: "normal" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Announcement.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Company news and updates"
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Announcement
          </Button>
        }
      />

      {announcements.length === 0 && !isLoading ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description="Post your first company announcement"
          action={<Button onClick={() => setShowForm(true)}>Post Announcement</Button>}
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{a.title}</h3>
                    {a.priority !== "normal" && <StatusBadge status={a.priority} />}
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-2">{a.content}</p>
                  <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                    <span>{a.author_name || "Unknown"}</span>
                    <span>•</span>
                    <span>{format(new Date(a.created_date), "MMM d, yyyy 'at' h:mm a")}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => deleteMutation.mutate(a.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
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
                placeholder="Announcement title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="What do you want to share with the team?"
                rows={5}
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={!form.title || !form.content}>Post</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}