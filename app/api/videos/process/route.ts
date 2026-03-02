import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { tmpdir } from "os";
import { join } from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import type { Transcript } from "@/lib/types/video";
import type { Clip } from "@/lib/types/clip";
import { analyzeTranscriptWithClaude } from "@/lib/ai/clip-analyzer";

async function updateStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  videoId: string,
  status: string,
  errorMessage?: string | null
) {
  await supabase
    .from("videos")
    .update({
      status,
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", videoId);
}

async function callPythonTranscribe(
  videoPath: string,
  openaiKeyOverride?: string | null
): Promise<Transcript> {
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

  return new Promise((resolve, reject) => {
    // Pass environment variables (especially OPENAI_API_KEY) to Python process
    // Ensure PATH includes /opt/homebrew/bin for FFmpeg on macOS
    const pathEnv = process.env.PATH || "";
    const homebrewBin = "/opt/homebrew/bin";
    const openaiKey = openaiKeyOverride ?? process.env.OPENAI_API_KEY;

    const env = {
      ...process.env,
      OPENAI_API_KEY: openaiKey || "",
      PATH: pathEnv.includes(homebrewBin) ? pathEnv : `${homebrewBin}:${pathEnv}`,
    };

    const proc = spawn(pythonPath, [scriptPath, "transcribe", videoPath], {
      env,
    });

    let stdout = "";
    let stderr = "";

    // Set a 5-minute timeout for transcription
    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Transcription timeout after 5 minutes"));
    }, 5 * 60 * 1000);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        return reject(
          new Error(`Python transcribe failed (code ${code}): ${stderr || stdout}`)
        );
      }

      try {
        const parsed = JSON.parse(stdout);
        if (!parsed || !parsed.transcript) {
          throw new Error("No transcript in Python response");
        }
        resolve(parsed.transcript as Transcript);
      } catch (err) {
        reject(err);
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

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

  return new Promise((resolve, reject) => {
    // Pass environment variables to Python process
    // Ensure PATH includes /opt/homebrew/bin for FFmpeg on macOS
    const pathEnv = process.env.PATH || "";
    const homebrewBin = "/opt/homebrew/bin";
    const env = {
      ...process.env,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      PATH: pathEnv.includes(homebrewBin) ? pathEnv : `${homebrewBin}:${pathEnv}`,
    };

    const burnSubs = params.burnSubtitles !== false;
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

    // Set a 3-minute timeout for clip generation
    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Clip generation timeout after 3 minutes"));
    }, 3 * 60 * 1000);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", async (code) => {
      clearTimeout(timeout);
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

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { videoId, burnSubtitles = true } = body as { videoId?: string; burnSubtitles?: boolean };

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: video, error: fetchError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.status !== "uploaded" && video.status !== "error") {
      return NextResponse.json(
        { error: `Cannot process video with status "${video.status}"` },
        { status: 400 }
      );
    }

    await updateStatus(supabase, videoId, "processing");

    // 1. Download video from Supabase Storage to temp directory
    const { data: signed } = await supabase.storage
      .from("videos")
      .createSignedUrl(video.file_path, 60 * 30);

    if (!signed?.signedUrl) {
      await updateStatus(supabase, videoId, "error", "Failed to create signed URL for video");
      return NextResponse.json(
        { error: "Failed to create signed URL for video" },
        { status: 500 }
      );
    }

    const tmpPath = join(tmpdir(), `clack-video-${videoId}.mp4`);

    const fileResp = await fetch(signed.signedUrl);
    if (!fileResp.ok) {
      await updateStatus(
        supabase,
        videoId,
        "error",
        `Failed to download video: ${fileResp.statusText}`
      );
      return NextResponse.json(
        { error: "Failed to download video from storage" },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileResp.arrayBuffer();
    await fs.writeFile(tmpPath, Buffer.from(arrayBuffer));

    try {
      // 2. Extract audio → transcribe with Whisper via Python microservice
      await updateStatus(supabase, videoId, "processing_transcript");
      // eslint-disable-next-line no-console
      console.log(`[${videoId}] Starting transcription for video: ${tmpPath}`);
      async function loadOpenAIKeyFromEnvFiles(): Promise<string | null> {
        const tryParse = (contents: string): string | null => {
          const line = contents
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("OPENAI_API_KEY="));
          if (!line) return null;
          const raw = line.slice("OPENAI_API_KEY=".length).trim();
          return raw.replace(/^['"]|['"]$/g, "") || null;
        };

        const candidates = [join(process.cwd(), ".env.local"), join(process.cwd(), ".env")];
        for (const candidate of candidates) {
          try {
            const contents = await fs.readFile(candidate, "utf8");
            const parsed = tryParse(contents);
            if (parsed) return parsed;
          } catch {
            // ignore missing/unreadable env files
          }
        }
        return null;
      }

      const openaiKeyFromEnv = process.env.OPENAI_API_KEY;
      const openaiKeyFromFile = openaiKeyFromEnv ? null : await loadOpenAIKeyFromEnvFiles();
      const openaiKeyCheck = openaiKeyFromEnv || openaiKeyFromFile;
      if (!openaiKeyCheck) {
        await updateStatus(supabase, videoId, "error", "OPENAI_API_KEY not found in environment. Please restart the dev server after adding it to .env.local");
        return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
      }
      const transcript = await callPythonTranscribe(tmpPath, openaiKeyCheck);
      // eslint-disable-next-line no-console
      console.log(`[${videoId}] Transcription completed, ${transcript.segments?.length || 0} segments`);

      // 3. Store transcript in videos table
      await supabase
        .from("videos")
        .update({
          transcript,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);

      // 4. Send transcript to Claude for analysis
      await updateStatus(supabase, videoId, "processing_analysis");
      const analysis = await analyzeTranscriptWithClaude({
        videoId,
        transcript,
      });

      // 5. For each recommended clip: cut, subtitle, upload, create record
      await updateStatus(supabase, videoId, "processing_clips");

      const clips: Clip[] = [];

      for (const clip of analysis.clips) {
        const { start_time, end_time, title, type, score, reasoning, suggested_caption, suggested_hashtags } =
          clip;

        const { clipPath } = await callPythonGenerateClip({
          videoPath: tmpPath,
          start: start_time,
          end: end_time,
          transcript,
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
          // eslint-disable-next-line no-console
          console.error("Failed to upload clip", uploadError);
          continue;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("clips")
          .insert({
            user_id: user.id,
            video_id: videoId,
            title,
            start_time,
            end_time,
            type,
            score,
            reasoning,
            suggested_caption,
            suggested_hashtags,
            status: "generated",
            file_path: clipFileName,
          })
          .select("*")
          .single();

        if (insertError) {
          // eslint-disable-next-line no-console
          console.error("Failed to insert clip record", insertError);
        } else if (inserted) {
          clips.push(inserted as Clip);
        }
      }

      // 6. Update video status to "clips_ready" only if clips were successfully created
      if (clips.length === 0) {
        await updateStatus(
          supabase,
          videoId,
          "error",
          "No clips were successfully generated. Check server logs for details."
        );
        return NextResponse.json(
          { error: "No clips were generated", clipsCount: 0 },
          { status: 500 }
        );
      }

      await updateStatus(supabase, videoId, "clips_ready");

      return NextResponse.json({
        success: true,
        status: "clips_ready",
        clipsCount: clips.length,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Video processing failed", err);
      await updateStatus(
        supabase,
        videoId,
        "error",
        err instanceof Error ? err.message : "Unknown processing error"
      );
      return NextResponse.json(
        { error: "Video processing failed" },
        { status: 500 }
      );
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Unexpected error in /api/videos/process", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

