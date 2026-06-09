// backend/services/rag_generator.js
const { getIndexer } = require("@root/services/rag_indexer");
const { callGroq } = require("@root/ai/groq/groq_client");

function detectModeFromNodes(nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) return "CAD";
    const hasSDF = nodes.some(n => {
        if (!n.node_type) return false;
        if (n.node_type.startsWith("sdf_")) return true;
        return ["sdf_primitive", "sdf_op", "sdf_deform", "sdf_mesher"].includes(n.node_type);
    });
    return hasSDF ? "SDF" : "CAD";
}

function normalizeNodeInputs(node) {
    if (!node.inputs) node.inputs = {};
    if (!node.params) node.params = {};

    // Conversion des champs Groq
    if (node.type && !node.node_type) {
        node.node_type = node.type;
        delete node.type;
    }
    if (node.id && !node.node_id) {
        node.node_id = `${node.id}_prim`;
        delete node.id;
    }
    if (!node.node_id) {
        node.node_id = `${Math.random().toString(36).slice(2, 8)}_node`;
    }

    // Correction des noms
    if (node.node_type === "boolean_cut") node.node_type = "boolean_difference";
    if (node.node_type === "boolean_intersection") node.node_type = "boolean_intersect";

    // Validation du node_type
    const validNodeTypes = [
        "solid_block", "solid_cylinder", "solid_sphere", "solid_cone", "solid_torus",
        "boolean_union", "boolean_difference", "boolean_intersect",
        "transform", "mirror", "array_linear", "array_radial",
        "sdf_primitive", "sdf_op", "sdf_deform", "sdf_mesher"
    ];
    if (!node.node_type || !validNodeTypes.includes(node.node_type)) {
        console.warn(`⚠️ Node ${node.node_id} a node_type invalide: ${node.node_type}. Forcé à "solid_block".`);
        node.node_type = "solid_block";
    }

    // --- Opérations booléennes ---
    const isBinaryOp = ["boolean_union", "boolean_difference", "boolean_intersect"].includes(node.node_type);
    if (isBinaryOp) {
        let childrenArray = null;
        if (node.params?.objects && Array.isArray(node.params.objects)) {
            childrenArray = node.params.objects;
            delete node.params.objects;
        } else if (node.params?.children && Array.isArray(node.params.children)) {
            childrenArray = node.params.children;
            delete node.params.children;
        } else if (node.children && Array.isArray(node.children)) {
            childrenArray = node.children;
            delete node.children;
        } else if (node.objects && Array.isArray(node.objects)) {
            childrenArray = node.objects;
            delete node.objects;
        } else if (node.inputs?.children && Array.isArray(node.inputs.children)) {
            childrenArray = node.inputs.children;
        } else if (node.a && node.b) {
            childrenArray = [node.a, node.b];
            delete node.a;
            delete node.b;
        }

        if (childrenArray && childrenArray.length) {
            node.inputs.children = childrenArray.map(childId => {
                return childId.includes("_prim") ? childId : `${childId}_prim`;
            });
            console.log(`ℹ️ Nœud ${node.node_id} a ${node.inputs.children.length} enfants.`);
        } else {
            console.warn(`⚠️ Nœud ${node.node_id} (${node.node_type}) n'a pas d'enfants détectés.`);
            node.inputs.children = [];
        }
    }

    // --- Transformations ---
    const isTransform = ["transform", "mirror", "array_linear", "array_radial", "sdf_deform"].includes(node.node_type);
    if (isTransform) {
        let childId = null;
        if (node.params?.object) {
            childId = node.params.object;
            delete node.params.object;
        } else if (node.params?.target) {
            childId = node.params.target;
            delete node.params.target;
        } else if (node.params?.node) {
            childId = node.params.node;
            delete node.params.node;
        } else if (node.child) {
            childId = node.child;
            delete node.child;
        } else if (node.target) {
            childId = node.target;
            delete node.target;
        } else if (node.inputs?.child) {
            childId = node.inputs.child;
        } else if (node.inputs?.target) {
            childId = node.inputs.target;
        }

        if (childId) {
            node.inputs.child = childId.includes("_prim") ? childId : `${childId}_prim`;
            console.log(`ℹ️ Nœud ${node.node_id} (transform) a enfant: ${node.inputs.child}`);
        } else {
            console.warn(`⚠️ Nœud transform ${node.node_id} n'a pas d'enfant détecté.`);
        }
    }

    // Normalisation des paramètres pour primitives CAD
    if (node.node_type === "solid_block" && node.params) {
        node.params = {
            width: node.params.width || 20,
            depth: node.params.depth || 20,
            height: node.params.height || 20
        };
    }
    if (node.node_type === "solid_cylinder" && node.params) {
        node.params = {
            radius: node.params.radius || 10,
            height: node.params.height || 20
        };
    }
    if (node.node_type === "solid_sphere" && node.params) {
        node.params = { radius: node.params.radius || 10 };
    }
    if (node.node_type === "solid_cone" && node.params) {
        node.params = {
            radius: node.params.radius || 10,
            height: node.params.height || 20,
            top_radius: node.params.top_radius || 5
        };
    }
    if (node.node_type === "solid_torus" && node.params) {
        node.params = {
            radius: node.params.radius || 10,
            hollow_radius: node.params.hollow_radius || 5
        };
    }
    if (node.node_type === "sdf_primitive" && node.params) {
        node.params.shape = node.params.shape || "box";
    }

    return node;
}

