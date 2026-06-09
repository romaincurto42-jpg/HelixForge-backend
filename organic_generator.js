// organic_generator.js — Version B (compatible HelixForge 3.0 strict SDF)
// Aucune primitive ou transformation non supportée
// Aucune multi-shape (préprocesseur strict ne les gère pas encore)

'use strict';

function safeNum(v, def, min = null) {
  let n = Number(v);
  if (!isFinite(n)) n = def;
  if (min !== null && n < min) n = min;
  return n;
}

// ------------------------------------------------------------
// 1. BLOB — forme organique de base
// ------------------------------------------------------------
function genBlob(radius = 40, turbulence = 0.8) {
  const r = safeNum(radius, 40, 0.1);
  const t = safeNum(turbulence, 0.8, 0);

  return [
    `shape sphere(${r})`,
    `noise(${(t * 2).toFixed(2)}, 0.25, true)`,
    `smooth(0.4)`
  ].join("\n");
}

// ------------------------------------------------------------
// 2. CAPSULE — forme allongée organique
// ------------------------------------------------------------
function genCapsule(length = 120, radius = 20) {
  const l = safeNum(length, 120, 0.1);
  const r = safeNum(radius, 20, 0.1);

  return [
    `shape cylinder(${r}, ${l})`,
    `smooth(0.3)`
  ].join("\n");
}

// ------------------------------------------------------------
// 3. FILAMENT — cylindre torsadé organique
// ------------------------------------------------------------
function genFilament(length = 200, radius = 10, twistTurns = 2) {
  const l = safeNum(length, 200, 0.1);
  const r = safeNum(radius, 10, 0.1);
  const t = safeNum(twistTurns, 2, 0);

  return [
    `shape cylinder(${r}, ${l})`,
    `twist(${(t * 180).toFixed(0)}, "ramp")`,
    `noise(0.8, 0.2, true)`,
    `smooth(0.3)`
  ].join("\n");
}

// ------------------------------------------------------------
// 4. MEMBRANE — plaque organique ondulée
// ------------------------------------------------------------
function genMembrane(width = 120, height = 80, noiseAmp = 2) {
  const w = safeNum(width, 120, 0.1);
  const h = safeNum(height, 80, 0.1);
  const a = safeNum(noiseAmp, 2, 0);

  return [
    `shape box(${w}, ${h}, 4)`,
    `noise(${a.toFixed(2)}, 0.35, true)`,
    `smooth(0.3)`
  ].join("\n");
}

// ------------------------------------------------------------
// 5. TENDRIL — vrille organique (simulée sans deform)
// ------------------------------------------------------------
function genTendril(length = 150, radius = 8, waves = 3) {
  const l = safeNum(length, 150, 0.1);
  const r = safeNum(radius, 8, 0.1);
  const w = safeNum(waves, 3, 0);

  return [
    `shape cylinder(${r}, ${l})`,
    `twist(${(w * 180).toFixed(0)}, "ramp")`,
    `noise(1.2, 0.25, true)`,
    `smooth(0.4)`
  ].join("\n");
}

// ------------------------------------------------------------
// 6. SPORE — ellipsoïde simulée via stretch
// ------------------------------------------------------------
function genSpore(radiusX = 25, radiusY = 35, noiseStrength = 1.5) {
  const rx = safeNum(radiusX, 25, 0.1);
  const ry = safeNum(radiusY, 35, 0.1);
  const ns = safeNum(noiseStrength, 1.5, 0);

  return [
    `shape sphere(${rx})`,
    `stretch("Y", ${(ry / rx).toFixed(2)})`,
    `noise(${ns.toFixed(2)}, 0.4, true)`,
    `smooth(0.5)`
  ].join("\n");
}

// ------------------------------------------------------------
// 7. STALK — tige renflée (simulée via stretch + noise)
// ------------------------------------------------------------
function genStalk(height = 100, maxRadius = 28) {
  const h = safeNum(height, 100, 0.1);
  const r = safeNum(maxRadius, 28, 0.1);

  return [
    `shape cylinder(${r}, ${h})`,
    `stretch("Y", 1.4)`,
    `noise(1.0, 0.3, true)`,
    `smooth(0.5)`
  ].join("\n");
}

// ------------------------------------------------------------
// EXPORT
// ------------------------------------------------------------
module.exports = {
  genBlob,
  genCapsule,
  genFilament,
  genMembrane,
  genTendril,
  genSpore,
  genStalk
};
