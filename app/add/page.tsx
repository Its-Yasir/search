import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AddUrlsForm } from "@/components/add/AddUrlsForm";
import { Link2 } from "lucide-react";

export const metadata = {
  title: "Add Profile URLs · Search",
  description:
    "Add LinkedIn or other profile URLs to your account for tracking.",
};

export default async function AddPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Top nav bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5 font-mono text-xs font-semibold tracking-wider text-zinc-900 uppercase dark:text-zinc-100">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold shadow-xs">
              α
            </div>
            <span>Search</span>
          </div>
          <nav className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <a
              href="/dashboard"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/find"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              Find Leads & ICP
            </a>
            <a
              href="/add"
              className="text-zinc-900 dark:text-zinc-100 font-semibold transition-colors"
            >
              Add URLs
            </a>
            <a
              href="/analyze"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
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
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12">
        {/* Page heading */}
        <div className="mb-10 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100">
              <Link2 className="h-4 w-4 text-zinc-50 dark:text-zinc-900" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Add Profile URLs
            </h1>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 pl-11">
            Paste LinkedIn profile URLs (or any profile links) below. You can
            add multiple at once.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-6 shadow-sm">
          <AddUrlsForm />
        </div>

        {/* Tips */}
        <div className="mt-6 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 px-5 py-4 text-xs text-zinc-500 dark:text-zinc-500 space-y-1">
          <p className="font-medium text-zinc-600 dark:text-zinc-400 mb-2">
            Tips
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Paste a comma-separated list to add many at once.</li>
            <li>
              Press{" "}
              <kbd className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">
                Enter
              </kbd>{" "}
              after each URL to tag it separately.
            </li>
            <li>Remove any URL by clicking the × on its tag before saving.</li>
            <li>Duplicate URLs are silently skipped.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
