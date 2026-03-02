export type VideoStatus =
  | "uploading"
  | "uploaded"
  | "processing"
  | "processing_transcript"
  | "processing_analysis"
  | "processing_clips"
  | "clips_ready"
  | "error";

export interface TranscriptWord {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
}

export interface Transcript {
  text: string;
  segments: TranscriptSegment[];
}

export interface Video {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number;
  file_path: string;
  mime_type: string;
  duration: number | null;
  thumbnail_url: string | null;
  transcript: Transcript | null;
  status: VideoStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const VIDEO_STATUS_CONFIG: Record<
  VideoStatus,
  { label: string; variant: "default" | "success" | "warning" | "error" | "info" }
> = {
  uploading: { label: "Uploading", variant: "info" },
  uploaded: { label: "Uploaded", variant: "default" },
  processing: { label: "Processing", variant: "warning" },
  processing_transcript: { label: "Transcribing", variant: "warning" },
  processing_analysis: { label: "Analyzing", variant: "warning" },
  processing_clips: { label: "Generating Clips", variant: "warning" },
  clips_ready: { label: "Clips Ready", variant: "success" },
  error: { label: "Error", variant: "error" },
};

export const ACCEPTED_VIDEO_TYPES: Record<string, string[]> = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
};

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
