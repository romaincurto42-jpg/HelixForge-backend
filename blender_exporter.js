// HelixForge 3.0 — Export Blender (fonctionnel)

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execPromise = promisify(exec);

const { generateHelixPlanV4FromPrompt } = require("../../helixplan/v4/generate_plan_v4");
const { helixPlanToScad } = require("@root/cad/scad/scad_engine");

/**
 * Exporte un modèle HelixForge vers un fichier .blend.
 * @param {string} prompt - Description textuelle du modèle.
 * @param {string} outputPath - Chemin de sortie du fichier .blend (par défaut "./output.blend").
 * @returns {Promise<string>} - Chemin du fichier .blend généré.
 */
async function exportToBlender(prompt, outputPath = "./output.blend") {
  // 1) Générer le plan HelixPlan
  console.log(`[Blender] Génération du plan pour : "${prompt}"`);
  const plan = await generateHelixPlanV4FromPrompt(prompt);

  // 2) Convertir en SCAD
  const scadCode = helixPlanToScad(plan);
  const tempDir = path.join(__dirname, "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const scadPath = path.join(tempDir, "model.scad");
  const stlPath = path.join(tempDir, "model.stl");
  const pyPath = path.join(tempDir, "import_stl.py");

  fs.writeFileSync(scadPath, scadCode, "utf8");

  // 3) Convertir SCAD → STL avec OpenSCAD
  console.log("[Blender] Conversion SCAD → STL via OpenSCAD");
  try {
    await execPromise(`openscad -o "${stlPath}" "${scadPath}"`);
  } catch (err) {
    throw new Error(`Échec d'OpenSCAD : ${err.message}`);
  }

  if (!fs.existsSync(stlPath)) {
    throw new Error("Le fichier STL n'a pas été généré par OpenSCAD.");
  }

  // 4) Créer un script Python pour Blender
  const blenderScript = `
import bpy
import sys
import os

// Supprimer le cube par défaut
if "Cube" in bpy.data.objects:
    bpy.data.objects.remove(bpy.data.objects["Cube"], do_unlink=True)

// Importer le STL
stl_path = "${stlPath.replace(/\\/g, "/")}"
bpy.ops.import_mesh.stl(filepath=stl_path)

// Sauvegarder le fichier .blend
output_path = "${outputPath.replace(/\\/g, "/")}"
bpy.ops.wm.save_as_mainfile(filepath=output_path)
print(f"Blender file saved to {output_path}")
`;

  fs.writeFileSync(pyPath, blenderScript, "utf8");

  // 5) Appeler Blender en arrière‑plan
  console.log("[Blender] Lancement de Blender pour création du .blend");
  try {
    await execPromise(`blender --background --python "${pyPath}"`);
  } catch (err) {
    throw new Error(`Échec de Blender : ${err.message}`);
  }

  // 6) Nettoyage des fichiers temporaires
  fs.unlinkSync(scadPath);
  fs.unlinkSync(stlPath);
  fs.unlinkSync(pyPath);
  fs.rmdirSync(tempDir); // supprime le dossier s'il est vide (ou utiliser fs.rm avec recursive)

  console.log(`[Blender] Export terminé : ${outputPath}`);
  return outputPath;
}

module.exports = { exportToBlender };
