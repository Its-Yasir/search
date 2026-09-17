"use client";

import { useState } from "react";
import {
  ExternalLink,
  Sparkles,
  MapPin,
  Users,
  Target,
  Send,
  AlertCircle,
  Copy,
  Check,
  Eye,
  Calendar,
  Clock,
} from "lucide-react";
import type { LeadFindItem } from "@/app/actions/find";

interface LeadCardProps {
  item: LeadFindItem;
  onViewDetails: (item: LeadFindItem) => void;
}

export function LeadCard({ item, onViewDetails }: LeadCardProps) {
  const [copied, setCopied] = useState(false);
  const { lead, event, company, contact } = item;

  const isExpired =
    lead.expiration && new Date(lead.expiration) < new Date();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const summary = `Lead: ${company.name}\nTrigger: ${event.headline}\nTarget Roles: ${
      lead.title?.join(", ") || "N/A"
    }\nPain Point: ${lead.painPoint || "N/A"}\nAngle: ${
      lead.advantageProviding || "N/A"
    }`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={() => onViewDetails(item)}
      className="group relative flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 p-5 shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 cursor-pointer"
    >
      {/* Top Header: Company Identity + Status Badges */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="h-11 w-11 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 bg-white shrink-0 shadow-xs"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-base border border-blue-500/20 shrink-0">
              {company.name.charAt(0)}
            </div>
          )}

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {company.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
              {company.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {company.location}
                </span>
              )}
              {company.employeeCount && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 shrink-0" />
                  {company.employeeCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Confidence & Expiration Tags */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {event.confidenceScore ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
              {event.confidenceScore}%
            </span>
          ) : null}

          {lead.expiration ? (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                isExpired
                  ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
              }`}
            >
              <Clock className="h-2.5 w-2.5" />
              {isExpired ? "Expired" : "Active"}
            </span>
          ) : null}
        </div>
      </div>

      {/* Trigger Event Headline */}
      <div className="mb-3 space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium capitalize">
            {event.eventType.replace(/_/g, " ")}
          </span>
          {event.postDate && (
            <span className="flex items-center gap-1">
              • <Calendar className="h-2.5 w-2.5" />
              {new Date(event.postDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
          {event.headline}
        </p>
      </div>

      {/* High-value Lead Insight: Pain Point / Opportunity */}
      {lead.painPoint && (
        <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-1 font-semibold text-[11px] text-amber-800 dark:text-amber-300 mb-0.5">
            <AlertCircle className="h-3 w-3" />
            Core Pain Point
          </div>
          <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            {lead.painPoint}
          </p>
        </div>
      )}

      {/* Target Roles & Industry Badges */}
      <div className="mt-auto pt-2 space-y-2">
        {lead.title && lead.title.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Target className="h-3 w-3 text-blue-500 shrink-0" />
            <div className="flex flex-wrap gap-1">
              {lead.title.slice(0, 3).map((t, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                >
                  {t}
                </span>
              ))}
              {lead.title.length > 3 && (
                <span className="text-[10px] text-zinc-400">
                  +{lead.title.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Recommended Contact Hint */}
        {contact && (Boolean(contact.role?.length) || Boolean(contact.connectMethod)) && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-500/20 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <Send className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {contact.role?.length ? (
                  <>
                    Reach out to: <strong>{contact.role[0]}</strong>
                  </>
                ) : (
                  <span>Outreach Strategy</span>
                )}
              </span>
            </div>
            {contact.connectMethod && (
              <span
                className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[45%] shrink-0 text-right ml-auto"
                title={contact.connectMethod}
              >
                {contact.connectMethod}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Quick action buttons */}
      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(item);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          <Eye className="h-3.5 w-3.5" />
          View Details
        </button>

        <div className="flex items-center gap-1.5">
          {company.profileUrl && (
            <a
              href={company.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Open LinkedIn profile"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Copy lead summary"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
