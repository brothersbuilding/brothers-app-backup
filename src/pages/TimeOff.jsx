import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";

export default function TimeOff() {
  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return me;
    },
  });

  const { data: ptoRequests = [] } = useQuery({
    queryKey: ["pto-requests", user?.id],
    queryFn: async () => {
      const requests = await base44.entities.PTORequest.filter({
        employee_id: user?.id,
      });
      return requests;
    },
    enabled: !!user?.id,
  });

  const stats = useMemo(() => {
    const pending = ptoRequests.filter((r) => r.status === "pending");
    const approved = ptoRequests.filter((r) => r.status === "approved");
    const rejected = ptoRequests.filter((r) => r.status === "rejected");

    const pendingHours = pending.reduce((sum, r) => sum + (r.total_hours || 0), 0);
    const approvedHours = approved.reduce((sum, r) => sum + (r.total_hours || 0), 0);
    const accumulatedPTO = (user?.pto_hours || 0) + approvedHours;

    return {
      pending: { count: pending.length, hours: pendingHours },
      approved: { count: approved.length, hours: approvedHours },
      rejected: { count: rejected.length, hours: 0 },
      accumulatedPTO,
      chartData: [
        { name: "Pending", count: pending.length, hours: pendingHours },
        { name: "Approved", count: approved.length, hours: approvedHours },
      ],
      pieData: [
        { name: "Pending", value: pendingHours, color: "#fbbf24" },
        { name: "Approved", value: approvedHours, color: "#34d399" },
      ],
    };
  }, [ptoRequests, user?.pto_hours]);

  const getStatusBadge = (status) => {
    const variants = {
      pending: { bg: "bg-amber-100", text: "text-amber-800", icon: AlertCircle },
      approved: { bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle },
      rejected: { bg: "bg-red-100", text: "text-red-800", icon: AlertCircle },
    };
    const variant = variants[status] || variants.pending;
    return variant;
  };

  return (
    <div>
      <PageHeader
        title="Time Off"
        subtitle="View your PTO requests and approved time off"
      />

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Accumulated PTO</p>
              <p className="text-3xl font-bold text-foreground">{stats.accumulatedPTO.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-2">hrs</span></p>
            </div>
            <Clock className="w-8 h-8 text-primary opacity-20" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pending Requests</p>
              <p className="text-3xl font-bold text-amber-600">{stats.pending.count}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.pending.hours.toFixed(1)} hrs</p>
            </div>
            <AlertCircle className="w-8 h-8 text-amber-500 opacity-20" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Approved Requests</p>
              <p className="text-3xl font-bold text-emerald-600">{stats.approved.count}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.approved.hours.toFixed(1)} hrs</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500 opacity-20" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Rejected</p>
              <p className="text-3xl font-bold text-red-600">{stats.rejected.count}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="font-semibold text-sm mb-4 uppercase tracking-wide">Requests by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" fill="#32a852" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-sm mb-4 uppercase tracking-wide">Hours Distribution</h3>
          {stats.pieData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)} hrs`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value.toFixed(1)} hrs`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No PTO data to display
            </div>
          )}
        </Card>
      </div>

      {/* Requests List */}
      <Card className="p-6">
        <h3 className="font-semibold text-sm mb-4 uppercase tracking-wide">All Requests</h3>
        {ptoRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No PTO requests yet</p>
        ) : (
          <div className="space-y-3">
            {ptoRequests.map((request) => {
              const variant = getStatusBadge(request.status);
              const Icon = variant.icon;
              return (
                <div key={request.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${variant.text}`} />
                      <p className="font-medium text-sm">
                        {format(new Date(request.start_date), "MMM d")} – {format(new Date(request.end_date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{request.total_hours.toFixed(1)} hours ({request.hours_per_day} hrs/day)</p>
                    {request.reason && <p className="text-xs text-muted-foreground italic">{request.reason}</p>}
                  </div>
                  <Badge className={`${variant.bg} ${variant.text} capitalize shrink-0 ml-4`}>
                    {request.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}