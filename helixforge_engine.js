// ============================================================================
// HelixForge Engine 3.0 — Pipeline biomorphique complet (VERSION FINALE HF3)
// ============================================================================

// ROUTEUR HF3 (TON routeur)
const { parseHF3 } = require("@prompt/hf3_parser_router");

// SDF GRAPH BUILDER HF3
const { biomorphicToSDFGraph } = require("@engine/sdf/sdf_graph_builder");

// RENDERER HF3
const { renderSDF, evalSDFWithLOD } = require("@engine/sdf/sdf_renderer");

// SDF OPS HF3
const { evalSDFNode } = require("@engine/sdf/sdf_ops");

// MESHER HF3
const {
    generateMeshHF3,
    clearMeshCache,
    getCacheStats: getMeshCacheStats
} = require("@engine/sdf/sdf_mesher_hf3");

// EXPORT GLB HF3
const { HelixForgeGLTFExporter } = require("@export/gltf/gltf_exporter_max");

// ============================================================================
// Configuration par défaut
// ============================================================================
const DEFAULT_WIDTH = 512;
const DEFAULT_HEIGHT = 512;

const DEFAULT_CAMERA = {
    position: { x: 0, y: 0, z: 6 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 }
};

const DEFAULT_RENDER_OPTIONS = {
    fov: 60,
    time: 0,
    maxSteps: 128,
    maxDist: 200,
    ambient: 0.15,
    baseColor: { r: 0.9, g: 0.8, b: 0.7 },
    specularIntensity: 0,
    reflectivity: 0,
    refractivity: 0,
    ior: 1.5,
    backgroundColor: { r: 0.02, g: 0.02, b: 0.04 },
    ssaaSamples: 1,
    lightDir: { x: 0.5, y: 0.8, z: -0.6 },
    maxBounces: 3
};

// ============================================================================
// Caches internes
// ============================================================================
const routeCache = new Map();
const biomorphicCache = new Map();
const graphCache = new Map();

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
let currentLogLevel = LOG_LEVELS.info;

function log(level, msg, data = null) {
    if (LOG_LEVELS[level] <= currentLogLevel) {
        console.log(`[${new Date().toISOString()}] [HF3:${level.toUpperCase()}] ${msg}`, data || "");
    }
}

function setLogLevel(level) {
    if (LOG_LEVELS[level] !== undefined) currentLogLevel = LOG_LEVELS[level];
}

function validatePrompt(prompt) {
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        throw new Error("Invalid prompt: must be a non-empty string");
    }
}

function deepMerge(a, b) {
    const out = { ...a };
    for (const k in b) {
        if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) {
            out[k] = deepMerge(a[k] || {}, b[k]);
        } else if (b[k] !== undefined) {
            out[k] = b[k];
        }
    }
    return out;
}

function getCacheKey(prompt, options) {
    return `${prompt}|${JSON.stringify(options || {})}`;
}

// ============================================================================
// ADAPTATEUR HF3 — CORRIGÉ : plus de fallback pour le mode strict
// ============================================================================
function adaptParsedToGraph(parsed) {
    // MODE STRICT : on exige un graph valide, sinon erreur immédiate
    if (parsed.mode === "strict") {
        if (parsed.graph && parsed.graph.root && parsed.graph.nodes) {
            log("debug", "Strict mode: using direct graph");
            return parsed.graph;
        } else {
            const errorMsg = parsed.error || "Strict parser did not produce a valid graph";
            throw new Error(`Strict mode parsing failed: ${errorMsg}. The prompt must be valid SDF code.`);
        }
    }

    // MODE ORGANIC
    if (parsed.mode === "organic" && parsed.pipeline) {
        log("debug", "Organic mode: converting to SDF graph");
        return biomorphicToSDFGraph(parsed, {});
    }

    // MODE CREATIVE
    if (parsed.mode === "creative") {
        log("debug", "Creative mode: converting to SDF graph");
        return biomorphicToSDFGraph(parsed, {});
    }

    // MODE HYBRID (fusion organic+creative)
    if (parsed.mode === "hybrid" && parsed.fused) {
        log("debug", "Hybrid mode: converting fused pipeline");
        return biomorphicToSDFGraph(parsed.fused, {});
    }

    // Fallback ultime : si aucun mode reconnu, on tente biomorphicToSDFGraph
    // mais avec avertissement (peut encore échouer si pas de pipeline)
    log("warn", "Unknown or incomplete mode, attempting biomorphicToSDFGraph fallback");
    return biomorphicToSDFGraph(parsed, {});
}

// ============================================================================
// Construction du pipeline
// ============================================================================
function buildBiomorphicPipeline(prompt, routerOptions = {}, biomorphicOptions = {}, graphOptions = {}) {
    const key = getCacheKey(prompt, { routerOptions, biomorphicOptions, graphOptions });

    if (biomorphicCache.has(key) && graphCache.has(key)) {
        return {
            route: routeCache.get(key),
            biomorphic: biomorphicCache.get(key),
            sdfGraph: graphCache.get(key),
            rootNode: graphCache.get(key).root
        };
    }

    let parsed;
    try {
        parsed = parseHF3(prompt, { forcedMode: routerOptions.mode });
        log("info", `HF3 Router → mode: ${parsed.mode}`);
    } catch (err) {
        log("error", `Router failed: ${err.message}`);
        throw new Error(`Router error: ${err.message}`);
    }
    routeCache.set(key, parsed);

    let sdfGraph;
    try {
        sdfGraph = adaptParsedToGraph(parsed);
    } catch (err) {
        log("error", `adaptParsedToGraph failed: ${err.message}`);
        throw new Error(`Cannot build SDF graph: ${err.message}`);
    }

    graphCache.set(key, sdfGraph);
    biomorphicCache.set(key, parsed);

    return {
        route: parsed,
        biomorphic: parsed,
        sdfGraph,
        rootNode: sdfGraph.root
    };
}

