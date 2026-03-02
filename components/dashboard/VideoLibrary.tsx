"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GlassCard, GlassButton, GlassInput, GlassBadge, PageTransition } from "@/components/ui";
import type { Video } from "@/lib/types/video";
import { VIDEO_STATUS_CONFIG } from "@/lib/types/video";

type SortOption = "newest" | "oldest" | "name";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoThumbnail({ video }: { video: Video }) {
  if (video.thumbnail_url) {
    return (
      <img
        src={video.thumbnail_url}
        alt={video.title}
        className="w-full h-full object-cover"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.02)" }}>
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#71717A" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

function SortSelect({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="px-4 py-3 text-sm outline-none appearance-none cursor-pointer"
      style={{
        background: "transparent",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "#E4E4E7",
        boxShadow: [
          "inset 0 1px 0 0 rgba(255,255,255,0.22)",
          "inset 1px 0 0 0 rgba(255,255,255,0.12)",
          "inset -1px 0 0 0 rgba(255,255,255,0.05)",
          "inset 0 -1px 0 0 rgba(255,255,255,0.03)",
          "0 2px 12px rgba(0,0,0,0.3)",
        ].join(", "),
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23A1A1AA'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "1.25rem",
        backgroundPosition: "right 0.75rem center",
        paddingRight: "2.5rem",
      }}
    >
      <option value="newest" style={{ backgroundColor: "#1C1C1F", color: "#E4E4E7" }}>Newest</option>
      <option value="oldest" style={{ backgroundColor: "#1C1C1F", color: "#E4E4E7" }}>Oldest</option>
      <option value="name" style={{ backgroundColor: "#1C1C1F", color: "#E4E4E7" }}>Name</option>
    </select>
  );
}

export function VideoLibrary({ videos }: { videos: Video[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");

  const filtered = useMemo(() => {
    let result = [...videos];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.file_name.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "name":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [videos, search, sort]);

  if (videos.length === 0) {
    return (
      <PageTransition>
        <GlassCard hover={false} className="flex flex-col items-center py-20 px-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.22), 0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#71717A" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "#E4E4E7" }}>
            No videos yet
          </h2>
          <p className="mb-8 text-center" style={{ color: "#71717A" }}>
            Upload your first video to get started with AI-powered clip extraction.
          </p>
          <GlassButton onClick={() => router.push("/dashboard/videos/upload")}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Upload Video
          </GlassButton>
        </GlassCard>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 w-full sm:w-auto">
            <GlassInput
              placeholder="Search videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <SortSelect value={sort} onChange={setSort} />
            <GlassButton
              size="sm"
              onClick={() => router.push("/dashboard/videos/upload")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Upload
            </GlassButton>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((video, i) => {
            const statusConfig =
              VIDEO_STATUS_CONFIG[video.status as keyof typeof VIDEO_STATUS_CONFIG] ??
              ({ label: video.status, variant: "default" } as const);
            return (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <GlassCard
                  className="cursor-pointer overflow-hidden"
                  onClick={() => router.push(`/dashboard/videos/${video.id}`)}
                >
                  <div className="aspect-video overflow-hidden" style={{ borderRadius: "20px 20px 0 0" }}>
                    <VideoThumbnail video={video} />
                  </div>

                  <div className="p-4">
                    <h3
                      className="font-medium truncate mb-1"
                      style={{ color: "#E4E4E7" }}
                    >
                      {video.title}
                    </h3>

                    <div className="flex items-center gap-2 mb-3">
                      {video.duration != null && (
                        <span className="text-xs" style={{ color: "#71717A" }}>
                          {formatDuration(video.duration)}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "#71717A" }}>
                        {formatFileSize(video.file_size)}
                      </span>
                      <span className="text-xs" style={{ color: "#71717A" }}>
                        · {formatDate(video.created_at)}
                      </span>
                    </div>

                    <GlassBadge
                      variant={statusConfig.variant}
                      size="sm"
                    >
                      {statusConfig.label}
                    </GlassBadge>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && videos.length > 0 && (
          <GlassCard hover={false} className="py-12 px-8 text-center">
            <p style={{ color: "#71717A" }}>No videos match your search.</p>
          </GlassCard>
        )}
      </div>
    </PageTransition>
  );
}
