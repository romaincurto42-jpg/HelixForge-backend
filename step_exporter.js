// HelixForge 3.0 — Export STEP (placeholder, à compléter avec OpenCASCADE)

const path = require('path');

/**
 * Exporte un HelixPlan vers STEP.
 * @param {Object} plan - Plan HelixPlan
 * @param {string} outputPath - Chemin de sortie (.step)
 * @returns {Promise<string>} - Chemin du fichier généré
 */
async function exportToStep(plan, outputPath) {
  console.warn('[STEP Exporter] Export vers STEP non encore implémenté. Utilisation de placeholder.');
  // Simuler une écriture (fichier vide)
  const fs = require('fs');
  const dummyContent = '// Placeholder STEP file\n';
  fs.writeFileSync(outputPath, dummyContent);
  return outputPath;
}

module.exports = { exportToStep };
