// ============================================================================
// sdf_graph_builder.js — Convertisseur pipeline → Graphe SDF
// HelixForge 3.0 — Production-grade Ultra-Performant
//
// Rôle :
//   - Prendre un pipeline biomorphique (primitives, transforms, booleans, warps, styles)
//   - Construire un graphe SDF hiérarchique exécutable
//   - Appliquer transformations, warps organiques et styles créatifs
//   - Retourner un root SDF prêt pour le moteur de rendu
//
// Optimisations :
//   - Éviter allocations inutiles (objets temporaires, recopies)
//   - Pipeline → arbre en une passe O(n) sans récursion superflue
//   - Validation stricte avec erreurs détaillées (pas de fallback)
// ============================================================================

const NODE_TYPE_PRIMITIVE = 'sdf_primitive';
const NODE_TYPE_TRANSFORM = 'sdf_transform';
const NODE_TYPE_BOOLEAN  = 'sdf_boolean';
const NODE_TYPE_WARP     = 'sdf_warp';
const NODE_TYPE_STYLE    = 'sdf_style';
const NODE_TYPE_EMPTY    = 'sdf_empty';

const BOOL_UNION    = 'union';
const BOOL_SUBTRACT = 'subtract';
const BOOL_INTERSECT = 'intersect';

// ----------------------------------------------------------------------------
// 1. Constructeurs bas niveau
// ----------------------------------------------------------------------------
function createPrimitiveNode(kind, params) {
    return { node_type: NODE_TYPE_PRIMITIVE, kind, params, children: [] };
}

function createTransformNode(kind, params, child) {
    return { node_type: NODE_TYPE_TRANSFORM, kind, params, children: [child] };
}

function createBooleanNode(operation, left, right) {
    return { node_type: NODE_TYPE_BOOLEAN, operation, children: [left, right] };
}

function createWarpNode(kind, params, child) {
    return { node_type: NODE_TYPE_WARP, kind, params, children: [child] };
}

function createStyleNode(kind, params, child) {
    return { node_type: NODE_TYPE_STYLE, kind, params, children: [child] };
}

// ----------------------------------------------------------------------------
// 2. Validation stricte d'une opération
// ----------------------------------------------------------------------------
function validateOperation(op, index) {
    const prefix = `[sdf_graph_builder] Operation at index ${index}`;
    if (!op || typeof op !== 'object') {
        throw new Error(`${prefix} is not an object`);
    }
    if (!op.op) {
        throw new Error(`${prefix} missing 'op' field`);
    }

    switch (op.op) {
        case 'primitive':
            if (!op.kind || typeof op.kind !== 'string') {
                throw new Error(`${prefix} primitive missing 'kind' (string)`);
            }
            if (op.params && typeof op.params !== 'object') {
                throw new Error(`${prefix} primitive 'params' must be an object`);
            }
            break;
        case 'transform':
            if (!op.kind || typeof op.kind !== 'string') {
                throw new Error(`${prefix} transform missing 'kind' (string)`);
            }
            if (!op.args || typeof op.args !== 'object') {
                throw new Error(`${prefix} transform missing 'args' (object)`);
            }
            break;
        case 'boolean':
            if (!op.operation || !['union', 'subtract', 'intersect'].includes(op.operation)) {
                throw new Error(`${prefix} boolean operation must be 'union'/'subtract'/'intersect'`);
            }
            if (!op.left || !op.right) {
                throw new Error(`${prefix} boolean missing 'left' or 'right' subtree`);
            }
            // validation récursive des sous-pipelines
            if (Array.isArray(op.left)) op.left.forEach((sub, i) => validateOperation(sub, i));
            if (Array.isArray(op.right)) op.right.forEach((sub, i) => validateOperation(sub, i));
            break;
        case 'organic':
            if (!op.kind || typeof op.kind !== 'string') {
                throw new Error(`${prefix} organic missing 'kind' (string)`);
            }
            if (op.params && typeof op.params !== 'object') {
                throw new Error(`${prefix} organic 'params' must be an object`);
            }
            break;
        case 'creative':
            if (!op.kind || typeof op.kind !== 'string') {
                throw new Error(`${prefix} creative missing 'kind' (string)`);
            }
            if (op.params && typeof op.params !== 'object') {
                throw new Error(`${prefix} creative 'params' must be an object`);
            }
            break;
        default:
            throw new Error(`${prefix} unknown op type '${op.op}'`);
    }
}

