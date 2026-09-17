"use client";

import { useState } from "react";
import {
  Sparkles,
  Target,
  Search,
  Building2,
  Users,
  Compass,
  ArrowUpRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  ChevronRight,
  Zap,
  Filter,
  Briefcase,
  HelpCircle,
} from "lucide-react";
import {
  detectIcpAndMatchEventsAction,
  MatchedEventItem,
  IcpPreset,
} from "@/app/actions/detect-icp";
import { IcpDetectionResult } from "@/lib/ai/icpDetector";

interface DetectIcpViewProps {
  presets: IcpPreset[];
}

export function DetectIcpView({ presets }: DetectIcpViewProps) {
  const [companyName, setCompanyName] = useState("");
  const [offering, setOffering] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detection, setDetection] = useState<IcpDetectionResult | null>(null);
  const [allMatchedEvents, setAllMatchedEvents] = useState<MatchedEventItem[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // Apply quick preset
  const handleApplyPreset = (preset: IcpPreset) => {
    setCompanyName(preset.companyName);
    setOffering(preset.offering);
    setLookingFor(preset.lookingFor);
    setError(null);
  };

  // Submit analysis
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!offering || offering.trim().length < 10) {
      setError("Please describe your offering in more detail (at least 10 characters).");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedTagFilter("all");

    try {
      const res = await detectIcpAndMatchEventsAction({
        companyName,
        offering,
        lookingFor,
      });

      if (res.success && res.detection) {
        setDetection(res.detection);
        setAllMatchedEvents(res.matchedEvents);
        setTotalAnalyzed(res.totalEventsAnalyzed);
        setHasSearched(true);
      } else {
        setError(res.message || "Failed to analyze ICP. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred during ICP detection.");
    } finally {
      setLoading(false);
    }
  };

  // Filter matched events by clicked industry tag pill
  const visibleEvents = allMatchedEvents.filter((item) => {
    if (selectedTagFilter === "all") return true;
    const filterLower = selectedTagFilter.toLowerCase().trim();
    return item.matchingTags.some(
      (tag) =>
        tag.toLowerCase().includes(filterLower) || filterLower.includes(tag.toLowerCase())
    );
  });

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 md:p-8 shadow-xs backdrop-blur-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-medium">
            <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>AI ICP Detection & Event Matching Engine</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Discover What Events Are Useful For Your Company
          </h1>

          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Tell us about your company, product, or solution. Our AI analyzes your value
            proposition, derives the relevant industry tags & target personas, and compares them
            against commercial trigger signals in your database to surface prime outreach opportunities.
          </p>
        </div>

        {/* 1-Click Demo Presets */}
        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Quick Test Presets (Click to autofill):
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="text-left px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-zinc-50 dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition group"
              >
                <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-between">
                  <span>{preset.title}</span>
                  <ChevronRight className="h-3 w-3 text-zinc-400 group-hover:translate-x-0.5 transition" />
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                  {preset.category}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-xs backdrop-blur-xs space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Company Name */}
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-zinc-500" />
              Your Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. VoltSun Solutions"
              className="w-full px-3.5 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>

          {/* Core Offering */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              What is your offering / product / service? <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={offering}
              onChange={(e) => setOffering(e.target.value)}
              placeholder="e.g. We provide commercial solar energy management, battery storage monitoring, and EV fleet transition financing software for enterprises..."
              className="w-full px-3.5 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Target Goals / Looking For */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-emerald-500" />
            What kind of companies or triggers are you looking for? (Optional)
          </label>
          <input
            type="text"
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value)}
            placeholder="e.g. Companies announcing energy transition programs, EV fleet deployments, or corporate sustainability initiatives"
            className="w-full px-3.5 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing Offering & Matching Signals...</span>
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                <span>Detect ICP & Match Events</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* AI Analysis Summary Bar */}
      {detection && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                AI ICP Classification Results
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                {detection.valueProposition || "Target Profile Definition"}
              </p>
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
              Scanned <span className="font-semibold text-zinc-800 dark:text-zinc-200">{totalAnalyzed}</span> database events
            </div>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {detection.analysisSummary}
          </p>

          {/* Industry Tags Filter Chips */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                <Filter className="h-3 w-3 text-zinc-500" />
                Detected Industry Tags (Click to filter events):
              </span>
              {selectedTagFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter("all")}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedTagFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedTagFilter === "all"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                All Matched Events ({allMatchedEvents.length})
              </button>

              {detection.industryTags.map((tag, idx) => {
                const count = allMatchedEvents.filter((e) =>
                  e.matchingTags.some(
                    (t) =>
                      t.toLowerCase().includes(tag.toLowerCase()) ||
                      tag.toLowerCase().includes(t.toLowerCase())
                  )
                ).length;

                const isSelected = selectedTagFilter.toLowerCase() === tag.toLowerCase();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedTagFilter(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <span>{tag}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-blue-700 text-blue-100"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Personas */}
          {detection.targetPersonas && detection.targetPersonas.length > 0 && (
            <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                <Users className="h-3 w-3 text-zinc-500" />
                Target Personas:
              </span>
              {detection.targetPersonas.map((persona, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {persona}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Matched Events Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Matched Commercial Trigger Events
            </h2>
            {hasSearched && (
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {visibleEvents.length} found
              </span>
            )}
          </div>
          {selectedTagFilter !== "all" && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Filtered by: <strong className="text-zinc-800 dark:text-zinc-200">{selectedTagFilter}</strong>
            </span>
          )}
        </div>

        {hasSearched && visibleEvents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mx-auto text-zinc-400">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              No matching events found for this filter
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Try clicking &quot;All Matched Events&quot; or updating your offering description to include broader terms.
            </p>
          </div>
        )}

        {!hasSearched && (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center mx-auto text-blue-500">
              <Compass className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Ready to Detect Opportunities
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Pick a quick demo preset above or describe your offering to see which active B2B events and buying signals match your solution.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visibleEvents.map((item) => (
            <div
              key={item.eventId}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition group"
            >
              <div className="space-y-3.5">
                {/* Top Header: Company + Match Score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.company.logoUrl ? (
                      <img
                        src={item.company.logoUrl}
                        alt={item.company.name}
                        className="h-9 w-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 shrink-0">
                        <Building2 className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                        <span>{item.company.name}</span>
                        {item.company.profileUrl && (
                          <a
                            href={item.company.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-blue-500 transition"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                        {item.company.industry || "Enterprise"} • {item.company.employeeCount ? `${item.company.employeeCount} employees` : "Verified"}
                      </div>
                    </div>
                  </div>

                  {/* Relevance Badge */}
                  <div
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      item.relevanceScore >= 80
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                        : "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {item.relevanceScore}% Fit
                  </div>
                </div>

                {/* Event Headline */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-300 font-semibold">
                      {item.event.eventType.replace(/_/g, " ")}
                    </span>
                    {item.matchingTags.map((mt, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      >
                        {mt}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                    {item.event.headline}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                    {item.event.summary}
                  </p>
                </div>

                {/* Why this event is useful for user */}
                <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 p-3 space-y-1">
                  <div className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Why It&apos;s Useful For Your Offering
                  </div>
                  <p className="text-xs text-amber-950 dark:text-amber-200/90 leading-relaxed font-medium">
                    {item.whyItIsUseful}
                  </p>
                </div>

                {/* Who to Contact Section */}
                {item.contact && (
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 p-3 space-y-1.5">
                    <div className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Who To Contact
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.contact.role &&
                        item.contact.role.slice(0, 3).map((r, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-medium text-zinc-800 dark:text-zinc-200"
                          >
                            {r}
                          </span>
                        ))}
                    </div>
                    {item.contact.connectMethod && (
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 pt-0.5">
                        Approach via: <strong className="text-zinc-700 dark:text-zinc-300">{item.contact.connectMethod}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">
                  {item.event.postDate
                    ? `Posted: ${new Date(item.event.postDate).toLocaleDateString()}`
                    : "Recent trigger"}
                </span>

                {item.event.postUrl && (
                  <a
                    href={item.event.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
                  >
                    <span>View LinkedIn Post</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
