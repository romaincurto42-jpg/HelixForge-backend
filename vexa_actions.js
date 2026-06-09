// HelixForge 3.0 — Exécution des actions Vexa

class VexaActions {
  constructor(io, viewerState) {
    this.io = io;           // socket.io instance (si utilisée)
    this.viewerState = viewerState; // état partagé du viewer
  }

  async executeAction(action, params) {
    switch (action) {
      case "open_panel":
        this._openPanel(params.panel);
        break;
      case "change_mode":
        this._changeMode(params.mode);
        break;
      case "load_model":
        await this._loadModel(params.url);
        break;
      case "export_stl":
        this._exportStl();
        break;
      case "slice_current":
        this._sliceCurrent();
        break;
      case "view":
        this._setView(params.view);
        break;
      default:
        console.warn(`Action inconnue : ${action}`);
    }
  }

  _openPanel(panel) {
    // Envoyer un message au frontend via socket.io ou WebSocket
    if (this.io) {
      this.io.emit("action", { type: "open_panel", panel });
    }
    console.log(`[Vexa] Ouvrir le panneau : ${panel}`);
  }

  _changeMode(mode) {
    if (this.io) {
      this.io.emit("action", { type: "change_mode", mode });
    }
    console.log(`[Vexa] Changer le mode : ${mode}`);
  }

  async _loadModel(url) {
    if (this.io) {
      this.io.emit("action", { type: "load_model", url });
    }
    console.log(`[Vexa] Charger le modèle : ${url}`);
  }

  _exportStl() {
    if (this.io) {
      this.io.emit("action", { type: "export_stl" });
    }
    console.log("[Vexa] Exporter STL");
  }

  _sliceCurrent() {
    if (this.io) {
      this.io.emit("action", { type: "slice_current" });
    }
    console.log("[Vexa] Lancer le slicing");
  }

  _setView(view) {
    if (this.io) {
      this.io.emit("action", { type: "set_view", view });
    }
    console.log(`[Vexa] Changer la vue : ${view}`);
  }
}

module.exports = { VexaActions };
