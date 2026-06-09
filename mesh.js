// backend/api/hf3/mesh.js — VERSION CORRIGÉE (compatible Parser V3 + Évaluateur V3 + Mesher V3 + Traducteur IA)
// ✅ Ajout : sélection du parser selon le mode (strict/organic/creative)
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============ IMPORTS DES PARSERS SPÉCIFIQUES ============
const { parseHF3: parseHF3V3 } = require("../../ai/prompt/organic_parser_prod_v3");
const { translateFRtoOrganic, organicTextToParserInput } = require("../../ai/prompt/organic_translator_fr_v5");
const { parseStrict } = require("../../ai/parsers/strict_parser_godmode");
const { parseCreative } = require("../../ai/parsers/artistic_semantic_parser_production");

// Évaluateur et mesher
const { createOrganicOptimizedEvaluator } = require("../../sdf/sdf_evaluator_organic_opt_v3");
const { generateMeshHF3 } = require("../../sdf/sdf_mesher_hf3");

const DEBUG = true;
function log(...args) { if (DEBUG) console.log("[HF3_MESH_API]", ...args); }
function warn(...args) { if (DEBUG) console.warn("[HF3_MESH_API WARN]", ...args); }

// ============ CACHE D'ÉVALUATEURS ============
const evaluatorCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheKey(rootNode, nodeCount, mode) {
    return `${rootNode}_${nodeCount}_${mode}`;
}

function getCachedEvaluator(cacheKey) {
    const cached = evaluatorCache.get(cacheKey);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        evaluatorCache.delete(cacheKey);
        return null;
    }
    return cached;
}

function setCachedEvaluator(cacheKey, evaluator, rootNode) {
    evaluatorCache.set(cacheKey, { evaluator, rootNode, timestamp: Date.now() });
}

// ============ CONFIGURATION RÉSOLUTION ============
const RESOLUTION_CONFIG = {
    max: 256,
    default: 256,
    min: 128,
    thresholds: { high: 500, medium: 1500, low: Infinity }
};

function computeAdaptiveResolution(nodeCount, requestedResolution) {
    if (requestedResolution) {
        return Math.min(Math.max(requestedResolution, 32), RESOLUTION_CONFIG.max);
    }
    if (nodeCount <= RESOLUTION_CONFIG.thresholds.high) return RESOLUTION_CONFIG.max;
    if (nodeCount <= RESOLUTION_CONFIG.thresholds.medium) return RESOLUTION_CONFIG.default;
    return RESOLUTION_CONFIG.min;
}

// ============ NORMALISATION GRAPHE ============
function normalizeHF3Graph(graph) {
    if (graph.root && Array.isArray(graph.nodes)) return graph;
    if (graph.rootId && graph.nodes && typeof graph.nodes === 'object') {
        const nodesArray = [];
        for (const [id, node] of Object.entries(graph.nodes)) {
            const normalized = { id, ...node };
            if (node.type === "sphere" && !node.op) {
                normalized.type = "primitive";
                normalized.op = "sphere";
                normalized.params = { r: node.r };
            } else if (node.type === "box" && !node.op) {
                normalized.type = "primitive";
                normalized.op = "box";
                normalized.params = { size: node.size || [node.width || 1, node.height || 1, node.depth || 1] };
            } else if (node.type === "cylinder" && !node.op) {
                normalized.type = "primitive";
                normalized.op = "cylinder";
                normalized.params = { r: node.r, h: node.height || node.h || 1 };
            } else if (node.type === "transform" && !node.op && node.transform) {
                normalized.op = node.transform;
            }
            nodesArray.push(normalized);
        }
        return { root: graph.rootId, nodes: nodesArray };
    }
    if (graph.root && graph.nodes) return graph;
    throw new Error("Format de graphe non reconnu");
}

