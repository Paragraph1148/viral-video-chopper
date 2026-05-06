const Groq = require("groq-sdk");

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * The Brain: Fuses Heatmap and Transcript data using LLM intelligence.
 */
async function identifyViralMoments(heatmapSegments, transcriptData) {
  console.log("[Brain] Starting multi-modal fusion...");

  const transcriptText = transcriptData.text;

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
      model: "llama-3.3-70b-versatile", // Using the confirmed working model
      response_format: { type: "json_object" },
    });

    const aiAnalysis = JSON.parse(chatCompletion.choices[0].message.content);
    const aiSegments =
      aiAnalysis.segments || aiAnalysis.moments || Object.values(aiAnalysis)[0];

    console.log("[Brain] AI Semantic analysis complete.");

    const finalMoments = [];

    for (const aiSeg of aiSegments) {
      let bestMatch = null;
      let maxScore = 0;

      for (const heatSeg of heatmapSegments) {
        const overlap = Math.max(
          0,
          Math.min(aiSeg.end, heatSeg.timestamp + 5) -
            Math.max(aiSeg.start, heatSeg.timestamp - 5),
        );

        if (overlap > 0) {
          const score = overlap * heatSeg.intensity;
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
      "moments.",
    );
    return finalMoments;
  } catch (error) {
    console.error("[Brain] Error during fusion:", error.message);
    return heatmapSegments.map((h) => ({
      start: h.timestamp,
      end: h.timestamp + 30,
      confidence: 0.5,
    }));
  }
}

/**
 * Generates a professional, SEO-optimized blog post using the LLM.
 */
async function generateBlog(transcript, videoDescription) {
  console.log("[Brain] Generating SEO-optimized blog post...");

  const prompt = `
    You are a professional content marketer and SEO expert.
    Task: Write a high-engagement, long-form blog post based on a video's transcript and description.

    Video Description: ${videoDescription || "No description provided."}
    Video Transcript: ${transcript.substring(0, 4000)} 

    Guidelines:
    1. Use a catchy, click-worthy headline.
    2. Use Markdown formatting (H1, H2, bold text, bullet points).
    3. The tone should be engaging and informative.
    4. Include an "Introduction", "Key Takeaways", and a "Conclusion".
    5. Output ONLY the markdown content.
  `;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
    });

    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error("[Brain] Blog Generation Error:", error.message);
    return null;
  }
}

// Exporting BOTH functions so server.js can see them
module.exports = { identifyViralMoments, generateBlog };
