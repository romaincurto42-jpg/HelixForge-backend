// HelixForge 3.0 — Pipeline d’import (STL, images, etc.)

const { imageToGeometry } = require("@ai/vision/image_to_geometry");
const { helixPlanToStl } = require("@root/services/pipeline/cad_pipeline");

async function importFromImages(images, intent = {}) {
  const plan = await imageToGeometry(images, intent);
  const stlPath = await helixPlanToStl(plan);
  return { plan, stlPath };
}

async function importFromStl(stlPath) {
  const { analyzeMesh, loadSTL } = require("@cad/reverse/mesh_analyzer");
  const { detectPrimitivesFromClusters } = require("@cad/reverse/primitive_detector");
  const { primitivesToHelixPlan } = require("@cad/reverse/plan_reconstructor");

  const { geometry, clusters } = analyzeMesh(stlPath);
  const primitives = detectPrimitivesFromClusters(geometry, clusters);
  const plan = primitivesToHelixPlan(primitives);
  return plan;
}

module.exports = {
  importFromImages,
  importFromStl
};
