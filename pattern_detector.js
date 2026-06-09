// HelixForge 3.0 — Pattern & Symmetry Detector

function detectSymmetry(primitives) {
  const sym = [];

  for (let i = 0; i < primitives.length; i++) {
    for (let j = i + 1; j < primitives.length; j++) {
      const a = primitives[i];
      const b = primitives[j];

      if (!a.position || !b.position) continue;

      const dx = Math.abs(a.position[0] - b.position[0]);
      const dy = Math.abs(a.position[1] - b.position[1]);
      const dz = Math.abs(a.position[2] - b.position[2]);

      if (dx < 1e-3 && dy < 1e-3) {
        sym.push({ axis: "Z", pair: [i, j] });
      }
      if (dx < 1e-3 && dz < 1e-3) {
        sym.push({ axis: "Y", pair: [i, j] });
      }
      if (dy < 1e-3 && dz < 1e-3) {
        sym.push({ axis: "X", pair: [i, j] });
      }
    }
  }

  return sym;
}

function detectPatterns(primitives) {
  const patterns = [];

  for (let i = 0; i < primitives.length - 2; i++) {
    const p1 = primitives[i];
    const p2 = primitives[i + 1];
    const p3 = primitives[i + 2];

    if (!p1.position || !p2.position || !p3.position) continue;

    const d1 = p2.position[0] - p1.position[0];
    const d2 = p3.position[0] - p2.position[0];

    if (Math.abs(d1 - d2) < 1e-3) {
      patterns.push({
        type: "linear_pattern",
        axis: "X",
        spacing: d1,
        elements: [i, i + 1, i + 2]
      });
    }
  }

  return patterns;
}

module.exports = {
  detectSymmetry,
  detectPatterns
};
