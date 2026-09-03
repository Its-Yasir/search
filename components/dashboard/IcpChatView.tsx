"use client";

import { useState, useRef, useEffect } from "react";
import type { Icp, SpecificIcp, Query } from "@/db/schema";
import {
  Search,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Send,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Users,
  CheckCircle2,
  ChevronRight,
  Hash,
  Minus,
  Plus,
  Layers,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import {
  getSpecificIcpsForIcpAction,
  getQueriesForSpecificIcpsAction,
} from "@/app/actions/icp";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface IcpChatViewProps {
  initialIcp: Icp | null;
  onIcpUpdated: (icp: Icp) => void;
  onNewIcpSession: () => void;
  onDeleteIcp?: (icpId: string) => Promise<void> | void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTED_QUERIES = [
  "B2B SaaS startups hiring remote React & AI engineers",
  "Dental practices in California seeking automated booking CRM",
  "Fintech companies with $5M-$20M ARR needing compliance tooling",
  "SMBs trying to sell/attract/identify startups for their offering",
];

type GenerationStep =
  | "idle"
  | "building-icp"
  | "building-specific"
  | "building-queries"
  | "done";

const STEPS: { key: GenerationStep; label: string }[] = [
  { key: "building-icp", label: "General ICP" },
  { key: "building-specific", label: "Specific ICPs" },
  { key: "building-queries", label: "Queries" },
];

// Hardcoded Tailwind-safe accent classes (no dynamic assembly)
const CARD_ACCENTS = [
  "border-l-violet-400",
  "border-l-sky-400",
  "border-l-emerald-400",
  "border-l-amber-400",
  "border-l-rose-400",
  "border-l-indigo-400",
  "border-l-teal-400",
  "border-l-orange-400",
  "border-l-cyan-400",
  "border-l-pink-400",
] as const;

const PLATFORM_META: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  linkedin: {
    label: "LinkedIn",
    dot: "bg-sky-500",
    badge:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800/50",
  },
  x: {
    label: "X / Twitter",
    dot: "bg-zinc-900",
    badge:
      "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600",
  },
  reddit: {
    label: "Reddit",
    dot: "bg-orange-500",
    badge:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800/50",
  },
  hackernews: {
    label: "Hacker News",
    dot: "bg-amber-500",
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50",
  },
  github: {
    label: "GitHub",
    dot: "bg-violet-500",
    badge:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/50",
  },
  jobs: {
    label: "Jobs",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50",
  },
  youtube: {
    label: "YouTube",
    dot: "bg-red-500",
    badge:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/50",
  },
  trustpilot: {
    label: "Trustpilot",
    dot: "bg-green-500",
    badge:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepPipeline({
  currentStep,
  done,
  size = "sm",
}: {
  currentStep: GenerationStep;
  done: boolean;
  size?: "sm" | "md";
}) {
  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STEPS.map((step, i) => {
        const isComplete = done || i < stepIndex;
        const isActive = step.key === currentStep;
        const iconSize = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
        const textSize = size === "md" ? "text-sm" : "text-[11px]";

        return (
          <div key={step.key} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              {isComplete ? (
                <CheckCircle2
                  className={`${iconSize} text-emerald-500 shrink-0`}
                />
              ) : isActive ? (
                <Loader2
                  className={`${iconSize} animate-spin text-violet-500 shrink-0`}
                />
              ) : (
                <div
                  className={`${iconSize} rounded-full border-2 border-zinc-300 dark:border-zinc-600 shrink-0`}
                />
              )}
              <span
                className={`${textSize} font-medium whitespace-nowrap ${
                  isComplete
                    ? "text-zinc-400 dark:text-zinc-500"
                    : isActive
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-zinc-400 dark:text-zinc-600"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 text-zinc-300 dark:text-zinc-600 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function KeywordPill({
  text,
  type,
}: {
  text: string;
  type: "must" | "optional" | "negative";
}) {
  if (type === "must") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
        <Plus className="h-2.5 w-2.5 shrink-0" />
        {text}
      </span>
    );
  }
  if (type === "optional") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
        <Hash className="h-2.5 w-2.5 shrink-0" />
        {text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50 line-through opacity-80">
      <Minus className="h-2.5 w-2.5 shrink-0" />
      {text}
    </span>
  );
}

function QueryCard({ query }: { query: Query }) {
  const [copied, setCopied] = useState(false);
  const meta = PLATFORM_META[query.platform] ?? {
    label: query.platform,
    dot: "bg-zinc-400",
    badge: "bg-zinc-50 text-zinc-600 border-zinc-200",
  };

  const handleCopy = async () => {
    if (!query.query) return;
    try {
      await navigator.clipboard.writeText(query.query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed
    }
  };

  return (
    <div className={`rounded-lg border p-3 space-y-2.5 ${meta.badge}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} shrink-0`} />
          <span className="text-[11px] font-semibold">{meta.label}</span>
        </div>
        <span className="font-mono text-[9px] opacity-60">
          ★ {(query.rating / 100).toFixed(2)}
        </span>
      </div>

      {query.query && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-700/80 px-2.5 py-1.5 text-xs font-mono text-zinc-800 dark:text-zinc-200 group">
          <span className="wrap-break-word select-all flex-1 text-[11px] leading-snug">
            {query.query}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy exact query"}
            className="shrink-0 p-1 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {query.must.map((kw, i) => (
          <KeywordPill key={i} text={kw} type="must" />
        ))}
        {query.optional.map((kw, i) => (
          <KeywordPill key={i} text={kw} type="optional" />
        ))}
        {query.negativeKeywords.map((kw, i) => (
          <KeywordPill key={i} text={kw} type="negative" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IcpChatView({
  initialIcp,
  onIcpUpdated,
  onNewIcpSession,
  onDeleteIcp,
}: IcpChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(!!initialIcp);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  const [turnCount, setTurnCount] = useState(initialIcp ? 1 : 0);
  const [currentIcp, setCurrentIcp] = useState<Icp | null>(initialIcp);
  const [specificIcps, setSpecificIcps] = useState<SpecificIcp[]>([]);
  const [allQueries, setAllQueries] = useState<Query[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedIcpId, setExpandedIcpId] = useState<string | null>(null);
  const [queryProgress, setQueryProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingIcp, setIsDeletingIcp] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load existing specific ICPs + queries when selecting a saved ICP
  useEffect(() => {
    if (!initialIcp) return;

    let cancelled = false;

    (async () => {
      try {
        const fetchedSpecific = await getSpecificIcpsForIcpAction(
          initialIcp.id,
        );
        if (cancelled) return;
        setSpecificIcps(fetchedSpecific);

        if (fetchedSpecific.length > 0) {
          setExpandedIcpId(fetchedSpecific[0].id);

          const fetchedQueries = await getQueriesForSpecificIcpsAction(
            fetchedSpecific.map((s) => s.id),
          );
          if (cancelled) return;
          setAllQueries(fetchedQueries);
        }

        // Mark pipeline as completed
        setGenerationStep("done");
      } catch (err) {
        console.error("Error loading ICP data:", err);
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialIcp]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Pipeline ───────────────────────────────────────────────────────────────
  const handleSubmit = async (overridePrompt?: string) => {
    const promptToSend = (overridePrompt || input).trim();
    if (!promptToSend || isLoading) return;
    if (turnCount >= 5) {
      setError(
        "Maximum revisions reached (5/5 turns). Please start a new ICP.",
      );
      return;
    }

    setError(null);
    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: promptToSend,
      createdAt: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);
    setGenerationStep("building-icp");

    try {
      // Step 1 — General ICP
      const icpRes = await fetch("/api/chat/icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentIcpId: currentIcp?.id,
          turnCount,
        }),
      });
      const icpData = await icpRes.json();
      if (!icpRes.ok) throw new Error(icpData.error || "Failed to build ICP");

      const newIcp: Icp | null = icpData.icp ?? null;
      if (newIcp) {
        setCurrentIcp(newIcp);
        onIcpUpdated(newIcp);
      }
      if (icpData.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: icpData.message,
            createdAt: new Date(),
          },
        ]);
      }
      setTurnCount(icpData.turnCount ?? turnCount + 1);

      // Steps 2 & 3 only on first turn
      if (turnCount === 0 && newIcp) {
        // Step 2 — Specific ICPs
        setGenerationStep("building-specific");
        const specRes = await fetch("/api/chat/icp/specific", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icpId: newIcp.id }),
        });
        const specData = await specRes.json();
        if (!specRes.ok)
          throw new Error(specData.error || "Failed to generate specific ICPs");

        const newSpecific: SpecificIcp[] = specData.specificIcps ?? [];
        setSpecificIcps(newSpecific);
        if (newSpecific.length > 0) setExpandedIcpId(newSpecific[0].id);

        // Step 3 — Queries (Generated one by one per Specific ICP)
        if (newSpecific.length > 0) {
          setGenerationStep("building-queries");
          for (let i = 0; i < newSpecific.length; i++) {
            const sIcp = newSpecific[i];
            setQueryProgress({ current: i + 1, total: newSpecific.length });
            try {
              const qRes = await fetch("/api/chat/icp/queries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ specificIcpId: sIcp.id }),
              });
              const qData = await qRes.json();
              if (qRes.ok && qData.queries?.length) {
                setAllQueries((prev) => [...prev, ...qData.queries]);
              }
            } catch (queryErr) {
              console.error(
                `Error generating queries for ICP ${sIcp.id}:`,
                queryErr,
              );
            }
          }
        }
      }

      setGenerationStep("done");
    } catch (err: unknown) {
      console.error("Pipeline error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
      setGenerationStep("idle");
    } finally {
      setQueryProgress(null);
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
    setTurnCount(0);
    setCurrentIcp(null);
    setSpecificIcps([]);
    setAllQueries([]);
    setError(null);
    setGenerationStep("idle");
    setExpandedIcpId(null);
    setQueryProgress(null);
    onNewIcpSession();
  };

  // Show the initial landing ONLY before the user sends anything
  const showLanding =
    messages.length === 0 &&
    !currentIcp &&
    specificIcps.length === 0 &&
    !isLoading &&
    !isLoadingData;
  const isTurnLimitReached = turnCount >= 5;
  const isDone = generationStep === "done";

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            ICP Studio
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
            <Sparkles className="h-2.5 w-2.5 text-amber-500" />
            gpt-5.6-luna
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Step pipeline in header (non-landing state) */}
          {!showLanding && generationStep !== "idle" && (
            <StepPipeline
              currentStep={generationStep}
              done={isDone}
              size="sm"
            />
          )}

          {/* Turn dots */}
          {!showLanding && (
            <div className="hidden sm:flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-700 pl-3 ml-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  title={`Turn ${n}/5`}
                  className={`h-2 rounded-full transition-all ${
                    n <= turnCount
                      ? isTurnLimitReached
                        ? "w-4 bg-emerald-500"
                        : "w-4 bg-zinc-800 dark:bg-zinc-200"
                      : "w-2 bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              ))}
              <span className="font-mono text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 ml-0.5">
                {turnCount}/5
              </span>
            </div>
          )}

          {!showLanding && (
            <div className="flex items-center gap-2">
              {currentIcp && onDeleteIcp && (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50/80 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60 transition-colors cursor-pointer shadow-xs"
                  title="Delete this ICP"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete ICP</span>
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                New Search
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ══ LANDING ══ */}
        {showLanding && (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center overflow-y-auto">
            <div className="mx-auto w-full max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-6">
                <ShieldCheck className="h-3.5 w-3.5" />
                AI Ideal Customer Profile Generator
              </div>

              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Define your Ideal Customer Profile
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Describe the leads you want to reach. AI will create a general
                ICP, 5–10 specific sub-profiles, and platform search queries —
                automatically.
              </p>

              <div className="mt-8">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                  className="relative flex items-center"
                >
                  <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g. SMBs trying to sell their offering to startups..."
                    disabled={isLoading}
                    className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-10 pr-12 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-zinc-100 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <span className="text-[11px] text-zinc-400">Try asking:</span>
                {SUGGESTED_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(q)}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ ACTIVE SESSION ══ */}
        {!showLanding && (
          <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
            {/* ── Left panel: ICP tree ── */}
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              {/* Loading state when fetching an existing ICP or building the initial general ICP */}
              {(isLoadingData || (isLoading && !currentIcp)) && (
                <div className="flex min-h-full items-center justify-center py-24 px-6">
                  <div className="flex flex-col items-center gap-4 text-center">
                    {isLoadingData ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                          Loading ICP data...
                        </p>
                      </>
                    ) : (
                      <>
                        <StepPipeline
                          currentStep={generationStep}
                          done={false}
                          size="md"
                        />
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-xs">
                          Analysing your query and structuring a General ICP...
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Main content once General ICP exists */}
              {currentIcp && !isLoadingData && (
                <div className="p-5 space-y-4 max-w-3xl mx-auto pb-10">
                  {/* General ICP bar */}
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 px-4 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Layers className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          General ICP
                        </span>
                      </div>
                      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 leading-snug">
                        {currentIcp.title}
                      </h2>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                        &ldquo;{currentIcp.name}&rdquo;
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0 mt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {isLoading &&
                          generationStep === "building-specific" && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300 animate-pulse">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Deriving sub-personas...
                            </span>
                          )}
                        {specificIcps.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {specificIcps.length} specific ICPs
                          </span>
                        )}
                        {allQueries.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300">
                            <CheckCircle2 className="h-3 w-3" />
                            {allQueries.length} queries
                          </span>
                        )}
                        {isLoading && generationStep === "building-queries" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-violet-500 dark:text-violet-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {queryProgress
                              ? `Generating queries (${queryProgress.current}/${queryProgress.total})...`
                              : "Generating queries..."}
                          </span>
                        )}
                      </div>

                      {onDeleteIcp && (
                        <button
                          type="button"
                          onClick={() => setShowDeleteModal(true)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50/80 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60 transition-colors cursor-pointer mt-1"
                          title="Delete this ICP"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete ICP</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* In-flow progress indicator while deriving Specific ICPs */}
                  {isLoading && specificIcps.length === 0 && (
                    <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20 p-8 flex flex-col items-center justify-center text-center gap-3">
                      <StepPipeline
                        currentStep={generationStep}
                        done={false}
                        size="md"
                      />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                        {generationStep === "building-specific" &&
                          "Deriving 5–10 specific sub-personas from the General ICP..."}
                        {generationStep === "building-queries" &&
                          "Preparing platform queries..."}
                      </p>
                    </div>
                  )}

                  {/* Specific ICP accordion cards */}
                  {specificIcps.map((sIcp, i) => {
                    const icpQueries = allQueries.filter(
                      (q) => q.specificIcpId === sIcp.id,
                    );
                    const isExpanded = expandedIcpId === sIcp.id;
                    // Safe accent lookup — fallback to first
                    const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];

                    return (
                      <div
                        key={sIcp.id}
                        className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden border-l-4 ${accent}`}
                      >
                        {/* Accordion header */}
                        <button
                          onClick={() =>
                            setExpandedIcpId(isExpanded ? null : sIcp.id)
                          }
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-snug truncate">
                                {sIcp.name}
                              </p>
                              {!isExpanded && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                  {sIcp.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {icpQueries.length > 0 && (
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                {icpQueries.length}{" "}
                                {icpQueries.length === 1 ? "query" : "queries"}
                              </span>
                            )}
                            {isLoading &&
                              generationStep === "building-queries" &&
                              icpQueries.length === 0 && (
                                <Loader2 className="h-3 w-3 animate-spin text-violet-400 shrink-0" />
                              )}
                            <ChevronRight
                              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                            />
                          </div>
                        </button>

                        {/* Expanded body */}
                        {isExpanded && (
                          <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-4 space-y-4">
                            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                              {sIcp.description}
                            </p>

                            {sIcp.whatToSearch && (
                              <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Search className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                    What to Search on Social Platforms
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                  {sIcp.whatToSearch}
                                </p>
                              </div>
                            )}

                            {icpQueries.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <Users className="h-3 w-3 text-zinc-400 shrink-0" />
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                    Platform Search Queries
                                  </span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {icpQueries.map((q) => (
                                    <QueryCard key={q.id} query={q} />
                                  ))}
                                </div>
                              </div>
                            )}

                            {isLoading &&
                              generationStep === "building-queries" &&
                              icpQueries.length === 0 && (
                                <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                                  <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
                                  Generating queries for this ICP...
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Right panel: chat ── */}
            <div className="flex flex-col w-full lg:w-96 shrink-0 min-h-0 bg-zinc-50 dark:bg-zinc-900 border-t lg:border-t-0 border-zinc-200 dark:border-zinc-800">
              {/* Messages scroll area */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                <p className="text-center text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 pb-1">
                  AI Strategist &amp; Revision Log
                </p>

                {messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs ${
                          isUser
                            ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                            : "bg-white text-zinc-800 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {m.content}
                        </div>
                      </div>
                      <span className="mt-1 text-[9px] text-zinc-400 dark:text-zinc-500 px-1">
                        {isUser ? "You" : "AI"}
                      </span>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center gap-2 pl-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500 shrink-0" />
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {generationStep === "building-icp" &&
                        "Building General ICP..."}
                      {generationStep === "building-specific" &&
                        "Generating Specific ICPs..."}
                      {generationStep === "building-queries" &&
                        "Generating queries (gpt-4o-mini)..."}
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input / limit footer */}
              <div className="shrink-0 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-3">
                {error && (
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {error}
                  </div>
                )}

                {isTurnLimitReached ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
                    <p className="text-xs font-medium text-amber-900 dark:text-amber-300">
                      Revision limit reached (5/5)
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                      Profiles are finalised. Start a new search?
                    </p>
                    <button
                      onClick={handleReset}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3 text-amber-400" />
                      Start New ICP
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmit();
                    }}
                    className="relative flex items-center"
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        isLoadingData
                          ? "Loading..."
                          : isDone
                            ? `Refine your ICPs (turn ${turnCount + 1}/5)...`
                            : isLoading
                              ? "Generating..."
                              : `Refine your ICPs (turn ${turnCount + 1}/5)...`
                      }
                      disabled={isLoading || isLoadingData}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-3 pr-10 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:bg-zinc-900 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal &&
        currentIcp &&
        (() => {
          const icpToDelete = currentIcp;
          if (!icpToDelete) return null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 animate-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Delete Ideal Customer Profile?
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    &ldquo;{icpToDelete.title}&rdquo;
                  </span>
                  ? This will permanently delete this ICP, all{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {specificIcps.length} specific ICPs
                  </span>
                  , and all{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {allQueries.length} platform search queries
                  </span>
                  .
                </p>

                <div className="mt-6 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeletingIcp}
                    className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!onDeleteIcp || !icpToDelete) return;
                      setIsDeletingIcp(true);
                      try {
                        await onDeleteIcp(icpToDelete.id);
                        setShowDeleteModal(false);
                      } catch (err) {
                        console.error("Failed to delete ICP:", err);
                      } finally {
                        setIsDeletingIcp(false);
                      }
                    }}
                    disabled={isDeletingIcp}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isDeletingIcp ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete ICP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