// ============ PARSING AVEC OU SANS IA (uniquement pour organic) ============
async function parseOrganicPrompt(prompt, options = {}) {
    const useAI = options.useAI !== false;
    let parsed;
    if (useAI) {
        log("🤖 Appel au traducteur IA...");
        const translation = await translateFRtoOrganic(prompt);
        if (translation.success) {
            log("✅ Traduction IA réussie");
            const translatedInput = organicTextToParserInput(translation.organicText);
            parsed = parseHF3V3(translatedInput.prompt, options);
            if (translatedInput.dominantMorphology && parsed.profile) {
                parsed.profile.dominant_morphology = translatedInput.dominantMorphology;
            }
            if (translatedInput.behaviors && parsed.profile) {
                parsed.profile.behaviors = translatedInput.behaviors;
            }
            if (translatedInput.materials && parsed.profile) {
                parsed.profile.material = translatedInput.materials[0] || parsed.profile.material;
            }
            if (translatedInput.intensity) {
                parsed.intensity = parseFloat(translatedInput.intensity) || parsed.intensity;
            }
        } else {
            warn("Traduction IA échouée, fallback sur parser classique");
            parsed = parseHF3V3(prompt, options);
        }
    } else {
        parsed = parseHF3V3(prompt, options);
    }
    return parsed;
}

// ============ ROUTE PRINCIPALE ============
router.post("/mesh", async (req, res) => {
    const startTime = Date.now();
    try {
        let { prompt, mode, resolution: requestedResolution, options = {} } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "Prompt requis" });
        }

        // ✅ Normalisation du mode utilisateur (creative -> organic pour le mesher)
        let normalizedMode = mode;
        if (mode === 'creatif') normalizedMode = 'organic';
        if (!['strict', 'organic'].includes(normalizedMode)) normalizedMode = 'organic';

        log(`🟦 /api/hf3/mesh → mode demandé: ${mode} → normalisé: ${normalizedMode}`);

        // ----- 1. PARSING SELON LE MODE -----
        let parsed;
        if (normalizedMode === "strict") {
            log("📘 Parser STRICT utilisé");
            parsed = parseStrict(prompt);
        } else if (normalizedMode === "creative") {
            log("🎨 Parser CREATIVE utilisé");
            parsed = parseCreative(prompt);
        } else {
            log("🌿 Parser ORGANIC utilisé");
            parsed = await parseOrganicPrompt(prompt, { ...options, useAI: options.useAI !== false });
        }

        // Vérification du graphe
        const graph = parsed.nodeGraph;
        if (!graph || !graph.root || !graph.nodes || graph.nodes.length === 0) {
            return res.status(400).json({ error: "Graphe invalide", details: { nodeCount: graph?.nodes?.length || 0 } });
        }

        const nodeCount = graph.nodes.length;
        log(`📊 Graph: ${nodeCount} nœuds, root: ${graph.root}`);

        const strictGraph = normalizeHF3Graph(graph);

        // 2. Cache évaluateur (basé sur le mode aussi)
        const cacheKey = getCacheKey(strictGraph.root, nodeCount, normalizedMode);
        let cached = getCachedEvaluator(cacheKey);
        let evaluator, rootNode;

        if (cached) {
            evaluator = cached.evaluator;
            rootNode = cached.rootNode;
        } else {
            log(`🔧 Construction évaluateur (mode graphe organique, le mode réel sera géré par le mesher)`);
            // On construit toujours l'évaluateur organique (le plus complet)
            const built = createOrganicOptimizedEvaluator(strictGraph);
            evaluator = built.evaluator;
            rootNode = built.rootNode;
            if (!rootNode) throw new Error("Évaluateur: rootNode null");
            setCachedEvaluator(cacheKey, evaluator, rootNode);
        }

        const meshResolution = computeAdaptiveResolution(nodeCount, requestedResolution);
        log(`📊 Résolution: ${meshResolution}³ (nodes: ${nodeCount})`);

        // 3. GÉNÉRATION MESH — APPEL CORRECT AVEC DEUX ARGUMENTS
        log("🔧 Appel generateMeshHF3 (mesher V3)...");
        let mesh;
        try {
            mesh = await generateMeshHF3(
                {
                    evaluator,
                    rootNode,
                    graph: strictGraph
                },
                {
                    resolution: meshResolution,
                    mode: normalizedMode,          // ← mode utilisateur dans userOptions
                    useAdaptive: true,
                    dynamicBounds: true,
                    cacheEnabled: true,
                    maxRetries: 2,
                    includeUVs: true,
                    includeVertexColors: true,
                    profile: parsed.profile
                }
            );
        } catch (meshErr) {
            warn("❌ Erreur mesh:", meshErr.message);
            if (meshResolution > 128) {
                log("🔄 Fallback résolution 128³...");
                mesh = await generateMeshHF3(
                    { evaluator, rootNode, graph: strictGraph },
                    {
                        resolution: 128,
                        mode: normalizedMode,
                        useAdaptive: false,
                        dynamicBounds: true,
                        cacheEnabled: false,
                        includeUVs: true,
                        includeVertexColors: true,
                        profile: parsed.profile
                    }
                );
            } else {
                throw meshErr;
            }
        }

        if (!mesh || !mesh.vertices || mesh.vertices.length === 0) {
            throw new Error("Mesh vide après génération");
        }

        const vertexCount = mesh.vertices.length / 3;
        const indexCount = mesh.indices.length;
        log(`🟩 Mesh généré: ${vertexCount} vertices, ${indexCount} triangles`);

        // Sauvegarde
        const meshId = crypto.randomUUID();
        const meshDir = path.join(__dirname, "../../data/meshes");
        if (!fs.existsSync(meshDir)) fs.mkdirSync(meshDir, { recursive: true });
        const filePath = path.join(meshDir, `${meshId}.json`);
        const meshData = {
            id: meshId,
            prompt,
            mode: normalizedMode,
            originalMode: mode,
            profile: parsed.profile,
            intensity: parsed.intensity,
            mesh: {
                vertices: Array.from(mesh.vertices),
                indices: Array.from(mesh.indices),
                normals: mesh.normals ? Array.from(mesh.normals) : undefined,
                uvs: mesh.uvs ? Array.from(mesh.uvs) : undefined,
                colors: mesh.colors ? Array.from(mesh.colors) : undefined,
                vertexCount,
                indexCount,
                bounds: mesh.bounds
            },
            generation: {
                nodeCount,
                resolution: meshResolution,
                durationMs: Date.now() - startTime,
                cached: !!cached,
                timestamp: new Date().toISOString()
            }
        };
        fs.writeFileSync(filePath, JSON.stringify(meshData, null, 2));
        log(`💾 Mesh sauvegardé: ${filePath}`);

        res.json({
            success: true,
            meshId,
            mode: normalizedMode,
            originalMode: mode,
            profile: parsed.profile,
            intensity: parsed.intensity,
            mesh: {
                vertexCount,
                indexCount,
                resolution: meshResolution,
                bounds: mesh.bounds,
                hasUVs: !!mesh.uvs,
                hasColors: !!mesh.colors
            },
            generation: {
                durationMs: Date.now() - startTime,
                cached: !!cached,
                nodeCount
            },
            downloadUrl: `/api/hf3/models/${meshId}.json`
        });

    } catch (err) {
        warn("🔥 Erreur HF3 mesh:", err.message);
        console.error(err.stack);
        res.status(500).json({
            error: err.message,
            stack: DEBUG ? err.stack : undefined,
            durationMs: Date.now() - startTime
        });
    }
});

