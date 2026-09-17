import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getIcpPresetsAction } from "@/app/actions/detect-icp";
import { DetectIcpView } from "@/components/detect-icp/DetectIcpView";
import { Compass, Sparkles, Target } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Detect ICP & Match Events · Search",
  description:
    "Input your company offering to automatically derive industry tags, target personas, and match commercial trigger events in your database.",
};

export default async function DetectIcpPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  const presets = await getIcpPresetsAction();

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
              href="/detect-icp"
              className="text-zinc-900 dark:text-zinc-100 font-semibold transition-colors flex items-center gap-1"
            >
              <Target className="h-3 w-3 text-blue-500" />
              Detect ICP
            </Link>
            <Link
              href="/find"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors flex items-center gap-1"
            >
              <Compass className="h-3 w-3 text-zinc-400" />
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
        <DetectIcpView presets={presets} />
      </main>
    </div>
  );
}
