// backend/utils/artisticToArtisticGraph.js
// Convertit la sortie du parser artistique en graphe SDF compatible avec l'évaluateur artistique
// Version corrigée : gestion des cycles, cache résilient

const crypto = require('crypto');

// Cache local - taille modifiable
let conversionCache = new Map();
let CACHE_MAX_SIZE = 100;

// Générateur d'IDs
let idCounter = 0;
function generateId(prefix) {
    return `${prefix}_${(idCounter++).toString(36)}_${Date.now().toString(36)}`;
}

// Mapping des primitives
const PRIMITIVE_MAP = {
    sphere: 'sphere', cube: 'box', box: 'box', torus: 'torus',
    cylinder: 'cylinder', cone: 'cone', plane: 'plane',
    fractal: 'mandelbulb', mandelbulb: 'mandelbulb', mandelbox: 'mandelbox',
    julia: 'julia3D', julia3d: 'julia3D', sierpinski: 'sierpinski3D',
    menger: 'menger_sponge', cloud: 'noise_volume', fluid: 'fbm_volume',
    smoke: 'fbm_volume', fire: 'fbm_volume', mobius: 'ribbon',
    klein: 'implicit_surface', penrose: 'implicit_surface', heart: 'heart',
    rounded_box: 'rounded_box', capsule: 'capsule'
};

// Mapping des transformations
const TRANSFORM_MAP = {
    twist: { twist: true, field: 'swirlStrength' },
    warp: { domain_distortion: true, field: 'distortAmp' },
    fractal_noise: { domain_distortion: true, field: 'distortAmp' },
    chaos: { swirl: true, field: 'swirlStrength' },
    topological_inversion: { sphere_fold: true, field: 'sphereMinR' },
    quantum_superposition: { quantum: true, field: 'strength' },
    scale: { scale: true, field: 'sx' },
    rotate: { rotate: true, field: 'angle' },
    translate: { translate: true, field: 'tx' },
    bend: { bend: true, field: 'intensity' },
    repeat: { repeat: true, field: 'period' },
    mirror: { mirror: true, field: 'axis' }
};

// Styles et modificateurs
const STYLE_MODIFIERS = {
    psychedelic: { intensityFactor: 1.5, defaultMaterial: 'neon', addMeta: { style: 'psychedelic', chromaticAb: true } },
    cyberpunk: { intensityFactor: 1.3, defaultMaterial: 'metal', addMeta: { style: 'cyberpunk', glitch: true, neonEdges: true } },
    surrealism: { intensityFactor: 1.2, defaultMaterial: 'soft', addMeta: { style: 'surreal', morph: true } },
    minimal: { intensityFactor: 0.7, defaultMaterial: 'matte', addMeta: { style: 'minimal', clean: true } },
    abstract: { intensityFactor: 1.0, defaultMaterial: 'soft', addMeta: { style: 'abstract' } }
};

function artisticToArtisticGraph(artisticResult, intensity = 1.0, options = {}) {
    const { useCache = true, time = 0, temporalEnabled = false } = options;
    const intensityClamped = Math.min(1.0, Math.max(0.0, intensity));

    let cacheKey = null;
    if (useCache) {
        try {
            // Tentative de sérialisation - peut échouer sur des cycles
            const serialized = JSON.stringify(artisticResult);
            const inputHash = crypto.createHash('md5').update(serialized).digest('hex');
            cacheKey = `${inputHash}_${intensityClamped}_${temporalEnabled ? time : 0}`;
            if (conversionCache.has(cacheKey)) {
                return conversionCache.get(cacheKey);
            }
        } catch (err) {
            // En cas d'erreur (cycle), on désactive le cache pour cet appel
            console.warn('[artisticToArtisticGraph] Impossible de sérialiser pour le cache (objet cyclique) - cache ignoré');
        }
    }

    try {
        const graph = buildGraphInternal(artisticResult, intensityClamped, time, temporalEnabled);
        if (useCache && cacheKey && graph) {
            if (conversionCache.size >= CACHE_MAX_SIZE) {
                const firstKey = conversionCache.keys().next().value;
                conversionCache.delete(firstKey);
            }
            conversionCache.set(cacheKey, graph);
        }
        return graph;
    } catch (error) {
        console.error('[artisticToArtisticGraph] Erreur conversion:', error);
        return getFallbackGraph(intensityClamped);
    }
}

