// HelixForge 3.0 — Vision Engine Pipeline (multi‑vues → HelixPlan v4)

const { extractContoursMultiview } = require("@root/ai/vision/contour_extractor");
const { estimateDepth } = require("@root/ai/vision/depth_estimator");
const {
  fuseContoursAndDepth,
  detectPrimitives,
  primitivesToHelixPlan
} = require("@root/ai/vision/shape_reconstructor");

async function imageToGeometry(images, intent = {}) {
  // 1) Extraction des contours multi‑vues
  const contours = await extractContoursMultiview(images);

  // 2) Estimation de profondeur (vue front si dispo)
  let depth = null;
  if (images.front) {
    try {
      depth = await estimateDepth(images.front);
    } catch (e) {
      depth = null;
    }
  }

  // 3) Reconstruction volumique
  const reconstruction = fuseContoursAndDepth(contours, depth);

  // 4) Détection de primitives 3D
  const primitives = detectPrimitives(reconstruction, intent);

  // 5) Génération HelixPlan v4
  const plan = primitivesToHelixPlan(primitives, intent);
  return plan;
}

module.exports = { imageToGeometry };
