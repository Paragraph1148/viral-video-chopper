// const { execSync } = require("child_process");
// const fs = require("fs");

// /**
//  * Cuts video clips using FFmpeg based on provided time windows.
//  */
// async function cutClips(videoPath, windows) {
//   console.log(`[Cutter] Cutting ${windows.length} clips...`);
//   const clipPaths = [];

//   for (let i = 0; i < windows.length; i++) {
//     const window = windows[i];
//     const clipName = `clip_${Date.now()}_${i + 1}.mp4`;
//     const clipPath = `${require("path").join(__dirname, "../clips", clipName)}`;

//     const start = parseFloat(window.start);
//     const end = parseFloat(window.end);
//     const duration = (end - start).toFixed(2);

//     console.log(
//       `   [Cutter] Processing clip ${i + 1}: ${start}s to ${end}s (${duration}s)`,
//     );

//     try {
//       // -ss before -i for fast seeking
//       // -t for duration
//       // -avoid_negative_ts make_zero for sync stability
//       execSync(
//         `ffmpeg -y -ss ${start} -i "${videoPath}" -t ${duration} -c:v libx264 -c:a aac -avoid_negative_ts make_zero "${clipPath}" -loglevel error`,
//       );

//       // Verify file is not empty
//       const stats = fs.statSync(clipPath);
//       if (stats.size > 1000) {
//         clipPaths.push(clipPath);
//         console.log(`   ✅ Clip ${i + 1} created successfully.`);
//       } else {
//         console.warn(`   ⚠️ Clip ${i + 1} was too small, skipping.`);
//       }
//     } catch (error) {
//       console.error(`   ❌ Failed to cut clip ${i + 1}:`, error.message);
//     }
//   }

//   return clipPaths;
// }

// module.exports = { cutClips };
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Cuts video clips using FFmpeg based on provided time windows.
 */
async function cutClips(videoPath, windows) {
  console.log(`[Cutter] Cutting ${windows.length} clips...`);
  const clipPaths = [];

  // 1. CRITICAL: Force create the directory right here to be 100% sure
  const clipsDir = path.join(__dirname, "../clips");
  if (!fs.existsSync(clipsDir)) {
    console.log(`[Cutter] Creating missing directory: ${clipsDir}`);
    fs.mkdirSync(clipsDir, { recursive: true });
  }

  for (let i = 0; i < windows.length; i++) {
    const window = windows[i];
    const clipName = `clip_${Date.now()}_${i + 1}.mp4`;
    const clipPath = path.join(clipsDir, clipName);

    const start = parseFloat(window.start);
    const end = parseFloat(window.end);
    const duration = (end - start).toFixed(2);

    console.log(
      `   Attempting to cut: Start ${start}, End ${end}, Duration ${duration}s`,
    );

    try {
      // 2. Use double quotes around paths to handle any potential spaces in filenames
      // 3. We use -y to overwrite if exists
      const command = `ffmpeg -y -ss ${start} -i "${videoPath}" -t ${duration} -c:v libx264 -c:a aac -avoid_negative_ts make_zero "${clipPath}" -loglevel error`;

      execSync(command);

      // Verify file existence and size
      if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 1000) {
        clipPaths.push(clipPath);
        console.log(`   ✅ Created: ${clipName} (${duration}s)`);
      } else {
        throw new Error("File was not created or is too small");
      }
    } catch (e) {
      console.error(`   ❌ Failed to cut clip ${i + 1}: ${e.message}`);
    }
  }

  return clipPaths;
}

module.exports = { cutClips };
