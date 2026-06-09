// HelixForge 3.0 — Mémoire contextuelle de Vexa

class VexaMemory {
  constructor() {
    this.conversation = [];
    this.lastAction = null;
    this.currentModel = null;
    this.currentMode = "select";
    this.userPreferences = {};
  }

  addMessage(role, content) {
    this.conversation.push({ role, content, timestamp: Date.now() });
    // Garder seulement les 20 derniers messages
    if (this.conversation.length > 20) this.conversation.shift();
  }

  getContext() {
    return {
      lastAction: this.lastAction,
      currentModel: this.currentModel,
      currentMode: this.currentMode,
      userPreferences: this.userPreferences
    };
  }

  updateLastAction(action) {
    this.lastAction = action;
  }

  setCurrentModel(modelId) {
    this.currentModel = modelId;
  }

  setCurrentMode(mode) {
    this.currentMode = mode;
  }

  setUserPreference(key, value) {
    this.userPreferences[key] = value;
  }
}

module.exports = { VexaMemory };
