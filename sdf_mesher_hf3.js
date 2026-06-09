// HelixForge 3.0 — MESHER HF3 V3 OPTIMISÉ (CORRIGÉ + UVs + Vertex Colors)
// Support STRICT / ORGANIC / ARTISTIC avec cache, résolution adaptative,
// fallback intelligent, marching cubes intégré, et génération d'UVs + couleurs.
// ============================================================================

const { createEvaluatorFromGraph } = require("./sdf_router");
const { createOrganicOptimizedEvaluator } = require("./sdf_evaluator_organic_opt_v3");
const crypto = require("crypto");

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    resolution: {
        max: 256,
        default: 256,
        min: 96,
        fallback: 64,
        thresholds: { high: 500, medium: 1500 }
    },
    maxDepth: 4,
    isoLevel: 0,
    multilayer: false,
    lod: false,
    useAdaptive: true,
    weldEpsilon: 1e-5,
    cacheEnabled: true,
    cacheTTL: 5 * 60 * 1000,
    boundsSampling: 8000,
    boundsPadding: 1.2,
    dynamicBounds: true,
    fallbackSphereRadius: 2.5,
    maxRetries: 2,
    includeUVs: true,
    includeVertexColors: true
};

const meshCache = new Map();

function log(...args) { console.log("[MESHER_V3]", ...args); }
function warn(...args) { console.warn("[MESHER_V3 WARN]", ...args); }

function getCacheKey(graph, options) {
    try {
        const data = JSON.stringify(graph) + JSON.stringify(options);
        return crypto.createHash("md5").update(data).digest("hex");
    } catch {
        return crypto.randomUUID();
    }
}

// ✅ CORRECTION : Forcer 256³ pour les graphes ≤ 50 nœuds
function computeAdaptiveResolution(nodeCount, requested) {
    if (nodeCount <= 50) return 256;
    if (requested) return Math.min(Math.max(requested, 32), CONFIG.resolution.max);
    if (nodeCount <= CONFIG.resolution.thresholds.high) return CONFIG.resolution.max;
    if (nodeCount <= CONFIG.resolution.thresholds.medium) return CONFIG.resolution.default;
    return CONFIG.resolution.min;
}

// ============================================================================
// MARCHING CUBES INTÉGRÉ (tableaux complets)
// ============================================================================

const EDGE_TABLE = [
    0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
    0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
    0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
    0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
    0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c,
    0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
    0x3a0, 0x2a9, 0x1a3, 0x0aa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
    0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
    0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c,
    0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
    0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0x0ff, 0x3f5, 0x2fc,
    0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
    0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c,
    0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
    0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0x0cc,
    0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
    0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
    0x0cc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
    0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
    0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
    0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
    0x2fc, 0x3f5, 0x0ff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
    0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
    0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460,
    0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
    0x4ac, 0x5a5, 0x6af, 0x7a6, 0x0aa, 0x1a3, 0x2a9, 0x3a0,
    0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
    0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
    0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
    0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190,
    0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
    0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0
];

const EDGE_VERTICES = [
    [0,1], [1,2], [2,3], [3,0],
    [4,5], [5,6], [6,7], [7,4],
    [0,4], [1,5], [2,6], [3,7]
];

