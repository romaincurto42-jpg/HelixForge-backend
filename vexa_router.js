// HelixForge 3.0 — Routeur principal Vexa
// Utilisé par l’API /api/assistant/voice

const axios = require("axios");
const { getSystemPrompt, getActionPrompt } = require("@root/ai/vexa/vexa_prompt");
const { VexaMemory } = require("@root/ai/vexa/vexa_memory");
const { VexaActions } = require("@root/ai/vexa/vexa_actions");

class VexaRouter {
  constructor(io, viewerState) {
    this.memory = new VexaMemory();
    this.actions = new VexaActions(io, viewerState);
    this.groqApiKey = process.env.GROQ_API_KEY;
  }

  async processText(userText, context = {}) {
    // Mettre à jour la mémoire
    this.memory.addMessage("user", userText);
    if (context.lastAction) this.memory.updateLastAction(context.lastAction);
    if (context.currentModel) this.memory.setCurrentModel(context.currentModel);
    if (context.currentMode) this.memory.setCurrentMode(context.currentMode);

    // Construire le prompt
    const systemPrompt = getSystemPrompt();
    const actionPrompt = getActionPrompt(userText, this.memory.getContext());

    // Appeler Groq pour obtenir la réponse et l’action
    const groqResponse = await this._callGroq(systemPrompt, actionPrompt);
    let reply = groqResponse.reply || "Je n’ai pas compris.";
    const action = groqResponse.action;

    // Exécuter l’action si présente
    if (action && action.type) {
      await this.actions.executeAction(action.type, action.params || {});
      this.memory.updateLastAction(action.type);
    }

    // Ajouter la réponse à la mémoire
    this.memory.addMessage("assistant", reply);

    return { reply, action };
  }

  async _callGroq(systemPrompt, userPrompt) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.groqApiKey}`
    };
    const payload = {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.4,
      response_format: { type: "json_object" }
    };

    try {
      const response = await axios.post(url, payload, { headers });
      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (err) {
      console.error("Erreur Groq (Vexa) :", err.message);
      return { reply: "Je n’arrive pas à répondre pour le moment.", action: null };
    }
  }
}

module.exports = { VexaRouter };
