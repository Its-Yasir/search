export class RateLimitError extends Error {
  public readonly isRateLimit = true;
  public readonly provider: "unipile" | "openai" | "generic";

  constructor(
    message: string,
    provider: "unipile" | "openai" | "generic" = "generic"
  ) {
    super(message);
    this.name = "RateLimitError";
    this.provider = provider;
  }
}

/**
 * Helper to inspect any error and determine if it represents a rate limit / 429 / quota error.
 */
export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof RateLimitError) return true;

  const record = err as Record<string, unknown>;
  const status = record.status || record.statusCode;
  if (status === 429) return true;

  const code = typeof record.code === "string" ? record.code.toLowerCase() : "";
  if (code.includes("rate_limit") || code.includes("insufficient_quota")) {
    return true;
  }

  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("quota exceeded") ||
    message.includes("insufficient_quota") ||
    message.includes("tokens per minute") ||
    message.includes("requests per minute")
  );
}