function marchingCubesInternal(sdfFn, bounds, resolution) {
    const sizeX = (bounds.max.x - bounds.min.x);
    const sizeY = (bounds.max.y - bounds.min.y);
    const sizeZ = (bounds.max.z - bounds.min.z);
    const stepX = sizeX / resolution;
    const stepY = sizeY / resolution;
    const stepZ = sizeZ / resolution;

    const grid = new Array(resolution + 1);
    for (let i = 0; i <= resolution; i++) {
        grid[i] = new Array(resolution + 1);
        for (let j = 0; j <= resolution; j++) {
            grid[i][j] = new Array(resolution + 1);
        }
    }

    for (let ix = 0; ix <= resolution; ix++) {
        const x = bounds.min.x + ix * stepX;
        for (let iy = 0; iy <= resolution; iy++) {
            const y = bounds.min.y + iy * stepY;
            for (let iz = 0; iz <= resolution; iz++) {
                const z = bounds.min.z + iz * stepZ;
                grid[ix][iy][iz] = sdfFn(x, y, z);
            }
        }
    }

    const vertices = [];
    const indices = [];
    const vertexCache = new Map();

    function interpolate(p1, p2, val1, val2) {
        if (Math.abs(val1 - val2) < 1e-8) return p1;
        const t = val1 / (val1 - val2);
        return [
            p1[0] + t * (p2[0] - p1[0]),
            p1[1] + t * (p2[1] - p1[1]),
            p1[2] + t * (p2[2] - p1[2])
        ];
    }

    for (let ix = 0; ix < resolution; ix++) {
        for (let iy = 0; iy < resolution; iy++) {
            for (let iz = 0; iz < resolution; iz++) {
                const corners = [
                    [ix,   iy,   iz  ], [ix+1, iy,   iz  ],
                    [ix+1, iy+1, iz  ], [ix,   iy+1, iz  ],
                    [ix,   iy,   iz+1], [ix+1, iy,   iz+1],
                    [ix+1, iy+1, iz+1], [ix,   iy+1, iz+1]
                ];
                const vals = corners.map(c => grid[c[0]][c[1]][c[2]]);
                let cubeIndex = 0;
                for (let i = 0; i < 8; i++) if (vals[i] < 0) cubeIndex |= (1 << i);
                if (cubeIndex === 0 || cubeIndex === 255) continue;

                const worldCorners = corners.map(c => [
                    bounds.min.x + c[0] * stepX,
                    bounds.min.y + c[1] * stepY,
                    bounds.min.z + c[2] * stepZ
                ]);

                const edgeIndices = [];
                for (let e = 0; e < 12; e++) {
                    if (EDGE_TABLE[cubeIndex] & (1 << e)) {
                        const [c1, c2] = EDGE_VERTICES[e];
                        const p1 = worldCorners[c1];
                        const p2 = worldCorners[c2];
                        const v1 = vals[c1];
                        const v2 = vals[c2];
                        const key = `${ix},${iy},${iz},${e}`;
                        let vertexIndex = vertexCache.get(key);
                        if (vertexIndex === undefined) {
                            const point = interpolate(p1, p2, v1, v2);
                            vertexIndex = vertices.length / 3;
                            vertices.push(point[0], point[1], point[2]);
                            vertexCache.set(key, vertexIndex);
                        }
                        edgeIndices.push(vertexIndex);
                    }
                }

                if (edgeIndices.length >= 3) {
                    for (let t = 0; t < edgeIndices.length - 2; t++) {
                        indices.push(edgeIndices[0], edgeIndices[t+1], edgeIndices[t+2]);
                    }
                }
            }
        }
    }

    return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

function marchingCubes(sdfFn, bounds, resolution) {
    return marchingCubesInternal(sdfFn, bounds, resolution);
}
function adaptiveMarchingCubes(sdfFn, bounds, resolution, maxDepth) {
    return marchingCubes(sdfFn, bounds, resolution);
}

// ============================================================================
// GÉNÉRATION D'UVs (projection sphérique standard)
// ============================================================================
function computeUVs(vertices) {
    const uvs = new Float32Array(vertices.length / 3 * 2);
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i+1];
        const z = vertices[i+2];
        const theta = Math.atan2(z, x);
        const phi = Math.acos(Math.max(-1, Math.min(1, y / Math.hypot(x, y, z))));
        const u = (theta + Math.PI) / (2 * Math.PI);
        const v = phi / Math.PI;
        uvs[i/3*2] = u;
        uvs[i/3*2+1] = v;
    }
    return uvs;
}