function normalizePlan(input, forcedMode) {
    if (input && typeof input === "object" && !Array.isArray(input)) {
        let nodes = input.nodes;
        if (!nodes && input.plan) nodes = input.plan;
        if (!Array.isArray(nodes)) throw new Error("No nodes array found");
        nodes.forEach(normalizeNodeInputs);

        const detectedMode = detectModeFromNodes(nodes);
        const mode = forcedMode || detectedMode || input.mode || "CAD";

        let outputsNode = input.outputs?.node;
        if (!outputsNode && nodes.length > 0) outputsNode = nodes[nodes.length - 1].node_id;
        const nodeExists = nodes.some(n => n.node_id === outputsNode);
        if (!nodeExists && nodes.length > 0) outputsNode = nodes[0].node_id;

        // Vérification supplémentaire : si le nœud de sortie est une opération booléenne sans enfants, on crée une union de toutes les primitives
        const rootNode = nodes.find(n => n.node_id === outputsNode);
        if (rootNode && (rootNode.node_type === "boolean_union" || rootNode.node_type === "boolean_difference" || rootNode.node_type === "boolean_intersect")) {
            if (!rootNode.inputs.children || rootNode.inputs.children.length === 0) {
                const primitiveIds = nodes.filter(n => 
                    !["boolean_union", "boolean_difference", "boolean_intersect", "transform", "mirror", "array_linear", "array_radial"].includes(n.node_type)
                ).map(n => n.node_id);
                if (primitiveIds.length) {
                    const newUnionId = `${rootNode.node_id}_auto_union`;
                    nodes.push({
                        node_id: newUnionId,
                        node_type: "boolean_union",
                        inputs: { children: primitiveIds },
                        params: {}
                    });
                    outputsNode = newUnionId;
                    console.log(`🔥 Auto-correction : union de ${primitiveIds.length} primitives créée.`);
                }
            }
        }

        const result = { mode, nodes, outputs: { node: outputsNode } };
        console.log(`🔧 Normalisation: mode=${mode}, nodes=${nodes.length}, outputs.node=${outputsNode}`);
        return result;
    }
    if (Array.isArray(input)) {
        if (input.length === 0) throw new Error("Empty node array");
        input.forEach(normalizeNodeInputs);
        const mode = forcedMode || detectModeFromNodes(input);
        const last = input[input.length - 1];
        if (!last.node_id) throw new Error("Last node missing node_id");
        return { mode, nodes: input, outputs: { node: last.node_id } };
    }
    throw new Error("Unrecognized plan format");
}

