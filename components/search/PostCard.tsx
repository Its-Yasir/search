"use client";

import { useState } from "react";
import { UnifiedPost, PlatformType } from "@/lib/search/types";
import {
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Repeat,
  Star,
  GitFork,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Target,
  Sparkles,
  X,
} from "lucide-react";


interface PostCardProps {
  post: UnifiedPost;
}


const PLATFORM_CONFIG: Record<
  PlatformType,
  {
    name: string;
    badgeClass: string;
    borderAccent: string;
    icon: string;
  }
> = {
  linkedin: {
    name: "LinkedIn",
    badgeClass:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60",
    borderAccent: "hover:border-blue-300 dark:hover:border-blue-800/80",
    icon: "in",
  },
  x: {
    name: "X (Twitter)",
    badgeClass:
      "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
    borderAccent: "hover:border-zinc-400 dark:hover:border-zinc-700",
    icon: "𝕏",
  },
  reddit: {
    name: "Reddit",
    badgeClass:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900/60",
    borderAccent: "hover:border-orange-300 dark:hover:border-orange-800/80",
    icon: "r/",
  },
  github: {
    name: "GitHub",
    badgeClass:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900/60",
    borderAccent: "hover:border-purple-300 dark:hover:border-purple-800/80",
    icon: "gh",
  },
  hackernews: {
    name: "Hacker News",
    badgeClass:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
    borderAccent: "hover:border-amber-300 dark:hover:border-amber-800/80",
    icon: "Y",
  },
};

export function PostCard({ post }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);

  const cfg = PLATFORM_CONFIG[post.platform] || {
    name: post.platform,
    badgeClass:
      "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200",
    borderAccent: "hover:border-zinc-300 dark:hover:border-zinc-700",
    icon: "•",
  };

  const formattedDate = post.createdAt
    ? formatDateString(post.createdAt)
    : undefined;

  const isLong = (post.text || "").length > 280;
  const displayText =
    !expanded && isLong ? `${post.text.slice(0, 280)}...` : post.text;

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-5 shadow-xs transition-all duration-200 dark:border-zinc-800/80 dark:bg-zinc-900/60 hover:shadow-md ${cfg.borderAccent}`}
    >
      <div>
        {/* Top Header: Platform Badge + Timestamp */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border shadow-2xs ${cfg.badgeClass}`}
            >
              <span className="font-bold opacity-80">{cfg.icon}</span>
              {cfg.name}
            </span>

            {post.specificIcpName && (
              <span className="hidden sm:inline-block truncate max-w-44 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-400">
                {post.specificIcpName}
              </span>
            )}

            {post.score !== undefined && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border shadow-2xs ${
                  Math.round(post.score * 100) >= 70
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70"
                    : Math.round(post.score * 100) >= 50
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70"
                }`}
                title={
                  post.scoreBreakdown
                    ? `Relevance Score: ${Math.round(post.score * 100)}%\n• Coverage: ${Math.round(post.scoreBreakdown.coverage * 100)}%\n• Informative Overlap: ${Math.round(post.scoreBreakdown.informativeOverlap * 100)}%\n• Precision: ${Math.round(post.scoreBreakdown.precision * 100)}%${post.scoreBreakdown.phraseBonus > 0 ? `\n• Phrase Bonus: +${Math.round(post.scoreBreakdown.phraseBonus * 100)}%` : ""}`
                    : `Score: ${Math.round(post.score * 100)}%`
                }
              >
                <Target className="h-2.5 w-2.5" />
                <span>{Math.round(post.score * 100)}%</span>
              </span>
            )}

            {post.aiEvaluation && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border shadow-2xs ${
                  post.aiEvaluation.isLead
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700"
                }`}
                title={`AI Lead Qualification: ${post.aiEvaluation.isLead ? "Qualified Lead" : "Not a Lead"}`}
              >
                {post.aiEvaluation.isLead ? (
                  <>
                    <Sparkles className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Lead</span>
                  </>
                ) : (
                  <>
                    <X className="h-2.5 w-2.5 text-zinc-400" />
                    <span>Not a Lead</span>
                  </>
                )}
              </span>
            )}
          </div>



          <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
            {formattedDate && <span>{formattedDate}</span>}
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Open original post"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Author Info */}
        <div className="flex items-center gap-2.5 mb-3">
          {post.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.author.avatarUrl}
              alt={post.author.name}
              className="h-8 w-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 shrink-0">
              {post.author.name ? post.author.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}

          <div className="truncate">
            <div className="flex items-center gap-1.5">
              {post.author.profileUrl ? (
                <a
                  href={post.author.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {post.author.name || "Anonymous"}
                </a>
              ) : (
                <span className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {post.author.name || "Anonymous"}
                </span>
              )}
            </div>
            {post.author.handle && (
              <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {post.author.handle}
              </p>
            )}
          </div>
        </div>

        {/* Title (if present) */}
        {post.title && (
          <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline flex items-start gap-1"
            >
              <span>{post.title}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
            </a>
          </h4>
        )}

        {/* Post Text / Body */}
        {post.text && (
          <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
            {displayText}
          </p>
        )}

        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show more <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}

        {/* AI Lead Analysis Callout */}
        {post.aiEvaluation && (
          <div
            className={`mt-3.5 rounded-xl border p-3 text-xs transition-colors ${
              post.aiEvaluation.isLead
                ? "border-emerald-200/90 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-zinc-200/80 bg-zinc-50/70 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold text-[11px] mb-1">
              {post.aiEvaluation.isLead ? (
                <>
                  <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-800 dark:text-emerald-300">
                    AI Lead Analysis: Qualified Lead
                  </span>
                </>
              ) : (
                <>
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 text-[9px] font-bold">
                    ✕
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    AI Lead Analysis: Rejection Reason
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              {post.aiEvaluation.reason}
            </p>
          </div>
        )}
      </div>



      {/* Bottom Metrics & Query Info */}
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-3">
          {/* Likes / Points / Stars */}
          {post.metrics?.likes !== undefined && post.metrics.likes > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <ThumbsUp className="h-3 w-3" /> {post.metrics.likes}
            </span>
          )}
          {post.metrics?.points !== undefined && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              ▲ {post.metrics.points} pts
            </span>
          )}
          {post.metrics?.stars !== undefined && post.metrics.stars > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-500">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{" "}
              {post.metrics.stars}
            </span>
          )}

          {/* Comments */}
          {post.metrics?.comments !== undefined && post.metrics.comments > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <MessageSquare className="h-3 w-3" /> {post.metrics.comments}
            </span>
          )}

          {/* Shares / Forks */}
          {post.metrics?.shares !== undefined && post.metrics.shares > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <Repeat className="h-3 w-3" /> {post.metrics.shares}
            </span>
          )}
          {post.metrics?.forks !== undefined && post.metrics.forks > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <GitFork className="h-3 w-3" /> {post.metrics.forks}
            </span>
          )}
        </div>

        {/* Matched Query Tag */}
        {post.queryUsed && (
          <span
            className="truncate max-w-40 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono"
            title={`Matched query: ${post.queryUsed}`}
          >
            &ldquo;{post.queryUsed}&rdquo;
          </span>

        )}
      </div>
    </div>
  );
}

function formatDateString(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;

    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}
