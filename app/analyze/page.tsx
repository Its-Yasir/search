import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnalyzePipelineView } from "@/components/analyze/AnalyzePipelineView";
import { Sparkles, ArrowUpRight, Target } from "lucide-react";

export const metadata = {
  title: "Analyze & Lead Signals · Search",
  description:
    "Automated LinkedIn company analysis, post ingestion, and B2B trigger event discovery with AI.",
};

export default async function AnalyzePage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Top nav bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5 font-mono text-xs font-semibold tracking-wider text-zinc-900 uppercase dark:text-zinc-100">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold shadow-xs">
              α
            </div>
            <span>Search</span>
          </div>
          <nav className="flex items-center gap-5 text-xs text-zinc-500 dark:text-zinc-400">
            <a
              href="/dashboard"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/detect-icp"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors flex items-center gap-1"
            >
              <Target className="h-3 w-3 text-blue-500" />
              Detect ICP
            </a>
            <a
              href="/find"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              Find Leads & ICP
            </a>
            <a
              href="/add"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              Add URLs
            </a>
            <a
              href="/analyze"
              className="text-zinc-900 dark:text-zinc-100 font-semibold transition-colors flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3 text-emerald-500" />
              Analyze & Leads
            </a>
            <a
              href="/search"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              Search
            </a>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-10">
        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Company Intelligence & Lead Event Extraction
              </h1>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-10.5 max-w-2xl">
              Processes your LinkedIn company profile URLs one-by-one with
              human-like intervals (2–3 minutes between requests), retrieves
              posts from the last 2 months, and feeds each post to OpenAI to
              extract high-value B2B commercial events and sales leads.
            </p>
          </div>

          <div>
            <a
              href="/add"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            >
              Manage Profile URLs
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
            </a>
          </div>
        </div>

        {/* Live Pipeline View */}
        <AnalyzePipelineView />
      </main>
    </div>
  );
}
