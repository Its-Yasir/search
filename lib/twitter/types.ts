export interface TweetAuthor {
  type?: string;
  userName: string;
  url?: string;
  twitterUrl?: string;
  id?: string;
  name: string;
  isVerified?: boolean;
  isBlueVerified?: boolean;
  verifiedType?: string | null;
  profilePicture?: string;
  coverPicture?: string;
  description?: string;
  location?: string;
  followers?: number;
  following?: number;
  status?: string;
  canDm?: boolean;
  canMediaTag?: boolean;
  createdAt?: string;
  favouritesCount?: number;
  mediaCount?: number;
  statusesCount?: number;
}

export interface TweetUrlEntity {
  display_url?: string;
  expanded_url?: string;
  url?: string;
  indices?: number[];
}

export interface TweetUserMention {
  id_str?: string;
  name?: string;
  screen_name?: string;
  indices?: number[];
}

export interface TweetHashtagEntity {
  text?: string;
  tag?: string;
  indices?: number[];
}

export interface TweetMediaEntity {
  type?: string;
  media_url_https?: string;
  url?: string;
  display_url?: string;
  expanded_url?: string;
}

export interface TweetEntities {
  user_mentions?: TweetUserMention[];
  urls?: TweetUrlEntity[];
  hashtags?: TweetHashtagEntity[];
  media?: TweetMediaEntity[];
}

export interface TweetItem {
  type?: string;
  id: string;
  url?: string;
  twitterUrl?: string;
  text: string;
  source?: string;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount?: number;
  viewCount?: number;
  bookmarkCount?: number;
  createdAt: string;
  lang?: string;
  isReply?: boolean;
  inReplyToId?: string | null;
  conversationId?: string;
  author: TweetAuthor;
  entities?: TweetEntities;
  extendedEntities?: {
    media?: TweetMediaEntity[];
  };
  quoted_tweet?: TweetItem | null;
  retweeted_tweet?: TweetItem | null;
  [key: string]: unknown;
}

export interface TwitterRawApiResponse {
  tweets?: TweetItem[];
  has_next_page?: boolean;
  next_cursor?: string;
  data?: {
    tweets?: TweetItem[];
    has_next_page?: boolean;
    next_cursor?: string;
  };
  status?: string;
  msg?: string;
  [key: string]: unknown;
}

export interface TwitterPostSearchOptions {
  keywords?: string;
  query?: string;
  username?: string;
  date?: string;
  limit?: number;
  queryType?: "Latest" | "Top";
  cursor?: string;
  timeoutMs?: number;
}

export interface TwitterPostSearchSuccessResponse {
  success: true;
  data: {
    items: TweetItem[];
    total: number;
    cursor?: string | null;
    has_next_page: boolean;
    query: {
      keywords?: string;
      username?: string;
      date_input?: string;
      since_date?: string;
      final_query: string;
      limit: number;
      queryType: "Latest" | "Top";
    };
  };
}

export interface TwitterPostSearchErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export type TwitterPostSearchApiResponse =
  | TwitterPostSearchSuccessResponse
  | TwitterPostSearchErrorResponse;
