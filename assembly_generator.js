// HelixForge 3.0 — Générateur d’assemblage fonctionnel
const path = require('path');
const { runPythonScript } = require("@root/services/python_runner");

const SCRIPT = path.join(__dirname, '../python/functional_assembly_generator.py');

/**
 * Génère un assemblage à partir d’une description textuelle.
 * @param {string} description - Description de l’assemblage (ex: "table avec tiroir")
 * @returns {Promise<Object>} - Assemblage au format JSON (nomenclature, joints, cinématique)
 */
async function generateAssembly(description) {
  const result = await runPythonScript(SCRIPT, [description]);
  return result;
}

module.exports = { generateAssembly };