// ============================================================================
// COULEURS PAR VERTEX (dégradé vertical basé sur le matériau)
// ============================================================================
function computeVertexColors(vertices, profile, bounds) {
    const colors = new Float32Array(vertices.length);
    if (!profile) {
        for (let i = 0; i < vertices.length; i++) colors[i] = 0.8;
        return colors;
    }

    const materialType = profile.material || 'soft';
    const matColors = {
        soft:      [1.0, 0.8, 0.6],
        viscous:   [0.8, 0.5, 0.4],
        dense:     [0.7, 0.5, 0.4],
        porous:    [0.8, 0.7, 0.5],
        irregular: [0.7, 0.7, 0.7],
        fluid:     [0.4, 0.6, 0.9],
        semisolid: [0.9, 0.7, 0.5],
        fibrous:   [0.7, 0.5, 0.3]
    };
    const base = matColors[materialType] || matColors.soft;
    const heightRange = bounds.max.y - bounds.min.y;
    for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i+1];
        const t = (y - bounds.min.y) / Math.max(heightRange, 0.001);
        const r = Math.min(1.0, base[0] * (0.8 + t * 0.4));
        const g = Math.min(1.0, base[1] * (0.8 + t * 0.3));
        const b = Math.min(1.0, base[2] * (0.7 + t * 0.3));
        colors[i]   = r;
        colors[i+1] = g;
        colors[i+2] = b;
    }
    return colors;
}

// ============================================================================
// BOUNDS DYNAMIQUES OPTIMISÉS
// ============================================================================
function computeDynamicBounds(sdfFn, samples = CONFIG.boundsSampling, padding = CONFIG.boundsPadding) {
    log("computeDynamicBounds: début");

    const testPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 0.1, y: 0, z: 0 },
        { x: 0, y: 0.1, z: 0 },
        { x: 0, y: 0, z: 0.1 },
        { x: -0.1, y: 0, z: 0 },
        { x: 0.2, y: 0.2, z: 0 },
        { x: -0.2, y: 0, z: 0.2 }
    ];
    const testValues = testPoints.map(p => sdfFn(p.x, p.y, p.z));
    const hasNegative = testValues.some(v => v < 0);
    const hasPositive = testValues.some(v => v > 0);

    if (!hasNegative || !hasPositive) {
        warn("SDF constante ou non signée → bounds ultra-serrés");
        return { min: { x: -1.5, y: -1.5, z: -1.5 }, max: { x: 1.5, y: 1.5, z: 1.5 } };
    }

    let min = { x: Infinity, y: Infinity, z: Infinity };
    let max = { x: -Infinity, y: -Infinity, z: -Infinity };
    let found = 0;

    const coarseRange = 1.5;
    const coarseSteps = 12;

    for (let ix = 0; ix <= coarseSteps; ix++) {
        for (let iy = 0; iy <= coarseSteps; iy++) {
            for (let iz = 0; iz <= coarseSteps; iz++) {
                const x = (ix / coarseSteps - 0.5) * 2 * coarseRange;
                const y = (iy / coarseSteps - 0.5) * 2 * coarseRange;
                const z = (iz / coarseSteps - 0.5) * 2 * coarseRange;
                const d = sdfFn(x, y, z);
                if (Math.abs(d) < 20) {
                    found++;
                    min.x = Math.min(min.x, x); max.x = Math.max(max.x, x);
                    min.y = Math.min(min.y, y); max.y = Math.max(max.y, y);
                    min.z = Math.min(min.z, z); max.z = Math.max(max.z, z);
                }
            }
        }
    }

    const range = {
        x: Math.max(0.1, max.x - min.x),
        y: Math.max(0.1, max.y - min.y),
        z: Math.max(0.1, max.z - min.z)
    };
    const center = {
        x: (min.x + max.x) / 2,
        y: (min.y + max.y) / 2,
        z: (min.z + max.z) / 2
    };

    for (let i = 0; i < samples && found < samples; i++) {
        const x = center.x + (Math.random() - 0.5) * range.x * 2.0;
        const y = center.y + (Math.random() - 0.5) * range.y * 2.0;
        const z = center.z + (Math.random() - 0.5) * range.z * 2.0;
        const d = sdfFn(x, y, z);
        if (Math.abs(d) < 30) {
            found++;
            min.x = Math.min(min.x, x); max.x = Math.max(max.x, x);
            min.y = Math.min(min.y, y); max.y = Math.max(max.y, y);
            min.z = Math.min(min.z, z); max.z = Math.max(max.z, z);
        }
    }

    if (found === 0) {
        warn("Aucun point trouvé → bounds par défaut (sphère)");
        const r = CONFIG.fallbackSphereRadius;
        return { min: { x: -r, y: -r, z: -r }, max: { x: r, y: r, z: r } };
    }

    const padX = Math.max(padding, (max.x - min.x) * 0.1);
    const padY = Math.max(padding, (max.y - min.y) * 0.1);
    const padZ = Math.max(padding, (max.z - min.z) * 0.1);

    const result = {
        min: { x: min.x - padX, y: min.y - padY, z: min.z - padZ },
        max: { x: max.x + padX, y: max.y + padY, z: max.z + padZ }
    };
    log(`Bounds trouvées: [${result.min.x.toFixed(2)},${result.min.y.toFixed(2)},${result.min.z.toFixed(2)}] → [${result.max.x.toFixed(2)},${result.max.y.toFixed(2)},${result.max.z.toFixed(2)}] (${found} points)`);
    return result;
}

