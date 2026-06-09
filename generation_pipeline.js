// backend/services/pipeline/generation_pipeline.js
const { generateHelixPlanV4FromPrompt } = require('../../helixplan/v4/generate_plan_v4');
const { generateSdfStl } = require('../../cad/sdf/sdf_stl_generator');
const { helixPlanToStl } = require("@root/services/pipeline/cad_pipeline");

async function generateModelFromPrompt(prompt, options = {}) {
    const plan = await generateHelixPlanV4FromPrompt(prompt);
    console.log("[generation_pipeline] Mode du plan :", plan.mode);
    
    let stlPath;
    // Détection robuste du mode SDF
    const isSDF = (plan.mode === "SDF") || 
                  (plan.nodes && plan.nodes.some(n => n.node_type === 'sdf_mesher'));
    
    if (isSDF) {
        console.log("✅ Détection SDF, appel direct à generateSdfStl");
        stlPath = await generateSdfStl(plan, options);
    } else {
        console.log("✅ Mode CAD, appel à helixPlanToStl");
        stlPath = await helixPlanToStl(plan, options);
    }
    return { plan, stlPath };
}

module.exports = { generateModelFromPrompt };
