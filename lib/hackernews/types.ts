export interface HnAuthor {
  name: string;
  profileUrl: string;
}

export interface HnStoryItem {
  id: string;
  title: string;
  text: string;
  url: string;
  hnUrl: string;
  author: HnAuthor;
  points: number;
  commentsCount: number;
  createdAt: string;
  createdAtTimestamp: number;
  type: "story" | "comment" | "show_hn" | "ask_hn" | "poll";
  [key: string]: unknown;
}

export type HnTag = "story" | "comment" | "show_hn" | "ask_hn" | "poll" | "all";
export type HnSort = "date" | "relevance";

export interface HnSearchOptions {
  keywords: string;
  date?: string;
  tag?: HnTag;
  sort?: HnSort;
  limit?: number;
  page?: number;
  minPoints?: number;
  minComments?: number;
  timeoutMs?: number;
}

export interface HnAlgoliaHit {
  objectID: string;
  title?: string;
  story_title?: string;
  story_text?: string;
  comment_text?: string;
  url?: string;
  story_url?: string;
  author: string;
  points?: number;
  num_comments?: number;
  created_at: string;
  created_at_i: number;
  _tags?: string[];
  [key: string]: unknown;
}

export interface HnAlgoliaResponse {
  hits: HnAlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  query: string;
  params: string;
  [key: string]: unknown;
}

export interface HnSearchSuccessResponse {
  success: true;
  data: {
    items: HnStoryItem[];
    total: number;
    query: {
      keywords: string;
      date_input?: string;
      since_timestamp?: number;
      tag: HnTag;
      sort: HnSort;
      limit: number;
      page: number;
    };
  };
}

export interface HnSearchErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export type HnSearchApiResponse =
  | HnSearchSuccessResponse
  | HnSearchErrorResponse;
