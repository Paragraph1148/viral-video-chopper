const { execSync } = require("child_process");
const fs = require("fs");

/**
 * Cuts video clips using FFmpeg based on provided time windows.
 */
async function cutClips(videoPath, windows) {
  console.log(`[Cutter] Cutting ${windows.length} clips...`);
  const clipPaths = [];

  for (let i = 0; i < windows.length; i++) {
    const window = windows[i];
    const clipName = `clip_${Date.now()}_${i + 1}.mp4`;
    const clipPath = `${require("path").join(__dirname, "../clips", clipName)}`;

    const start = parseFloat(window.start);
    const end = parseFloat(window.end);
    const duration = (end - start).toFixed(2);

    console.log(
      `   [Cutter] Processing clip ${i + 1}: ${start}s to ${end}s (${duration}s)`,
    );

    try {
      // -ss before -i for fast seeking
      // -t for duration
      // -avoid_negative_ts make_zero for sync stability
      execSync(
        `ffmpeg -y -ss ${start} -i "${videoPath}" -t ${duration} -c:v libx264 -c:a aac -avoid_negative_ts make_zero "${clipPath}" -loglevel error`,
      );

      // Verify file is not empty
      const stats = fs.statSync(clipPath);
      if (stats.size > 1000) {
        clipPaths.push(clipPath);
        console.log(`   ✅ Clip ${i + 1} created successfully.`);
      } else {
        console.warn(`   ⚠️ Clip ${i + 1} was too small, skipping.`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to cut clip ${i + 1}:`, error.message);
    }
  }

  return clipPaths;
}

module.exports = { cutClips };
