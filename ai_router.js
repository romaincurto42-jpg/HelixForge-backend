const { runIA } = require("ia-core/dist/core/orchestrator.js");

async function classifyPrompt(prompt) {
  try {
    const lowerPrompt = prompt.toLowerCase();
    
    // 🔥 Règle de secours : si le prompt contient des mots de meubles → CAD
    const furnitureKeywords = /table|chaise|bureau|étagère|meuble|pied|plateau|tabouret|armoire|lit/;
    if (furnitureKeywords.test(lowerPrompt)) {
      return {
        task: "Génération CAD",
        needsWeb: false,
        needsCAD: true,
        needsText: false
      };
    }
    
    // 🔥 Règle de secours : formes organiques/artistiques → SDF
    const organicKeywords = /spirale|organique|lisse|blob|sculpture|figurine|vase|décoratif|torsadé|vrillé|anneau|tore|capsule|métaball/;
    if (organicKeywords.test(lowerPrompt)) {
      return {
        task: "Génération SDF",
        needsWeb: false,
        needsCAD: false,
        needsText: false
      };
    }

    const intent = await runIA(prompt);

    return {
      task: intent.task || "unknown",
      needsWeb: intent.needsWeb || false,
      needsCAD: intent.needsCAD || false,
      needsText: intent.needsText || false
    };
  } catch (err) {
    console.error("❌ IA-core: erreur de classification :", err);
    return {
      task: "unknown",
      needsWeb: false,
      needsCAD: false,
      needsText: true
    };
  }
}

module.exports = { classifyPrompt };
