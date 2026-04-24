import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  DollarSign,
  FileText,
  Megaphone,
  Users,
  BarChart2,
  Settings,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALL_NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { key: "projects", label: "Projects", icon: FolderKanban, path: "/projects" },
  { key: "time", label: "Time Cards", icon: Clock, path: "/time" },
  { key: "costs", label: "Costs", icon: DollarSign, path: "/costs" },
  { key: "documents", label: "Documents", icon: FileText, path: "/documents" },
  { key: "announcements", label: "Announcements", icon: Megaphone, path: "/announcements" },
  { key: "team", label: "Team", icon: Users, path: "/team" },
  { key: "reports", label: "Reports", icon: BarChart2, path: "/reports" },
  { key: "clock-in", label: "Clock In", icon: Clock, path: "/labor", managerAndAbove: true },
  { key: "settings", label: "Settings", icon: Settings, path: "/settings", adminOnly: true },
];

export default function Sidebar({ user }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return user?.role === "admin";
    if (item.managerAndAbove) return user?.role === "admin" || user?.role === "manager";
    return user?.role === "admin" || (user?.allowed_pages || []).includes(item.key);
  });

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          {/* BB Diamond Logo Mark */}
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
              <polygon points="24,2 46,24 24,46 2,24" fill="hsl(32,65%,52%)" />
              <text x="24" y="29" textAnchor="middle" fontFamily="serif" fontWeight="700" fontSize="14" fill="white">BB</text>
            </svg>
          </div>
          <div>
            <h1 className="font-barlow text-lg font-bold text-sidebar-foreground tracking-widest uppercase leading-none">Brothers</h1>
            <p className="font-barlow text-xs text-sidebar-primary/80 font-semibold tracking-widest uppercase">Building</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className={cn("w-4.5 h-4.5", isActive && "text-sidebar-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-card shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}