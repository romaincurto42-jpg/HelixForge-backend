// HelixForge 3.0 — Validateur de topologie manufacturable
const path = require('path');
const fs = require('fs');
const { runPythonScript } = require("@root/services/python_runner");

const SCRIPT = path.join(__dirname, '../python/manufacturable_topology_validator.py');

/**
 * Valide un fichier STL pour une méthode de fabrication donnée.
 * @param {string} stlPath - Chemin absolu du fichier STL
 * @param {string} method - Méthode de fabrication (ex: "FDM_3D_PRINTING")
 * @returns {Promise<Object>} - Rapport de validation
 */
async function validateStl(stlPath, method = 'FDM_3D_PRINTING') {
  // Vérifier que le fichier existe
  if (!fs.existsSync(stlPath)) {
    throw new Error(`Fichier STL introuvable: ${stlPath}`);
  }

  // Le script Python reçoit le chemin du STL et la méthode en arguments
  const args = [stlPath, method];
  const result = await runPythonScript(SCRIPT, args);
  return result;
}

module.exports = { validateStl };
