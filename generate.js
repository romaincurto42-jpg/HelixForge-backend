const express = require("express");
const { generateHelixPlanV4FromPrompt } = require("@helixplan/v4/generate_plan_v4");
const { helixPlanToScad } = require("@cad/scad/scad_engine");
const { scadToStl } = require("@cad/stl/stl_engine");
const fs = require("fs");
const path = require("path");

const router = express.Router();

router.post("/from-prompt", async (req, res) => {
  try {
    const { prompt, meshing } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant" });

    const plan = await generateHelixPlanV4FromPrompt(prompt);
    const scadCode = helixPlanToScad(plan);
    const scadDir = path.join("models", "generated");
    if (!fs.existsSync(scadDir)) fs.mkdirSync(scadDir, { recursive: true });
    const scadPath = path.join(scadDir, `prompt_${Date.now()}.scad`);
    fs.writeFileSync(scadPath, scadCode);

    // scadToStl retourne directement une URL comme "/models/generated/cache/...stl"
    const stlUrlPath = await scadToStl(scadCode, { quality: meshing?.quality || "medium" });

    res.json({ stlPath: stlUrlPath });
  } catch (err) {
    console.error("Erreur génération prompt:", err);
    res.status(500).json({ error: "Erreur génération modèle" });
  }
});

module.exports = router;
