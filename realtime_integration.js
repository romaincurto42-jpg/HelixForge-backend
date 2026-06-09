// HelixForge 3.0 — Intégration en temps réel des services

const { autoCorrect } = require("@root/services/auto_correction_loop");

/**
 * Point d’entrée principal pour la génération avec corrections intégrées.
 * @param {string} prompt - Prompt utilisateur
 * @param {Object} options - Options
 * @returns {Promise<Object>} Plan final, STL, rapport
 */
async function generateWithCorrections(prompt, options = {}) {
  // Étape 1: générer le plan initial (via votre pipeline existant)
  const { generateHelixPlanV4FromPrompt } = require('../helixplan/v4/generate_plan_v4');
  let plan = await generateHelixPlanV4FromPrompt(prompt);

  // Étape 2: exécuter la boucle de correction
  const result = await autoCorrect(plan, options);

  return result;
}

module.exports = { generateWithCorrections };
