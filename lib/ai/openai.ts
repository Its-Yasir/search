import OpenAI from "openai";

let _openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!_openaiClient || _openaiClient.apiKey !== apiKey) {
    _openaiClient = new OpenAI({
      apiKey: apiKey || "dummy-key-for-build",
    });
  }
  return _openaiClient;
}

export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getOpenAIClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
