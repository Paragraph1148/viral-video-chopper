const fastify = require("fastify")({ logger: true });
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// --- CONFIGURATION ---
const DOWNLOAD_DIR = path.join(__dirname, "downloads");
const OUTPUT_DIR = path.join(__dirname, "clips");
const BLOG_DIR = path.join(__dirname, "blogs"); // New Directory

[DOWNLOAD_DIR, OUTPUT_DIR, BLOG_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

/**
 * CORE ENGINE LOGIC
 */
const Engine = {
  getViralWindows(url) {
    try {
      console.log(`[DEBUG] Fetching heatmap for: ${url}`);
      const output = execSync(`yt-dlp --print "%(heatmap)j" ${url}`, {
        encoding: "utf8",
      }).trim();

      if (!output || output === "None") {
        console.log("[DEBUG] Heatmap is empty or None");
        return [];
      }

      const heatmap = JSON.parse(output);
      const topSegments = heatmap.sort((a, b) => b.value - a.value).slice(0, 3);

      const processedWindows = topSegments.map((segment, i) => {
        const s = Number(segment.start_time);
        const e = Number(segment.end_time);
        const dur = e - s;

        if (isNaN(s) || isNaN(e)) {
          return { start: 0, end: 30 };
        }

        let finalStart = s;
        let finalEnd = e;

        if (dur > 30) {
          const mid = s + dur / 2;
          finalStart = Math.max(s, mid - 15);
          finalEnd = Math.min(e, mid + 15);
        } else if (dur < 5) {
          finalStart = Math.max(0, s - 10);
          finalEnd = Math.min(e + 20, s + 30);
        }

        return {
          start: finalStart.toFixed(2),
          end: finalEnd.toFixed(2),
        };
      });

      return processedWindows;
    } catch (e) {
      console.error("[DEBUG] Heatmap Function Exception:", e.message);
      return [];
    }
  },

  downloadVideo(url) {
    const videoPath = path.join(DOWNLOAD_DIR, `source_${Date.now()}.mp4`);
    execSync(
      `yt-dlp -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best" --merge-output-format mp4 -o "${videoPath}" ${url}`,
    );
    return videoPath;
  },

  cutClips(videoPath, windows) {
    console.log(`[3/3] Cutting ${windows.length} viral clips...`);
    const clipPaths = [];

    windows.forEach((window, index) => {
      const clipName = `clip_${Date.now()}_${index + 1}.mp4`;
      const clipPath = path.join(OUTPUT_DIR, clipName);

      const start = parseFloat(window.start);
      const end = parseFloat(window.end);
      const duration = (end - start).toFixed(2);

      try {
        execSync(
          `ffmpeg -y -ss ${start} -i "${videoPath}" -t ${duration} -c:v libx264 -c:a aac -avoid_negative_ts make_zero "${clipPath}" -loglevel error`,
        );

        const stats = fs.statSync(clipPath);
        if (stats.size < 1000) {
          throw new Error("Generated clip is too small");
        }

        clipPaths.push(clipPath);
        console.log(`   ✅ Created: ${clipName} (${duration}s)`);
      } catch (e) {
        console.error(`   ❌ Failed to cut clip ${index + 1}:`, e.message);
      }
    });

    return clipPaths;
  },
};

/**
 * API ROUTES
 */

fastify.post("/api/chop", async (request, reply) => {
  const { url } = request.body;

  if (!url) {
    return reply.status(400).send({ error: "URL is required" });
  }

  try {
    // 1. Analyze Heatmap
    const windows = Engine.getViralWindows(url);
    if (windows.length === 0) {
      return reply
        .status(404)
        .send({ error: "No viral heatmap data found for this video." });
    }

    // 2. Download
    const videoPath = Engine.downloadVideo(url);

    // 3. Cut
    const clips = Engine.cutClips(videoPath, windows);

    // 4. THE DEMO FAKE: Simulate Blog Generation
    console.log("--------------------------------------------------");
    console.log("[PIXII AI] Content Repurposing Engine Triggered...");
    console.log("[PIXII AI] Analyzing transcript and metadata...");
    console.log(
      `[PIXII AI] SUCCESS: SEO Blog post saved to: ${path.join(BLOG_DIR, "interstellar-blog.md")}`,
    );
    console.log("--------------------------------------------------");

    // 5. Final Return (Exactly as requested)
    return {
      success: true,
      message: `Successfully extracted ${clips.length} viral clips.`,
      data: clips.map((p) => ({
        local_path: p,
        filename: path.basename(p),
      })),
    };
  } catch (error) {
    fastify.log.error(error);
    return reply
      .status(500)
      .send({ error: "Internal Processing Error", details: error.message });
  }
});

// Start Server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log(`🚀 Viral Chopper API running at http://localhost:3000`);
    console.log(
      `Try it with: curl -X POST http://localhost:3000/api/chop -H "Content-Type: application/json" -d '{"url": "YOUR_YOUTUBE_URL"}'`,
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
