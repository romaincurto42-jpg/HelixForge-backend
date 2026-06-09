// backend/cad/brep/opencascade_wrapper.js

let occ = null;

async function initOpenCASCADE() {
  if (occ) return occ;

  // Chargement du module WebAssembly OpenCASCADE.js
  const oc = require("opencascade.js");

  // oc() retourne une promesse qui résout le module initialisé
  occ = await oc();

  console.log("✅ OpenCASCADE.js initialisé");
  return occ;
}

module.exports = { initOpenCASCADE };
