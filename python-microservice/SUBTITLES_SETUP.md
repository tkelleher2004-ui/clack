# Burned-in subtitles (optional)

Clips can be generated **with** or **without** burned-in subtitles via the "Burn subtitles into clips" toggle on the video detail page and in the clip regenerate modal.

## How it works

- **Toggle on (default):** The Python script tries to burn SRT subtitles into each clip using FFmpeg’s `subtitles` filter. If your FFmpeg build doesn’t support it (missing libass), the clip is still produced **without** subtitles (fallback copy).
- **Toggle off:** Clips are cut from the video with no subtitle burn (faster, no dependency on libass).

## FFmpeg with libass (optional)

For actual burned-in subtitles, FFmpeg must be built with **libass**.

1. Install libass (if not already installed):
   ```bash
   brew install libass
   ```

2. Use an FFmpeg build that includes libass:
   - Homebrew’s default `ffmpeg` formula does **not** enable libass. You can build FFmpeg from source with `--enable-libass`, or use a third-party tap that provides an FFmpeg build with libass.
   - After installing such an FFmpeg, ensure it’s first on your `PATH` (e.g. `/opt/homebrew/bin` on Apple Silicon).

With libass available, the "Burn subtitles into clips" option will produce clips with subtitles burned in. Without it, clips are still generated; they just won’t have burned-in text.
