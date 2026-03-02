export type ClipType = "hook" | "value_bomb" | "emotional_peak" | "cta" | "story";

export type ClipStatus = "generated" | "ready_to_post" | "rejected";

export interface Clip {
  id: string;
  user_id: string;
  video_id: string;
  title: string;
  start_time: number;
  end_time: number;
  type: ClipType;
  score: number | null;
  reasoning: string | null;
  suggested_caption: string | null;
  suggested_hashtags: string[] | null;
  status: ClipStatus;
  file_path: string;
  srt_path: string | null;
  created_at: string;
  updated_at: string;
}

