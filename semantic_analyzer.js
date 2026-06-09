// HelixForge 3.0 — Analyseur sémantique avancé basé sur l’ontologie
const fs = require('fs');
const path = require('path');
const { callGroq } = require("@root/ai/groq/groq_client");

const ONTOLOGY = JSON.parse(fs.readFileSync(path.join(__dirname, '../ai/semantic/ontology_schema.json'), 'utf8'));
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../ai/semantic/semantic_rules.json'), 'utf8'));

/**
 * Analyse un prompt et retourne une intention structurée.
 * @param {string} prompt
 * @returns {Promise<Object>}
 */
async function analyzeSemantic(prompt) {
  const systemPrompt = `
Tu es un analyseur sémantique expert en modélisation 3D.
Voici l’ontologie des objets et les règles sémantiques :

ONTOLOGIE (extrait) :
${JSON.stringify(ONTOLOGY, null, 2)}

RÈGLES SÉMANTIQUES (extrait) :
${JSON.stringify(RULES, null, 2)}

Extrais du prompt suivant une intention structurée au format JSON.
Inclus : catégorie, type, dimensions, matériaux, style, contraintes, relations spatiales, sous‑composants, etc.
Réponds uniquement en JSON.

Prompt : "${prompt}"
`;

  const response = await callGroq(systemPrompt, 'analysis');
  const cleaned = response.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { analyzeSemantic };
