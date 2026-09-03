export type PlatformType =
  | "linkedin"
  | "x"
  | "reddit"
  | "github"
  | "hackernews";

export interface UnifiedAuthor {
  name: string;
  handle?: string;
  profileUrl?: string;
  avatarUrl?: string;
}

export interface UnifiedPostMetrics {
  likes?: number;
  comments?: number;
  shares?: number;
  stars?: number;
  forks?: number;
  points?: number;
}

export interface ScoreBreakdown {
  coverage: number;
  informativeOverlap: number;
  precision: number;
  phraseBonus: number;
}

export interface AiLeadEvaluation {
  isLead: boolean;
  reason: string;
}

export interface UnifiedPost {
  id: string;
  platform: PlatformType;
  title?: string;
  text: string;
  url: string;
  author: UnifiedAuthor;
  createdAt?: string;
  metrics?: UnifiedPostMetrics;
  queryUsed?: string;
  specificIcpId?: string;
  specificIcpName?: string;
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
  aiEvaluation?: AiLeadEvaluation;
  raw?: unknown;
}

export interface PlatformSearchResult {
  platform: PlatformType;
  success: boolean;
  total: number;
  processedCount?: number;
  acceptedCount?: number;
  leadsCount?: number;
  items: UnifiedPost[];
  queryUsed: string;
  queriesUsed?: string[];
  executionTimeMs?: number;
  status: "success" | "empty" | "error";
  error?: string;
  directApiUrl?: string;
}

export interface OrchestrateSearchRequest {
  icpId: string;
  specificIcpIds?: string[];
  platforms: PlatformType[];
  dateRange?: string; // e.g. "past 24 hours", "past 7 days", "past 30 days", "past year", "all"
  limitPerPlatform?: number;
}

export interface OrchestrateSearchResponse {
  success: boolean;
  totalPosts: number;
  totalProcessed?: number;
  totalAccepted?: number;
  totalLeads?: number;
  acceptanceRate?: number;
  posts: UnifiedPost[];
  platformResults: Record<PlatformType, PlatformSearchResult>;
  error?: string;
}


