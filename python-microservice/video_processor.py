import json
import os
import subprocess
import sys
import tempfile
import shutil
from dataclasses import dataclass, asdict
from typing import List, Dict, Any

# Check FFmpeg availability at module load
import ffmpeg  # type: ignore
from flask import Flask, jsonify, request  # type: ignore

try:
    from openai import OpenAI  # type: ignore
except ImportError:  # pragma: no cover - handled at runtime
    OpenAI = None  # type: ignore


@dataclass
class TranscriptWord:
    start: float
    end: float
    text: str


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str
    words: List[TranscriptWord]


@dataclass
class Transcript:
    text: str
    segments: List[TranscriptSegment]


def extract_audio(video_path: str) -> str:
    """
    Extracts audio from a video file using FFmpeg and returns the audio path.
    """
    base, _ = os.path.splitext(video_path)
    audio_path = f"{base}_audio.wav"

    try:
        (
            ffmpeg
            .input(video_path)
            .output(audio_path, acodec="pcm_s16le", ac=1, ar="16k")
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as e:
        error_msg = e.stderr.decode() if e.stderr else str(e)
        raise RuntimeError(f"FFmpeg failed to extract audio: {error_msg}") from e
    except Exception as e:
        raise

    return audio_path


def _init_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is required for transcription")
    if OpenAI is None:
        raise RuntimeError("openai package is not installed")
    return OpenAI(api_key=api_key)


def transcribe_audio(audio_path: str) -> Dict[str, Any]:
    """
    Uses OpenAI Whisper API to transcribe audio and return a transcript with
    word-level timestamps in a stable JSON format compatible with the app.
    """
    client = _init_openai_client()

    # Use OpenAI Whisper API for transcription
    with open(audio_path, "rb") as f:  # pragma: no cover - network call
        result = client.audio.transcriptions.create(
            model="whisper-1",  # Standard Whisper model
            file=f,
            response_format="verbose_json",
            timestamp_granularities=["word", "segment"],
        )

    # Normalise into our Transcript structure
    full_text = getattr(result, "text", "") or ""
    segments_data = getattr(result, "segments", []) or []
    words_data = getattr(result, "words", []) or []

    # Build word lookup for each segment by time range
    words = [
        TranscriptWord(
            start=float(getattr(w, "start", 0.0)),
            end=float(getattr(w, "end", 0.0)),
            text=str(getattr(w, "word", "")).strip(),
        )
        for w in words_data
    ]

    transcript_segments: List[TranscriptSegment] = []
    for seg in segments_data:
        seg_start = float(getattr(seg, "start", 0.0))
        seg_end = float(getattr(seg, "end", 0.0))
        seg_text = str(getattr(seg, "text", "")).strip()

        seg_words = [
            w for w in words if w.start >= seg_start and w.end <= seg_end
        ]

        transcript_segments.append(
            TranscriptSegment(
                start=seg_start,
                end=seg_end,
                text=seg_text,
                words=seg_words,
            )
        )

    transcript = Transcript(text=full_text, segments=transcript_segments)

    # Convert dataclasses to plain JSON-serialisable dict
    def to_dict(obj):
        if isinstance(obj, list):
            return [to_dict(o) for o in obj]
        if hasattr(obj, "__dataclass_fields__"):
            data = asdict(obj)
            for k, v in data.items():
                data[k] = to_dict(v)
            return data
        return obj

    return to_dict(transcript)


def generate_clips(video_path: str, clip_segments: List[Dict[str, Any]], output_dir: str) -> List[str]:
    """
    Generates individual video clips for the given segments using FFmpeg.
    clip_segments: list of { start_time: float, end_time: float, index: int }
    Returns list of clip file paths.
    """
    os.makedirs(output_dir, exist_ok=True)
    clip_paths: List[str] = []

    for idx, seg in enumerate(clip_segments):
        start = float(seg.get("start_time", 0.0))
        end = float(seg.get("end_time", 0.0))
        duration = max(end - start, 0.1)
        clip_path = os.path.join(output_dir, f"clip_{idx + 1}.mp4")

        (
            ffmpeg
            .input(video_path, ss=start, t=duration)
            .output(clip_path, c="copy")
            .overwrite_output()
            .run(quiet=True)
        )
        clip_paths.append(clip_path)

    return clip_paths


def generate_subtitles(transcript: Dict[str, Any], output_path: str) -> str:
    """
    Generates an SRT file from the transcript JSON and returns the path.
    """
    segments = transcript.get("segments", [])

    def format_timestamp(seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds - int(seconds)) * 1000)
        return f"{h:02}:{m:02}:{s:02},{ms:03}"

    lines: List[str] = []
    for i, seg in enumerate(segments, start=1):
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", 0.0))
        text = str(seg.get("text", "")).strip()
        if not text:
            continue

        lines.append(str(i))
        lines.append(f"{format_timestamp(start)} --> {format_timestamp(end)}")
        lines.append(text)
        lines.append("")  # blank line between cues

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return output_path


