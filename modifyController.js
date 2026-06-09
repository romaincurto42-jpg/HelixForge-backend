const { applyModificationToPlan } = require("../../../ai/generators/semantic_to_helixplan");
const { helixPlanToStl } = require("@root/services/pipeline/cad_pipeline");
const { createExtrudedPrimitive } = require("@root/ai/generators/sketch_utils");

/**
 * Valide les paramètres d'une action.
 * @param {string} action - Nom de l'action.
 * @param {object} params - Paramètres à valider.
 * @returns {object} { valid: boolean, error?: string }
 */
function validateActionParams(action, params) {
  switch (action) {
    case "hole":
      if (!params.radius || params.radius <= 0) return { valid: false, error: "Le rayon doit être positif" };
      if (!params.depth || params.depth <= 0) return { valid: false, error: "La profondeur doit être positive" };
      break;
    case "fillet":
    case "chamfer":
      const val = params.radius || params.distance;
      if (!val || val <= 0) return { valid: false, error: "La valeur doit être positive" };
      break;
    case "shell":
      if (!params.thickness || params.thickness <= 0) return { valid: false, error: "L'épaisseur doit être positive" };
      break;
    case "move":
      if (!params.translation || !Array.isArray(params.translation) || params.translation.length !== 3)
        return { valid: false, error: "La translation doit être un tableau [x,y,z]" };
      break;
    case "rotate":
      if (!params.angle) return { valid: false, error: "L'angle est requis" };
      if (params.axis && (!Array.isArray(params.axis) || params.axis.length !== 3))
        return { valid: false, error: "L'axe doit être un tableau [x,y,z]" };
      break;
    case "scale":
      if (!params.scale || !Array.isArray(params.scale) || params.scale.length !== 3)
        return { valid: false, error: "Le facteur d'échelle doit être un tableau [sx,sy,sz]" };
      break;
    case "pattern_linear":
      if (!params.count || params.count < 2) return { valid: false, error: "Le nombre d'occurrences doit être >= 2" };
      if (!params.direction || !Array.isArray(params.direction) || params.direction.length !== 3)
        return { valid: false, error: "La direction doit être un tableau [dx,dy,dz]" };
      break;
    case "pattern_circular":
      if (!params.count || params.count < 2) return { valid: false, error: "Le nombre d'occurrences doit être >= 2" };
      if (!params.radius || params.radius <= 0) return { valid: false, error: "Le rayon doit être positif" };
      break;
    case "extrude":
      if (!params.height || params.height <= 0) return { valid: false, error: "La hauteur d'extrusion doit être positive" };
      if (!params.sketchPoints || !Array.isArray(params.sketchPoints) || params.sketchPoints.length < 3)
        return { valid: false, error: "Le sketch doit contenir au moins 3 points" };
      break;
    case "pushpull":
    case "stretch":
    case "twist":
    case "bend":
    case "taper":
      // Validation basique pour les déformations : un paramètre numérique positif
      const key = action === "pushpull" || action === "stretch" ? "distance" : (action === "twist" ? "angle" : (action === "bend" ? "radius" : "angle"));
      if (!params[key] || params[key] === 0) return { valid: false, error: `Le paramètre ${key} doit être non nul` };
      break;
    default:
      // Pour les actions non listées, pas de validation supplémentaire
      break;
  }
  return { valid: true };
}

/**
 * Convertit une action utilisateur (hole, move, extrude, etc.) en un objet "modification"
 * compréhensible par applyModificationToPlan.
 * @param {object} actionObj - { action, params, target, targets? } (targets pour booléens)
 * @returns {object} Modification object
 */
