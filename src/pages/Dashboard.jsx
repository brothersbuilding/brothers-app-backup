import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Clock, DollarSign, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/shared/StatCard";
import StatusBadge from "@/components/shared/StatusBadge";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date", 50),
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries-recent"],
    queryFn: () => base44.entities.TimeEntry.list("-created_date", 20),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-recent"],
    queryFn: () => base44.entities.Expense.list("-created_date", 20),
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements-recent"],
    queryFn: () => base44.entities.Announcement.list("-created_date", 5),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const activeProjects = projects.filter((p) => p.status === "in_progress");
  const totalHours = timeEntries.reduce((sum, t) => sum + (t.hours || 0), 0);
  const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's what's happening at Brothers Building
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Projects"
          value={activeProjects.length}
          icon={FolderKanban}
          trend={`${projects.length} total`}
        />
        <StatCard
          title="Hours Logged"
          value={totalHours.toFixed(1)}
          icon={Clock}
          trend="Recent entries"
        />
        <StatCard
          title="Total Spent"
          value={`$${totalSpent.toLocaleString()}`}
          icon={DollarSign}
          trend="Recent expenses"
        />
        <StatCard
          title="Team Members"
          value={users.length}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Active Projects</h2>
            <Link to="/projects">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {activeProjects.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No active projects</p>
            )}
            {activeProjects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{project.client_name || "No client"}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {project.budget > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ${(project.spent || 0).toLocaleString()} / ${project.budget.toLocaleString()}
                    </span>
                  )}
                  <StatusBadge status={project.status} />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Announcements */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Announcements</h2>
            <Link to="/announcements">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="space-y-4">
            {announcements.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No announcements yet</p>
            )}
            {announcements.map((a) => (
              <div key={a.id} className="border-l-2 border-accent pl-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{a.title}</p>
                  {a.priority !== "normal" && <StatusBadge status={a.priority} />}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {format(new Date(a.created_date), "MMM d")}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}