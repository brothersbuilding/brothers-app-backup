import React from "react";
import { X, Clock, Megaphone, LogOut, UtensilsCrossed } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";

export default function LaborNavDrawer({ open, onClose, user }) {
  const handleLogout = () => {
    base44.auth.logout();
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
              <polygon points="24,2 46,24 24,46 2,24" fill="hsl(32,65%,52%)" />
              <text x="24" y="29" textAnchor="middle" fontFamily="serif" fontWeight="700" fontSize="14" fill="white">BB</text>
            </svg>
            <div>
              <p className="font-barlow text-xs text-sidebar-primary/80 font-semibold tracking-widest uppercase">Brothers Building</p>
              <p className="font-barlow text-sm font-bold text-sidebar-foreground uppercase tracking-wide leading-tight">{user?.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-sidebar-foreground/50 hover:text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-5 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wide mb-1">Role</p>
          <span className="inline-block bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold px-2 py-0.5 rounded font-barlow uppercase tracking-wide">
            Labor
          </span>
          <p className="text-xs text-sidebar-foreground/50 mt-3">{user?.email}</p>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent text-sidebar-foreground text-sm font-medium"
          >
            <Clock className="w-4 h-4 text-sidebar-primary" />
            Time Clock
          </button>
          <Link
            to="/time-off"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground text-sm font-medium"
          >
            <UtensilsCrossed className="w-4 h-4" />
            Time Off
          </Link>
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground text-sm font-medium"
          >
            <Megaphone className="w-4 h-4" />
            Announcements
          </button>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}