// HelixForge 3.0 — Pipeline intégré avec Python
// Ce service peut être utilisé pour remplacer ou enrichir le pipeline CAD existant
const { applyDimensionalConstraints } = require("@root/services/dimensional_precision");
const { validateStl } = require("@root/services/topology_validator");
const { generateAssembly } = require("@root/services/assembly_generator");

async function processCADPlan(plan, stlPath) {
  // 1) Ajuster les dimensions avec contraintes de précision
  const precisionResult = await applyDimensionalConstraints(plan);
  const adjustedPlan = { ...plan, ...precisionResult.dimensions };

  // 2) Valider le STL produit
  const validationReport = await validateStl(stlPath, 'FDM_3D_PRINTING');
  const isManufacturable = validationReport.validation_summary?.manufacturable === true;

  // 3) Optionnel : si l’objet est un assemblage, on peut régénérer avec le générateur d’assemblage
  let assemblyData = null;
  if (plan.assembly && plan.assembly.description) {
    assemblyData = await generateAssembly(plan.assembly.description);
  }

  return {
    adjustedPlan,
    validationReport,
    isManufacturable,
    assemblyData
  };
}

module.exports = { processCADPlan };
