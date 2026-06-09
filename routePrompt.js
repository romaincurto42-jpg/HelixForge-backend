// backend/ai/prompt/routePrompt.js

const { parseSemantic } =  require("./semantic_parser")
 // remplace l'ancien
const { classifyObject } = require("@root/ai/prompt/object_classifier");

function decideMode(prompt, semantic, classification) {
  const cat = classification.category;
  if (cat === "organic") return "SDF";
  if (cat === "mechanical") return "CAD";
  if (cat === "furniture") return "CAD";
  if (cat === "architecture") return "CAD";
  if (cat === "electronic") return "CAD";
  if (cat === "decorative") {
    if (semantic.style && (semantic.style.includes("smooth") || semantic.style.includes("organique"))) return "SDF";
    return "CAD";
  }
  const p = prompt.toLowerCase();
  if (p.includes("organique") || p.includes("organic") || p.includes("blob")) return "SDF";
  return "CAD";
}

async function routePrompt(prompt) {
  const semantic = await parseSemantic(prompt);
  const classification = await classifyObject(prompt, semantic);
  const mode = decideMode(prompt, semantic, classification);
  return { mode, semantic, classification };
}

module.exports = { routePrompt };
