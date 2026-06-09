// backend/ai/generators/sketch_utils.js

/**
 * Convertit un sketch 2D (points dans le plan XZ) en une primitive.
 * NOTE : Actuellement, la primitive polygon_extrude n'est pas entièrement supportée.
 * On utilise une primitive "box" avec des dimensions approximatives pour la démonstration.
 * Pour un vrai support, il faudra étendre primitiveToHelixNode dans semantic_to_helixplan.js
 * pour accepter un paramètre "points" et générer un polygone extrudé.
 *
 * @param {Array<Array<number>>} sketchPoints - Liste de points [x, z].
 * @param {number} height - Hauteur d'extrusion.
 * @param {boolean} [closed=true] - Fermeture du contour (non utilisé pour la boîte).
 * @returns {object} Une primitive HelixPlan (boîte approximative pour l'instant).
 */
function createExtrudedPrimitive(sketchPoints, height, closed = true) {
  if (!sketchPoints || sketchPoints.length < 3) {
    throw new Error("Le sketch doit contenir au moins 3 points.");
  }

  // Calculer les dimensions approximatives (bounding box)
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of sketchPoints) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[1]);
    maxZ = Math.max(maxZ, p[1]);
  }
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Créer une boîte approximative (pour démonstration)
  return {
    type: "box",
    operation: "add",
    params: {
      width: width,
      depth: depth,
      height: height
    },
    position: [centerX, 0, centerZ]
  };
}

module.exports = { createExtrudedPrimitive };
