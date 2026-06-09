// HelixForge 3.0 — Boucle de correction automatique

const { applyDimensionalConstraints } = require("@root/services/dimensional_precision");
const { validateStl } = require("@root/services/topology_validator");
const { adjustPlanDimensions, adjustPlanForTopology } = require("@root/services/plan_adjusters");
const { helixPlanToStl } = require("@root/services/pipeline/cad_pipeline"); // à adapter selon votre structure

const MAX_ITERATIONS = 3;

/**
 * Exécute une boucle de correction sur un plan.
 * @param {Object} plan - Plan HelixPlan initial
 * @param {Object} options - Options (manufacturingMethod, etc.)
 * @returns {Promise<{ plan: Object, stlPath: string, report: Object }>}
 */
async function autoCorrect(plan, options = {}) {
  let currentPlan = plan;
  let lastStlPath = null;
  let finalReport = null;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // 1) Ajuster les dimensions avec précision
    const precisionResult = await applyDimensionalConstraints(currentPlan);
    if (precisionResult.dimensions) {
      currentPlan = adjustPlanDimensions(currentPlan, precisionResult.dimensions);
    }

    // 2) Générer le STL
    const stlPath = await helixPlanToStl(currentPlan, options);
    lastStlPath = stlPath;

    // 3) Valider la topologie
    const report = await validateStl(stlPath, options.manufacturingMethod || 'FDM_3D_PRINTING');

    // 4) Si plus de problèmes critiques, sortir
    if (report.validation_summary.critical === 0) {
      finalReport = report;
      break;
    }

    // 5) Sinon, ajuster le plan pour résoudre les problèmes
    currentPlan = adjustPlanForTopology(currentPlan, report);
    finalReport = report;
  }

  return {
    plan: currentPlan,
    stlPath: lastStlPath,
    report: finalReport,
    iterations: MAX_ITERATIONS
  };
}

module.exports = { autoCorrect };
