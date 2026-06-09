const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { imageToGeometry } = require("@ai/vision/image_to_geometry");
const { helixPlanToScad } = require("@cad/scad/scad_engine");
const { scadToStl } = require("@cad/stl/stl_engine");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post(
  "/multiview",
  upload.fields([
    { name: "front" }, { name: "back" }, { name: "left" },
    { name: "right" }, { name: "top" }, { name: "bottom" }
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      const images = {};
      ["front","back","left","right","top","bottom"].forEach(v => {
        if (files[v] && files[v][0]) images[v] = files[v][0].path;
      });

      const intent = req.body.intent ? JSON.parse(req.body.intent) : {};
      const helixPlan = await imageToGeometry(images, intent);
      const scadCode = helixPlanToScad(helixPlan);
      const outDir = path.join("models", "generated");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const scadPath = path.join(outDir, `vision_${Date.now()}.scad`);
      fs.writeFileSync(scadPath, scadCode);
      const stlUrlPath = await scadToStl(scadCode, { quality: "medium" });

      res.json({ stlPath: stlUrlPath });
      Object.values(images).forEach(p => fs.unlinkSync(p));
    } catch (err) {
      console.error("Vision error:", err);
      res.status(500).json({ error: "Erreur reconstruction multivue" });
    }
  }
);

module.exports = router;
