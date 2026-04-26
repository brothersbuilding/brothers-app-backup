import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { Send } from "lucide-react";

export default function TaskDetailDialog({ task, open, onOpenChange, comments = [], user, allUsers = [] }) {
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const queryClient = useQueryClient();

  const createCommentMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskComment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments"] });
      setCommentText("");
    },
  });

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    createCommentMutation.mutate({
      task_id: task.id,
      author_email: user?.email,
      author_name: user?.full_name,
      content: commentText,
      reply_to_id: replyingTo?.id,
      reply_to_author: replyingTo?.author_name,
    });
    setReplyingTo(null);
  };

  const handleMention = (userEmail, userName) => {
    const before = commentText.substring(0, commentText.lastIndexOf("@"));
    setCommentText(before + `@${userName} `);
    setShowMentionList(false);
    setMentionSearch("");
  };

  const handleCommentChange = (value) => {
    setCommentText(value);
    const lastAt = value.lastIndexOf("@");
    if (lastAt !== -1) {
      const afterAt = value.substring(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setMentionSearch(afterAt);
        setShowMentionList(true);
      } else {
        setShowMentionList(false);
      }
    } else {
      setShowMentionList(false);
    }
  };

  const filteredUsers = allUsers.filter((u) =>
    u.full_name?.toLowerCase().includes(mentionSearch.toLowerCase()) && u.email !== user?.email
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Details */}
          <div className="space-y-3">
            {task.description && (
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm">{task.description}</p>
              </div>
            )}
            {task.assigned_to_name && (
              <div>
                <Label className="text-xs text-muted-foreground">Assigned To</Label>
                <p className="text-sm">{task.assigned_to_name}</p>
              </div>
            )}
            {task.project_name && (
              <div>
                <Label className="text-xs text-muted-foreground">Project</Label>
                <p className="text-sm">{task.project_name}</p>
              </div>
            )}
            {task.due_date && (
              <div>
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                <p className="text-sm">{format(parseISO(task.due_date), "MMM dd, yyyy")}</p>
              </div>
            )}
            {task.attachment_url && (
              <div>
                <Label className="text-xs text-muted-foreground">Attachment</Label>
                <a href={task.attachment_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  View File
                </a>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
           <h3 className="text-sm font-semibold mb-3">Comments ({comments.length})</h3>

           {/* Comments List */}
           <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
             {comments.length === 0 ? (
               <p className="text-xs text-muted-foreground">No comments yet</p>
             ) : (
               comments.map((comment) => (
                 <div key={comment.id}>
                   {comment.reply_to_id && (
                     <div className="text-xs text-muted-foreground mb-1 ml-2 pl-2 border-l-2 border-muted">
                       Replying to {comment.reply_to_author}
                     </div>
                   )}
                   <Card className={`p-3 ${comment.reply_to_id ? "bg-primary/5 ml-2" : "bg-muted/30"}`}>
                     <div className="flex items-start justify-between mb-2">
                       <p className="text-xs font-medium">{comment.author_name}</p>
                       {comment.created_date && (
                         <p className="text-xs text-muted-foreground">{format(parseISO(comment.created_date), "MMM dd, h:mm a")}</p>
                       )}
                     </div>
                     <p className="text-xs text-foreground mb-2">{comment.content}</p>
                     <Button
                       type="button"
                       variant="ghost"
                       size="sm"
                       className="h-6 text-xs"
                       onClick={() => setReplyingTo(comment)}
                     >
                       Reply
                     </Button>
                   </Card>
                 </div>
               ))
             )}
           </div>

            {/* Add Comment Form */}
            {replyingTo && (
              <div className="mb-2 p-2 bg-primary/10 rounded text-xs flex items-center justify-between">
                <span>Replying to {replyingTo.author_name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => setReplyingTo(null)}
                >
                  ✕
                </Button>
              </div>
            )}
            <div className="relative">
              <form onSubmit={handleAddComment} className="flex gap-2">
                <Input
                  placeholder="Add a comment... (type @ to mention someone)"
                  value={commentText}
                  onChange={(e) => handleCommentChange(e.target.value)}
                  className="text-xs h-8"
                />
                <Button type="submit" size="icon" className="h-8 w-8" disabled={!commentText.trim() || createCommentMutation.isPending}>
                  <Send className="w-3 h-3" />
                </Button>
              </form>
              {showMentionList && filteredUsers.length > 0 && (
                <Card className="absolute bottom-full mb-1 w-full p-1 shadow-lg z-50">
                  {filteredUsers.slice(0, 5).map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => handleMention(u.email, u.full_name)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded transition-colors"
                    >
                      {u.full_name}
                    </button>
                  ))}
                </Card>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}