// sdf_evaluator_strict_opt.js - Version haute performance sans allocations intermédiaires
// Support: primitives de base, ops booléennes, transformations (scale, translate, rotate)
// Correction: prise en charge directe du format de graphe HF3 (type "sphere", "box", etc.)

const EPS = 1e-6;

// Utilitaires inline
function dot(x1, y1, z1, x2, y2, z2) { return x1 * x2 + y1 * y2 + z1 * z2; }
function length2(x, y, z) { return x * x + y * y + z * z; }
function length(x, y, z) { return Math.sqrt(length2(x, y, z)); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

// Primitives
function sdfSphere(x, y, z, r) { return length(x, y, z) - r; }
function sdfBox(x, y, z, sx, sy, sz) {
    const qx = Math.abs(x) - sx, qy = Math.abs(y) - sy, qz = Math.abs(z) - sz;
    const maxComp = qx > qy ? (qx > qz ? qx : qz) : (qy > qz ? qy : qz);
    const dx = qx > 0 ? qx : 0, dy = qy > 0 ? qy : 0, dz = qz > 0 ? qz : 0;
    return Math.min(maxComp, 0) + Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function sdfCylinder(x, y, z, r, h) {
    const dxy = Math.hypot(x, y) - r;
    const dz = Math.abs(z) - h * 0.5;
    return dxy > dz ? dxy : dz;
}
function sdfCone(x, y, z, r, h) {
    const q = Math.hypot(x, y);
    const d = Math.max(q - r * (1 - (z + h * 0.5) / h), Math.abs(z + h * 0.5) - h * 0.5);
    return d;
}
function sdfTorus(x, y, z, r1, r2) {
    const q = Math.hypot(x, y) - r1;
    return Math.sqrt(q * q + z * z) - r2;
}
function sdfPlane(x, y, z, nx, ny, nz, d) { return nx * x + ny * y + nz * z + d; }

// Opérations booléennes
function opUnion(a, b) { return a < b ? a : b; }
function opSubtract(a, b) { return a > -b ? a : -b; }
function opIntersect(a, b) { return a > b ? a : b; }
function opSmoothUnion(a, b, k) {
    const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
    return b * h + a * (1 - h) - k * h * (1 - h);
}
function opSmoothSubtract(a, b, k) {
    const h = clamp(0.5 - 0.5 * (b + a) / k, 0, 1);
    return b * h + a * (1 - h) - k * h * (1 - h);
}
function opSmoothIntersect(a, b, k) {
    const h = clamp(0.5 - 0.5 * (b - a) / k, 0, 1);
    return b * h + a * (1 - h) + k * h * (1 - h);
}

// Transformations
class Transform {
    constructor(tx, ty, tz, sx, sy, sz, rotMat) {
        this.tx = tx; this.ty = ty; this.tz = tz;
        this.sx = sx; this.sy = sy; this.sz = sz;
        this.rotMat = rotMat;
    }
    apply(x, y, z, out) {
        let lx = x - this.tx;
        let ly = y - this.ty;
        let lz = z - this.tz;
        lx /= this.sx;
        ly /= this.sy;
        lz /= this.sz;
        if (this.rotMat) {
            const m = this.rotMat;
            const rx = m[0] * lx + m[1] * ly + m[2] * lz;
            const ry = m[3] * lx + m[4] * ly + m[5] * lz;
            const rz = m[6] * lx + m[7] * ly + m[8] * lz;
            out[0] = rx; out[1] = ry; out[2] = rz;
        } else {
            out[0] = lx; out[1] = ly; out[2] = lz;
        }
    }
}

function quatToMatrix(qw, qx, qy, qz) {
    const xx = qx * qx, yy = qy * qy, zz = qz * qz;
    const xy = qx * qy, xz = qx * qz, yz = qy * qz;
    const wx = qw * qx, wy = qw * qy, wz = qw * qz;
    return [
        1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
        2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
        2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)
    ];
}

// Évaluateur
class SDFEvaluatorStrictOpt {
    constructor() {
        this._tmp = [0, 0, 0];
    }
    evaluate(node, x, y, z) {
        if (!node) return 1e9;
        switch (node._type) {
            case 'primitive': return this._primitive(node, x, y, z);
            case 'op': return this._boolean(node, x, y, z);
            case 'transform': return this._transform(node, x, y, z);
            default: return 1e9;
        }
    }
    _primitive(prim, x, y, z) {
        const p = prim;
        switch (p.kind) {
            case 'sphere': return sdfSphere(x, y, z, p.r);
            case 'box': return sdfBox(x, y, z, p.sx, p.sy, p.sz);
            case 'cylinder': return sdfCylinder(x, y, z, p.r, p.h);
            case 'cone': return sdfCone(x, y, z, p.r, p.h);
            case 'torus': return sdfTorus(x, y, z, p.r1, p.r2);
            case 'plane': return sdfPlane(x, y, z, p.nx, p.ny, p.nz, p.d);
            default: return 1e9;
        }
    }
    _boolean(opNode, x, y, z) {
        const left = this.evaluate(opNode.left, x, y, z);
        const right = this.evaluate(opNode.right, x, y, z);
        const k = opNode.smoothness;
        switch (opNode.op) {
            case 'union': return left < right ? left : right;
            case 'subtract': return left > -right ? left : -right;
            case 'intersect': return left > right ? left : right;
            case 'smooth_union': return opSmoothUnion(left, right, k);
            case 'smooth_subtract': return opSmoothSubtract(left, right, k);
            case 'smooth_intersect': return opSmoothIntersect(left, right, k);
            default: return 1e9;
        }
    }
    _transform(transNode, x, y, z) {
        transNode.transform.apply(x, y, z, this._tmp);
        return this.evaluate(transNode.child, this._tmp[0], this._tmp[1], this._tmp[2]);
    }
}

// Construction de l'arbre optimisé à partir du graphe HF3
function createStrictOptimizedEvaluator(graph) {
    // Normalisation du graphe (si nodes est un objet, le convertir en tableau)
    if (!Array.isArray(graph.nodes)) {
        const arr = [];
        for (const [id, n] of Object.entries(graph.nodes)) arr.push({ id, ...n });
        graph.nodes = arr;
    }
    if (!graph.root && graph.rootNode) graph.root = graph.rootNode;
    if (graph.rootId) graph.root = graph.rootId;

    const nodesMap = new Map(graph.nodes.map(n => [n.id, n]));

    function buildNode(ref) {
        let raw = ref && typeof ref === 'object' && ref.id ? nodesMap.get(ref.id) : ref;
        if (!raw) return null;

        // --- Primitives (type "sphere", "box", "cylinder", "cone", "torus", "plane") ---
        if (raw.type === 'sphere' || raw.type === 'box' || raw.type === 'cylinder' ||
            raw.type === 'cone' || raw.type === 'torus' || raw.type === 'plane') {
            const p = { _type: 'primitive', kind: raw.type };
            if (p.kind === 'sphere') {
                p.r = raw.r ?? 1;
            } else if (p.kind === 'box') {
                // Gère size (objet ou tableau) ou width/height/depth
                if (raw.size !== undefined) {
                    let size = raw.size;
                    if (Array.isArray(size)) {
                        p.sx = size[0] ?? 1;
                        p.sy = size[1] ?? 1;
                        p.sz = size[2] ?? 1;
                    } else {
                        p.sx = size.x ?? 1;
                        p.sy = size.y ?? 1;
                        p.sz = size.z ?? 1;
                    }
                } else {
                    p.sx = raw.width ?? 1;
                    p.sy = raw.height ?? 1;
                    p.sz = raw.depth ?? 1;
                }
            } else if (p.kind === 'cylinder') {
                p.r = raw.r ?? 1;
                p.h = raw.height ?? 1;
            } else if (p.kind === 'cone') {
                p.r = raw.r ?? 1;
                p.h = raw.height ?? 1;
            } else if (p.kind === 'torus') {
                p.r1 = raw.r1 ?? raw.rmajor ?? 1;
                p.r2 = raw.r2 ?? raw.rminor ?? 0.2;
            } else if (p.kind === 'plane') {
                const n = raw.normal ?? { x: 0, y: 1, z: 0 };
                p.nx = n.x; p.ny = n.y; p.nz = n.z;
                p.d = raw.d ?? 0;
            }
            return p;
        }

        // --- Opérations booléennes (type "op") ---
        if (raw.type === 'op') {
            const left = buildNode(raw.left);
            const right = buildNode(raw.right);
            if (!left || !right) return null;
            return {
                _type: 'op',
                op: raw.op,
                left, right,
                smoothness: raw.smoothness ?? 0.2,
                t: raw.t ?? 0.5,
                chamfer: raw.chamfer ?? 0.1
            };
        }

        // --- Transformations (type "transform") ---
        if (raw.type === 'transform') {
            const child = buildNode(raw.child);
            if (!child) return null;
            // Si la transformation a déjà un Transform précalculé, l'utiliser
            if (raw.transform) {
                return { _type: 'transform', transform: raw.transform, child };
            }
            // Sinon, construire un Transform à partir de translate, scale, rotate
            let tx = 0, ty = 0, tz = 0;
            let sx = 1, sy = 1, sz = 1;
            let rotMat = null;
            if (raw.translate) {
                const t = Array.isArray(raw.translate) ? raw.translate : [raw.translate.x, raw.translate.y, raw.translate.z];
                tx = t[0] || 0; ty = t[1] || 0; tz = t[2] || 0;
            }
            if (raw.scale) {
                const s = Array.isArray(raw.scale) ? raw.scale : [raw.scale.x, raw.scale.y, raw.scale.z];
                sx = s[0] || 1; sy = s[1] || 1; sz = s[2] || 1;
            }
            if (raw.rotate) {
                const q = Array.isArray(raw.rotate) ? raw.rotate : [raw.rotate.x, raw.rotate.y, raw.rotate.z, raw.rotate.w];
                let qx, qy, qz, qw;
                if (Array.isArray(q)) {
                    qx = q[0] || 0; qy = q[1] || 0; qz = q[2] || 0; qw = q[3] ?? 1;
                } else {
                    qx = q.x || 0; qy = q.y || 0; qz = q.z || 0; qw = q.w ?? 1;
                }
                rotMat = quatToMatrix(qw, qx, qy, qz);
            }
            const transform = new Transform(tx, ty, tz, sx, sy, sz, rotMat);
            return { _type: 'transform', transform, child };
        }

        // Type non reconnu
        console.warn("[createStrictOptimizedEvaluator] Type de nœud non supporté:", raw.type, raw);
        return null;
    }

    const rootNode = buildNode({ id: graph.root });
    if (!rootNode) {
        throw new Error("Failed to build root node from graph");
    }
    const evaluator = new SDFEvaluatorStrictOpt();
    return { evaluator, rootNode };
}

module.exports = { SDFEvaluatorStrictOpt, createStrictOptimizedEvaluator, Transform, quatToMatrix };
