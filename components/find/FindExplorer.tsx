"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Search,
  Loader2,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  findEntitiesAction,
  LeadFindItem,
  IcpFindItem,
  FindFilterParams,
  FilterOptionSummary,
} from "@/app/actions/find";
import { FilterPanel } from "./FilterPanel";
import { LeadCard } from "./LeadCard";
import { IcpCard } from "./IcpCard";
import { EntityDetailModal } from "./EntityDetailModal";

interface FindExplorerProps {
  initialOptions: FilterOptionSummary;
  initialMode?: "leads" | "icp";
}

export function FindExplorer({
  initialOptions,
  initialMode = "leads",
}: FindExplorerProps) {
  const [filters, setFilters] = useState<FindFilterParams>({
    mode: initialMode,
    query: "",
    industry: "all",
    geography: "all",
    entityType: "all",
    title: "all",
    eventType: "all",
    expirationStatus: "all",
    sortBy: "newest",
    limit: 24,
    offset: 0,
  });

  const [leadResults, setLeadResults] = useState<LeadFindItem[]>([]);
  const [icpResults, setIcpResults] = useState<IcpFindItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [selectedItem, setSelectedItem] = useState<
    LeadFindItem | IcpFindItem | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


  const fetchResults = useCallback(async (currentFilters: FindFilterParams) => {
    setLoading(true);
    setError(null);
    try {
      const res = await findEntitiesAction(currentFilters);
      if (res.success) {
        if (currentFilters.mode === "leads") {
          setLeadResults(res.data as LeadFindItem[]);
        } else {
          setIcpResults(res.data as IcpFindItem[]);
        }
        setTotal(res.total);
      } else {
        setError(res.error || "Failed to load results");
      }
    } catch (err) {
      console.error("Fetch entities error:", err);
      setError("An unexpected error occurred while querying records.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResults(filters);
    }, 250); // slight debounce for smooth text filtering

    return () => clearTimeout(timer);
  }, [filters, fetchResults]);

  const handleFilterChange = (updates: Partial<FindFilterParams>) => {
    setFilters((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const handleReset = () => {
    setFilters({
      mode: filters.mode,
      query: "",
      industry: "all",
      geography: "all",
      entityType: "all",
      title: "all",
      minCompanySize: undefined,
      maxCompanySize: undefined,
      eventType: "all",
      expirationStatus: "all",
      sortBy: "newest",
      limit: 24,
      offset: 0,
    });
  };

  // Compute active filters count
  const activeCount = [
    Boolean(filters.query),
    filters.industry && filters.industry !== "all",
    filters.geography && filters.geography !== "all",
    filters.entityType && filters.entityType !== "all",
    filters.title && filters.title !== "all",
    filters.eventType && filters.eventType !== "all",
    filters.expirationStatus && filters.expirationStatus !== "all",
    Boolean(filters.minCompanySize || filters.maxCompanySize),
  ].filter(Boolean).length;

  const handleViewDetails = (item: LeadFindItem | IcpFindItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  // Pagination calculation
  const limit = filters.limit || 24;
  const offset = filters.offset || 0;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;

  const handleNextPage = () => {
    if (offset + limit < total) {
      handleFilterChange({ offset: offset + limit });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevPage = () => {
    if (offset - limit >= 0) {
      handleFilterChange({ offset: offset - limit });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Controls */}
      <FilterPanel
        filters={filters}
        options={initialOptions}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        activeCount={activeCount}
      />

      {/* Quick Recommendation Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-500" />
          Quick Filters:
        </span>

        <button
          onClick={() =>
            handleFilterChange({
              industry: "Banking",
              offset: 0,
            })
          }
          className={`px-3 py-1 rounded-lg border text-xs font-medium shrink-0 transition cursor-pointer ${
            filters.industry === "Banking"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent"
              : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          Banking & Finance
        </button>

        <button
          onClick={() =>
            handleFilterChange({
              industry: "Sustainability",
              offset: 0,
            })
          }
          className={`px-3 py-1 rounded-lg border text-xs font-medium shrink-0 transition cursor-pointer ${
            filters.industry === "Sustainability"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent"
              : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          Sustainability & ESG
        </button>

        <button
          onClick={() =>
            handleFilterChange({
              eventType: "partnership",
              offset: 0,
            })
          }
          className={`px-3 py-1 rounded-lg border text-xs font-medium shrink-0 transition cursor-pointer ${
            filters.eventType === "partnership"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent"
              : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          🤝 Partnerships
        </button>

        <button
          onClick={() =>
            handleFilterChange({
              eventType: "product_launch",
              offset: 0,
            })
          }
          className={`px-3 py-1 rounded-lg border text-xs font-medium shrink-0 transition cursor-pointer ${
            filters.eventType === "product_launch"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent"
              : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          🚀 Product Launches
        </button>

        {filters.mode === "leads" && (
          <button
            onClick={() =>
              handleFilterChange({
                expirationStatus: "active",
                offset: 0,
              })
            }
            className={`px-3 py-1 rounded-lg border text-xs font-medium shrink-0 transition cursor-pointer ${
              filters.expirationStatus === "active"
                ? "bg-emerald-600 text-white border-transparent"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            🟢 Active Leads Only
          </button>
        )}

        <button
          onClick={() =>
            handleFilterChange({
              sortBy: "confidence",
              offset: 0,
            })
          }
          className={`px-3 py-1 rounded-lg border text-xs font-medium shrink-0 transition cursor-pointer ${
            filters.sortBy === "confidence"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent"
              : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          ⚡ High Confidence
        </button>
      </div>

      {/* Results Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {filters.mode === "leads" ? "Commercial Leads" : "ICP Profiles"}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing {total > 0 ? offset + 1 : 0}–
            {Math.min(offset + limit, total)} of {total} results
          </span>
        </div>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Updating...</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-50/50 dark:bg-red-950/20 p-4 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/40 animate-pulse p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              </div>
              <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Results Grid */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filters.mode === "leads"
            ? leadResults.map((item) => (
                <LeadCard
                  key={item.lead.id}
                  item={item}
                  onViewDetails={handleViewDetails}
                />
              ))
            : icpResults.map((item) => (
                <IcpCard
                  key={item.icp.id}
                  item={item}
                  onViewDetails={handleViewDetails}
                />
              ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && total === 0 && (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-3">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            No matching {filters.mode === "leads" ? "leads" : "ICP profiles"} found
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Try adjusting your search keywords, clearing industry or geography filters,
            or broadening your scale criteria.
          </p>
          <div className="mt-4">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 transition shadow-xs cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset All Filters
            </button>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={offset + limit >= total || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      <EntityDetailModal
        item={selectedItem}
        mode={filters.mode}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
      />
    </div>
  );
}
