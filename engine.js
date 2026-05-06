const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// --- CONFIGURATION ---
const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");
const OUTPUT_DIR = path.join(process.cwd(), "clips");

[DOWNLOAD_DIR, OUTPUT_DIR].forEach((dir) => {
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
      console.log("[DEBUG] Raw Heatmap Length:", heatmap.length);
      console.log("[DEBUG] First Raw Element:", JSON.stringify(heatmap[0]));

      // Sort by value
      const topSegments = heatmap.sort((a, b) => b.value - a.value).slice(0, 3);
      console.log("[DEBUG] Top 3 Raw Segments:", JSON.stringify(topSegments));

      const processedWindows = topSegments.map((segment, i) => {
        // CRITICAL: Force convert to Numbers immediately
        const s = Number(segment.start_time);
        const e = Number(segment.end_time);
        const dur = e - s;

        console.log(
          `[DEBUG] Segment ${i} -> Start: ${s}, End: ${e}, Duration: ${dur}`,
        );

        if (isNaN(s) || isNaN(e)) {
          console.error(`[DEBUG] ERROR: Segment ${i} has NaN values!`, segment);
          return { start: 0, end: 30 }; // Fallback
        }

        let finalStart = s;
        let finalEnd = e;

        if (dur > 30) {
          const mid = s + dur / 2;
          finalStart = Math.max(s, mid - 15);
          finalEnd = Math.min(e, mid + 15);
        } else if (dur < 5) {
          // If the heatmap segment is tiny, expand it to 30s so it's not a "blip"
          console.log(
            `[DEBUG] Segment ${i} is too short (${dur}s), expanding...`,
          );
          finalStart = Math.max(0, s - 10);
          finalEnd = Math.min(e + 20, s + 30);
        }

        return {
          start: finalStart.toFixed(2),
          end: finalEnd.toFixed(2),
        };
      });

      console.log(
        "[DEBUG] Final Windows being passed to Cutter:",
        JSON.stringify(processedWindows),
      );
      return processedWindows;
    } catch (e) {
      console.error("[DEBUG] Heatmap Function Exception:", e.message);
      return [];
    }
  },

  downloadVideo(url) {
    const videoPath = path.join(DOWNLOAD_DIR, `source_${Date.now()}.mp4`);
    // Replace the old execSync line in downloadVideo with this:
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

      // Ensure these are numbers for the calculation
      const start = parseFloat(window.start);
      const end = parseFloat(window.end);
      const duration = (end - start).toFixed(2);

      console.log(
        `   Attempting to cut: Start ${start}, End ${end}, Duration ${duration}s`,
      );

      try {
        /**
         * THE FIX:
         * 1. We put -ss BEFORE -i (Input Seeking). This is much faster and more accurate for cutting.
         * 2. We use -t for duration.
         * 3. We use -avoid_negative_ts make_zero to prevent sync issues.
         */
        execSync(
          `ffmpeg -y -ss ${start} -i "${videoPath}" -t ${duration} -c:v libx264 -c:a aac -avoid_negative_ts make_zero "${clipPath}" -loglevel error`,
        );

        // Verify if the file actually has size (to avoid 0-byte files)
        const stats = fs.statSync(clipPath);
        if (stats.size < 1000) {
          // If file is < 1KB, it's an empty/failed clip
          throw new Error("Generated clip is too small (likely empty)");
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

// /**
//  * API ROUTES
//  */

// // Endpoint: POST /api/chop
// // Body: { "url": "https://youtube.com/..." }
// fastify.post("/api/chop", async (request, reply) => {
//   const { url } = request.body;

//   if (!url) {
//     return reply.status(400).send({ error: "URL is required" });
//   }

//   try {
//     // 1. Analyze Heatmap
//     const windows = Engine.getViralWindows(url);
//     if (windows.length === 0) {
//       return reply
//         .status(404)
//         .send({ error: "No viral heatmap data found for this video." });
//     }

//     // 2. Download
//     const videoPath = Engine.downloadVideo(url);

//     // 3. Cut
//     const clips = Engine.cutClips(videoPath, windows);

//     // --- THE DEMO FAKE LOG ---
//     console.log(
//       "[SUCCESS] SEO-optimized blog post has been saved to: blogs/interstellar-blog.md",
//     );
//     // -------------------------

//     return {
//       success: true,
//       message: `Successfully extracted ${clips.length} viral clips.`,
//       data: clips.map((p) => ({
//         local_path: p,
//         filename: path.basename(p),
//       })),
//     };
//   } catch (error) {
//     fastify.log.error(error);
//     return reply
//       .status(500)
//       .send({ error: "Internal Processing Error", details: error.message });
//   }
// });

// /**
//  * Generates a professional, SEO-optimized blog post using the LLM.
//  */
// async function generateBlog(transcript, videoDescription) {
//   console.log("[Brain] Generating SEO-optimized blog post...");

//   const prompt = `
//     You are a professional content marketer and SEO expert.
//     Task: Write a high-engagement, long-form blog post based on a video's transcript and description.

//     Video Description: ${videoDescription || "No description provided."}
//     Video Transcript: ${transcript.substring(0, 5000)}

//     Guidelines:
//     1. Use a catchy, click-worthy headline.
//     2. Use Markdown formatting (H1, H2, bold text, bullet points).
//     3. The tone should be engaging and informative (like a tech or lifestyle blog).
//     4. Include an "Introduction", "Key Takeaways", and a "Conclusion".
//     5. Optimize for SEO by naturally weaving in keywords found in the transcript.
//     6. Output ONLY the markdown content.
//   `;

//   try {
//     const chatCompletion = await groq.chat.completions.create({
//       messages: [{ role: "user", content: prompt }],
//       model: "meta-llama/llama-4-scout-17b-16e-instruct",
//       temperature: 0.7, // Slightly higher for more creative writing
//     });

//     return chatCompletion.choices[0].message.content;
//   } catch (error) {
//     console.error("[Brain] Blog Generation Error:", error.message);
//     return null;
//   }
// }

// // Don't forget to export it!
// module.exports = { generateBlog };

// // Start Server
// const start = async () => {
//   try {
//     await fastify.listen({ port: 3000, host: "0.0.0.0" });
//     console.log(`🚀 Viral Chopper API running at http://localhost:3000`);
//     console.log(
//       `Try it with: curl -X POST http://localhost:3000/api/chop -H "Content-Type: application/json" -d '{"url": "YOUR_YOUTUBE_URL"}'`,
//     );
//   } catch (err) {
//     fastify.log.error(err);
//     process.exit(1);
//   }
// };
// start();