function buildGraphInternal(artisticResult, intensity, time, temporalEnabled) {
    const nodes = [];
    let lastNodeId = null;

    // 1. Primitive principale
    const shape = artisticResult.geometry?.primary || 'sphere';
    const shapeParams = artisticResult.geometry?.params || {};
    const primitiveNode = createPrimitiveNode(shape, shapeParams, intensity, time, temporalEnabled);
    nodes.push(primitiveNode);
    lastNodeId = primitiveNode.id;

    // 2. Transformations
    const pipeline = artisticResult.transformPipeline || [];
    const effectiveTransforms = pipeline.filter(trans => getTransformStrength(trans, intensity) > 0.05);
    for (const trans of effectiveTransforms) {
        const transformNode = createTransformNode(trans, lastNodeId, intensity, time, temporalEnabled);
        if (transformNode) {
            nodes.push(transformNode);
            lastNodeId = transformNode.id;
        }
    }

    // 3. Métadonnées
    const materialProfile = buildMaterialProfileFromArtistic(artisticResult.material, artisticResult.styles, intensity);
    const metaNodes = createMetaNodes(artisticResult, intensity, lastNodeId);
    nodes.push(...metaNodes);

    return {
        nodeGraph: { root: lastNodeId, nodes },
        profile: materialProfile,
        intensity,
        mode: 'artistic',
        temporalState: temporalEnabled ? { time, elapsed: time } : null
    };
}

function createPrimitiveNode(shape, params, intensity, time, temporal) {
    const kind = mapShapeToKind(shape);
    const id = generateId('prim');
    const baseParams = extractPrimitiveParams(kind, params, intensity);
    if (temporal && kind === 'mandelbulb') baseParams.time = time;
    return { id, type: 'primitive', kind, params: baseParams };
}

function mapShapeToKind(shape) {
    const normalized = shape.toLowerCase().trim();
    return PRIMITIVE_MAP[normalized] || 'sphere';
}

function extractPrimitiveParams(kind, params, intensity) {
    const i = intensity;
    switch (kind) {
        case 'sphere': return { r: (params.radius || 1.0) * (0.5 + i * 0.8) };
        case 'box': {
            const s = params.size || 1.0;
            return { sx: s * (0.7 + i * 0.6), sy: s * (0.7 + i * 0.6), sz: s * (0.7 + i * 0.6) };
        }
        case 'torus': return { R: (params.majorRadius || 1.2) * (0.8 + i * 0.4), r: (params.minorRadius || 0.4) * (0.5 + i * 0.7) };
        case 'cylinder': return { r: (params.radius || 0.6) * (0.8 + i * 0.5), h: (params.height || 1.0) * (0.8 + i * 0.4) };
        case 'cone': return { r: (params.radius || 0.8) * (0.7 + i * 0.6), h: (params.height || 1.2) * (0.8 + i * 0.4) };
        case 'mandelbulb': return { power: params.power || 8, iter: Math.max(4, Math.floor((params.iterations || 12) * (0.5 + i * 0.8))) };
        case 'mandelbox': return { scale: params.scale || 2.0, iter: Math.max(3, Math.floor((params.iterations || 10) * (0.5 + i * 0.8))) };
        case 'julia3D': return { cx: params.cx || 0.7885, cy: params.cy || 0.7885, cz: params.cz || 0, iter: Math.max(4, Math.floor((params.iterations || 10) * (0.5 + i))) };
        case 'sierpinski3D': return { size: (params.size || 2.0) * (0.7 + i * 0.6), iter: Math.max(3, Math.floor((params.iterations || 5) * (0.5 + i))) };
        case 'menger_sponge': return { size: (params.size || 2.0) * (0.8 + i * 0.4), iter: Math.max(2, Math.floor((params.iterations || 4) * (0.5 + i))) };
        case 'noise_volume': return { amp: 0.3 + i * 0.7, freq: 0.5 + i * 1.5, oct: Math.floor(3 + i * 5) };
        case 'fbm_volume': return { amp: 0.4 + i * 0.8, freq: 0.6 + i * 2.0, oct: Math.floor(4 + i * 6), lac: 2.0 };
        case 'ribbon': return { twist: (params.twist || 1.0) * (0.5 + i) };
        case 'implicit_surface': return { formula: params.formula || 'klein', scale: (params.scale || 1.0) * (0.6 + i * 0.8) };
        case 'heart': return { scale: (params.scale || 1.0) * (0.7 + i * 0.9) };
        case 'rounded_box': return { sx: (params.size || 1.0) * (0.7 + i * 0.6), sy: (params.size || 1.0) * (0.7 + i * 0.6), sz: (params.size || 1.0) * (0.7 + i * 0.6), r: (params.roundness || 0.2) * (0.5 + i) };
        case 'capsule': return { r: (params.radius || 0.5) * (0.6 + i * 0.8), h: (params.height || 1.0) * (0.7 + i * 0.6) };
        default: return {};
    }
}

