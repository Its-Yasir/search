"use client";

import { useState } from "react";
import {
  ExternalLink,
  Sparkles,
  MapPin,
  Users,
  Target,
  Send,
  Copy,
  Check,
  Eye,
  Calendar,
  Layers,
  Building,
} from "lucide-react";
import type { IcpFindItem } from "@/app/actions/find";

interface IcpCardProps {
  item: IcpFindItem;
  onViewDetails: (item: IcpFindItem) => void;
}

export function IcpCard({ item, onViewDetails }: IcpCardProps) {
  const [copied, setCopied] = useState(false);
  const { icp, event, company, contact } = item;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const summary = `ICP Profile (from ${company.name})\nTarget Roles: ${
      icp.title?.join(", ") || "N/A"
    }\nIndustries: ${icp.industry?.join(", ") || "N/A"}\nGeography: ${
      icp.geography?.join(", ") || "N/A"
    }\nCompany Size: ${
      icp.companySize?.join(" - ") || "N/A"
    } employees\nType: ${icp.type || "company"}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sizeText =
    icp.companySize && icp.companySize.length > 1
      ? `${icp.companySize[0]} – ${icp.companySize[1]} employees`
      : icp.companySize && icp.companySize.length === 1
      ? `${icp.companySize[0]}+ employees`
      : "Any size";

  return (
    <div
      onClick={() => onViewDetails(item)}
      className="group relative flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 p-5 shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 cursor-pointer"
    >
      {/* Top Header: Company Branding + ICP Type */}
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
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-base border border-purple-500/20 shrink-0">
              {company.name.charAt(0)}
            </div>
          )}

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {company.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
              {company.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {company.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Persona Type Badge */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 uppercase tracking-wider">
            <Layers className="h-2.5 w-2.5" />
            {icp.type || "Company"} ICP
          </span>
          {event.confidenceScore ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400">
              <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
              {event.confidenceScore}% score
            </span>
          ) : null}
        </div>
      </div>

      {/* Target Title & Persona Badges */}
      <div className="mb-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
          <Target className="h-3 w-3 text-purple-500" />
          Target Job Roles
        </div>
        <div className="flex flex-wrap gap-1.5">
          {icp.title && icp.title.length > 0 ? (
            icp.title.slice(0, 4).map((t, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
              >
                {t}
              </span>
            ))
          ) : (
            <span className="text-xs text-zinc-400">General Executive</span>
          )}
          {icp.title && icp.title.length > 4 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
              +{icp.title.length - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Profile Specifications (Industries & Company Scale) */}
      <div className="mb-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-3 space-y-2">
        {/* Industries */}
        {icp.industry && icp.industry.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <Building className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {icp.industry.slice(0, 3).map((ind, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40"
                >
                  {ind}
                </span>
              ))}
              {icp.industry.length > 3 && (
                <span className="text-[10px] text-zinc-400 self-center">
                  +{icp.industry.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Company Size */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Target Size:
          </span>
          <span>{sizeText}</span>
        </div>

        {/* Geography */}
        {icp.geography && icp.geography.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{icp.geography.slice(0, 3).join(", ")}</span>
          </div>
        )}
      </div>

      {/* Origin Event Context Snippet */}
      <div className="mt-auto text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 space-y-1">
        <div className="flex items-center gap-1 text-zinc-400">
          <Calendar className="h-2.5 w-2.5" />
          <span>Derived from trigger event:</span>
        </div>
        <p className="line-clamp-1 italic text-zinc-600 dark:text-zinc-400">
          &ldquo;{event.headline}&rdquo;
        </p>

        {/* Recommended Contact Hint */}
        {contact && (Boolean(contact.role?.length) || Boolean(contact.connectMethod)) && (
          <div className="pt-1.5 flex items-center justify-between gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-500/20 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <Send className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {contact.role?.length ? (
                  <>
                    Contact: <strong>{contact.role[0]}</strong>
                  </>
                ) : (
                  <span>Target Contact</span>
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
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-400 transition"
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
            title="Copy ICP details"
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
