const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Transcriber Module
 * Logic: 1. Try yt-dlp subtitles -> 2. Fallback to Local Whisper
 */
async function getTranscript(videoPath, url) {
  try {
    console.log("[Transcriber] Attempting to fetch YouTube subtitles...");

    // 1. Attempt to extract existing subtitles using yt-dlp
    // We try to get the subtitles in .vtt format
    try {
      const subtitlePath = path.join(path.dirname(videoPath), "subtitles.vtt");

      // This command tries to download the English subtitles specifically
      execSync(
        `yt-dlp --write-auto-subs --sub-lang en --skip-download --convert-subs vtt -o "${subtitlePath.replace(".vtt", "")}" ${url}`,
      );

      if (fs.existsSync(subtitlePath)) {
        console.log("[Transcriber] YouTube subtitles found! Parsing...");
        const vttContent = fs.readFileSync(subtitlePath, "utf8");
        // For the MVP, we return the raw text.
        // In the next phase, we will parse timestamps from VTT.
        return { source: "youtube", text: vttContent.replace(/<[^>]*>/g, " ") };
      }
    } catch (ytError) {
      console.warn(
        "[Transcriber] YouTube subtitles not found or error downloading. Falling back to Whisper...",
      );
    }

    // 2. Fallback to Local Whisper
    console.log(
      "[Transcriber] Running Local Whisper (this may take a moment)...",
    );
    const pythonScript = path.join(__dirname, "whisper_worker.py");

    // Run the Python script and capture stdout
    const whisperOutput = execSync(`python3 ${pythonScript} "${videoPath}"`, {
      encoding: "utf8",
    });

    const result = JSON.parse(whisperOutput);

    if (result.error) {
      throw new Error(`Whisper Error: ${result.error}`);
    }

    console.log("[Transcriber] Whisper transcription complete.");
    return { source: "whisper", ...result };
  } catch (error) {
    console.error("[Transcriber] Critical Error:", error.message);
    throw error;
  }
}

module.exports = { getTranscript };
