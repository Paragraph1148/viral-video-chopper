const Groq = require("groq-sdk");

// Initialize Groq (You will need to set your API Key in environment variables)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * The Brain: Fuses Heatmap and Transcript data using LLM intelligence.
 */
async function identifyViralMoments(heatmapSegments, transcriptData) {
  console.log("[Brain] Starting multi-modal fusion...");

  // 1. Extract semantic context from the transcript
  const transcriptText = transcriptData.text;

  // 2. Ask the LLM to identify "High Energy" time ranges based on the text
  // We send the transcript and ask it to return JSON timestamps of interesting parts
  const prompt = `
    Analyze the following video transcript. 
    Identify the top 3 most "viral" or "high-energy" moments. 
    A moment is viral if it contains: high emotion, sudden action, 
    a key revelation, or a dramatic shift in tone.

    Return ONLY a JSON array of objects with "start" and "end" keys.
    Example format: [{"start": 10.5, "end": 25.0}, {"start": 45.0, "end": 60.0}]

    Transcript:
    ${transcriptText.substring(0, 4000)} 
  `;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Using a powerful model for reasoning
      response_format: { type: "json_object" },
    });

    // Parse the LLM response
    const aiAnalysis = JSON.parse(chatCompletion.choices[0].message.content);
    const aiSegments =
      aiAnalysis.segments || aiAnalysis.moments || Object.values(aiAnalysis)[0];

    console.log("[Brain] AI Semantic analysis complete.");

    // 3. Intersection: Compare AI segments with Heatmap segments
    // We look for segments that are "close" to both high heatmap intensity and AI interest
    const finalMoments = [];

    for (const aiSeg of aiSegments) {
      let bestMatch = null;
      let maxScore = 0;

      for (const heatSeg of heatmapSegments) {
        // Calculate a 'proximity score'
        // If the heatmap peak is within the AI's suggested window, it's a high-confidence hit
        const overlap = Math.max(
          0,
          Math.min(aiSeg.end, heatSeg.timestamp + 5) -
            Math.max(aiSeg.start, heatSeg.timestamp - 5),
        );

        if (overlap > 0) {
          const score = overlap * heatSeg.intensity; // Score = Overlap * Heatmap Intensity
          if (score > maxScore) {
            maxScore = score;
            bestMatch = {
              start: aiSeg.start,
              end: aiSeg.end,
              confidence: score,
            };
          }
        }
      }

      if (bestMatch) {
        finalMoments.push(bestMatch);
      } else {
        // Fallback: If AI suggests a moment but heatmap doesn't see it,
        // we still include it but with lower confidence
        finalMoments.push({
          start: aiSeg.start,
          end: aiSeg.end,
          confidence: 0.1,
        });
      }
    }

    console.log(
      "[Brain] Fusion complete. Found",
      finalMoments.length,
      "high-confidence moments.",
    );
    return finalMoments;
  } catch (error) {
    console.error("[Brain] Error during fusion:", error.message);
    // Fallback to heatmap only if AI fails
    return heatmapSegments.map((h) => ({
      start: h.timestamp,
      end: h.timestamp + 30,
      confidence: 0.5,
    }));
  }
}

module.exports = { identifyViralMoments };
