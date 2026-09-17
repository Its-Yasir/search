import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFindFilterOptionsAction } from "@/app/actions/find";
import { FindExplorer } from "@/components/find/FindExplorer";
import { Compass, Sparkles, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Find Leads & ICP Profiles · Search",
  description:
    "Filter and discover targeted B2B sales leads and Ideal Customer Profiles extracted from company activity and commercial signals.",
};

export default async function FindPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  const filterOptions = await getFindFilterOptionsAction();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-mono text-xs font-semibold tracking-wider text-zinc-900 uppercase dark:text-zinc-100"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold shadow-xs">
              α
            </div>
            <span>Search</span>
          </Link>

          <nav className="flex items-center gap-5 text-xs text-zinc-500 dark:text-zinc-400">
            <Link
              href="/dashboard"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/find"
              className="text-zinc-900 dark:text-zinc-100 font-semibold transition-colors flex items-center gap-1"
            >
              <Compass className="h-3 w-3 text-blue-500" />
              Find Leads & ICP
            </Link>
            <Link
              href="/analyze"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3 text-emerald-500" />
              Analyze Pipeline
            </Link>
            <Link
              href="/add"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              Add URLs
            </Link>
            <Link
              href="/search"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              Search
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Compass className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Find Leads & Ideal Customer Profiles
              </h1>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-10.5 max-w-2xl">
              Filter commercial opportunities and ICP personas detected from company
              announcements, partnerships, and hiring activity. Select between Leads
              and ICPs using the dropdown selector below.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/analyze"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            >
              Pipeline Analysis
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
            </Link>
          </div>
        </div>

        {/* Interactive Discovery Explorer */}
        <FindExplorer initialOptions={filterOptions} />
      </main>
    </div>
  );
}
