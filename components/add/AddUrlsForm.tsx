"use client";

import { useState, useRef, useCallback } from "react";
import { saveProfileUrlsAction } from "@/app/actions/profile-url";
import { Link2, X, Plus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Tag {
  id: number;
  url: string;
}

let tagIdCounter = 0;

function makeTag(url: string): Tag {
  return { id: ++tagIdCounter, url };
}

export function AddUrlsForm() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Flush whatever is currently in the input as tags */
  const flushInput = useCallback((value: string) => {
    const parts = value
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      setTags((prev) => [...prev, ...parts.map(makeTag)]);
    }
    setInputValue("");
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      flushInput(inputValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    // Auto-flush on comma
    if (val.includes(",")) {
      flushInput(val);
    } else {
      setInputValue(val);
    }
  };

  const removeTag = (id: number) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    // Flush any remaining text first
    const remaining = inputValue.trim();
    let allUrls = tags.map((t) => t.url);
    if (remaining) {
      allUrls = [...allUrls, ...remaining.split(/[\n,]+/).map((u) => u.trim()).filter(Boolean)];
    }

    if (allUrls.length === 0) {
      setStatus({ type: "error", message: "Please enter at least one URL." });
      return;
    }

    setSaving(true);
    setStatus(null);

    const result = await saveProfileUrlsAction(allUrls.join("\n"));

    setSaving(false);

    if (result.success) {
      const parts: string[] = [];
      if (result.saved) parts.push(`${result.saved} URL${result.saved !== 1 ? "s" : ""} saved`);
      if (result.duplicates) parts.push(`${result.duplicates} duplicate${result.duplicates !== 1 ? "s" : ""} skipped`);
      setStatus({ type: "success", message: parts.join(", ") + "." });
      setTags([]);
      setInputValue("");
    } else {
      setStatus({ type: "error", message: result.error ?? "Something went wrong." });
    }
  };

  const totalCount = tags.length + (inputValue.trim() ? 1 : 0);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Tag input area */}
      <div
        className="min-h-[180px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 flex flex-wrap gap-2 cursor-text focus-within:ring-2 focus-within:ring-zinc-900/20 dark:focus-within:ring-zinc-100/10 transition-shadow"
        onClick={() => textareaRef.current?.focus()}
      >
        {/* Rendered tags */}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium pl-3 pr-1.5 py-1 max-w-[280px] group"
          >
            <Link2 className="h-3 w-3 text-zinc-400 shrink-0" />
            <span className="truncate" title={tag.url}>{tag.url}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag.id); }}
              className="flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer shrink-0"
              aria-label={`Remove ${tag.url}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        {/* Textarea for live input */}
        <textarea
          ref={textareaRef}
          id="url-input"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Paste URLs here, separated by commas or press Enter after each…" : "Add more URLs…"}
          className="flex-1 min-w-[200px] resize-none bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none leading-relaxed"
          rows={1}
          style={{ minHeight: "28px" }}
        />
      </div>

      {/* Helper text */}
      <p className="text-xs text-zinc-400 dark:text-zinc-600 flex items-center gap-1.5">
        <Plus className="h-3 w-3" />
        Separate URLs with <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[10px]">Enter</kbd> or <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[10px]">,</kbd> — or paste multiple comma-separated at once.
      </p>

      {/* Status message */}
      {status && (
        <div
          className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-1 duration-200 ${
            status.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        id="save-urls-btn"
        onClick={handleSave}
        disabled={saving || totalCount === 0}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-sm font-medium py-2.5 px-4 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" />
            Save {totalCount > 0 ? `${totalCount} URL${totalCount !== 1 ? "s" : ""}` : "URLs"}
          </>
        )}
      </button>
    </div>
  );
}
