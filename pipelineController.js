// backend/controllers/pipelineController.js

const { generateWithCorrections } = require("@root/services/realtime_integration");

async function fullPipeline(req, res) {
  try {
    const { prompt, currentPlan, options } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt manquant' });
    }

    console.log("📥 Pipeline a reçu currentPlan :", currentPlan ? "OUI" : "NON");

    // ------------------------------------------------------------
    // 🔥 Reconstruction de sécurité (comme dans generationController)
    // ------------------------------------------------------------
    let safeCurrentPlan = currentPlan || null;

    if (safeCurrentPlan && !safeCurrentPlan.semantic) {
      if (safeCurrentPlan.primitives) {
        console.warn("⚠️ Reconstruction de semantic à partir de primitives (pipeline)");
        safeCurrentPlan.semantic = { primitives: safeCurrentPlan.primitives };
      }
    }

    if (safeCurrentPlan && safeCurrentPlan.semantic && !safeCurrentPlan.semantic.primitives) {
      if (safeCurrentPlan.primitives) {
        console.warn("⚠️ Reconstruction de semantic.primitives à partir de primitives (pipeline)");
        safeCurrentPlan.semantic.primitives = safeCurrentPlan.primitives;
      }
    }

    if (safeCurrentPlan) {
      console.log("🟦 Mode édition activé dans le pipeline");
    }

    // ------------------------------------------------------------
    // 🔥 Transmission correcte au moteur CAD
    // ------------------------------------------------------------
    const result = await generateWithCorrections(prompt, {
      ...options,
      currentPlan: safeCurrentPlan
    });

    // ------------------------------------------------------------
    // 🔥 Réponse complète
    // ------------------------------------------------------------
    res.json({
      success: true,
      plan: result.plan,
      stlPath: result.stlPath,
      validationReport: result.report,
      iterations: result.iterations
    });

  } catch (err) {
    console.error('Pipeline error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { fullPipeline };
