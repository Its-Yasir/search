export interface RedditAuthor {
  name: string;
  profileUrl?: string;
}

export interface RedditPostItem {
  id: string;
  title: string;
  text: string;
  url: string;
  subreddit: string;
  author: RedditAuthor;
  createdAt: string;
  type: "post" | "subreddit";
  [key: string]: unknown;
}

export type RedditTimeframe = "hour" | "day" | "week" | "month" | "year" | "all";
export type RedditSort = "relevance" | "top" | "new" | "comments";

export interface RedditSearchOptions {
  keywords: string;
  subreddit?: string;
  date?: string;
  timeframe?: RedditTimeframe;
  sort?: RedditSort;
  limit?: number;
  timeoutMs?: number;
}

export interface RedditSearchSuccessResponse {
  success: true;
  data: {
    items: RedditPostItem[];
    total: number;
    query: {
      keywords: string;
      subreddit?: string;
      date_input?: string;
      timeframe: RedditTimeframe;
      sort: RedditSort;
      limit: number;
      feed_url: string;
    };
  };
}

export interface RedditSearchErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export type RedditSearchApiResponse =
  | RedditSearchSuccessResponse
  | RedditSearchErrorResponse;
