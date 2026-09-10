"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Square,
  RefreshCw,
  Clock,
  Sparkles,
  Building2,
  FileText,
  TrendingUp,
  ExternalLink,
  Target,
  CheckCircle2,
  Lightbulb,
  Terminal,
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";
import { CompanyEvent } from "@/db/schema";

interface PipelineLogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "event";
  message: string;
}

interface PipelineStatusData {
  status: "idle" | "running" | "stopping" | "completed";
  startedAt: string | null;
  totalCompanies: number;
  companiesProcessed: number;
  postsRead: number;
  eventsFound: number;
  currentCompany: {
    url?: string;
    identifier?: string;
    name?: string;
    stage?: string;
  } | null;
  countdown: {
    active: boolean;
    remainingSeconds: number;
    reason: string;
  } | null;
  logs: PipelineLogEntry[];
  recentEvents: CompanyEvent[];
  overview?: {
    totalUrls: number;
    pendingUrls: number;
    completedUrls: number;
    totalEvents: number;
    totalPosts?: number;
  };
}

export function AnalyzePipelineView() {
  const [data, setData] = useState<PipelineStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [timeframeFilter, setTimeframeFilter] = useState<"1m" | "2m" | "all">("all");
  const [showLogs, setShowLogs] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/status");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to poll pipeline status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/pipeline/status");
        const json = await res.json();
        if (active && json.success && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to poll pipeline status:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/pipeline/start", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || json.message || "Failed to start pipeline");
      }
      await fetchStatus();
    } catch (err) {
      alert("Error starting pipeline: " + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/pipeline/stop", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || json.message || "Failed to stop pipeline");
      }
      await fetchStatus();
    } catch (err) {
      alert("Error stopping pipeline: " + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const isRunning = data?.status === "running";
  const isStopping = data?.status === "stopping";

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder < 10 ? "0" : ""}${remainder}s`;
  };

  const formatPostDateTime = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return null;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return (
      d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }) +
      " • " +
      d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const formatDetectedTime = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return "N/A";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "N/A";
    return (
      d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }) +
      " • " +
      d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const filteredEvents = (data?.recentEvents || []).filter((event) => {
    // 1. Event Type Category Filter
    if (activeFilter !== "all" && event.eventType !== activeFilter) {
      return false;
    }

    // 2. Timeframe Filter (Active for UI filtering when pipeline is not running)
    if (!isRunning && timeframeFilter !== "all") {
      const eventDateVal = event.postDate || event.createdAt;
      const eventTime = new Date(eventDateVal).getTime();
      if (!isNaN(eventTime)) {
        const now = Date.now();
        const diffDays = (now - eventTime) / (1000 * 60 * 60 * 24);
        if (timeframeFilter === "1m" && diffDays > 30) {
          return false;
        }
        if (timeframeFilter === "2m" && diffDays > 60) {
          return false;
        }
      }
    }

    return true;
  });

  const getEventTypeBadge = (type: string) => {
    switch (type) {
      case "funding_given":
        return {
          label: "FUNDING GIVEN",
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        };
      case "funding_received":
        return {
          label: "FUNDING RAISED",
          bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        };
      case "investment_mandate":
        return {
          label: "INVESTMENT MANDATE",
          bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        };
      case "accelerator_rfp":
        return {
          label: "ACCELERATOR / RFP",
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "partnership":
        return {
          label: "PARTNERSHIP",
          bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
        };
      case "expansion_hiring":
        return {
          label: "EXPANSION / HIRING",
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        };
      case "product_launch":
        return {
          label: "PRODUCT LAUNCH",
          bg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
        };
      default:
        return {
          label: "MARKET SIGNAL",
          bg: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
        };
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Controls Header */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Pipeline Controller
              </h2>
              {/* Status Badge */}
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Running
                </span>
              )}
              {isStopping && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Stopping...
                </span>
              )}
              {data?.status === "idle" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  Idle
                </span>
              )}
              {data?.status === "completed" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Pacing: 2–3 minutes between company fetches (human delay), seconds for OpenAI post analysis. Bounded to last 2 months.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={actionLoading || isStopping}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs text-white bg-emerald-600 hover:bg-emerald-500 active:scale-98 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Start Pipeline
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={actionLoading || isStopping}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs text-white bg-rose-600 hover:bg-rose-500 active:scale-98 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop Pipeline
              </button>
            )}

            <button
              onClick={fetchStatus}
              className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition active:scale-95"
              title="Refresh status"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Live Human Delay Countdown Banner */}
        {data?.countdown?.active && (
          <div className="mt-6 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-500/5 dark:bg-amber-950/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Clock className="h-4 w-4 animate-spin" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Human-like Jitter Interval in Progress
                  </div>
                  <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                    {data.countdown.reason || "Simulating organic browsing interval"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
                  {formatCountdown(data.countdown.remainingSeconds)}
                </span>
                <div className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
                  remaining
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Working Target Card */}
        {data?.currentCompany && isRunning && (
          <div className="mt-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 px-4 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 text-zinc-500" />
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {data.currentCompany.name || data.currentCompany.identifier}
              </span>
              <span className="text-zinc-400">·</span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {data.currentCompany.stage || "Processing"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Task
            </div>
          </div>
        )}
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Companies Processed */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              Companies Processed
            </span>
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {isRunning
                ? `${data?.companiesProcessed || 0} / ${data?.totalCompanies || 0}`
                : `${data?.overview?.completedUrls || 0} / ${data?.overview?.totalUrls || 0}`}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {data?.overview?.pendingUrls || 0} pending in queue
          </p>
        </div>

        {/* Posts Read */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              Posts Read (Last 2 Mo)
            </span>
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {isRunning
                ? data?.postsRead || 0
                : data?.overview?.totalPosts || data?.postsRead || 0}
            </span>
            <span className="text-xs text-zinc-400">posts</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {isRunning ? "Live batch progress (60-day filter)" : "Filtered with 60-day reverse-stop"}
          </p>
        </div>

        {/* B2B Events & Leads Found */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              B2B Lead Events Found
            </span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {isRunning
                ? data?.eventsFound || 0
                : data?.overview?.totalEvents || data?.recentEvents?.length || 0}
            </span>
            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
              signals
            </span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-700/70 dark:text-emerald-300/60">
            Identified by OpenAI in real-time
          </p>
        </div>

        {/* Overall Progress / Conversion Rate */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              Conversion Rate
            </span>
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {(() => {
                const posts = isRunning
                  ? data?.postsRead || 0
                  : data?.overview?.totalPosts || data?.postsRead || 0;
                const events = isRunning
                  ? data?.eventsFound || 0
                  : data?.overview?.totalEvents || data?.recentEvents?.length || 0;
                return posts > 0 ? `${Math.round((events / posts) * 100)}%` : "0%";
              })()}
            </span>
            <span className="text-xs text-zinc-400">lead yield</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Actionable signals per post
          </p>
        </div>
      </div>

      {/* Main Content Area: Live Event Feed & Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Live B2B Lead Events Stream */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-500" />
                  Live B2B Lead Events Stream
                  <span className="text-xs font-normal text-zinc-400 font-mono">
                    ({filteredEvents.length})
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Signals extracted from company posts by AI in real-time.
                </p>
              </div>

              {/* Timeframe Filter Segmented Control (Active only when pipeline is idle) */}
              <div className="flex items-center self-start sm:self-auto">
                <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="px-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Window:
                  </div>
                  {[
                    { id: "1m", label: "Last 1 Month" },
                    { id: "2m", label: "Last 2 Months" },
                    { id: "all", label: "All Time" },
                  ].map((tf) => (
                    <button
                      key={tf.id}
                      disabled={isRunning}
                      onClick={() => setTimeframeFilter(tf.id as "1m" | "2m" | "all")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                        timeframeFilter === tf.id
                          ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                      title={
                        isRunning
                          ? "Timeframe filter is locked to live session while pipeline is running"
                          : ""
                      }
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Event Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
              <span className="text-[11px] text-zinc-400 mr-1">Category:</span>
              {[
                { id: "all", label: "All Categories" },
                { id: "funding_given", label: "Funding Given" },
                { id: "funding_received", label: "Funding Raised" },
                { id: "investment_mandate", label: "Mandates" },
                { id: "accelerator_rfp", label: "RFP / Accelerators" },
                { id: "partnership", label: "Partnerships" },
                { id: "expansion_hiring", label: "Expansion / Hiring" },
                { id: "product_launch", label: "Product Launch" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setActiveFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    activeFilter === pill.id
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Events List */}
          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center bg-zinc-50/50 dark:bg-zinc-900/20">
              <Sparkles className="h-8 w-8 mx-auto text-zinc-400 mb-3" />
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                No events match this filter
              </h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                {isRunning
                  ? "OpenAI is actively reading posts. As soon as an event is detected, it will appear here."
                  : "Try selecting a broader timeframe or category filter, or click 'Start Pipeline' above to analyze pending companies."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((event) => {
                const badge = getEventTypeBadge(event.eventType);
                const targets = (event.targetEntities as { name: string; role: string }[]) || [];
                const postPublishedStr = formatPostDateTime(event.postDate);
                const detectedStr = formatDetectedTime(event.createdAt);

                return (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition space-y-3"
                  >
                    {/* Event Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border tracking-wider ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                          {event.industrySector && (
                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                              {event.industrySector}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {event.headline}
                        </h4>
                      </div>
                    </div>

                    {/* Published Date & Detected Timestamp Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {postPublishedStr && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-medium bg-blue-50/80 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                          <Calendar className="h-3 w-3 text-blue-500 shrink-0" />
                          <span>
                            Post Published: <strong className="font-semibold">{postPublishedStr}</strong>
                          </span>
                        </div>
                      )}

                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700">
                        <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                        <span>Signal Detected: {detectedStr}</span>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {event.summary}
                    </p>

                    {/* Target Entities Mentioned */}
                    {targets.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-medium text-zinc-500">
                          Entities:
                        </span>
                        {targets.map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            <Building2 className="h-3 w-3 text-zinc-400" />
                            {t.name}
                            <span className="text-zinc-400 text-[9px]">({t.role})</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Lead Opportunity Pitch Box */}
                    {event.leadOpportunity && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                        <Lightbulb className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                        <div>
                          <span className="font-semibold block mb-0.5 text-emerald-900 dark:text-emerald-200">
                            Actionable Lead Opportunity:
                          </span>
                          <span className="text-[11px] leading-relaxed">
                            {event.leadOpportunity}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Post Link */}
                    {event.postUrl && (
                      <div className="pt-1 flex items-center justify-between text-xs text-zinc-400">
                        <a
                          href={event.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition font-medium"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View original post on LinkedIn
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Column: Live Activity Console Log */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-zinc-500" />
              Live Terminal Log
            </h3>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
            >
              {showLogs ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>

          {showLogs && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 p-4 font-mono text-[11px] h-[580px] flex flex-col shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 mb-2 text-zinc-400 text-[10px]">
                <span>STREAM LOGS</span>
                <span>{data?.logs?.length || 0} entries</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {(!data?.logs || data.logs.length === 0) && (
                  <div className="text-zinc-600 italic py-4 text-center">
                    Awaiting pipeline activity...
                  </div>
                )}
                {data?.logs?.map((log) => {
                  let color = "text-zinc-300";
                  if (log.type === "event") color = "text-emerald-400 font-semibold";
                  else if (log.type === "success") color = "text-teal-300";
                  else if (log.type === "warning") color = "text-amber-400";
                  else if (log.type === "error") color = "text-rose-400";

                  return (
                    <div key={log.id} className="leading-tight">
                      <span className="text-zinc-600 mr-2">[{log.timestamp}]</span>
                      <span className={color}>{log.message}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