// ============ ROUTES ANNEXES ============
router.post("/parse", async (req, res) => {
    try {
        const { prompt, options = {} } = req.body;
        // Pour l'API parse, on garde le comportement par défaut (organic avec IA)
        const parsed = await parseOrganicPrompt(prompt, options);
        const nodeCount = parsed.nodeGraph?.nodes?.length || 0;
        res.json({
            success: true,
            parsed: {
                mode: parsed.mode,
                profile: parsed.profile,
                intensity: parsed.intensity,
                pipeline: parsed.pipeline,
                nodeCount,
                rootNode: parsed.nodeGraph?.root
            },
            nodeGraph: parsed.nodeGraph
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/models/:id", (req, res) => {
    const filePath = path.join(__dirname, "../../data/meshes", `${req.params.id}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Mesh non trouvé" });
    res.sendFile(path.resolve(filePath));
});

router.get("/health", (req, res) => {
    res.json({ status: "ok", cache: { size: evaluatorCache.size }, resolutionConfig: RESOLUTION_CONFIG, uptime: process.uptime() });
});

setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, val] of evaluatorCache.entries()) {
        if (now - val.timestamp > CACHE_TTL_MS) {
            evaluatorCache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) log(`🧹 Cache nettoyé: ${cleaned} entrées`);
}, CACHE_TTL_MS);

module.exports = router;
