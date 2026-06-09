// HelixForge 2.0 — Classifieur d’objets basé sur heuristiques simples

const MECHANICAL_HINTS = [
  "support", "bracket", "mount",
  "hinge", "charnière",
  "gear", "engrenage",
  "spacer", "entretoise",
  "plate", "plaque",
  "box", "enclosure", "boîtier", "boitier",
  "mechanical", "mécanique"
];

const FURNITURE_HINTS = [
  "table", "bureau", "desk",
  "chaise", "chair",
  "tabouret", "stool",
  "étagère", "etagere", "shelf",
  "meuble", "furniture"
];

const ARCHITECTURE_HINTS = [
  "maison", "house",
  "building", "immeuble",
  "mur", "wall",
  "toit", "roof",
  "architecture"
];

const ELECTRONIC_HINTS = [
  "pcb", "circuit",
  "boîtier électronique", "electronic case",
  "arduino", "raspberry",
  "module", "capteur", "sensor"
];

const ORGANIC_HINTS = [
  "organique", "organic",
  "blob", "smooth shape",
  "forme lisse", "forme fluide",
  "sdf"
];

const DECORATIVE_HINTS = [
  "vase", "sculpture",
  "décoratif", "decorative",
  "art", "objet d'art",
  "statue"
];

async function classifyObject(prompt, semantic) {
  const p = prompt.toLowerCase();

  function match(hints) {
    return hints.some(h => p.includes(h));
  }

  if (match(MECHANICAL_HINTS)) return { category: "mechanical", confidence: 0.9 };
  if (match(FURNITURE_HINTS)) return { category: "furniture", confidence: 0.9 };
  if (match(ARCHITECTURE_HINTS)) return { category: "architecture", confidence: 0.9 };
  if (match(ELECTRONIC_HINTS)) return { category: "electronic", confidence: 0.9 };
  if (match(ORGANIC_HINTS)) return { category: "organic", confidence: 0.9 };
  if (match(DECORATIVE_HINTS)) return { category: "decorative", confidence: 0.7 };

  if (semantic.style && semantic.style.includes("organique")) {
    return { category: "organic", confidence: 0.6 };
  }

  return { category: "unknown", confidence: 0.3 };
}

module.exports = { classifyObject };