// ----------------------------------------------------------------------------
// 3. Conversion pipeline → graphe
// ----------------------------------------------------------------------------
function buildGraphFromPipeline(pipeline) {
    if (!Array.isArray(pipeline)) {
        throw new Error('[sdf_graph_builder] Pipeline must be an array');
    }
    if (pipeline.length === 0) {
        return { node_type: NODE_TYPE_EMPTY, children: [] };
    }

    // Validation complète avant construction
    for (let i = 0; i < pipeline.length; i++) {
        validateOperation(pipeline[i], i);
    }

    let root = null;

    for (let i = 0; i < pipeline.length; i++) {
        const op = pipeline[i];
        switch (op.op) {
            case 'primitive':
                const prim = createPrimitiveNode(op.kind, op.params || {});
                if (root === null) {
                    root = prim;
                } else {
                    root = createBooleanNode(BOOL_UNION, root, prim);
                }
                break;

            case 'transform':
                if (root === null) {
                    throw new Error(`[sdf_graph_builder] transform at index ${i} has no previous geometry`);
                }
                root = createTransformNode(op.kind, op.args || {}, root);
                break;

            case 'boolean':
                if (!op.left || !op.right) {
                    throw new Error(`[sdf_graph_builder] boolean at index ${i} missing left/right`);
                }
                const leftGraph = buildGraphFromPipeline(Array.isArray(op.left) ? op.left : [op.left]);
                const rightGraph = buildGraphFromPipeline(Array.isArray(op.right) ? op.right : [op.right]);
                root = createBooleanNode(op.operation, leftGraph, rightGraph);
                break;

            case 'organic':
                if (root === null) {
                    throw new Error(`[sdf_graph_builder] organic warp at index ${i} has no previous geometry`);
                }
                root = createWarpNode(op.kind, op.params || {}, root);
                break;

            case 'creative':
                if (root === null) {
                    throw new Error(`[sdf_graph_builder] creative style at index ${i} has no previous geometry`);
                }
                root = createStyleNode(op.kind, op.params || {}, root);
                break;
        }
    }

    return root || { node_type: NODE_TYPE_EMPTY, children: [] };
}

// ----------------------------------------------------------------------------
// 4. Conversion d'un objet biomorphique complet → graphe SDF
// ----------------------------------------------------------------------------
function biomorphicToSDFGraph(biomorphic, options = {}) {
    if (!biomorphic || typeof biomorphic !== 'object') {
        throw new Error('[sdf_graph_builder] Invalid biomorphic: not an object');
    }
    if (!Array.isArray(biomorphic.pipeline)) {
        throw new Error('[sdf_graph_builder] Invalid biomorphic: missing pipeline array');
    }

    const root = buildGraphFromPipeline(biomorphic.pipeline);

    return {
        mode: 'SDF',
        root: root,
        pipeline: biomorphic.pipeline,
        stages: biomorphic.stages || [],
        meta: Object.assign({}, biomorphic.meta, {
            builderVersion: '3.0-prod',
            timestamp: Date.now(),
            nodeCount: countNodesFast(root)
        })
    };
}

// ----------------------------------------------------------------------------
// 5. Utilitaires performants
// ----------------------------------------------------------------------------
function countNodesFast(root) {
    if (!root || root.node_type === NODE_TYPE_EMPTY) return 0;
    let count = 0;
    const stack = [root];
    while (stack.length) {
        const node = stack.pop();
        count++;
        if (node.children && node.children.length) {
            for (let i = 0; i < node.children.length; i++) {
                stack.push(node.children[i]);
            }
        }
    }
    return count;
}

// ----------------------------------------------------------------------------
// 6. API publique
// ----------------------------------------------------------------------------
module.exports = {
    biomorphicToSDFGraph,
    buildGraphFromPipeline,
    createPrimitiveNode,
    createTransformNode,
    createBooleanNode,
    createWarpNode,
    createStyleNode,
    countNodesFast,
    validateOperation
};