function getTransformStrength(trans, intensity) {
    if (!trans || !trans.type) return 0;
    const t = trans.type;
    switch (t) {
        case 'twist': return Math.abs(trans.angle || 0) / 360 * intensity;
        case 'warp': return (trans.strength || 0.5) * intensity;
        case 'fractal_noise': return (trans.amplitude || 0.2) * intensity;
        case 'chaos': return 1.5 * intensity;
        case 'topological_inversion': return 0.8 * intensity;
        case 'quantum_superposition': return intensity;
        case 'scale': {
            const sx = trans.sx || 1, sy = trans.sy || 1, sz = trans.sz || 1;
            return (Math.abs(sx - 1) + Math.abs(sy - 1) + Math.abs(sz - 1)) * intensity;
        }
        case 'rotate': return (Math.abs(trans.angle || 0) / 180) * intensity;
        case 'translate': {
            const mag = Math.hypot(trans.tx || 0, trans.ty || 0, trans.tz || 0);
            return mag * intensity;
        }
        default: return intensity * 0.5;
    }
}

function createTransformNode(trans, childId, intensity, time, temporal) {
    const type = trans.type;
    const id = generateId('xf');
    const node = { id, type: 'transform', child: { id: childId } };
    const params = trans;

    switch (type) {
        case 'twist':
            node.twist = true;
            node.axis = params.axis || 'z';
            node.angle = (params.angle || 360) * intensity;
            node.swirlStrength = node.angle / 360;
            break;
        case 'warp':
            node.domain_distortion = true;
            node.distortFreq = (params.frequency || 2.0) * (0.5 + intensity);
            node.distortAmp = (params.strength || 0.5) * intensity;
            break;
        case 'fractal_noise':
            node.domain_distortion = true;
            node.distortFreq = (params.octaves || 4) * 0.8 * (0.7 + intensity * 0.6);
            node.distortAmp = (params.amplitude || 0.2) * intensity * 1.2;
            node.distortOctaves = Math.floor(3 + intensity * 5);
            break;
        case 'chaos':
            node.swirl = true;
            node.swirlStrength = 1.5 * intensity;
            node.swirlFreq = 2.0;
            break;
        case 'topological_inversion':
            node.sphere_fold = true;
            node.sphereMinR = 0.2 + intensity * 0.3;
            node.sphereMaxR = 1.2 + intensity * 0.8;
            break;
        case 'quantum_superposition':
            node.quantum = true;
            node.strength = intensity;
            node.seed = (params.seed || Math.floor(Math.random() * 10000)) + (temporal ? Math.floor(time * 10) : 0);
            break;
        case 'scale':
            node.scale = true;
            const sf = 1 + (params.uniform ? (params.uniform - 1) : (params.sx ? params.sx - 1 : 0)) * intensity;
            node.sx = node.sy = node.sz = sf;
            if (params.sx) node.sx = 1 + (params.sx - 1) * intensity;
            if (params.sy) node.sy = 1 + (params.sy - 1) * intensity;
            if (params.sz) node.sz = 1 + (params.sz - 1) * intensity;
            break;
        case 'rotate':
            node.rotate = true;
            node.angle = (params.angle || 0) * intensity;
            node.axis = params.axis || 'y';
            break;
        case 'translate':
            node.translate = true;
            node.tx = (params.tx || 0) * intensity;
            node.ty = (params.ty || 0) * intensity;
            node.tz = (params.tz || 0) * intensity;
            break;
        case 'bend':
            node.bend = true;
            node.intensity = (params.intensity || 0.5) * intensity;
            node.radius = params.radius || 1.0;
            break;
        case 'repeat':
            node.repeat = true;
            node.period = (params.period || 2.0) * (0.8 + intensity * 0.5);
            node.offset = params.offset || 0;
            break;
        case 'mirror':
            node.mirror = true;
            node.axis = params.axis || 'x';
            break;
        default:
            // fallback scale neutre
            node.scale = true;
            node.sx = node.sy = node.sz = 1 + intensity * 0.1;
            break;
    }
    if (temporal && (type === 'twist' || type === 'warp')) {
        node.time = time;
        node.modulate = true;
    }
    return node;
}

