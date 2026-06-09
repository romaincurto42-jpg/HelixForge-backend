// Contrôleur pour le slicing
const { sliceStl } = require("@cad/slicing/slicer");
const { exportGcode } = require("@cad/slicing/gcode_exporter");
const fs = require("fs");
const path = require("path");

async function sliceStlFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier STL" });
    }
    const stlPath = req.file.path;
    const outputDir = path.join("models", "gcode");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const gcodePath = path.join(outputDir, `${path.basename(stlPath, ".stl")}.gcode`);

    await sliceStl(stlPath, gcodePath);
    fs.unlinkSync(stlPath);

    res.json({ success: true, gcode: gcodePath });
  } catch (err) {
    console.error("Slicing error:", err);
    res.status(500).json({ error: "Erreur slicing" });
  }
}

async function sliceFromPath(req, res) {
  try {
    const { stlPath } = req.body;
    if (!stlPath || !fs.existsSync(stlPath)) {
      return res.status(400).json({ error: "Fichier STL introuvable" });
    }
    const outputDir = path.join("models", "gcode");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const gcodePath = path.join(outputDir, `${path.basename(stlPath, ".stl")}.gcode`);

    await sliceStl(stlPath, gcodePath);
    res.json({ success: true, gcode: gcodePath });
  } catch (err) {
    console.error("Slicing error:", err);
    res.status(500).json({ error: "Erreur slicing" });
  }
}

module.exports = {
  sliceStlFile,
  sliceFromPath
};
