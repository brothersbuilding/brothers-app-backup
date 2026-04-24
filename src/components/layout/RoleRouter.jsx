import React, { useEffect, useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import LaborDashboard from "@/pages/LaborDashboard";
import Sidebar from "./Sidebar";

const PAGE_PATHS = {
  dashboard: "/",
  projects: "/projects",
  time: "/time",
  costs: "/costs",
  documents: "/documents",
  announcements: "/announcements",
  team: "/team",
};

export default function RoleRouter() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // Resolve effective role — app owner/collaborator gets full admin access
  // collaborator_role "editor" or "owner" means they built the app and should be admin
  const isAppOwner =
    user?.data?._app_role === "admin" ||
    user?._app_role === "admin" ||
    user?.role === "admin" ||
    user?.collaborator_role === "editor" ||
    user?.collaborator_role === "owner";
  const effectiveRole = isAppOwner ? "admin" : user?.role;

  // Labor users get their own focused view — no sidebar
  if (effectiveRole === "labor") {
    return <LaborDashboard user={user} />;
  }

  // For managers, redirect to their first allowed page if they don't have dashboard access
  const isRoot = window.location.pathname === "/";
  if (effectiveRole === "manager" && isRoot) {
    const allowed = user.allowed_pages || [];
    if (!allowed.includes("dashboard") && allowed.length > 0) {
      return <Navigate to={PAGE_PATHS[allowed[0]]} replace />;
    }
  }

  // Admin and Manager get the full sidebar app
  const userWithEffectiveRole = { ...user, role: effectiveRole };
  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={userWithEffectiveRole} />
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet context={{ user: userWithEffectiveRole }} />
        </div>
      </main>
    </div>
  );
}