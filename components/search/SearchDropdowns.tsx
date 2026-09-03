"use client";

import { useState, useRef, useEffect } from "react";
import type { Icp, SpecificIcp } from "@/db/schema";
import { PlatformType } from "@/lib/search/types";
import {
  Search,
  ChevronDown,
  Check,
  Calendar,
  Layers,
  Sparkles,
  Globe,
  Loader2,
  X,
} from "lucide-react";

export interface SearchFilterState {
  selectedIcpId: string;
  selectedSpecificIcpIds: string[];
  selectedPlatforms: PlatformType[];
  dateRange: string;
}

interface SearchDropdownsProps {
  icps: Icp[];
  specificIcps: SpecificIcp[];
  loadingSpecific: boolean;
  filterState: SearchFilterState;
  onFilterChange: (updates: Partial<SearchFilterState>) => void;
  onSearch: () => void;
  isSearching: boolean;
}

const ALL_PLATFORMS: { id: PlatformType; name: string; icon: string }[] = [
  { id: "linkedin", name: "LinkedIn", icon: "in" },
  { id: "x", name: "X (Twitter)", icon: "𝕏" },
  { id: "reddit", name: "Reddit", icon: "r/" },
  { id: "github", name: "GitHub", icon: "gh" },
  { id: "hackernews", name: "Hacker News", icon: "Y" },
];

const DATE_OPTIONS = [
  { value: "past 24 hours", label: "Past 24 Hours" },
  { value: "past 7 days", label: "Past 7 Days (Week)" },
  { value: "past 30 days", label: "Past 30 Days (Month)" },
  { value: "past year", label: "Past Year" },
  { value: "all", label: "All Time" },
];