function extractJSON(text) {
    if (!text || typeof text !== "string") return null;
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").replace(/\n\s*/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    let start = -1;
    if (firstBrace !== -1 && firstBracket !== -1) start = Math.min(firstBrace, firstBracket);
    else start = Math.max(firstBrace, firstBracket);
    if (start === -1) return null;
    let jsonText = cleaned.substring(start);
    jsonText = jsonText.replace(/([{,]\s*)(\w+):/g, '$1"$2":').replace(/:\s*('|"?)([^'\"{}\[\] ,]+)\1/g, ':"$2"');
    try {
        return JSON.parse(jsonText);
    } catch (e) {
        return null;
    }
}

let indexerReady = null;
async function ensureIndexer() {
    if (!indexerReady) {
        indexerReady = await getIndexer();
        let attempts = 0;
        while (!indexerReady.isReady && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        if (!indexerReady.isReady) console.warn("⚠️ Indexeur non chargé après 6 secondes");
    }
    return indexerReady;
}

async function generateWithRAG(userPrompt) {
    const indexer = await ensureIndexer();
    const lowerPrompt = userPrompt.toLowerCase();
    const organicKeywords = /spirale|organique|lisse|blob|sculpture|vase|torsadé|vrillé|goutte|métaball|tore|anneau|capsule/;
    let targetMode = organicKeywords.test(lowerPrompt) ? "SDF" : "CAD";
    let examples = [];
    if (targetMode === "SDF") {
        console.log("🎯 Forçage SDF pour prompt organique");
    } else {
        examples = await indexer.findSimilar(userPrompt, 3) || [];
        const sdfCount = examples.filter(e => e.plan?.mode === "SDF").length;
        const cadCount = examples.filter(e => e.plan?.mode === "CAD").length;
        targetMode = sdfCount > cadCount ? "SDF" : "CAD";
        console.log(`🎯 Mode cible (basé sur exemples): ${targetMode}`);
    }

    const fewShotText = examples.map((ex, i) => {
        const planStr = JSON.stringify(ex.plan.nodes || ex.plan, null, 2);
        return `EXAMPLE ${i+1}:\nInput: ${ex.prompt}\nPlan:\n${planStr}`;
    }).join("\n\n");

    const systemPrompt = `You are HelixForge, a strict 3D model generator.
TARGET MODE: ${targetMode}

CRITICAL RULES:
- Respond ONLY with a valid JSON object (no markdown, no extra text).
- Structure: { "mode": "${targetMode}", "nodes": [...], "outputs": {"node": "id"} }
- For CAD: use node types: solid_block, solid_cylinder, transform, boolean_union, boolean_difference, boolean_intersect.
- For SDF: use sdf_primitive (shape: box, sphere, cylinder, cone, torus), sdf_op (union, subtract, intersect), sdf_deform (twist, translate, rotate, scale), sdf_mesher.
- For boolean_union: "inputs.children" must be an array of 2+ valid node_ids.
- For transform: "inputs.child" must be a valid node_id.
- Do NOT include any text outside the JSON.

Examples:
${fewShotText || "No examples."}

Generate plan for: "${userPrompt}"

RESPONSE (ONLY JSON):
`;

    try {
        console.log("📤 Envoi du prompt à Groq (mode:", targetMode + ")");
        const groqResponse = await callGroq(systemPrompt, userPrompt, targetMode);
        const content = groqResponse.choices?.[0]?.message?.content || groqResponse;
        console.log("📥 Réponse brute (début):", content.substring(0, 300) + (content.length > 300 ? "..." : ""));
        const parsed = extractJSON(content);
        if (!parsed) throw new Error("JSON extraction failed");
        const plan = normalizePlan(parsed, targetMode);
        console.log(`✅ Plan normalisé: mode=${plan.mode}, nodes=${plan.nodes.length}, outputs.node=${plan.outputs.node}`);
        return plan;
    } catch (err) {
        console.error("❌ RAG failed:", err.message);
        if (examples.length > 0) {
            console.warn("⚠️ Fallback to first example");
            const fallbackPlan = normalizePlan(examples[0].plan, targetMode);
            return fallbackPlan;
        }
        throw new Error("No plan could be generated");
    }
}

module.exports = { generateWithRAG };
