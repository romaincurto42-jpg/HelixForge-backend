const express = require("express");
const path = require("path");
const fs = require("fs");
const { helixPlanToScad } = require("@cad/scad/scad_engine");
const { scadToStl } = require("@cad/stl/stl_engine");
const { generateSdfStl } = require("@cad/sdf/sdf_stl_generator");

const router = express.Router();

router.post("/from-plan", async (req, res) => {
  try {
    const plan = req.body;
    if (!plan) return res.status(400).json({ error: "Plan JSON manquant" });
    
    let stlUrlPath;
    if (plan.mode === "SDF") {
      console.log("[model] Mode SDF, génération STL via marching cubes");
      stlUrlPath = await generateSdfStl(plan);
    } else {
      const scadCode = helixPlanToScad(plan);
      const outDir = path.join("models", "generated");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const scadPath = path.join(outDir, `plan_${Date.now()}.scad`);
      fs.writeFileSync(scadPath, scadCode);
      stlUrlPath = await scadToStl(scadCode, { quality: "medium" });
    }
    res.json({ stlPath: stlUrlPath });
  } catch (err) {
    console.error("Erreur génération depuis plan:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
