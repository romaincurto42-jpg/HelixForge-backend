// Smooth union (Helix 2.0)
function organicSmoothUnion(d1, d2, k = 10) {
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (d2 - d1) / k));
  return d1 * (1 - h) + d2 * h - k * h * (1 - h);
}

// Smooth subtraction (Helix 2.0)
function organicSmoothDifference(d1, d2, k = 10) {
  const h = Math.max(0, Math.min(1, 0.5 - 0.5 * (d2 + d1) / k));
  return d1 * (1 - h) - d2 * h + k * h * (1 - h);
}

// Smooth intersection (Helix 2.0)
function organicSmoothIntersection(d1, d2, k = 10) {
  const h = Math.max(0, Math.min(1, 0.5 - 0.5 * (d2 - d1) / k));
  return d1 * (1 - h) + d2 * h + k * h * (1 - h);
}

module.exports = {
  organicSmoothUnion,
  organicSmoothDifference,
  organicSmoothIntersection
};
