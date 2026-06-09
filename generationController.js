const { generateHelixPlanV4FromPrompt } = require('../../../helixplan/v4/generate_plan_v4');
const { helixPlanToStl } = require("@root/services/pipeline/cad_pipeline");

async function generateFromPrompt(req, res) {
    try {
        const { prompt, currentPlan } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt manquant" });
        }

        console.log("📥 Backend a reçu currentPlan :", currentPlan ? "OUI" : "NON");

        // 🔥 Reconstruction de sécurité si le plan est incomplet (pour compatibilité)
        let safeCurrentPlan = currentPlan || null;

        if (safeCurrentPlan && !safeCurrentPlan.semantic) {
            if (safeCurrentPlan.primitives) {
                console.warn("⚠️ Reconstruction de semantic à partir de primitives (côté contrôleur)");
                safeCurrentPlan.semantic = { primitives: safeCurrentPlan.primitives };
            }
        }

        if (safeCurrentPlan && safeCurrentPlan.semantic && !safeCurrentPlan.semantic.primitives) {
            if (safeCurrentPlan.primitives) {
                console.warn("⚠️ Reconstruction de semantic.primitives à partir de primitives (côté contrôleur)");
                safeCurrentPlan.semantic.primitives = safeCurrentPlan.primitives;
            }
        }

        if (safeCurrentPlan) {
            console.log("🟦 Mode édition activé (plan valide reçu)");
        }

        // 🔥 Passage correct du currentPlan au générateur
        const plan = await generateHelixPlanV4FromPrompt(prompt, {
            currentPlan: safeCurrentPlan
        });

        // Génération STL
        const stlPath = await helixPlanToStl(plan);

        // Réponse complète
        return res.json({
            success: true,
            stlPath,
            plan   // 🔥 On renvoie le nouveau plan (avec semantic à jour)
        });

    } catch (err) {
        console.error("❌ Erreur generateFromPrompt :", err);
        return res.status(500).json({ error: err.message });
    }
}

module.exports = { generateFromPrompt };
