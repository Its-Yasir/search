"use client";

import { useEffect, useState } from "react";
import {
  X,
  ExternalLink,
  Building2,
  Calendar,
  Sparkles,
  MapPin,
  Users,
  Target,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Clock,
  TrendingUp,
  Layers,
  Globe,
  Briefcase,
  MessageSquare,
} from "lucide-react";
import type { LeadFindItem, IcpFindItem } from "@/app/actions/find";

interface EntityDetailModalProps {
  item: LeadFindItem | IcpFindItem | null;
  mode: "leads" | "icp";
  isOpen: boolean;
  onClose: () => void;
}

export function EntityDetailModal({
  item,
  mode,
  isOpen,
  onClose,
}: EntityDetailModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const isLead = mode === "leads";
  const { event, company, contact } = item;

  // Unified data extraction: supports both lead and icp modes
  const leadData = item.lead || null;
  const icpData = item.icp || null;

  // Derive ICP attributes with fallback to lead if icp is not directly populated
  const icpTitles =
    icpData?.title && icpData.title.length > 0
      ? icpData.title
      : leadData?.title || [];

  const icpIndustries =
    icpData?.industry && icpData.industry.length > 0
      ? icpData.industry
      : leadData?.industry && leadData.industry.length > 0
      ? leadData.industry
      : company.industry
      ? [company.industry]
      : [];

  const icpGeographies =
    icpData?.geography && icpData.geography.length > 0
      ? icpData.geography
      : leadData?.geography && leadData.geography.length > 0
      ? leadData.geography
      : company.location
      ? [company.location]
      : [];

  const icpSizes =
    icpData?.companySize && icpData.companySize.length > 0
      ? icpData.companySize
      : leadData?.companySize || [];

  const icpType = icpData?.type || leadData?.type || "company";

  const sizeDisplay =
    icpSizes.length > 1
      ? `${icpSizes[0]} – ${icpSizes[1]} employees`
      : icpSizes.length === 1
      ? `${icpSizes[0]}+ employees`
      : company.employeeCount
      ? `${company.employeeCount} employees`
      : "Any scale";

  const isLeadExpired =
    leadData?.expiration && new Date(leadData.expiration) < new Date();

  const handleCopy = () => {
    const lines = [
      `=== ${company.name.toUpperCase()} INTELLIGENCE DOSSIER ===`,
      `Industry: ${company.industry || "N/A"}`,
      `Location: ${company.location || "N/A"}`,
      `Trigger Event: ${event.headline}`,
      `Event Date: ${
        event.postDate ? new Date(event.postDate).toLocaleDateString() : "N/A"
      }`,
      "",
      `--- 1. ICP INFO (IDEAL CUSTOMER PROFILE) ---`,
      `Target Titles: ${icpTitles.length ? icpTitles.join(", ") : "N/A"}`,
      `Target Industries: ${
        icpIndustries.length ? icpIndustries.join(", ") : "N/A"
      }`,
      `Target Geography: ${
        icpGeographies.length ? icpGeographies.join(", ") : "N/A"
      }`,
      `Target Company Size: ${sizeDisplay}`,
      `ICP Type: ${icpType}`,
      "",
      `--- 2. LEAD INFO (COMMERCIAL INTELLIGENCE) ---`,
      leadData?.advantageProviding
        ? `Opportunity Angle: ${leadData.advantageProviding}`
        : "",
      leadData?.painPoint ? `Pain Point: ${leadData.painPoint}` : "",
      leadData?.requirements ? `Requirements: ${leadData.requirements}` : "",
      leadData?.didTheyAsk ? `Expressed Need: ${leadData.didTheyAsk}` : "",
      leadData?.expiration
        ? `Expiration: ${new Date(leadData.expiration).toLocaleDateString()}`
        : "",
      "",
      `--- 3. WHO TO CONNECT (OUTREACH STRATEGY) ---`,
      contact?.role?.length ? `Target Role(s): ${contact.role.join(", ")}` : "",
      contact?.seniority?.length
        ? `Seniority: ${contact.seniority.join(", ")}`
        : "",
      contact?.connectMethod
        ? `Connect Method: ${contact.connectMethod}`
        : "",
      contact?.extraInfo ? `Strategic Guidance: ${contact.extraInfo}` : "",
    ].filter((line) => line !== "");

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      {/* Background click overlay */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Card Box */}
      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden z-10 my-8">
        {/* Header with Company details */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  className="h-13 w-13 sm:h-14 sm:w-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 shadow-xs bg-white shrink-0"
                />
              ) : (
                <div className="flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xl border border-blue-500/20 shrink-0">
                  {company.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {company.name}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      isLead
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                        : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                    }`}
                  >
                    {isLead ? "Commercial Lead" : "Ideal Customer Profile"}
                  </span>
                  {event.confidenceScore ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      <Sparkles className="h-3 w-3 text-emerald-500" />
                      {event.confidenceScore}% Confidence
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                  {company.industry && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Building2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      {company.industry}
                    </span>
                  )}
                  {company.location && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      {company.location}
                    </span>
                  )}
                  {company.employeeCount && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      {company.employeeCount} employees
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="flex h-8 items-center gap-1.5 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                title="Copy full intelligence dossier"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-zinc-500" />
                    Copy Dossier
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="max-h-[72vh] overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Signal / Event Context Section */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Trigger Event Signal
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 capitalize">
                  {event.eventType.replace(/_/g, " ")}
                </span>
              </div>
              {event.postDate && (
                <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(event.postDate).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>

            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {event.headline}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {event.summary}
            </p>

            {event.postUrl && (
              <div className="pt-0.5">
                <a
                  href={event.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  View LinkedIn Source Post
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              UNIFIED INTELLIGENCE DOSSIER BOX:
              1. ICP Info
              2. Lead Info
              3. Who to Connect
              All in the same box, clearly demarcated with subtle separation
             ══════════════════════════════════════════════════════════════════ */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800/80">
            {/* Box Header Overview Bar */}
            <div className="bg-zinc-50/80 dark:bg-zinc-950/60 px-5 py-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Lead & ICP Intelligence Dossier
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                  1. ICP Info
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  2. Lead Info
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  3. Who to Connect
                </span>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 1: ICP INFO (Ideal Customer Profile)
               ───────────────────────────────────────────────────────────── */}
            <div className="p-5 space-y-3.5 bg-purple-50/20 dark:bg-purple-950/10">
              {/* Section Header */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-purple-600 text-white font-bold text-xs shadow-xs">
                    1
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Ideal Customer Profile (ICP) Info
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 uppercase tracking-wider">
                    <Layers className="h-3 w-3" />
                    {icpType} ICP
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    <Users className="h-3 w-3 text-zinc-400" />
                    {sizeDisplay}
                  </span>
                </div>
              </div>

              {/* ICP Criteria Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Target Job Titles */}
                <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <Briefcase className="h-3.5 w-3.5 text-purple-500" />
                    Target Job Roles & Titles
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {icpTitles.length > 0 ? (
                      icpTitles.map((title, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border border-purple-200/60 dark:border-purple-800/40"
                        >
                          {title}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-400">
                        General decision makers
                      </span>
                    )}
                  </div>
                </div>

                {/* Target Industries & Geography */}
                <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <Globe className="h-3.5 w-3.5 text-purple-500" />
                    Industries & Geography
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    {/* Industries */}
                    <div className="flex flex-wrap gap-1">
                      {icpIndustries.length > 0 ? (
                        icpIndustries.map((ind, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          >
                            {ind}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400">
                          Cross-industry
                        </span>
                      )}
                    </div>
                    {/* Geography */}
                    <div className="flex flex-wrap gap-1">
                      {icpGeographies.length > 0 ? (
                        icpGeographies.map((geo, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                          >
                            <MapPin className="h-2.5 w-2.5 mr-1 text-zinc-400" />
                            {geo}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400">
                          Worldwide / Flexible
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 2: LEAD INFO (Commercial Intelligence)
               ───────────────────────────────────────────────────────────── */}
            <div className="p-5 space-y-3.5 bg-blue-50/20 dark:bg-blue-950/10">
              {/* Section Header */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-xs shadow-xs">
                    2
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Lead Info (Commercial Intelligence)
                    </h4>
                  </div>
                </div>

                {leadData?.expiration && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                      isLeadExpired
                        ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {isLeadExpired
                      ? "Stale / Expired"
                      : `Active until ${new Date(
                          leadData.expiration
                        ).toLocaleDateString()}`}
                  </span>
                )}
              </div>

              {/* Lead Details Sub-Cards */}
              <div className="space-y-3 pt-1">
                {/* Advantage / Angle */}
                {leadData?.advantageProviding ? (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-blue-200">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Opportunity Advantage & Outreach Pitch Angle
                    </div>
                    <p className="text-xs text-blue-950/85 dark:text-blue-200/90 leading-relaxed">
                      {leadData.advantageProviding}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-blue-200">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Opportunity Trigger Angle
                    </div>
                    <p className="text-xs text-blue-950/85 dark:text-blue-200/90 leading-relaxed">
                      {event.leadOpportunity ||
                        "Recent company event presents a timely business development opportunity."}
                    </p>
                  </div>
                )}

                {/* Pain Point */}
                {leadData?.painPoint && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/30 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      Identified Pain Point & Operational Urgency
                    </div>
                    <p className="text-xs text-amber-950/85 dark:text-amber-200/90 leading-relaxed">
                      {leadData.painPoint}
                    </p>
                  </div>
                )}

                {/* Requirements */}
                {leadData?.requirements && (
                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <CheckCircle2 className="h-4 w-4 text-zinc-500" />
                      Key Requirements, Services & Solutions Needed
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {leadData.requirements}
                    </p>
                  </div>
                )}

                {/* Did They Ask */}
                {leadData?.didTheyAsk && (
                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      Specific Request / Direct Ask
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 italic">
                      &ldquo;{leadData.didTheyAsk}&rdquo;
                    </p>
                  </div>
                )}

                {/* Other Useful Resources */}
                {leadData?.otherUsefulResources && (
                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <ExternalLink className="h-4 w-4 text-zinc-500" />
                      Additional Context & Outreach References
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed break-words">
                      {leadData.otherUsefulResources}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 3: WHO TO CONNECT (Contact Strategy)
               ───────────────────────────────────────────────────────────── */}
            <div className="p-5 space-y-3.5 bg-emerald-50/20 dark:bg-emerald-950/10">
              {/* Section Header */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-emerald-600 text-white font-bold text-xs shadow-xs">
                    3
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Who to Connect (Contact Strategy)
                    </h4>
                  </div>
                </div>

                {contact?.connectMethod && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    <Send className="h-3 w-3" />
                    {contact.connectMethod}
                  </span>
                )}
              </div>

              {/* Contact Strategy Details */}
              {contact &&
              (Boolean(contact.role?.length) ||
                Boolean(contact.seniority?.length) ||
                Boolean(contact.connectMethod) ||
                Boolean(contact.extraInfo)) ? (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Target Roles */}
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-3.5 space-y-1.5">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Target Decision-Maker Roles
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {contact.role && contact.role.length > 0 ? (
                          contact.role.map((r, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-800/40"
                            >
                              {r}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-400">
                            Key stakeholders
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Seniority & Channel */}
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-3.5 space-y-2">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Seniority & Preferred Channel
                      </div>
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex flex-wrap gap-1">
                          {contact.seniority && contact.seniority.length > 0 ? (
                            contact.seniority.map((s, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-400">
                              Executive level
                            </span>
                          )}
                        </div>
                        {contact.connectMethod && (
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">
                            Preferred approach:{" "}
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                              {contact.connectMethod}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Strategic Guidance Quote Card */}
                  {contact.extraInfo && (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Actionable Outreach Guidance & Strategy Angle
                      </div>
                      <p className="text-xs text-emerald-950/85 dark:text-emerald-200/90 leading-relaxed italic">
                        &ldquo;{contact.extraInfo}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-zinc-500 dark:text-zinc-400 italic py-2">
                  Outreach strategy: Target senior leadership and heads of
                  business units relevant to the trigger event.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {company.profileUrl && (
              <a
                href={company.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                LinkedIn Profile
                <ExternalLink className="h-3 w-3 text-zinc-400" />
              </a>
            )}
            {company.websiteUrl && (
              <a
                href={company.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Company Website
                <ExternalLink className="h-3 w-3 text-zinc-400" />
              </a>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

