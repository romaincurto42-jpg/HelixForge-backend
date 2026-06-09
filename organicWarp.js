function organicWarp(p, k = 0.02) {
  return {
    x: p.x + Math.sin(p.y * k * 2.0) * 3.0,
    y: p.y + Math.sin(p.z * k * 1.5) * 2.0,
    z: p.z + Math.sin(p.x * k * 1.2) * 3.0
  };
}

module.exports = { organicWarp };