export function SearchDropdowns({
  icps,
  specificIcps,
  loadingSpecific,
  filterState,
  onFilterChange,
  onSearch,
  isSearching,
}: SearchDropdownsProps) {
  const [openDropdown, setOpenDropdown] = useState<
    "icp" | "specific" | "platform" | "date" | null
  >(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIcp = icps.find((i) => i.id === filterState.selectedIcpId);

  // Toggle Specific ICP
  const toggleSpecificIcp = (id: string) => {
    const current = filterState.selectedSpecificIcpIds;
    const exists = current.includes(id);
    const updated = exists
      ? current.filter((x) => x !== id)
      : [...current, id];
    onFilterChange({ selectedSpecificIcpIds: updated });
  };

  // Select All / Deselect All Specific ICPs
  const toggleAllSpecificIcps = () => {
    if (filterState.selectedSpecificIcpIds.length === specificIcps.length) {
      onFilterChange({ selectedSpecificIcpIds: [] });
    } else {
      onFilterChange({
        selectedSpecificIcpIds: specificIcps.map((s) => s.id),
      });
    }
  };

  // Toggle Platform
  const togglePlatform = (p: PlatformType) => {
    const current = filterState.selectedPlatforms;
    const exists = current.includes(p);
    const updated = exists
      ? current.filter((x) => x !== p)
      : [...current, p];
    onFilterChange({ selectedPlatforms: updated });
  };

  // Select All / Deselect All Platforms
  const toggleAllPlatforms = () => {
    if (filterState.selectedPlatforms.length === ALL_PLATFORMS.length) {
      onFilterChange({ selectedPlatforms: [] });
    } else {
      onFilterChange({
        selectedPlatforms: ALL_PLATFORMS.map((p) => p.id),
      });
    }
  };

  const selectedDateLabel =
    DATE_OPTIONS.find((d) => d.value === filterState.dateRange)?.label ||
    "Past 7 Days";

  const canSearch =
    Boolean(filterState.selectedIcpId) &&
    filterState.selectedSpecificIcpIds.length > 0 &&
    filterState.selectedPlatforms.length > 0 &&
    !isSearching;

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-zinc-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. ICP Dropdown */}
        <div className="relative">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-zinc-400" />
            <span>1. Ideal Customer Profile</span>
          </label>
          <button
            type="button"
            onClick={() =>
              setOpenDropdown(openDropdown === "icp" ? null : "icp")
            }
            className="w-full flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-900 shadow-2xs hover:bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <span className="truncate">
              {selectedIcp ? selectedIcp.title || selectedIcp.name : "Select an ICP..."}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 ml-2" />
          </button>

          {openDropdown === "icp" && (
            <div className="absolute z-30 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              {icps.length === 0 ? (
                <div className="p-3 text-xs text-zinc-500 dark:text-zinc-400">
                  No saved ICPs found. Generate one in Dashboard first.
                </div>
              ) : (
                icps.map((icp) => {
                  const isSelected = icp.id === filterState.selectedIcpId;
                  return (
                    <button
                      key={icp.id}
                      type="button"
                      onClick={() => {
                        onFilterChange({
                          selectedIcpId: icp.id,
                          selectedSpecificIcpIds: [], // reset specific on ICP switch
                        });
                        setOpenDropdown(null);
                      }}
                      className={`w-full flex items-start gap-2 rounded-lg p-2 text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-zinc-100 text-zinc-900 font-semibold dark:bg-zinc-800 dark:text-zinc-100"
                          : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {isSelected && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />}
                      </div>
                      <div className="truncate">
                        <div className="truncate font-medium">
                          {icp.title || icp.name}
                        </div>
                        {icp.description && (
                          <div className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">
                            {icp.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* 2. Specific ICPs Multi-Select Dropdown */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>2. Specific ICPs</span>
            </label>
            {specificIcps.length > 0 && (
              <button
                type="button"
                onClick={toggleAllSpecificIcps}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {filterState.selectedSpecificIcpIds.length === specificIcps.length
                  ? "Clear"
                  : "Select All"}
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={!filterState.selectedIcpId || loadingSpecific}
            onClick={() =>
              setOpenDropdown(openDropdown === "specific" ? null : "specific")
            }
            className="w-full flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-900 shadow-2xs hover:bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="truncate">
              {loadingSpecific ? (
                <span className="inline-flex items-center gap-1.5 text-zinc-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading audiences...
                </span>
              ) : filterState.selectedSpecificIcpIds.length === 0 ? (
                "Select Specific ICPs..."
              ) : filterState.selectedSpecificIcpIds.length === specificIcps.length ? (
                `All Specific ICPs (${specificIcps.length})`
              ) : (
                `${filterState.selectedSpecificIcpIds.length} of ${specificIcps.length} selected`
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 ml-2" />
          </button>

          {openDropdown === "specific" && (
            <div className="absolute z-30 mt-1.5 w-full min-w-72 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-zinc-100 dark:border-zinc-800 px-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                  Target Audiences ({specificIcps.length})
                </span>
                <button
                  type="button"
                  onClick={toggleAllSpecificIcps}
                  className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
                >
                  {filterState.selectedSpecificIcpIds.length === specificIcps.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              {specificIcps.length === 0 ? (
                <div className="p-3 text-xs text-zinc-400">
                  No specific ICPs found for this profile.
                </div>
              ) : (
                <div className="space-y-1">
                  {specificIcps.map((spec) => {
                    const isChecked = filterState.selectedSpecificIcpIds.includes(
                      spec.id
                    );
                    return (
                      <div
                        key={spec.id}
                        onClick={() => toggleSpecificIcp(spec.id)}
                        className={`flex items-start gap-2.5 rounded-lg p-2 text-xs transition-colors cursor-pointer select-none ${
                          isChecked
                            ? "bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div
                          className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:checked:bg-zinc-100 dark:checked:text-zinc-900"
                        />
                        <div className="truncate">
                          <div className="font-medium truncate">{spec.name}</div>
                          {spec.whatToSearch && (
                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                              {spec.whatToSearch}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Platform Multi-Select Dropdown */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-blue-500" />
              <span>3. Platforms</span>
            </label>
            <button
              type="button"
              onClick={toggleAllPlatforms}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {filterState.selectedPlatforms.length === ALL_PLATFORMS.length
                ? "Clear"
                : "Select All"}
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setOpenDropdown(openDropdown === "platform" ? null : "platform")
            }
            className="w-full flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-900 shadow-2xs hover:bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <span className="truncate">
              {filterState.selectedPlatforms.length === 0 ? (
                "Select Platforms..."
              ) : filterState.selectedPlatforms.length === ALL_PLATFORMS.length ? (
                "All Platforms (5)"
              ) : (
                `${filterState.selectedPlatforms.length} platform${
                  filterState.selectedPlatforms.length > 1 ? "s" : ""
                } selected`
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 ml-2" />
          </button>

          {openDropdown === "platform" && (
            <div className="absolute z-30 mt-1.5 w-full min-w-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-zinc-100 dark:border-zinc-800 px-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                  Available Channels ({ALL_PLATFORMS.length})
                </span>
                <button
                  type="button"
                  onClick={toggleAllPlatforms}
                  className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
                >
                  {filterState.selectedPlatforms.length === ALL_PLATFORMS.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              <div className="space-y-1">
                {ALL_PLATFORMS.map((p) => {
                  const isChecked = filterState.selectedPlatforms.includes(
                    p.id
                  );
                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer select-none ${
                        isChecked
                          ? "bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-medium"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold">
                          {p.icon}
                        </span>
                        <span>{p.name}</span>
                      </div>

                      {isChecked && (
                        <Check className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. Date Range / Timeframe Dropdown */}
        <div className="relative">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <span>4. Post Age / Date Range</span>
          </label>
          <button
            type="button"
            onClick={() =>
              setOpenDropdown(openDropdown === "date" ? null : "date")
            }
            className="w-full flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-900 shadow-2xs hover:bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <span className="truncate">{selectedDateLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 ml-2" />
          </button>

          {openDropdown === "date" && (
            <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              {DATE_OPTIONS.map((opt) => {
                const isSelected = opt.value === filterState.dateRange;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onFilterChange({ dateRange: opt.value });
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-zinc-100 text-zinc-900 font-semibold dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Filters Chips Row & Search Action Bar */}
      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Chips Summary */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {filterState.selectedPlatforms.map((p) => {
            const item = ALL_PLATFORMS.find((x) => x.id === p);
            return (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
              >
                <span>{item?.name || p}</span>
                <button
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}

          <span className="rounded-md bg-zinc-50 dark:bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-700">
            {selectedDateLabel}
          </span>
        </div>

        {/* Primary Search Button */}
        <button
          type="button"
          disabled={!canSearch}
          onClick={onSearch}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-zinc-50 shadow-md transition-all hover:bg-zinc-800 active:scale-98 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer shrink-0"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              <span>Searching Socials...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4 text-zinc-300 dark:text-zinc-700" />
              <span>Search Posts</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