function buildMaterialProfileFromArtistic(material, styles, intensity) {
    let styleMod = { defaultMaterial: 'soft', intensityFactor: 1.0, addMeta: {} };
    if (styles && styles.length) {
        for (const s of styles) {
            if (STYLE_MODIFIERS[s]) {
                styleMod = STYLE_MODIFIERS[s];
                break;
            }
        }
    }
    const effectiveIntensity = intensity * styleMod.intensityFactor;
    let materialName = styleMod.defaultMaterial;
    let props = { roughness: 0.4 + (1 - effectiveIntensity) * 0.3 };

    if (material && material.type) {
        switch (material.type) {
            case 'glass': materialName = 'glass'; props = { ior: 1.45 + effectiveIntensity * 0.1, caustics: effectiveIntensity > 0.5 }; break;
            case 'metal': materialName = 'metal'; props = { roughness: Math.max(0.05, 0.4 - effectiveIntensity * 0.3), metalness: 0.9 + effectiveIntensity * 0.1 }; break;
            case 'liquid': materialName = 'liquid'; props = { viscosity: 0.2 + effectiveIntensity * 0.6, ior: 1.33 }; break;
            case 'energy': materialName = 'emissive'; props = { emissiveIntensity: 0.5 + effectiveIntensity * 2.0, color: material.color || [1,0.5,0] }; break;
            case 'neon': materialName = 'emissive'; props = { emissiveIntensity: 1.2 + effectiveIntensity * 1.5, bloom: true }; break;
            default: materialName = styleMod.defaultMaterial; props.roughness = 0.3 + (1 - effectiveIntensity) * 0.4;
        }
    }
    let morphology = 'abstract';
    if (styles) {
        if (styles.includes('psychedelic')) morphology = 'psychedelic';
        else if (styles.includes('cyberpunk')) morphology = 'geometric';
        else if (styles.includes('surrealism')) morphology = 'surreal';
        else if (styles.includes('minimal')) morphology = 'minimal';
    }
    return {
        material: materialName,
        dominant_morphology: morphology,
        intensity_factor: effectiveIntensity,
        ...props,
        ...styleMod.addMeta
    };
}

function createMetaNodes(artisticResult, intensity, lastNodeId) {
    const metaNodes = [];
    if (Array.isArray(artisticResult.materialLayers)) {
        for (let i = 0; i < artisticResult.materialLayers.length; i++) {
            const layer = artisticResult.materialLayers[i];
            metaNodes.push({
                id: generateId('meta_mat'),
                type: 'meta',
                kind: 'material_layer',
                attachTo: lastNodeId,
                layerIndex: i,
                blend: layer.blend || 'mix',
                material: layer.material || 'soft',
                weight: Math.min(1.0, (layer.weight || 0.5) * intensity),
                color: layer.color || null
            });
        }
    }
    if (Array.isArray(artisticResult.colorFields)) {
        for (let i = 0; i < artisticResult.colorFields.length; i++) {
            const cf = artisticResult.colorFields[i];
            metaNodes.push({
                id: generateId('meta_color'),
                type: 'meta',
                kind: 'color_field',
                attachTo: lastNodeId,
                fieldType: cf.type || 'gradient',
                colors: cf.colors || [[1,0,0],[0,0,1]],
                intensity: (cf.intensity || 0.5) * intensity,
                mapping: cf.mapping || 'position'
            });
        }
    }
    if (Array.isArray(artisticResult.styles) && artisticResult.styles.length) {
        metaNodes.push({
            id: generateId('meta_style'),
            type: 'meta',
            kind: 'style_tags',
            attachTo: lastNodeId,
            styles: artisticResult.styles.slice(),
            intensity: intensity
        });
    }
    return metaNodes;
}

function getFallbackGraph(intensity) {
    const fallbackId = generateId('fallback_prim');
    return {
        nodeGraph: {
            root: fallbackId,
            nodes: [{ id: fallbackId, type: 'primitive', kind: 'sphere', params: { r: 0.8 + intensity * 0.4 } }]
        },
        profile: { material: 'soft', dominant_morphology: 'abstract', roughness: 0.5, emissiveIntensity: 0.2, fallback: true },
        intensity,
        mode: 'artistic_fallback'
    };
}

module.exports = {
    artisticToArtisticGraph,
    clearCache: () => { conversionCache.clear(); },
    setCacheSize: (size) => { if (size > 0) CACHE_MAX_SIZE = size; }
};
