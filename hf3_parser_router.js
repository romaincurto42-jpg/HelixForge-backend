// hf3_router.js — ROUTEUR HF3 V4 (VERSION JSON ONLY, SANS THREE.JS)

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createCanvas } = require('canvas');

const { createOrganicOptimizedEvaluator } = require('../../engine/sdf/sdf_evaluator_organic_opt_v3');
const { generateMeshHF3 } = require('../../engine/sdf/sdf_mesher_hf3');
const { OrganicParserProdV3 } = require('../parsers/organic_parser_prod_v3');
const { translateFRtoOrganic, organicTextToParserInput } = require('../../ai/prompt/organic_translator_fr_v5');

const CONFIG = {
    meshOutputDir: process.env.MESH_DIR || './models',
    defaultResolution: 256,
    maxResolution: 256,
    minResolution: 128,
    enableCache: true,
    debug: true,
    useAITranslator: true
};

function log(...args) { if (CONFIG.debug) console.log("[HF3_ROUTER]", ...args); }
function warn(...args) { if (CONFIG.debug) console.warn("[HF3_ROUTER WARN]", ...args); }

const organicParserV3 = new OrganicParserProdV3();

// ============================================================================
// 🔥 AJOUT CRITIQUE : parseHF3() (nécessaire pour helixforge_engine.js)
// ============================================================================
function parseHF3(prompt, options = {}) {
    return organicParserV3.parse(prompt, options);
}

// ============================================================================
// ROUTE PRINCIPALE : GÉNÉRATION DE MESH HF3 (JSON UNIQUEMENT)
// ============================================================================
router.post('/mesh', async (req, res) => {
    try {
        let { prompt, mode: requestedMode, resolution, options = {} } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt requis" });

        // Normalisation du mode
        let modeForMesher = requestedMode;
        if (requestedMode === 'creatif') modeForMesher = 'organic';
        if (!['strict', 'organic'].includes(modeForMesher)) modeForMesher = 'organic';

        log(`🔥 /api/hf3/mesh → mode original: ${requestedMode} → mesher: ${modeForMesher}`);

        let parsed;

        // Traduction IA si organic
        if (CONFIG.useAITranslator && modeForMesher === 'organic') {
            log("🤖 Traduction IA en cours...");
            const translation = await translateFRtoOrganic(prompt);

            if (translation.success && translation.organicText) {
                const translatedInput = organicTextToParserInput(translation.organicText, prompt);
                if (translatedInput?.prompt) {
                    parsed = organicParserV3.parseFromTranslated(translatedInput, options);
                } else {
                    parsed = organicParserV3.parse(prompt, options);
                }
            } else {
                parsed = organicParserV3.parse(prompt, options);
            }
        } else {
            parsed = organicParserV3.parse(prompt, options);
        }

        const graph = parsed.nodeGraph;
        if (!graph || !graph.nodes?.length) {
            return res.status(500).json({
                error: "Graphe invalide",
                details: { nodeCount: graph?.nodes?.length || 0, profile: parsed.profile }
            });
        }

        const meshResolution = resolution || CONFIG.defaultResolution;

        log(`HF3_ROUTER → generateMeshHF3(mode=${modeForMesher})`);

        // Génération du mesh HF3
        const meshResult = await generateMeshHF3(graph, {
            resolution: meshResolution,
            dynamicBounds: true,
            useAdaptive: true,
            isoLevel: 0,
            cacheEnabled: CONFIG.enableCache,
            maxRetries: 2,
            mode: modeForMesher,
            profile: parsed.profile,
            includeUVs: true,
            includeVertexColors: true
        });

        if (!meshResult || meshResult.vertices.length === 0) {
            return res.status(500).json({ error: "Mesh vide", parsed: parsed.profile });
        }

        const modelId = uuidv4();
        const outputDir = path.resolve(CONFIG.meshOutputDir);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        // Sauvegarde JSON HF3
        const jsonData = {
            id: modelId,
            prompt,
            mode: modeForMesher,
            originalMode: requestedMode,
            profile: parsed.profile,
            intensity: parsed.intensity,
            vertices: Array.from(meshResult.vertices),
            indices: Array.from(meshResult.indices),
            normals: meshResult.normals ? Array.from(meshResult.normals) : undefined,
            uvs: meshResult.uvs ? Array.from(meshResult.uvs) : undefined,
            colors: meshResult.colors ? Array.from(meshResult.colors) : undefined,
            bounds: meshResult.bounds,
            nodeCount: graph.nodes.length,
            resolution: meshResult.meta?.resolution || meshResolution,
            createdAt: new Date().toISOString(),
            meta: meshResult.meta
        };

        const jsonPath = path.join(outputDir, `${modelId}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

        log(`🟩 Mesh généré: ${meshResult.vertices.length/3} vertices, ${meshResult.indices.length/3} triangles`);
        log(`💾 JSON: ${jsonPath}`);

        res.json({
            success: true,
            modelId,
            mode: modeForMesher,
            profile: parsed.profile,
            intensity: parsed.intensity,
            mesh: {
                vertexCount: meshResult.vertices.length / 3,
                indexCount: meshResult.indices.length,
                resolution: meshResult.meta?.resolution || meshResolution,
                hasUVs: !!meshResult.uvs,
                hasVertexColors: !!meshResult.colors
            },
            jsonUrl: `/api/hf3/models/${modelId}.json`
        });

    } catch (err) {
        warn("❌ Erreur:", err.message);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// ============================================================================
// ROUTE PARSE SEULE
// ============================================================================
router.post('/parse', async (req, res) => {
    try {
        const { prompt, mode = 'strict', options = {}, useAI = true } = req.body;
        let parsed;

        if (useAI && CONFIG.useAITranslator) {
            const translation = await translateFRtoOrganic(prompt);
            if (translation.success && translation.organicText) {
                const translatedInput = organicTextToParserInput(translation.organicText, prompt);
                parsed = translatedInput?.prompt
                    ? organicParserV3.parseFromTranslated(translatedInput, options)
                    : organicParserV3.parse(prompt, options);
            } else {
                parsed = organicParserV3.parse(prompt, options);
            }
        } else {
            parsed = organicParserV3.parse(prompt, options);
        }

        res.json(parsed);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// ROUTE SERVE JSON
// ============================================================================
router.get('/models/:id', (req, res) => {
    const id = req.params.id;
    const jsonPath = path.join(CONFIG.meshOutputDir, `${id}.json`);

    if (fs.existsSync(jsonPath)) {
        res.sendFile(path.resolve(jsonPath));
    } else {
        res.status(404).json({ error: "Modèle non trouvé" });
    }
});

router.get('/health', (req, res) => {
    res.json({ status: 'ok', config: CONFIG });
});

module.exports = { parseHF3, router, OrganicParserProdV3 };