// ============================================================================
// NORMALES, WELDING, EXTRACTIONS
// ============================================================================
function computeNormals(vertices, sdfFn, eps = 0.001) {
    const normals = new Float32Array(vertices.length);
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i], y = vertices[i+1], z = vertices[i+2];
        const dx = sdfFn(x+eps, y, z) - sdfFn(x-eps, y, z);
        const dy = sdfFn(x, y+eps, z) - sdfFn(x, y-eps, z);
        const dz = sdfFn(x, y, z+eps) - sdfFn(x, y, z-eps);
        const L = Math.hypot(dx, dy, dz) || 1;
        normals[i] = dx/L; normals[i+1] = dy/L; normals[i+2] = dz/L;
    }
    return normals;
}

function weldVertices(vertices, indices, epsilon = CONFIG.weldEpsilon) {
    if (vertices.length === 0) return { vertices: new Float32Array(0), indices: new Uint32Array(0) };
    const eps2 = epsilon * epsilon;
    const map = new Map();
    const newVerts = [];
    const oldToNew = new Array(vertices.length / 3);
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i], y = vertices[i+1], z = vertices[i+2];
        const key = `${Math.round(x/epsilon)}_${Math.round(y/epsilon)}_${Math.round(z/epsilon)}`;
        let idx = map.get(key);
        if (idx !== undefined) {
            const cx = newVerts[idx*3], cy = newVerts[idx*3+1], cz = newVerts[idx*3+2];
            const dx = cx-x, dy = cy-y, dz = cz-z;
            if (dx*dx + dy*dy + dz*dz > eps2) idx = undefined;
        }
        if (idx === undefined) {
            idx = newVerts.length / 3;
            newVerts.push(x, y, z);
            map.set(key, idx);
        }
        oldToNew[i/3] = idx;
    }
    const newIdx = new Uint32Array(indices.length);
    for (let i = 0; i < indices.length; i++) newIdx[i] = oldToNew[indices[i]];
    return { vertices: new Float32Array(newVerts), indices: newIdx };
}

