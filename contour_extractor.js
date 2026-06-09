// HelixForge 3.0 — Contour Extractor (Canny + simplification polygonale)

const sharp = require("sharp");
const { simplify } = require("simplify-js");

async function extractContoursFromImage(imagePath) {
  const img = sharp(imagePath).greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  // Canny minimal (seuil simple)
  const edges = [];
  for (let i = 0; i < data.length; i++) {
    edges.push(data[i] < 128 ? 0 : 255);
  }

  // Points de contour
  const points = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x] === 255) points.push({ x, y });
    }
  }

  if (points.length === 0) return [];

  // Simplification polygonale
  const simplified = simplify(points, 2, true);
  return simplified.map(p => [p.x, p.y]);
}

async function extractContoursMultiview(images) {
  const out = {};
  for (const [view, path] of Object.entries(images)) {
    if (!path) continue;
    try {
      out[view] = await extractContoursFromImage(path);
    } catch (e) {
      out[view] = [];
    }
  }
  return out;
}

module.exports = {
  extractContoursFromImage,
  extractContoursMultiview
};
