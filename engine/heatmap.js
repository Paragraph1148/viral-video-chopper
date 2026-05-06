const { execSync } = require("child_process");

/**
 * Fetches YouTube heatmap data and returns normalized viral segments.
 */
async function getHeatmapSegments(url) {
  try {
    console.log(`[Heatmap] Fetching data for: ${url}`);

    // Use yt-dlp to get the heatmap JSON
    const output = execSync(`yt-dlp --print "%(heatmap)j" ${url}`, {
      encoding: "utf8",
    }).trim();

    if (!output || output === "None") {
      console.warn("[Heatmap] No heatmap data available for this video.");
      return [];
    }

    const heatmap = JSON.parse(output);

    // Sort by intensity (value) descending
    const sorted = heatmap.sort((a, b) => b.value - a.value);

    // We take the top 5 highest intensity points as potential "seed" timestamps
    return sorted.slice(0, 5).map((point) => ({
      timestamp: Number(point.start_time) || Number(point.end_time),
      intensity: point.value,
    }));
  } catch (error) {
    console.error("[Heatmap] Error:", error.message);
    return [];
  }
}

module.exports = { getHeatmapSegments };
