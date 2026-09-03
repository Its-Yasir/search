"use client";

import { useState, useEffect } from "react";
import type { Icp, SpecificIcp } from "@/db/schema";
import {
  PlatformSearchResult,
  PlatformType,
  UnifiedPost,
} from "@/lib/search/types";
import { SearchDropdowns, SearchFilterState } from "./SearchDropdowns";
import { PostCard } from "./PostCard";
import { getSpecificIcpsForIcpAction } from "@/app/actions/icp";
import {
  AlertCircle,
  Inbox,
  Sparkles,
  RefreshCw,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";


interface SearchPageViewProps {
  initialIcps: Icp[];
  user?: {
    userId: string;
    name: string;
    email: string;
  };
}

const DEFAULT_PLATFORMS: PlatformType[] = [
  "linkedin",
  "x",
  "reddit",
  "github",
  "hackernews",
];

export function SearchPageView({ initialIcps }: SearchPageViewProps) {
  const [icps] = useState<Icp[]>(initialIcps);
  const [specificIcps, setSpecificIcps] = useState<SpecificIcp[]>([]);
  const [loadingSpecific, setLoadingSpecific] = useState(false);

  // Filter State
  const [filterState, setFilterState] = useState<SearchFilterState>({
    selectedIcpId: initialIcps.length > 0 ? initialIcps[0].id : "",
    selectedSpecificIcpIds: [],
    selectedPlatforms: DEFAULT_PLATFORMS,
    dateRange: "past 7 days",
  });

  // Search Results State
  const [isSearching, setIsSearching] = useState(false);
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [platformResults, setPlatformResults] = useState<
    Record<string, PlatformSearchResult>
  >({});
  const [rankingStats, setRankingStats] = useState<{
    totalProcessed: number;
    totalAccepted: number;
    totalLeads?: number;
    acceptanceRate: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | PlatformType>("all");
  const [leadFilter, setLeadFilter] = useState<"all" | "leads_only" | "rejected_only">("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);



  // Load specific ICPs when selected ICP changes
  useEffect(() => {
    let isMounted = true;
    if (!filterState.selectedIcpId) return;

    const loadSpecific = async () => {
      setLoadingSpecific(true);
      try {
        const data = await getSpecificIcpsForIcpAction(filterState.selectedIcpId);
        if (isMounted) {
          setSpecificIcps(data);
          // Auto-select all specific ICPs
          setFilterState((prev) => ({
            ...prev,
            selectedSpecificIcpIds: data.map((s) => s.id),
          }));
        }
      } catch (err) {
        console.error("Error loading specific ICPs:", err);
      } finally {
        if (isMounted) setLoadingSpecific(false);
      }
    };

    loadSpecific();

    return () => {
      isMounted = false;
    };
  }, [filterState.selectedIcpId]);

  const handleFilterChange = (updates: Partial<SearchFilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  // Execute Search
  const handleExecuteSearch = async () => {
    if (!filterState.selectedIcpId) return;

    setIsSearching(true);
    setErrorMessage(null);
    setHasSearched(true);

    try {
      const response = await fetch("/api/search/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icpId: filterState.selectedIcpId,
          specificIcpIds: filterState.selectedSpecificIcpIds,
          platforms: filterState.selectedPlatforms,
          dateRange: filterState.dateRange,
          limitPerPlatform: 6,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Search orchestration failed");
      }

      setPosts(data.posts || []);
      setPlatformResults(data.platformResults || {});
      if (data.totalProcessed !== undefined) {
        setRankingStats({
          totalProcessed: data.totalProcessed,
          totalAccepted: data.totalAccepted ?? data.posts?.length ?? 0,
          totalLeads:
            data.totalLeads ??
            data.posts?.filter((p: UnifiedPost) => p.aiEvaluation?.isLead)
              ?.length ??
            0,
          acceptanceRate:
            data.acceptanceRate ??
            (data.totalProcessed > 0
              ? Math.round(
                  ((data.totalAccepted ?? data.posts?.length ?? 0) /
                    data.totalProcessed) *
                    100
                )
              : 0),
        });
      }
      setActiveTab("all");
      setLeadFilter("all");

    } catch (err: unknown) {
      console.error("Search error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while searching."
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Filter posts by active channel tab
  const channelFilteredPosts =
    activeTab === "all"
      ? posts
      : posts.filter((p) => p.platform === activeTab);

  // Filter posts by lead qualification status
  const displayedPosts = channelFilteredPosts.filter((p) => {
    if (leadFilter === "leads_only") {
      return p.aiEvaluation?.isLead === true;
    }
    if (leadFilter === "rejected_only") {
      return p.aiEvaluation?.isLead === false;
    }
    return true;
  });

  // Platform count tabs
  const tabCounts: Record<string, number> = {
    all: posts.length,
    linkedin: posts.filter((p) => p.platform === "linkedin").length,
    x: posts.filter((p) => p.platform === "x").length,
    reddit: posts.filter((p) => p.platform === "reddit").length,
    github: posts.filter((p) => p.platform === "github").length,
    hackernews: posts.filter((p) => p.platform === "hackernews").length,
  };


  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-4 sm:p-6 lg:p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/70 pb-5 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 font-mono text-sm font-bold shadow-xs">
                α
              </span>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
                Social &amp; Web Search
              </h1>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Query live posts, discussions, and developer activity across LinkedIn, Twitter/X, Reddit, GitHub, and Hacker News based on your target ICPs.
            </p>
          </div>

          {hasSearched && posts.length > 0 && (
            <button
              type="button"
              onClick={handleExecuteSearch}
              disabled={isSearching}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSearching ? "animate-spin" : ""}`} />
              <span>Refresh Results</span>
            </button>
          )}
        </div>

        {/* Dropdown Filters Toolbar */}
        <SearchDropdowns
          icps={icps}
          specificIcps={specificIcps}
          loadingSpecific={loadingSpecific}
          filterState={filterState}
          onFilterChange={handleFilterChange}
          onSearch={handleExecuteSearch}
          isSearching={isSearching}
        />

        {/* Error Banner */}
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="font-semibold">Search encountered an issue</p>
              <p className="mt-0.5 opacity-90">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Platform Results Bar & Tabs (Visible after search or when results exist) */}
        {hasSearched && (
          <div className="space-y-4">
            {/* Relevance Ranking & AI Filter Stats Banner */}
            {rankingStats && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/80 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      AI Lead Qualification
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-medium">
                      Processed: <strong className="font-bold text-zinc-900 dark:text-zinc-100">{rankingStats.totalProcessed}</strong>
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">→</span>
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 text-blue-800 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60 font-medium">
                      Ranked (&gt;40%): <strong className="font-bold text-blue-900 dark:text-blue-200">{rankingStats.totalAccepted}</strong>
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">→</span>
                    <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 font-medium">
                      AI Qualified Leads: <strong className="font-bold text-emerald-900 dark:text-emerald-200">{rankingStats.totalLeads ?? 0}</strong>
                    </span>
                    <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400 font-medium">
                      AI Rejected: <strong className="font-bold text-zinc-600 dark:text-zinc-400">{Math.max(0, rankingStats.totalAccepted - (rankingStats.totalLeads ?? 0))}</strong> (showing reasons)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">Ranking Pass Rate:</span>
                  <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-bold text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
                    {rankingStats.acceptanceRate}%
                  </span>
                </div>
              </div>
            )}


            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              {/* Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "all"
                      ? "bg-zinc-900 text-zinc-50 shadow-xs dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <span>All Channels</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeTab === "all"
                        ? "bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-800"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {tabCounts.all}
                  </span>
                </button>


                {(
                  [
                    { id: "linkedin", label: "LinkedIn" },
                    { id: "x", label: "X" },
                    { id: "reddit", label: "Reddit" },
                    { id: "github", label: "GitHub" },
                    { id: "hackernews", label: "Hacker News" },
                  ] as const
                ).map((tab) => {
                  const count = tabCounts[tab.id];
                  const res = platformResults[tab.id];
                  const isSelected = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-zinc-900 text-zinc-50 shadow-xs dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isSelected
                            ? "bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-800"
                            : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {count}
                      </span>
                      {res && !res.success && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-amber-500"
                          title={`Platform warning: ${res.error || "Rate limited"}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Total count & Diagnostics Toggle Button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Channel Diagnostics</span>
                  {showDiagnostics ? (
                    <ChevronUp className="h-3 w-3 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-zinc-400" />
                  )}
                </button>

                <div className="text-xs text-zinc-400 dark:text-zinc-500">
                  Found <span className="font-semibold text-zinc-700 dark:text-zinc-300">{displayedPosts.length}</span> posts
                </div>
              </div>
            </div>

            {/* Lead Qualification Filter Toggle Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-zinc-100/70 p-1.5 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLeadFilter("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    leadFilter === "all"
                      ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  All Ranked Posts ({channelFilteredPosts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeadFilter("leads_only")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    leadFilter === "leads_only"
                      ? "bg-emerald-600 text-white shadow-2xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  <span>
                    Qualified Leads Only ({channelFilteredPosts.filter((p) => p.aiEvaluation?.isLead).length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeadFilter("rejected_only")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    leadFilter === "rejected_only"
                      ? "bg-zinc-800 text-white shadow-2xs dark:bg-zinc-700 font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <span>
                    AI Rejected ({channelFilteredPosts.filter((p) => p.aiEvaluation && !p.aiEvaluation.isLead).length})
                  </span>
                </button>
              </div>

              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 px-2">
                {leadFilter === "leads_only" && "Showing only high-intent qualified leads"}
                {leadFilter === "rejected_only" && "Showing AI-rejected posts and their rejection rationale"}
                {leadFilter === "all" && "Showing all ranked posts (with AI rationale and rejection reasons)"}
              </div>
            </div>

            {/* Collapsible Diagnostics Panel */}
            {showDiagnostics && (
              <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Channel Execution Logs &amp; Live Query Inspection
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {Object.keys(platformResults).length} Channels Processed
                  </span>
                </div>

                <div className="space-y-2">
                  {Object.values(platformResults).map((res) => {
                    const isOk = res.status === "success";
                    const isEmpty = res.status === "empty";
                    const isErr = res.status === "error";

                    return (
                      <div
                        key={res.platform}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 text-xs dark:border-zinc-800/80 dark:bg-zinc-950/60"
                      >
                        <div className="flex items-start sm:items-center gap-2.5 truncate">
                          {isOk && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 sm:mt-0" />
                          )}
                          {isEmpty && (
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                          )}
                          {isErr && (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5 sm:mt-0" />
                          )}

                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-bold uppercase tracking-wider text-[11px] text-zinc-900 dark:text-zinc-100">
                                {res.platform}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                                  isOk
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : isEmpty
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                    : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                                }`}
                              >
                                {isOk
                                  ? `${res.total} ranked${res.leadsCount !== undefined ? ` • ${res.leadsCount} leads` : ""}${res.processedCount !== undefined ? ` (from ${res.processedCount} processed)` : ""}`
                                  : isEmpty
                                  ? `0 matches${res.processedCount !== undefined ? ` (${res.processedCount} processed)` : ""}`
                                  : "Failed / Error"}
                              </span>


                              {res.executionTimeMs !== undefined && (
                                <span className="text-[10px] text-zinc-400">
                                  {res.executionTimeMs}ms
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                              {res.queriesUsed && res.queriesUsed.length > 1 ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-zinc-400">
                                    {res.queriesUsed.length} queries executed:
                                  </span>
                                  {res.queriesUsed.map((q, qIdx) => (
                                    <code
                                      key={qIdx}
                                      className="rounded bg-zinc-200/60 dark:bg-zinc-800 px-1 py-0.5 text-zinc-800 dark:text-zinc-200 font-mono text-[10px]"
                                    >
                                      {q}
                                    </code>
                                  ))}
                                </div>
                              ) : (
                                <div className="truncate">
                                  <span className="text-zinc-400">Query used:</span>{" "}
                                  <code className="rounded bg-zinc-200/60 dark:bg-zinc-800 px-1 py-0.5 text-zinc-800 dark:text-zinc-200 font-mono text-[10px]">
                                    {res.queryUsed}
                                  </code>
                                </div>
                              )}
                              {isErr && (
                                <span className="mt-1 inline-block font-medium text-red-600 dark:text-red-400">
                                  — Error: {res.error}
                                </span>
                              )}
                              {isEmpty && (
                                <span className="mt-1 inline-block text-zinc-400 italic">
                                  — Completed successfully with 0 posts. Try broadening keywords or changing date filter.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {res.directApiUrl && (
                          <a
                            href={res.directApiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 shrink-0 transition-colors border border-zinc-200 dark:border-zinc-700"
                            title="Open raw platform API response in a new tab"
                          >
                            <span>Test Direct API</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Loading Indicator during search */}
            {isSearching && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div
                    key={idx}
                    className="h-48 rounded-xl border border-zinc-200/80 bg-white p-5 animate-pulse dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-3 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="space-y-1">
                        <div className="h-3 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-2.5 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-3 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results Grid */}
            {!isSearching && displayedPosts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedPosts.map((post) => (
                  <PostCard key={`${post.platform}-${post.id}`} post={post} />
                ))}
              </div>
            )}

            {/* Empty State after search */}
            {!isSearching && displayedPosts.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-16 px-4 text-center dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 mb-3">
                  <Inbox className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  No posts found for this selection
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                  Try broadening your date range (e.g. Past 30 Days or Past Year) or selecting additional specific ICPs or channels.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial Empty State before search */}
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 px-4 text-center dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/20">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 mb-4 shadow-xs">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Ready to find social and web signals
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">
              Select your ICP profile above, choose which target audiences and platforms you want to monitor, pick a date range, and click <span className="font-semibold text-zinc-700 dark:text-zinc-300">&ldquo;Search Posts&rdquo;</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
