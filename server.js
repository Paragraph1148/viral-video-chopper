require("dotenv").config(); // Load .env at the very top
const fastify = require("fastify")({ logger: true });
const path = require("path");

// Import the specialized modules
const { getHeatmapSegments } = require("./engine/heatmap");
const { getTranscript } = require("./engine/transcriber");
const { identifyViralMoments } = require("./engine/processor");
const { cutClips } = require("./engine/cutter");
const { downloadVideo } = require("./engine/downloader"); // We will create this tiny helper

/**
 * THE VIRAL CHOPPER PIPELINE
 * 1. Heatmap Analysis (User Behavior)
 * 2. Transcription (Content Context)
 * 3. Brain Fusion (Multi-modal Intersection)
 * 4. Video Processing (FFmpeg Execution)
 */
fastify.post("/api/chop", async (request, reply) => {
  const { url } = request.body;

  if (!url) {
    return reply.status(400).send({ error: "URL is required" });
  }

  try {
    console.log(`\n🚀 Starting Pipeline for: ${url}`);

    // PHASE 1: Heatmap Extraction
    const heatmapWindows = await getHeatmapSegments(url);
    if (heatmapWindows.length === 0) {
      return reply.status(404).send({ error: "No heatmap data available." });
    }

    // PHASE 2: Transcription (Subtitles -> Whisper)
    // We need the video path for Whisper, so we download it first
    const videoPath = await downloadVideo(url);
    const transcriptData = await getTranscript(videoPath, url);

    // PHASE 3: The Brain (Fusion)
    // We pass the heatmap points and the transcript to the LLM
    const viralMoments = await identifyViralMoments(
      heatmapWindows,
      transcriptData,
    );

    if (viralMoments.length === 0) {
      return reply
        .status(404)
        .send({ error: "Brain could not identify any viral moments." });
    }

    // PHASE 4: The Cutter
    const clips = await cutClips(videoPath, viralMoments);

    // PHASE 5: Cleanup
    // Remove the large source video to save EC2 storage/costs
    try {
      const fs = require("fs");
      fs.unlinkSync(videoPath);
      console.log("[Cleanup] Source video removed.");
    } catch (e) {
      console.warn("[Cleanup] Failed to remove source video:", e.message);
    }

    // SUCCESS RESPONSE
    return {
      success: true,
      metadata: {
        url,
        clip_count: clips.length,
        transcription_source: transcriptData.source,
      },
      data: clips.map((p) => ({
        local_path: p,
        filename: path.basename(p),
      })),
    };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: "Pipeline Execution Failed",
      details: error.message,
    });
  }
});

// Start Server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log(`\n✅ Viral Chopper Production API is LIVE`);
    console.log(`🔗 Endpoint: http://localhost:3000/api/chop`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