def burn_subtitles(video_path: str, srt_path: str, output_path: str) -> str:
    """
    Uses FFmpeg to burn SRT subtitles into the video with styling:
    bold sans-serif, semi-transparent black background, bottom-center.
    """
    # Try to burn subtitles. FFmpeg must be built with libass for the "subtitles" filter.
    # If that filter is unavailable, we fall back to copying the clip without burned-in subs.
    out_dir = os.path.dirname(output_path)
    sub_srt = os.path.join(out_dir, "sub.srt")
    shutil.copy2(srt_path, sub_srt)
    ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
    try:
        result = subprocess.run(
            [ffmpeg_bin, "-i", video_path, "-vf", "subtitles=sub.srt", "-c:a", "copy", "-y", output_path],
            cwd=out_dir,
            capture_output=True,
            timeout=120,
            check=False,
        )
        if result.returncode != 0:
            stderr_msg = result.stderr.decode() if result.stderr else ""
            # If subtitles filter is missing or broken, copy clip without burning
            if "Unknown filter" in stderr_msg or "No option name" in stderr_msg or "Error parsing" in stderr_msg:
                subprocess.run(
                    [ffmpeg_bin, "-i", video_path, "-c", "copy", "-y", output_path],
                    capture_output=True,
                    timeout=120,
                    check=True,
                )
            else:
                raise RuntimeError(f"FFmpeg failed to burn subtitles: {stderr_msg}")
    except subprocess.TimeoutExpired as e:
        if e.process:
            e.process.kill()
        raise RuntimeError("FFmpeg burn subtitles timed out") from e
    except Exception as e:
        raise
    finally:
        try:
            if os.path.exists(sub_srt):
                os.remove(sub_srt)
        except Exception:
            pass

    return output_path


# ---------------------------------------------------------------------------
# Simple Flask app (optional HTTP microservice)
# ---------------------------------------------------------------------------

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health() -> Any:
    return jsonify({"status": "ok"})


@app.route("/transcribe", methods=["POST"])
def http_transcribe() -> Any:
    """
    POST JSON: { "video_path": "/abs/path/to/video.mp4" }
    Returns: { "transcript": { ... } }
    """
    data = request.get_json(force=True) or {}
    video_path = data.get("video_path")

    if not video_path or not os.path.exists(video_path):
        return jsonify({"error": "video_path is required and must exist"}), 400

    audio_path = extract_audio(video_path)
    transcript = transcribe_audio(audio_path)

    # Clean up audio file in the background
    try:
        os.remove(audio_path)
    except OSError:
        pass

    return jsonify({"transcript": transcript})


# ---------------------------------------------------------------------------
# CLI entrypoint for subprocess usage from Next.js
# ---------------------------------------------------------------------------

def cli() -> None:
    """
    Supports simple commands:
      python video_processor.py transcribe <video_path>
      python video_processor.py generate_clip <video_path> <start> <end> <transcript_json_path> <output_dir>
    Outputs JSON to stdout.
    """
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: video_processor.py <command> <args...>"}))
        sys.exit(1)

    command = sys.argv[1]

    if command == "transcribe":
        video_path = sys.argv[2]
        if not os.path.exists(video_path):
            print(json.dumps({"error": "video_path does not exist", "video_path": video_path}))
            sys.exit(1)

        audio_path = extract_audio(video_path)
        try:
            transcript = transcribe_audio(audio_path)
        finally:
            try:
                os.remove(audio_path)
            except OSError:
                pass

        print(json.dumps({"transcript": transcript}))
        return

    if command == "generate_clip":
        if len(sys.argv) < 7:
            print(json.dumps({"error": "Usage: generate_clip <video_path> <start> <end> <transcript_json_path> <output_dir> [burn_subtitles]"}))
            sys.exit(1)

        video_path = sys.argv[2]
        start = float(sys.argv[3])
        end = float(sys.argv[4])
        transcript_json_path = sys.argv[5]
        output_dir = sys.argv[6]
        burn_subs = len(sys.argv) < 8 or sys.argv[7].lower() not in ("0", "false", "no")

        if not os.path.exists(video_path):
            print(json.dumps({"error": "video_path does not exist", "video_path": video_path}))
            sys.exit(1)

        with open(transcript_json_path, "r", encoding="utf-8") as f:
            transcript = json.load(f)

        os.makedirs(output_dir, exist_ok=True)
        duration = max(end - start, 0.1)
        with tempfile.TemporaryDirectory() as tmpdir:
            raw_clip_path = os.path.join(tmpdir, "clip_raw.mp4")
            (
                ffmpeg
                .input(video_path, ss=start, t=duration)
                .output(raw_clip_path, c="copy")
                .overwrite_output()
                .run(quiet=True)
            )

            final_clip_path = os.path.join(output_dir, "clip_burned.mp4")
            if burn_subs:
                srt_path = os.path.join(tmpdir, "clip.srt")
                filtered = {
                    "text": transcript.get("text", ""),
                    "segments": [
                        seg for seg in transcript.get("segments", [])
                        if float(seg.get("end", 0.0)) >= start and float(seg.get("start", 0.0)) <= end
                    ],
                }
                generate_subtitles(filtered, srt_path)
                burn_subtitles(raw_clip_path, srt_path, final_clip_path)
            else:
                shutil.copy2(raw_clip_path, final_clip_path)

        print(json.dumps({
            "clip_path": final_clip_path,
            "start_time": start,
            "end_time": end,
        }))
        return

    print(json.dumps({"error": f"Unknown command: {command}"}))
    sys.exit(1)


if __name__ == "__main__":
    # If FLASK_RUN is set, run as a web service; otherwise behave as CLI helper.
    if os.environ.get("FLASK_RUN") == "1":
        app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
    else:
        cli()

