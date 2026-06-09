const multer = require("multer");
const fs = require("fs");
const { importFromImages } = require("@services/pipeline/import_pipeline");

const upload = multer({ dest: "uploads/" });

async function generateFromMultiview(req, res) {
  try {
    const files = req.files || {};
    const images = {};
    ["front","back","left","right","top","bottom"].forEach(v => {
      if (files[v] && files[v][0]) images[v] = files[v][0].path;
    });

    const intent = req.body.intent ? JSON.parse(req.body.intent) : {};
    const { plan, stlPath } = await importFromImages(images, intent);

    // Nettoyage des fichiers uploadés (ignorer les erreurs)
    for (const p of Object.values(images)) {
      if (p) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {
          console.warn(`Impossible de supprimer ${p}:`, e.message);
          // On ignore, le fichier sera nettoyé plus tard par le système
        }
      }
    }

    res.json({ success: true, stlPath, plan });
  } catch (err) {
    console.error("Vision error:", err);
    res.status(500).json({ error: "Erreur reconstruction multivue" });
  }
}

module.exports = {
  generateFromMultiview,
  multiviewUpload: upload.fields([
    { name: "front" }, { name: "back" }, { name: "left" },
    { name: "right" }, { name: "top" }, { name: "bottom" }
  ])
};
