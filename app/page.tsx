import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Navigation */}
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-mono tracking-widest text-zinc-800 uppercase dark:text-zinc-200 font-semibold"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 text-xs">
              α
            </div>
            Search
          </Link>

          <nav className="flex items-center gap-2.5">
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  Dashboard ({session.name.split(" ")[0]})
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="rounded-md border border-transparent px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto flex flex-1 w-full max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-6 shadow-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
          <span>Powered by Neon DB &amp; Drizzle ORM</span>
        </div>

        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl text-zinc-900 dark:text-zinc-50">
          Search with clarity, speed, and precision.
        </h1>

        <p className="mt-4 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
          A minimalist search engine backed by serverless PostgreSQL and JWT
          authentication.
        </p>

        {/* Minimal Search Input Preview */}
        <div className="mt-8 w-full max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search anything..."
              disabled
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 pl-10 text-xs text-zinc-900 shadow-xs placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 cursor-not-allowed opacity-80"
            />
            <Search className="pointer-events-none absolute left-3.5 top-3 h-3.5 w-3.5 text-zinc-400" />
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="mt-8 flex items-center gap-3">
          {session ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
            >
              Go to Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
              >
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-200/80 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800/80 dark:text-zinc-600">
        Search &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
