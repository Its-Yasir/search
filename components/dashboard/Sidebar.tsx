"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import type { Icp } from "@/db/schema";
import {
  LayoutDashboard,
  Search,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Layers,
  Trash2,
  Check,
  X,
  Loader2,
  Target,
  Link2,
  Compass,
} from "lucide-react";

interface SidebarProps {
  user: {
    userId: string;
    name: string;
    email: string;
  };
  icps: Icp[];
  activeIcpId?: string | null;
  onSelectIcp?: (icp: Icp) => void;
  onNewIcp?: () => void;
  onDeleteIcp?: (icpId: string) => Promise<void> | void;
}

export function Sidebar({
  user,
  icps,
  activeIcpId,
  onSelectIcp,
  onNewIcp,
  onDeleteIcp,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const initial = user.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <aside
      className={`relative flex flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 ease-in-out select-none ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Header & Brand */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-100 px-3.5 dark:border-zinc-800/70">
        {!collapsed && (
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-mono text-xs font-semibold tracking-wider text-zinc-900 uppercase dark:text-zinc-100"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold shadow-xs">
              α
            </div>
            <span className="truncate">Search</span>
          </Link>
        )}

        {collapsed && (
          <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold">
            α
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 transition-colors cursor-pointer ${
            collapsed ? "mx-auto mt-1" : ""
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex flex-1 flex-col justify-between overflow-y-auto p-2.5 space-y-4">
        <div className="space-y-4">
          {/* Primary Action / New ICP */}
          <div>
            <button
              onClick={onNewIcp}
              className={`w-full flex items-center gap-2.5 rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 px-3 py-2 text-xs font-medium transition-all shadow-xs cursor-pointer ${
                collapsed ? "justify-center px-0" : ""
              }`}
              title="New ICP"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300 dark:text-amber-500" />
              {!collapsed && <span>New ICP Search</span>}
            </button>
          </div>

          {/* Menus List */}
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                pathname === "/dashboard"
                  ? "text-zinc-900 bg-zinc-100/90 dark:bg-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title="Dashboard"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Dashboard</span>}
            </Link>

            <Link
              href="/find"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                pathname === "/find"
                  ? "text-zinc-900 bg-zinc-100/90 dark:bg-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title="Find Leads & ICP"
            >
              <Compass className="h-4 w-4 shrink-0 text-blue-500" />
              {!collapsed && <span>Find Leads & ICP</span>}
            </Link>

            <Link
              href="/search"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                pathname === "/search"
                  ? "text-zinc-900 bg-zinc-100/90 dark:bg-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title="Social & Web Search"
            >
              <Search className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Social & Web Search</span>}
            </Link>

            <Link
              href="/analyze"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                pathname === "/analyze"
                  ? "text-zinc-900 bg-zinc-100/90 dark:bg-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title="Analyze & Leads"
            >
              <Target className="h-4 w-4 shrink-0 text-emerald-500" />
              {!collapsed && <span>Analyze & Leads</span>}
            </Link>

            <Link
              href="/add"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                pathname === "/add"
                  ? "text-zinc-900 bg-zinc-100/90 dark:bg-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title="Add Profile URLs"
            >
              <Link2 className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Add Profile URLs</span>}
            </Link>
          </nav>

          {/* Saved ICPs Section */}
          {!collapsed && (
            <div className="pt-2">
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Saved ICPs ({icps.length})
                </span>
                <Layers className="h-3 w-3 text-zinc-400" />
              </div>

              {icps.length === 0 ? (
                <div className="px-2 py-3 text-[11px] text-zinc-400 dark:text-zinc-600">
                  No ICPs yet. Start a chat search to generate your first
                  profile.
                </div>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {icps.map((icp) => {
                    const isActive = activeIcpId === icp.id;
                    const isConfirming = confirmDeleteId === icp.id;
                    const isDeleting = deletingId === icp.id;

                    if (isConfirming) {
                      return (
                        <div
                          key={icp.id}
                          className="flex items-center justify-between rounded-md bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-2 py-1 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150"
                        >
                          <span className="truncate pr-1 text-[11px] font-medium">
                            Delete ICP?
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (onDeleteIcp) {
                                  setDeletingId(icp.id);
                                  try {
                                    await onDeleteIcp(icp.id);
                                  } finally {
                                    setDeletingId(null);
                                    setConfirmDeleteId(null);
                                  }
                                }
                              }}
                              disabled={isDeleting}
                              className="rounded p-1 text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
                              title="Confirm delete"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              disabled={isDeleting}
                              className="rounded p-1 text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-400 transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={icp.id}
                        className={`group flex items-center justify-between rounded-md text-xs transition-colors ${
                          isActive
                            ? "bg-zinc-200/70 text-zinc-900 font-medium dark:bg-zinc-800 dark:text-zinc-100"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                        }`}
                      >
                        <button
                          onClick={() => onSelectIcp && onSelectIcp(icp)}
                          className="flex-1 min-w-0 text-left px-2 py-1.5 cursor-pointer truncate"
                          title={icp.title}
                        >
                          <span className="truncate block">{icp.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(icp.id);
                          }}
                          className="p-1.5 rounded-md text-red-500 hover:text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors cursor-pointer shrink-0"
                          title="Delete ICP"
                          aria-label={`Delete ICP ${icp.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Section: User & Logout */}
        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800/70 space-y-2">
          {/* User Info Badge */}
          <div
            className={`flex items-center gap-2.5 rounded-lg p-1.5 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-xs font-semibold">
              {initial}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {user.name || "User"}
                </div>
                <div className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">
                  {user.email}
                </div>
              </div>
            )}
          </div>

          {/* Logout Action */}
          <form action={logoutAction} className="w-full">
            <button
              type="submit"
              className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors cursor-pointer ${
                collapsed ? "justify-center px-0" : ""
              }`}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
