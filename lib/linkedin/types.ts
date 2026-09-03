export interface LinkedinAuthor {
  id?: string | null;
  public_identifier?: string;
  name: string;
  is_company: boolean;
  headline?: string;
  profile_picture_url?: string;
}

export interface LinkedinAttachment {
  id?: string;
  type?: string;
  url?: string;
  size?: {
    width?: number;
    height?: number;
  };
  sticker?: boolean;
  unavailable?: boolean;
  thumbnail_url?: string;
  title?: string;
}

export interface LinkedinMention {
  url?: string;
  start?: number;
  length?: number;
}

export interface LinkedinPostItem {
  type: string;
  provider: string;
  id: string;
  social_id: string;
  text: string;
  date?: string;
  parsed_datetime?: string;
  reaction_counter?: number;
  comment_counter?: number;
  repost_counter?: number;
  impressions_counter?: number;
  author: LinkedinAuthor;
  permissions?: {
    can_react?: boolean;
    can_post_comments?: boolean;
    can_share?: boolean;
  };
  share_url?: string;
  is_repost?: boolean;
  attachments?: LinkedinAttachment[];
  mentions?: LinkedinMention[];
  [key: string]: unknown;
}

export interface LinkedinPaging {
  start?: number | null;
  page_count?: number;
  total_count?: number | null;
}

export type UnipileDatePosted = "past_day" | "past_week" | "past_month";

export interface LinkedinPostSearchOptions {
  keywords: string;
  date_posted?: UnipileDatePosted;
  sort_by?: "relevance" | "date";
  limit?: number;
  cursor?: string;
  timeoutMs?: number;
}

export interface UnipileSearchResponse {
  object?: string;
  items?: LinkedinPostItem[];
  cursor?: string | null;
  paging?: LinkedinPaging;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LinkedinPostSearchSuccessResponse {
  success: true;
  data: {
    items: LinkedinPostItem[];
    total: number;
    cursor?: string | null;
    has_next_page: boolean;
    query: {
      keywords: string;
      date_input?: string;
      normalized_date?: UnipileDatePosted;
      limit: number;
      sort_by: "relevance" | "date";
    };
    paging?: LinkedinPaging;
  };
}

export interface LinkedinPostSearchErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export type LinkedinPostSearchApiResponse =
  | LinkedinPostSearchSuccessResponse
  | LinkedinPostSearchErrorResponse;
