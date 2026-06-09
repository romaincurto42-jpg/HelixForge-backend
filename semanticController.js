const { analyzeSemantic } = require("@root/services/semantic_analyzer");

async function analyze(req, res) {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant" });
    const result = await analyzeSemantic(prompt);
    res.json({ success: true, semantic: result });
  } catch (err) {
    console.error("Semantic analysis error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { analyze };