// ============================================================================
// 1. GÉNÉRATION D'IMAGE
// ============================================================================
async function generateHelixImage(prompt, options = {}) {
    const startTime = Date.now();
    validatePrompt(prompt);

    const width = options.width || DEFAULT_WIDTH;
    const height = options.height || DEFAULT_HEIGHT;
    const camera = deepMerge(DEFAULT_CAMERA, options.camera || {});
    const renderOptions = deepMerge(DEFAULT_RENDER_OPTIONS, options.render || options);

    const { rootNode, sdfGraph, biomorphic } = buildBiomorphicPipeline(
        prompt,
        options.router || {},
        options.biomorphic || {},
        options.graph || {}
    );

    let buffer;
    try {
        buffer = renderSDF(rootNode, width, height, camera, renderOptions);
    } catch (err) {
        log("error", `Rendering failed: ${err.message}`);
        throw new Error(`Image generation failed: ${err.message}`);
    }

    log("info", `Image generated in ${Date.now() - startTime}ms`);
    return { mode: "image", width, height, buffer, sdfGraph, biomorphic };
}

// ============================================================================
// 2. GÉNÉRATION DU CHAMP DE DISTANCE
// ============================================================================
async function generateDistanceField(prompt, options = {}) {
    const startTime = Date.now();
    validatePrompt(prompt);

    const time = options.time || 0;
    const { rootNode, sdfGraph, biomorphic } = buildBiomorphicPipeline(
        prompt,
        options.router || {},
        options.biomorphic || {},
        options.graph || {}
    );

    const distanceField = (x, y, z, t = time) => evalSDFNode(rootNode, x, y, z, t);
    const distanceFieldWithLOD = (x, y, z, dist, t = time) =>
        evalSDFWithLOD(rootNode, x, y, z, t, dist);

    log("info", `Distance field ready in ${Date.now() - startTime}ms`);
    return { mode: "distance_field", sdfGraph, biomorphic, distanceField, distanceFieldWithLOD };
}

// ============================================================================
// 3. GÉNÉRATION DE MAILLAGE HF3
// ============================================================================
async function generateHelixMeshHF3(prompt, options = {}) {
    const startTime = Date.now();
    validatePrompt(prompt);

    const resolution = options.resolution || 128;
    const bounds = options.bounds || [-2, -2, -2, 2, 2, 2];
    const adaptative = options.adaptative !== false;

    const df = await generateDistanceField(prompt, options);
    const rootNode = df.sdfGraph.root;

    let mesh;
    try {
        mesh = await generateMeshHF3(rootNode, {
            resolution,
            bounds,
            adaptative,
            ...(options.mesher || {})
        });
    } catch (err) {
        log("error", `Meshing failed: ${err.message}`);
        throw new Error(`Mesh generation failed: ${err.message}`);
    }

    if (options.exportGLB) {
        try {
            const exporter = new HelixForgeGLTFExporter();
            if (mesh.vertices && mesh.indices) {
                const mat = exporter.addOrganicMaterial({});
                exporter.addPrimitive(mesh.vertices, mesh.indices, mesh.normals || [], mat);
            }
            mesh.glbBuffer = exporter.generateGLB();
        } catch (err) {
            log("error", `GLB export failed: ${err.message}`);
            mesh.glbBuffer = null;
        }
    }

    log("info", `Mesh generated in ${Date.now() - startTime}ms`);
    return { mode: "mesh", mesh, sdfGraph: df.sdfGraph, biomorphic: df.biomorphic };
}

// ============================================================================
// 4. BATCH
// ============================================================================
async function batchGenerate(prompts, options = {}) {
    const mode = options.mode || "image";
    const results = [];

    for (const p of prompts) {
        try {
            const result =
                mode === "image"
                    ? await generateHelixImage(p, options)
                    : await generateHelixMeshHF3(p, options);

            results.push({ prompt: p, success: true, result });
        } catch (err) {
            results.push({ prompt: p, success: false, error: err.message });
        }
    }

    return results;
}

// ============================================================================
// 5. GESTION DU CACHE
// ============================================================================
function clearCache() {
    routeCache.clear();
    biomorphicCache.clear();
    graphCache.clear();
    clearMeshCache();
    log("info", "All caches cleared");
}

function getCacheStats() {
    return {
        routes: routeCache.size,
        biomorphic: biomorphicCache.size,
        graphs: graphCache.size,
        mesh: getMeshCacheStats()
    };
}

function invalidatePipelineCache(prompt, options = {}) {
    const key = getCacheKey(prompt, options);
    routeCache.delete(key);
    biomorphicCache.delete(key);
    graphCache.delete(key);
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    generateHelixImage,
    generateDistanceField,
    generateHelixMeshHF3,
    batchGenerate,
    clearCache,
    getCacheStats,
    invalidatePipelineCache,
    setLogLevel,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_CAMERA,
    DEFAULT_RENDER_OPTIONS
};
