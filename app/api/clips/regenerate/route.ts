import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tmpdir } from "os";
import { join } from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import type { Transcript } from "@/lib/types/video";

async function callPythonGenerateClip(params: {
  videoPath: string;
  start: number;
  end: number;
  transcript: Transcript;
  burnSubtitles?: boolean;
}): Promise<{ clipPath: string }> {
  // Use venv Python if available, otherwise python3, or PYTHON_PATH env var
  const venvPython = join(process.cwd(), "python-microservice", "venv", "bin", "python3");
  let pythonPath = process.env.PYTHON_PATH;
  if (!pythonPath) {
    try {
      await fs.access(venvPython);
      pythonPath = venvPython;
    } catch {
      pythonPath = "python3";
    }
  }
  const scriptPath = "python-microservice/video_processor.py";

  const tmpDir = tmpdir();
  const transcriptFile = join(tmpDir, `transcript-${randomUUID()}.json`);
  const outputDir = join(tmpDir, `clip-${randomUUID()}`);

  await fs.writeFile(transcriptFile, JSON.stringify(params.transcript), "utf8");

  // Ensure PATH includes /opt/homebrew/bin for FFmpeg on macOS
  const pathEnv = process.env.PATH || "";
  const homebrewBin = "/opt/homebrew/bin";
  const env = {
    ...process.env,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    PATH: pathEnv.includes(homebrewBin) ? pathEnv : `${homebrewBin}:${pathEnv}`,
  };

  const burnSubs = params.burnSubtitles !== false;
  return new Promise((resolve, reject) => {
    const proc = spawn(
      pythonPath,
      [
        scriptPath,
        "generate_clip",
        params.videoPath,
        String(params.start),
        String(params.end),
        transcriptFile,
        outputDir,
        burnSubs ? "true" : "false",
      ],
      { env }
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", async (code) => {
      try {
        await fs.unlink(transcriptFile).catch(() => {});
      } catch {
        // ignore
      }

      if (code !== 0) {
        return reject(
          new Error(`Python generate_clip failed (code ${code}): ${stderr || stdout}`)
        );
      }

      try {
        const parsed = JSON.parse(stdout);
        if (!parsed || !parsed.clip_path) {
          throw new Error("No clip_path in Python response");
        }
        resolve({ clipPath: parsed.clip_path as string });
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clipId, videoId, start_time, end_time, burnSubtitles = true } = body as {
      clipId?: string;
      videoId?: string;
      start_time?: number;
      end_time?: number;
      burnSubtitles?: boolean;
    };

    if (!clipId || !videoId || start_time == null || end_time == null) {
      return NextResponse.json({ error: "clipId, videoId, start_time, end_time are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (!video.transcript) {
      return NextResponse.json({ error: "Transcript not available for this video" }, { status: 400 });
    }

    const { data: signed } = await supabase.storage
      .from("videos")
      .createSignedUrl(video.file_path, 60 * 30);

    if (!signed?.signedUrl) {
      return NextResponse.json({ error: "Failed to create signed URL for video" }, { status: 500 });
    }

    const tmpPath = join(tmpdir(), `clack-video-${videoId}-${clipId}.mp4`);
    const resp = await fetch(signed.signedUrl);

    if (!resp.ok) {
      return NextResponse.json({ error: "Failed to download video" }, { status: 500 });
    }

    const arrayBuffer = await resp.arrayBuffer();
    await fs.writeFile(tmpPath, Buffer.from(arrayBuffer));

    try {
      const { clipPath } = await callPythonGenerateClip({
        videoPath: tmpPath,
        start: start_time,
        end: end_time,
        transcript: video.transcript as Transcript,
        burnSubtitles,
      });

      const fileBuffer = await fs.readFile(clipPath);
      const clipFileName = `${user.id}/${videoId}/${randomUUID()}.mp4`;

      const { error: uploadError } = await supabase.storage
        .from("clips")
        .upload(clipFileName, fileBuffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: "video/mp4",
        });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      const { error: updateError } = await supabase
        .from("clips")
        .update({
          start_time,
          end_time,
          file_path: clipFileName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clipId)
        .eq("user_id", user.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to regenerate clip", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