function extractMesh(sdfFn, bounds, resolution, isoLevel = 0, useAdaptive = true, maxDepth = CONFIG.maxDepth, options = {}) {
    log(`extractMesh: resolution=${resolution}, adaptive=${useAdaptive}`);
    const shifted = (x,y,z) => sdfFn(x,y,z) - isoLevel;
    let mesh;
    try {
        mesh = useAdaptive ? adaptiveMarchingCubes(shifted, bounds, resolution, maxDepth) : marchingCubes(shifted, bounds, resolution);
    } catch (err) {
        warn("Erreur marching cubes:", err.message);
        return null;
    }
    if (!mesh || !mesh.vertices || mesh.vertices.length === 0) {
        warn("Aucun vertex généré");
        return null;
    }
    log(`Brut: ${mesh.vertices.length/3} vertices, ${mesh.indices.length/3} triangles`);
    const welded = weldVertices(mesh.vertices, mesh.indices);
    const normals = computeNormals(welded.vertices, shifted);
    log(`Weldé: ${welded.vertices.length/3} vertices, ${welded.indices.length/3} triangles`);

    const result = {
        vertices: welded.vertices,
        indices: welded.indices,
        normals,
        bounds
    };
    if (options.includeUVs !== false) {
        result.uvs = computeUVs(result.vertices);
    }
    if (options.includeVertexColors !== false && options.profile) {
        result.colors = computeVertexColors(result.vertices, options.profile, bounds);
    }
    if (result.uvs) log(`   UVs: ${result.uvs.length/2}`);
    if (result.colors) log(`   Vertex colors: ${result.colors.length/3}`);
    return result;
}

function extractMultiLayerMeshes(sdfFn, bounds, resolution, useAdaptive = true, options = {}) {
    return {
        main: extractMesh(sdfFn, bounds, resolution, 0, useAdaptive, CONFIG.maxDepth, options),
        vessels: extractMesh(sdfFn, bounds, resolution, 3, useAdaptive, CONFIG.maxDepth, options),
        fibers: extractMesh(sdfFn, bounds, resolution, 6, useAdaptive, CONFIG.maxDepth, options)
    };
}

function extractLODMeshes(sdfFn, bounds, useAdaptive = true, options = {}) {
    return {
        high: extractMesh(sdfFn, bounds, 180, 0, useAdaptive, CONFIG.maxDepth, options),
        mid: extractMesh(sdfFn, bounds, 120, 0, useAdaptive, CONFIG.maxDepth, options),
        low: extractMesh(sdfFn, bounds, 60, 0, useAdaptive, CONFIG.maxDepth, options)
    };
}

