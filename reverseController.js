const multer = require("multer");
const fs = require("fs");
const { analyzeMesh, loadSTL } = require("@cad/reverse/mesh_analyzer");
const { detectPrimitivesFromClusters } = require("@cad/reverse/primitive_detector");
const { primitivesToHelixPlan } = require("@cad/reverse/plan_reconstructor");

const upload = multer({ dest: "uploads/" });

async function reverseStl(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier STL" });
    const stlPath = req.file.path;
    const { geometry, clusters } = analyzeMesh(stlPath);
    const primitives = detectPrimitivesFromClusters(geometry, clusters);
    const plan = primitivesToHelixPlan(primitives);
    fs.unlinkSync(stlPath);
    res.json({ success: true, plan });
  } catch (err) {
    console.error("Reverse error:", err);
    res.status(500).json({ error: "Erreur reverse engineering" });
  }
}

module.exports = {
  reverseStl,
  reverseUpload: upload.single("stl")
};
