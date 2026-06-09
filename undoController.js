// backend/api/v1/controllers/undoController.js

const { undoPlan, getCurrentPlan } = require("@root/services/planCache");
const { helixPlanToStl } = require("@root/services/pipeline/cad_pipeline");

/**
 * POST /api/undo
 * Reçoit { objectId } ou { currentPlan } (si objectId non fourni).
 * Retourne le plan précédent et son STL.
 */
async function undo(req, res) {
  try {
    const { objectId, currentPlan } = req.body;

    let plan = null;
    if (objectId) {
      plan = undoPlan(objectId);
      if (!plan) {
        return res.status(404).json({ error: "Aucun historique pour cet objet" });
      }
    } else if (currentPlan && currentPlan.object_id) {
      plan = undoPlan(currentPlan.object_id);
      if (!plan) {
        return res.status(404).json({ error: "Aucun historique" });
      }
    } else {
      return res.status(400).json({ error: "objectId ou currentPlan.object_id requis" });
    }

    const stlPath = await helixPlanToStl(plan);
    res.json({ success: true, stlPath, plan });
  } catch (err) {
    console.error("Erreur undo :", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { undo };
