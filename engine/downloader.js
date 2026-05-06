const { execSync } = require("child_process");
const path = require("path");

const DOWNLOAD_DIR = path.join(__dirname, "../downloads");

async function downloadVideo(url) {
  const videoPath = path.join(DOWNLOAD_DIR, `source_${Date.now()}.mp4`);
  console.log(`[Downloader] Downloading low-res source for processing...`);

  // Downloading 480p for speed and efficiency on EC2
  execSync(
    `yt-dlp -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best" --merge-output-format mp4 -o "${videoPath}" ${url}`,
    { stdio: "ignore" }, // Keep console clean
  );

  return videoPath;
}

module.exports = { downloadVideo };
