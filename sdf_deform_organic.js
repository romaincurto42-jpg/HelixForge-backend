function organicTwist(p, amount = 30, height = 100) {
  const k = (amount * Math.PI / 180) / height;
  const a = k * p.y;
  const c = Math.cos(a), s = Math.sin(a);
  return {
    x: c * p.x - s * p.z,
    y: p.y,
    z: s * p.x + c * p.z
  };
}

function organicBend(p, angle = 20, radius = 200) {
  const a = angle * Math.PI / 180;
  const theta = p.x / radius;
  return {
    x: radius * Math.sin(theta),
    y: p.y,
    z: p.z + radius * (1 - Math.cos(theta)) * Math.sin(a)
  };
}

function organicInflate(p, offset = 1.0, childFn) {
  return childFn(p) - offset;
}

module.exports = {
  organicTwist,
  organicBend,
  organicInflate
};
