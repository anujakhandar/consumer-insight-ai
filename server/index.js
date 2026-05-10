const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Datastore = require("nedb-promises");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || "AIzaSyB_heZgTd81129mIQArE2qoBAjQOv0PG2c";
const MODEL_CANDIDATES = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.5-flash"
];

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const reportsDb = Datastore.create({
  filename: path.join(dataDir, "reports.db"),
  autoload: true
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const buildPrompt = (productName) => `
Analyze consumer sentiment for "${productName}" and generate realistic market-intelligence style insights.
Return only valid JSON with this exact shape:
{
  "productName": "string",
  "summary": "short paragraph",
  "love": [{"label":"string","percent": number, "emoji":"string"}],
  "hate": [{"label":"string","percent": number, "emoji":"string"}],
  "topRequestedFeatures": [{"feature":"string","mentionsPercent": number}],
  "overallSentimentScore": number,
  "competitor": {"name":"string","comparison":"string","winRatePercent": number},
  "brandHealthScore": number,
  "trend": {"direction":"rising|declining|stable","changePercent": number,"insight":"string"},
  "targetAudience": [{"segment":"string","percent": number}],
  "pricePerception": {"valueForMoneyScore": number,"insight":"string"},
  "recommendations": ["string","string","string"],
  "emotions": [{"emotion":"Joy","percent": number},{"emotion":"Anger","percent": number},{"emotion":"Surprise","percent": number},{"emotion":"Disgust","percent": number}]
}
Constraints:
- Keep scores in bounds: overallSentimentScore(0-10), brandHealthScore(0-100), valueForMoneyScore(0-10)
- Percentages should be believable and mostly sum near 100 where relevant
- competitor should be a real or plausible category competitor
- Keep output compact and JSON-only.
`;

const normalizeInsight = (data, productName) => {
  const safe = data || {};
  return {
    productName: safe.productName || productName,
    summary:
      safe.summary ||
      `${productName} shows mixed but improving sentiment, with clear opportunities for product refinement.`,
    love: safe.love || [],
    hate: safe.hate || [],
    topRequestedFeatures: safe.topRequestedFeatures || [],
    overallSentimentScore: Number(safe.overallSentimentScore ?? 6.8),
    competitor: safe.competitor || {
      name: "Primary Competitor",
      comparison: "Comparable demand, slightly lower retention perception.",
      winRatePercent: 52
    },
    brandHealthScore: Number(safe.brandHealthScore ?? 70),
    trend: safe.trend || {
      direction: "stable",
      changePercent: 1.2,
      insight: "Conversation volume remains steady with occasional spikes."
    },
    targetAudience: safe.targetAudience || [],
    pricePerception: safe.pricePerception || {
      valueForMoneyScore: 6.9,
      insight: "Customers find value acceptable with room for stronger packaging."
    },
    recommendations: safe.recommendations || [],
    emotions: safe.emotions || []
  };
};

const extractJson = (raw) => {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Invalid JSON response from Gemini");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
};

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/api/analyze", async (req, res) => {
  const productName = req.body?.productName?.trim();
  if (!productName) {
    return res.status(400).json({ error: "productName is required" });
  }
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on server" });
  }

  const payload = {
    contents: [{ role: "user", parts: [{ text: buildPrompt(productName) }] }]
  };

  let lastError = null;
  for (const model of MODEL_CANDIDATES) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404) {
          lastError = new Error(`Model unavailable: ${model}`);
          continue;
        }
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No content from Gemini API");
      }

      return res.json({
        result: normalizeInsight(extractJson(text), productName),
        meta: { modelUsed: model }
      });
    } catch (error) {
      lastError = error;
    }
  }

  console.error("Gemini analyze failed:", lastError?.message || "unknown error");
  return res.status(502).json({
    error:
      "Unable to fetch analysis from Gemini. Check API key restrictions and model access for your project."
  });
});

app.post("/api/reports", async (req, res) => {
  const report = req.body?.report;
  if (!report || typeof report !== "object") {
    return res.status(400).json({ error: "report payload is required" });
  }

  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : crypto.randomBytes(6).toString("hex");
  await reportsDb.insert({ _id: id, report, createdAt: Date.now() });
  return res.status(201).json({ id });
});

app.get("/api/reports/:id", async (req, res) => {
  const doc = await reportsDb.findOne({ _id: req.params.id });
  if (!doc) {
    return res.status(404).json({ error: "Report not found" });
  }
  return res.json({ id: doc._id, report: doc.report, createdAt: doc.createdAt });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
