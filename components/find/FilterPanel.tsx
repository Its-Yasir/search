"use client";

import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  Sparkles,
  Building2,
  MapPin,
  Users,
  Target,
  Clock,
  Layers,
  ChevronDown,
} from "lucide-react";
import type { FilterOptionSummary, FindFilterParams } from "@/app/actions/find";

interface FilterPanelProps {
  filters: FindFilterParams;
  options: FilterOptionSummary;
  onFilterChange: (updates: Partial<FindFilterParams>) => void;
  onReset: () => void;
  activeCount: number;
}

export function FilterPanel({
  filters,
  options,
  onFilterChange,
  onReset,
  activeCount,
}: FilterPanelProps) {
  const isLead = filters.mode === "leads";

  return (
    <div className="space-y-4">
      {/* Top Controls: Mode Dropdown Selector + Primary Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Dropdown to switch between Leads and ICP */}
        <div className="relative min-w-60 shrink-0">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            What are you finding?
          </label>
          <div className="relative">
            <select
              value={filters.mode}
              onChange={(e) =>
                onFilterChange({
                  mode: e.target.value as "leads" | "icp",
                  offset: 0,
                })
              }
              className="w-full appearance-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 pr-10 text-sm font-semibold text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="leads">
                🎯 Leads ({options.totalLeads})
              </option>
              <option value="icp">
                🏢 ICP Profiles ({options.totalIcps})
              </option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          </div>
        </div>

        {/* Global Keyword Search */}
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Search keywords
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={filters.query || ""}
              onChange={(e) =>
                onFilterChange({ query: e.target.value, offset: 0 })
              }
              placeholder={
                isLead
                  ? "Search companies, pain points, headlines, or requirements..."
                  : "Search companies, target roles, industries, or profiles..."
              }
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2.5 pl-10 pr-10 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
            />
            {filters.query && (
              <button
                onClick={() => onFilterChange({ query: "", offset: 0 })}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="w-full md:w-48 shrink-0">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Sort by
          </label>
          <div className="relative">
            <select
              value={filters.sortBy || "newest"}
              onChange={(e) =>
                onFilterChange({
                  sortBy: e.target.value as "newest" | "confidence" | "size",
                  offset: 0,
                })
              }
              className="w-full appearance-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 pr-8 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="newest">Latest Signal</option>
              <option value="confidence">Highest Confidence</option>
              <option value="size">Company Scale (Largest)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          </div>
        </div>
      </div>

      {/* Filter Row: Detailed Dropdowns */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500" />
            <span>Refine Filters</span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                {activeCount} active
              </span>
            )}
          </div>

          {activeCount > 0 && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              Reset filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Industry Filter Dropdown */}
          <div>
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-zinc-400" />
              Industry
            </label>
            <div className="relative">
              <select
                value={filters.industry || "all"}
                onChange={(e) =>
                  onFilterChange({ industry: e.target.value, offset: 0 })
                }
                className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-3 py-2 pr-8 text-xs text-zinc-800 dark:text-zinc-200 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Industries</option>
                {options.industries.map((ind) => (
                  <option key={ind.name} value={ind.name}>
                    {ind.name} ({ind.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>

          {/* Geography Filter Dropdown */}
          <div>
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-zinc-400" />
              Geography / Region
            </label>
            <div className="relative">
              <select
                value={filters.geography || "all"}
                onChange={(e) =>
                  onFilterChange({ geography: e.target.value, offset: 0 })
                }
                className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-3 py-2 pr-8 text-xs text-zinc-800 dark:text-zinc-200 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Regions</option>
                {options.geographies.map((geo) => (
                  <option key={geo.name} value={geo.name}>
                    {geo.name} ({geo.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>

          {/* Target Role / Job Title Filter Dropdown */}
          <div>
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
              <Target className="h-3 w-3 text-zinc-400" />
              Target Job Title
            </label>
            <div className="relative">
              <select
                value={filters.title || "all"}
                onChange={(e) =>
                  onFilterChange({ title: e.target.value, offset: 0 })
                }
                className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-3 py-2 pr-8 text-xs text-zinc-800 dark:text-zinc-200 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Target Roles</option>
                {options.titles.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>

          {/* Entity Type Dropdown */}
          <div>
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
              <Layers className="h-3 w-3 text-zinc-400" />
              Target Entity Type
            </label>
            <div className="relative">
              <select
                value={filters.entityType || "all"}
                onChange={(e) =>
                  onFilterChange({
                    entityType: e.target.value as "all" | "person" | "company",
                    offset: 0,
                  })
                }
                className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-3 py-2 pr-8 text-xs text-zinc-800 dark:text-zinc-200 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Types (Company & Person)</option>
                <option value="company">🏢 Company Targets</option>
                <option value="person">👤 Person / Individual Targets</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>

          {/* Event Trigger Signal Type */}
          <div>
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-zinc-400" />
              Signal / Event Type
            </label>
            <div className="relative">
              <select
                value={filters.eventType || "all"}
                onChange={(e) =>
                  onFilterChange({ eventType: e.target.value, offset: 0 })
                }
                className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-3 py-2 pr-8 text-xs text-zinc-800 dark:text-zinc-200 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Signal Events</option>
                {options.eventTypes.map((ev) => (
                  <option key={ev.name} value={ev.name}>
                    {ev.name.replace(/_/g, " ")} ({ev.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>

          {/* Company Scale Presets */}
          <div>
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
              <Users className="h-3 w-3 text-zinc-400" />
              Company Scale
            </label>
            <div className="relative">
              <select
                value={
                  filters.minCompanySize === 1000
                    ? "1000+"
                    : filters.minCompanySize === 200
                    ? "200-1000"
                    : filters.minCompanySize === 50
                    ? "50-200"
                    : filters.maxCompanySize === 50
                    ? "1-50"
                    : "all"
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "1-50") {
                    onFilterChange({ minCompanySize: 1, maxCompanySize: 50, offset: 0 });
                  } else if (val === "50-200") {
                    onFilterChange({ minCompanySize: 50, maxCompanySize: 200, offset: 0 });
                  } else if (val === "200-1000") {
                    onFilterChange({ minCompanySize: 200, maxCompanySize: 1000, offset: 0 });
                  } else if (val === "1000+") {
                    onFilterChange({ minCompanySize: 1000, maxCompanySize: undefined, offset: 0 });
                  } else {
                    onFilterChange({ minCompanySize: undefined, maxCompanySize: undefined, offset: 0 });
                  }
                }}
                className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-3 py-2 pr-8 text-xs text-zinc-800 dark:text-zinc-200 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Scales</option>
                <option value="1-50">1 – 50 employees (Startups)</option>
                <option value="50-200">50 – 200 employees (Growth)</option>
                <option value="200-1000">200 – 1,000 employees (Mid-Market)</option>
                <option value="1000+">1,000+ employees (Enterprise)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>

          {/* Lead Expiration Status (Only shown for Leads) */}
          {isLead && (
            <div>
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3 text-zinc-400" />
                Opportunity Status
              </label>
              <div className="relative">
                <select
                  value={filters.expirationStatus || "all"}
                  onChange={(e) =>
                    onFilterChange({
                      expirationStatus: e.target.value as "all" | "active" | "expired",
                      offset: 0,
                    })
                  }
                  className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-3 py-2 pr-8 text-xs text-zinc-800 dark:text-zinc-200 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Opportunities</option>
                  <option value="active">Active & Open</option>
                  <option value="expired">Expired / Past Signal</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              </div>
            </div>
          )}
        </div>

        {/* Active Filter Chips */}
        {activeCount > 0 && (
          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-zinc-400">
              Active filters:
            </span>

            {filters.industry && filters.industry !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                Industry: {filters.industry}
                <button
                  onClick={() => onFilterChange({ industry: undefined })}
                  className="hover:text-red-500 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.geography && filters.geography !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                Geo: {filters.geography}
                <button
                  onClick={() => onFilterChange({ geography: undefined })}
                  className="hover:text-red-500 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.title && filters.title !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                Role: {filters.title}
                <button
                  onClick={() => onFilterChange({ title: undefined })}
                  className="hover:text-red-500 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.entityType && filters.entityType !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                Type: {filters.entityType}
                <button
                  onClick={() => onFilterChange({ entityType: "all" })}
                  className="hover:text-red-500 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.eventType && filters.eventType !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 capitalize">
                Signal: {filters.eventType.replace(/_/g, " ")}
                <button
                  onClick={() => onFilterChange({ eventType: undefined })}
                  className="hover:text-red-500 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {(filters.minCompanySize || filters.maxCompanySize) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                Scale: {filters.minCompanySize || 0}–{filters.maxCompanySize || "∞"}
                <button
                  onClick={() =>
                    onFilterChange({
                      minCompanySize: undefined,
                      maxCompanySize: undefined,
                    })
                  }
                  className="hover:text-red-500 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filters.expirationStatus && filters.expirationStatus !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                Status: {filters.expirationStatus}
                <button
                  onClick={() => onFilterChange({ expirationStatus: "all" })}
                  className="hover:text-red-500 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
