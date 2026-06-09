// sdf_router.js — Sélectionne l’évaluateur STRICT / ORGANIC / ARTISTIC

console.log("🔧 SDF ROUTER CHARGÉ");

const { createStrictOptimizedEvaluator } = require("./sdf_evaluator_strict_opt");
const { createOrganicOptimizedEvaluator } = require("./sdf_evaluator_organic_opt_v3");
const { createArtisticEvaluatorFromGraph } = require("./sdf_evaluator_artistic");

function createEvaluatorFromGraph(graph, mode) {
    console.log("[SDF_ROUTER] Mode demandé =", mode);

    // Normalisation : accepter root OU rootNode
    const root = graph.root || graph.rootNode;

    if (!graph || !graph.nodes || !root) {
        console.error("[SDF_ROUTER] Graph reçu =", graph);
        throw new Error("Graph invalide : root ou nodes manquants");
    }

    // On reconstruit un graph propre pour les évaluateurs
    const normalizedGraph = {
        root,
        nodes: graph.nodes
    };

    // Sélection du moteur
    if (mode === "strict") {
        console.log("[SDF_ROUTER] → Evaluateur STRICT");
        return createStrictOptimizedEvaluator(normalizedGraph);
    }

    if (mode === "organic") {
        console.log("[SDF_ROUTER] → Evaluateur ORGANIC");
        return createOrganicOptimizedEvaluator(normalizedGraph);
    }

    if (mode === "creative" || mode === "artistic") {
        console.log("[SDF_ROUTER] → Evaluateur ARTISTIC");
        return createArtisticEvaluatorFromGraph(normalizedGraph);
    }

    console.warn("[SDF_ROUTER] Mode inconnu :", mode);
    throw new Error("Mode SDF inconnu : " + mode);
}

module.exports = { createEvaluatorFromGraph };
