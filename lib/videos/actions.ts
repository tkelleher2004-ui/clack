"use server";

import { createClient } from "@/lib/supabase/server";
import type { Video } from "@/lib/types/video";

export async function createVideoRecord(data: {
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<{ id: string; userId: string; filePath: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = crypto.randomUUID();
  const filePath = `${user.id}/${id}/${data.fileName}`;

  const { error } = await supabase.from("videos").insert({
    id,
    user_id: user.id,
    title: data.title,
    file_name: data.fileName,
    file_size: data.fileSize,
    file_path: filePath,
    mime_type: data.mimeType,
    status: "uploading",
  });

  if (error) return { error: error.message };
  return { id, userId: user.id, filePath };
}

export async function updateVideoStatus(
  videoId: string,
  status: string,
  errorMessage?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("videos")
    .update({
      status,
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", videoId);

  if (error) return { error: error.message };
  return {};
}

export async function updateVideoDetails(
  videoId: string,
  data: { title?: string; description?: string }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("videos")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", videoId);

  if (error) return { error: error.message };
  return {};
}

export async function deleteVideo(videoId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: video } = await supabase
    .from("videos")
    .select("file_path")
    .eq("id", videoId)
    .single();

  if (video?.file_path) {
    await supabase.storage.from("videos").remove([video.file_path]);
  }

  const { error } = await supabase.from("videos").delete().eq("id", videoId);
  if (error) return { error: error.message };
  return {};
}

export async function getUserVideos(): Promise<Video[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("videos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as Video[];
}

export async function getVideoById(videoId: string): Promise<Video | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .eq("user_id", user.id)
    .single();

  return (data as Video) ?? null;
}

export async function getVideoSignedUrl(filePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("videos")
    .createSignedUrl(filePath, 3600);

  return data?.signedUrl ?? null;
}
