export interface GitHubAuthor {
  name: string;
  profileUrl: string;
  avatarUrl?: string;
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  title: string;
  text: string;
  url: string;
  author: GitHubAuthor;
  stars: number;
  forks: number;
  language?: string | null;
  topics?: string[];
  createdAt: string;
  updatedAt: string;
  type: "repository";
  [key: string]: unknown;
}

export interface GitHubIssueItem {
  id: number;
  title: string;
  text: string;
  url: string;
  author: GitHubAuthor;
  state: string;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  type: "issue";
  [key: string]: unknown;
}

export type GitHubItem = GitHubRepoItem | GitHubIssueItem;

export type GitHubSearchType = "repositories" | "issues";

export interface GitHubSearchOptions {
  keywords: string;
  type?: GitHubSearchType;
  date?: string;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  page?: number;
  timeoutMs?: number;
}

export interface GitHubSearchSuccessResponse {
  success: true;
  data: {
    items: GitHubItem[];
    total: number;
    query: {
      keywords: string;
      final_query: string;
      type: GitHubSearchType;
      date_input?: string;
      since_date?: string;
      sort: string;
      limit: number;
    };
  };
}

export interface GitHubSearchErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export type GitHubSearchApiResponse =
  | GitHubSearchSuccessResponse
  | GitHubSearchErrorResponse;