function actionToModification(actionObj) {
  const { action, params, target, targets } = actionObj;

  let primitive = null;

  // Gestion des booléens multi-sélection
  const isBoolean = ["union", "subtract", "intersect"].includes(action);
  if (isBoolean && targets && targets.length >= 2) {
    const [baseTarget, secondaryTarget] = targets;
    primitive = {
      type: `boolean_${action}`, // union, difference, intersection
      operation: "modify",
      baseTarget,
      secondaryTarget
    };
    return {
      type: "modification",
      action,
      primitive,
      target: baseTarget,
      secondaryTarget,
      params
    };
  }

  // Actions simples
  switch (action) {
    case "hole":
      primitive = {
        type: "cylinder",
        operation: "subtract",
        params: {
          radius: params.radius || 5,
          height: params.depth || 20,
          facets: 32
        },
        position: [0, 0, 0] // À adapter pour centrer sur la face cible
      };
      break;

    case "fillet":
      primitive = {
        type: "fillet",
        operation: "modify",
        params: { radius: params.radius || 3 }
      };
      break;

    case "chamfer":
      primitive = {
        type: "chamfer",
        operation: "modify",
        params: { distance: params.distance || 2 }
      };
      break;

    case "shell":
      primitive = {
        type: "shell",
        operation: "modify",
        params: { thickness: params.thickness || 2 }
      };
      break;

    case "move":
      primitive = {
        type: "transform_translate",
        operation: "modify",
        params: { translation: params.translation || [0, 0, 0] }
      };
      break;

    case "rotate":
      primitive = {
        type: "transform_rotate",
        operation: "modify",
        params: {
          angle: params.angle || 45,
          axis: params.axis || [0, 1, 0]
        }
      };
      break;

    case "scale":
      primitive = {
        type: "transform_scale",
        operation: "modify",
        params: { scale: params.scale || [1, 1, 1] }
      };
      break;

    case "pattern_linear":
      primitive = {
        type: "array_linear",
        operation: "modify",
        params: {
          count: params.count || 3,
          step: params.direction || [10, 0, 0]
        }
      };
      break;

    case "pattern_circular":
      primitive = {
        type: "array_radial",
        operation: "modify",
        params: {
          count: params.count || 4,
          radius: params.radius || 50,
          axis: [0, 0, 1]
        }
      };
      break;

    case "extrude":
      // Utiliser la fonction utilitaire pour créer une primitive polygon_extrude
      primitive = createExtrudedPrimitive(params.sketchPoints, params.height, params.closed !== false);
      break;

    // Déformations
    case "pushpull":
      primitive = {
        type: "pushpull",
        operation: "modify",
        params: { distance: params.distance || 10 }
      };
      break;

    case "stretch":
      primitive = {
        type: "stretch",
        operation: "modify",
        params: { factor: params.factor || 1.2 }
      };
      break;

    case "twist":
      primitive = {
        type: "twist",
        operation: "modify",
        params: { angle: params.angle || 30 }
      };
      break;

    case "bend":
      primitive = {
        type: "bend",
        operation: "modify",
        params: { radius: params.radius || 100 }
      };
      break;

    case "taper":
      primitive = {
        type: "taper",
        operation: "modify",
        params: { angle: params.angle || 15 }
      };
      break;

    default:
      // Action inconnue ou générique
      primitive = {
        type: action,
        operation: "modify",
        params: params || {}
      };
  }

  // Ajouter la cible si présente (face/arête/sommet)
  if (target) {
    primitive.target = target;
  }

  return {
    type: "modification",
    action,
    primitive,
    target,
    params
  };
}

/**
 * Point d'entrée POST /api/modify
 * Applique une modification au plan courant et retourne le STL mis à jour.
 */
async function modify(req, res) {
  try {
    const { action, params, target, targets, currentPlan } = req.body;

    if (!currentPlan) {
      return res.status(400).json({ error: "Aucun plan courant fourni" });
    }

    // Validation des paramètres
    const validation = validateActionParams(action, params);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const actionObj = { action, params, target, targets };
    const modification = actionToModification(actionObj);

    // Appliquer la modification au plan
    const newPlan = applyModificationToPlan(currentPlan, modification);

    // Générer le STL à partir du nouveau plan
    const stlPath = await helixPlanToStl(newPlan);

    // Retourner le STL et le plan mis à jour
    res.json({
      success: true,
      stlPath,
      plan: newPlan
    });
  } catch (err) {
    console.error("Erreur dans /api/modify :", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { modify };
