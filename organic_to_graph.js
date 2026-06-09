// backend/ai/prompt/organic_to_graph.js
// HF3 — Convertisseur d'expressions SDF linéaires en graphe HF3.
// Format attendu : "sphere(r=1) warp(0.1) warp(0.3) twist(144, 1) warp(0.4) warp(0.3)"
// Produit un graphe chaîné où chaque transformation prend le nœud précédent en input.

// ===============================
// 1. Extraction de la séquence d'appels
// ===============================
function extractCalls(expr) {
    const calls = [];
    // Capture : nom( ... ) – les parenthèses ne sont pas imbriquées ici
    const regex = /([a-zA-Z_][a-zA-Z0-9_]*)\(([^()]*)\)/g;
    let match;
    while ((match = regex.exec(expr)) !== null) {
        calls.push({
            name: match[1],
            args: match[2].trim()
        });
    }
    return calls;
}

// ===============================
// 2. Parse les arguments d'un appel (ex: "r=1" ou "0.1" ou "144, 1")
//    Retourne un objet avec clés/valeurs (positionnelles converties selon mapping)
// ===============================
function parseArguments(argsStr, nodeName) {
    if (!argsStr) return {};
    const parts = argsStr.split(',').map(s => s.trim());
    const result = {};

    // Mapping positionnel par type de nœud
    const positionalMap = {
        sphere: ['r'],
        box: ['size'],
        cylinder: ['r', 'height'],
        torus: ['r1', 'r2'],
        plane: ['y'],
        warp: ['strength'],
        twist: ['angle', 'height'],
        scale: ['sx', 'sy', 'sz'],
        translate: ['tx', 'ty', 'tz'],
        rotate: ['rx', 'ry', 'rz'],
        repeat: ['ox', 'oy', 'oz'],
        mirror: ['axis'],
        elongate: ['ex', 'ey', 'ez'],
        round: ['radius'],
        onion: ['thickness'],
        shell: ['thickness']
    };

    const mapping = positionalMap[nodeName] || [];
    let positionalIdx = 0;

    for (const part of parts) {
        if (part.includes('=')) {
            const [key, value] = part.split('=').map(s => s.trim());
            const num = parseFloat(value);
            result[key] = isNaN(num) ? value : num;
        } else {
            const num = parseFloat(part);
            if (!isNaN(num)) {
                if (positionalIdx < mapping.length) {
                    result[mapping[positionalIdx]] = num;
                } else {
                    result[`arg${positionalIdx}`] = num;
                }
                positionalIdx++;
            }
        }
    }
    return result;
}

// ===============================
// 3. Construction du graphe HF3 à partir d'une séquence d'appels
// ===============================
function organicToGraph(expr) {
    if (!expr || typeof expr !== 'string') {
        return { rootNode: null, nodes: {}, error: 'Expression vide ou invalide' };
    }

    try {
        const calls = extractCalls(expr);
        if (calls.length === 0) {
            return { rootNode: null, nodes: {}, error: 'Aucun appel trouvé' };
        }

        const nodes = {};
        let previousNodeId = null;

        for (let i = 0; i < calls.length; i++) {
            const call = calls[i];
            const nodeId = `node${i}`;
            const params = parseArguments(call.args, call.name);

            const node = { type: call.name, ...params };

            // Si ce n'est pas le premier nœud, il prend en entrée le nœud précédent
            if (previousNodeId !== null) {
                node.input = previousNodeId;
            }

            nodes[nodeId] = node;
            previousNodeId = nodeId;
        }

        return {
            rootNode: previousNodeId,
            nodes
        };
    } catch (err) {
        console.error('[organicToGraph] Erreur:', err.message);
        return { rootNode: null, nodes: {}, error: err.message };
    }
}

// ===============================
// 4. Normalisation (optionnelle, mais gardée pour compatibilité)
// ===============================
function normalizeGraph(graph) {
    if (!graph.nodes || Object.keys(graph.nodes).length === 0) return graph;
    // Déjà normalisé par l'indexation linéaire, mais on reformate juste
    return {
        rootNode: graph.rootNode,
        nodes: graph.nodes
    };
}

module.exports = { organicToGraph, normalizeGraph };
