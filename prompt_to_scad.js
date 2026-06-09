// HelixForge 2.0 — Wrapper Prompt → HelixPlan v4 → SCAD (CAD + SDF + BOSL2)

const { generateHelixPlanV4FromPrompt } = require("../../helixplan/v4/generate_plan_v4");
const { helixPlanToScad } = require("@root/cad/scad/scad_engine");

async function generateScadFromPrompt(prompt, options = {}) {
  const plan = await generateHelixPlanV4FromPrompt(prompt);
  const scad = helixPlanToScad(plan, {
    emitCall: options.emitCall ?? true,
    defaults: options.defaults ?? {},
    transformOrder: options.transformOrder ?? ["scale", "rotate", "translate"],
    // 🔁 Forcer l'export STL pour les nœuds SDF
    enableSdfStlExport: true,
    sdfBounds: options.sdfBounds,
    sdfResolution: options.sdfResolution ?? 64,
    sdfOutputDir: options.sdfOutputDir
  });
  return { plan, scad };
}

module.exports = { generateScadFromPrompt };
