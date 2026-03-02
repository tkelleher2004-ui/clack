export type SocialPlatform =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "twitter"
  | "facebook";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface SocialAccountAccountData {
  name?: string;
  biography?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  video_count?: number;
  profile_picture_url?: string;
  avatar_url?: string;
  page_name?: string;
}

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  platform_account_id: string;
  username: string | null;
  access_token?: string; // Server-only, not returned to client via RLS
  account_data?: SocialAccountAccountData;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Legacy fields (for backward compatibility during migration)
  external_account_id?: string;
  account_name?: string | null;
  account_avatar_url?: string | null;
  follower_count?: number;
  following_count?: number;
  sync_status?: SyncStatus;
  sync_progress?: string | null;
  sync_error?: string | null;
}

export interface SocialPost {
  id: string;
  user_id: string;
  social_account_id: string;
  platform: SocialPlatform;
  post_type: string;
  title: string | null;
  caption: string | null;
  hashtags: string[] | null;
  media_url: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  external_post_id: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export const PLATFORM_CONFIG: Record<
  SocialPlatform,
  { name: string; icon: string; color: string }
> = {
  youtube: { name: "YouTube", icon: "▶", color: "#FF0000" },
  instagram: { name: "Instagram", icon: "📷", color: "#E4405F" },
  tiktok: { name: "TikTok", icon: "♪", color: "#00F2EA" },
  linkedin: { name: "LinkedIn", icon: "in", color: "#0A66C2" },
  twitter: { name: "X (Twitter)", icon: "𝕏", color: "#000000" },
  facebook: { name: "Facebook", icon: "f", color: "#1877F2" },
};
