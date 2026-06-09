// HelixForge 3.0 — Route pour slicing STL → G‑code

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sliceStl } = require("@cad/slicing/slicer");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/slice", upload.single("stl"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier STL" });
    const stlPath = req.file.path;
    const outDir = path.join("models", "gcode");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const gcodePath = path.join(outDir, `${path.basename(stlPath, ".stl")}.gcode`);
    await sliceStl(stlPath, gcodePath);
    fs.unlinkSync(stlPath);
    const relative = path.relative(process.cwd(), gcodePath).replace(/\\/g, "/");
    res.json({ gcode: relative });
  } catch (err) {
    console.error("Slicing error:", err);
    res.status(500).json({ error: "Erreur slicing" });
  }
});

router.post("/slice-from-path", async (req, res) => {
  try {
    const { stlPath } = req.body;
    if (!stlPath || !fs.existsSync(stlPath)) {
      return res.status(400).json({ error: "Fichier STL introuvable" });
    }
    const outDir = path.join("models", "gcode");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const gcodePath = path.join(outDir, `${path.basename(stlPath, ".stl")}.gcode`);
    await sliceStl(stlPath, gcodePath);
    const relative = path.relative(process.cwd(), gcodePath).replace(/\\/g, "/");
    res.json({ gcode: relative });
  } catch (err) {
    console.error("Slicing error:", err);
    res.status(500).json({ error: "Erreur slicing" });
  }
});

module.exports = router;