async function generateMeshHF3(input, userOptions = {}) {
    log("generateMeshHF3: début");
    const options = { ...CONFIG, ...userOptions };
    let evaluator, rootNode, graph;
    let source = "unknown";

    if (input.evaluator && input.rootNode) {
        log("Format détecté: evaluator+rootNode (cache hit)");
        evaluator = input.evaluator;
        rootNode = input.rootNode;
        graph = input.graph || null;
        source = "cached";
    } else if (input.root && input.nodes) {
        log("Format détecté: graph legacy");
        graph = input;
        source = "legacy_graph";
    } else {
        throw new Error("Format d'entrée invalide: attendu {evaluator, rootNode} ou {root, nodes}");
    }

    if (!evaluator || !rootNode) {
        log("Construction évaluateur depuis graph...");

        // ✅ CORRECTION : lire mode directement depuis userOptions (non pollué)
        let mode = userOptions.mode;

        if (mode) {
            log(`Mode forcé par l'utilisateur: ${mode}`);
        } else {
            const hasOrganicOps = graph.nodes.some(n =>
                n._type === "transform" &&
                ["wave", "noise", "twist", "bend", "bulge", "ripple", "curl_noise"].includes(n.op)
            );
            mode = hasOrganicOps ? "organic" : "strict";
            log(`Mode auto-détecté: ${mode}`);
        }

        log(`Mode détecté: ${mode}`);

        if (mode === 'organic') {
            const built = createOrganicOptimizedEvaluator(graph);
            evaluator = built.evaluator;
            rootNode = built.rootNode;
        } else {
            const built = createEvaluatorFromGraph(graph, mode);
            evaluator = built.evaluator;
            rootNode = built.rootNode;
        }
        if (!rootNode) throw new Error("Échec construction rootNode");
    }

    let evalCount = 0;
    const sdfFn = (x,y,z) => { evalCount++; return evaluator.evaluate(rootNode, x, y, z); };

    const cacheKey = options.cacheEnabled ? getCacheKey(graph || { rootNode, source }, options) : null;
    if (cacheKey && meshCache.has(cacheKey)) {
        const entry = meshCache.get(cacheKey);
        if (Date.now() - entry.timestamp < options.cacheTTL) {
            log("📦 Cache hit");
            return { ...entry.data, cached: true, source };
        }
        meshCache.delete(cacheKey);
    }

    const nodeCount = graph ? graph.nodes.length : 0;
    const resolution = computeAdaptiveResolution(nodeCount, options.resolution);
    log(`Résolution: ${resolution}³ (nodes: ${nodeCount})`);

    let bounds;
    if (options.dynamicBounds && nodeCount <= 20) {
        bounds = { min: { x: -1.5, y: -1.5, z: -1.5 }, max: { x: 1.5, y: 1.5, z: 1.5 } };
        log("✅ Bounds forcés pour petit graphe:", bounds);
    } else if (options.dynamicBounds) {
        bounds = computeDynamicBounds(sdfFn, options.boundsSampling, options.boundsPadding);
    } else if (options.bounds) {
        bounds = options.bounds;
    } else {
        bounds = computeDynamicBounds(sdfFn);
    }

    let result = null;
    let attempts = 0;
    const resolutions = [resolution, Math.floor(resolution * 0.75), CONFIG.resolution.fallback];

    while (!result && attempts < Math.min(resolutions.length, options.maxRetries + 1)) {
        const res = resolutions[attempts];
        log(`Tentative ${attempts + 1}: resolution=${res}`);
        const extractOptions = {
            includeUVs: options.includeUVs,
            includeVertexColors: options.includeVertexColors,
            profile: options.profile
        };
        if (options.multilayer) {
            result = extractMultiLayerMeshes(sdfFn, bounds, res, options.useAdaptive, extractOptions);
        } else if (options.lod) {
            result = extractLODMeshes(sdfFn, bounds, options.useAdaptive, extractOptions);
        } else {
            result = extractMesh(sdfFn, bounds, res, options.isoLevel, options.useAdaptive, options.maxDepth, extractOptions);
        }
        if (!result || (result.vertices && result.vertices.length === 0)) {
            result = null;
            attempts++;
        }
    }

    if (!result) {
        warn("Toutes les tentatives ont échoué → sphère de secours");
        const r = CONFIG.fallbackSphereRadius;
        const fallbackFn = (x,y,z) => Math.hypot(x,y,z) - r;
        const fallbackBounds = { min: { x: -r-1, y: -r-1, z: -r-1 }, max: { x: r+1, y: r+1, z: r+1 } };
        result = extractMesh(fallbackFn, fallbackBounds, 96, 0, false, CONFIG.maxDepth, { includeUVs: true, includeVertexColors: true, profile: options.profile });
        result._fallback = true;
    }

    const finalResult = {
        ...result,
        meta: {
            resolution: result._fallback ? 96 : resolutions[attempts] || resolution,
            attempts: attempts + 1,
            fallback: !!result._fallback,
            evalCount,
            source,
            nodeCount,
            bounds,
            timestamp: new Date().toISOString()
        }
    };
    delete finalResult._fallback;

    if (cacheKey) {
        meshCache.set(cacheKey, { data: finalResult, timestamp: Date.now() });
    }

    log(`✅ Mesh final: ${finalResult.vertices.length/3} vertices, ${finalResult.indices.length/3} triangles`);
    if (finalResult.uvs) log(`   - UVs (${finalResult.uvs.length/2} sommets)`);
    if (finalResult.colors) log(`   - Vertex colors (${finalResult.colors.length/3} sommets)`);
    return finalResult;
}

setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, val] of meshCache.entries()) {
        if (now - val.timestamp > CONFIG.cacheTTL) {
            meshCache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) log("🧹 Cache nettoyé:", cleaned, "entrées");
}, CONFIG.cacheTTL);

module.exports = {
    generateMeshHF3,
    computeDynamicBounds,
    extractMesh,
    extractMultiLayerMeshes,
    extractLODMeshes,
    weldVertices,
    computeNormals,
    CONFIG
};