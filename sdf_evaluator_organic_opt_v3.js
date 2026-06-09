// sdf_evaluator_organic_opt_v3.js
// HELIXFORGE 6.0 — Évaluateur SDF avec diagnostics et robustesse

const EPS = 1e-6;
const DEBUG = true;

function log(...args) { if (DEBUG) console.log("[SDF_EVAL]", ...args); }
function warn(...args) { if (DEBUG) console.warn("[SDF_EVAL WARN]", ...args); }

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function mix(a, b, t) { return a * (1 - t) + b * t; }
function dot3(ax, ay, az, bx, by, bz) { return ax*bx + ay*by + az*bz; }
function len2(x, y, z) { return x*x + y*y + z*z; }

// ========== PRIMITIVES SDF ==========
function sdfSphere(p, r) { return Math.hypot(p[0], p[1], p[2]) - r; }
function sdfBox(p, sx, sy, sz) {
    const qx = Math.abs(p[0]) - sx, qy = Math.abs(p[1]) - sy, qz = Math.abs(p[2]) - sz;
    const dx = Math.max(qx, 0), dy = Math.max(qy, 0), dz = Math.max(qz, 0);
    return Math.min(Math.max(qx, qy, qz), 0) + Math.hypot(dx, dy, dz);
}
function sdfCylinder(p, r, h) {
    const dxy = Math.hypot(p[0], p[1]) - r;
    const dz = Math.abs(p[2]) - h*0.5;
    return Math.max(dxy, dz);
}
function sdfCapsule(p, ax, ay, az, bx, by, bz, r) {
    const pax = p[0]-ax, pay = p[1]-ay, paz = p[2]-az;
    const bax = bx-ax, bay = by-ay, baz = bz-az;
    const ba2 = len2(bax, bay, baz);
    const h = clamp(dot3(pax, pay, paz, bax, bay, baz) / (ba2 + 1e-8), 0, 1);
    const cx = ax + bax*h, cy = ay + bay*h, cz = az + baz*h;
    return Math.hypot(p[0]-cx, p[1]-cy, p[2]-cz) - r;
}
function sdfTorus(p, r1, r2) {
    const q = Math.hypot(p[0], p[1]) - r1;
    return Math.hypot(q, p[2]) - r2;
}
function sdfPlane(p, nx, ny, nz, d) { return nx*p[0] + ny*p[1] + nz*p[2] + d; }
function sdfEllipsoid(p, rx, ry, rz) { return Math.hypot(p[0]/rx, p[1]/ry, p[2]/rz) - 1; }
function sdfRoundedBox(p, sx, sy, sz, rad) {
    const qx = Math.abs(p[0]) - sx + rad;
    const qy = Math.abs(p[1]) - sy + rad;
    const qz = Math.abs(p[2]) - sz + rad;
    const dx = Math.max(qx, 0), dy = Math.max(qy, 0), dz = Math.max(qz, 0);
    return Math.min(Math.max(qx, qy, qz), 0) + Math.hypot(dx, dy, dz) - rad;
}
function sdfCone(p, r, h) {
    const q = Math.hypot(p[0], p[1]);
    const d = Math.max(q - r * (0.5 - p[2]/h), Math.abs(p[2] + h*0.5));
    return d;
}
function sdfPyramid(p, w, h) {
    const q = Math.abs(p[0]) + Math.abs(p[1]);
    const d = Math.max(q - w * (0.5 - p[2]/h), Math.abs(p[2] + h*0.5));
    return d;
}

// ========== OPÉRATIONS ==========
function opUnion(a,b) { return a < b ? a : b; }
function opSubtract(a,b) { return a > -b ? a : -b; }
function opIntersect(a,b) { return a > b ? a : b; }
function opSmoothUnion(a,b,k) {
    if (k <= 0) return opUnion(a,b);
    const h = clamp(0.5 + 0.5*(b-a)/k, 0, 1);
    return mix(a,b,h) - k*h*(1-h);
}
function opSmoothSubtract(a,b,k) {
    if (k <= 0) return opSubtract(a,b);
    const h = clamp(0.5 - 0.5*(b+a)/k, 0, 1);
    return mix(a,b,h) - k*h*(1-h);
}
function opSmoothIntersect(a,b,k) {
    if (k <= 0) return opIntersect(a,b);
    const h = clamp(0.5 - 0.5*(b-a)/k, 0, 1);
    return mix(a,b,h) + k*h*(1-h);
}

// ========== TRANSFORMATIONS ==========
function translate(p, tx, ty, tz) { return [p[0]-tx, p[1]-ty, p[2]-tz]; }
function scale(p, sx, sy, sz) { return [p[0]/sx, p[1]/sy, p[2]/sz]; }
function rotateQuat(p, qw, qx, qy, qz) {
    const x=p[0], y=p[1], z=p[2];
    const ix = -qx, iy = -qy, iz = -qz, iw = qw;
    const x2 = ix+ix, y2 = iy+iy, z2 = iz+iz;
    const xx = ix*x2, xy = ix*y2, xz = ix*z2;
    const yy = iy*y2, yz = iy*z2, zz = iz*z2;
    const wx = iw*x2, wy = iw*y2, wz = iw*z2;
    const rx = (1-(yy+zz))*x + (xy-wz)*y + (xz+wy)*z;
    const ry = (xy+wz)*x + (1-(xx+zz))*y + (yz-wx)*z;
    const rz = (xz-wy)*x + (yz+wx)*y + (1-(xx+yy))*z;
    return [rx, ry, rz];
}
function noiseDeform(p, amp, freq) {
    const a = amp || 0.1, f = freq || 1.5;
    const nx = Math.sin(p[0]*f) + Math.sin(p[1]*f) + Math.sin(p[2]*f);
    const ny = Math.sin(p[1]*f) + Math.sin(p[2]*f) + Math.sin(p[0]*f);
    const nz = Math.sin(p[2]*f) + Math.sin(p[0]*f) + Math.sin(p[1]*f);
    return [p[0] + nx*a/3, p[1] + ny*a/3, p[2] + nz*a/3];
}
function warpDeform(p, strength) {
    const k = strength || 0.1;
    return [p[0] + Math.sin(p[1])*k, p[1] + Math.sin(p[2])*k, p[2] + Math.sin(p[0])*k];
}
function twist(p, angleDeg, height) {
    const angle = (angleDeg||0) * Math.PI/180;
    const h = height || 1;
    const t = clamp(p[1]/h, -1, 1) * angle;
    const c = Math.cos(t), s = Math.sin(t);
    return [p[0]*c - p[2]*s, p[1], p[0]*s + p[2]*c];
}
function bend(p, amount) {
    const k = amount || 0.3;
    const t = clamp(p[0], -1, 1) * k;
    const c = Math.cos(t), s = Math.sin(t);
    return [p[0], p[1]*c - p[2]*s, p[1]*s + p[2]*c];
}
function inflate(p, amount) {
    const k = amount || 0.1;
    const L = Math.hypot(p[0], p[1], p[2]);
    const factor = 1 + k * Math.tanh(L);
    return [p[0]*factor, p[1]*factor, p[2]*factor];
}
function waveDeform(p, amp, freq, timeMs) {
    const t = (timeMs || 0) * 0.001;
    const a = amp || 0.3, f = freq || 2.0;
    return [
        p[0] + Math.sin(p[1]*f + t)*a,
        p[1] + Math.sin(p[0]*f + t*0.7)*a*0.5,
        p[2] + Math.sin(p[1]*f + t*1.3)*a*0.8
    ];
}
function roundedCorner(p, rad) {
    const q = [Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])];
    const d = Math.max(Math.max(q[0]-rad, q[1]-rad, q[2]-rad), 0);
    return [Math.sign(p[0])*(q[0]-d), Math.sign(p[1])*(q[1]-d), Math.sign(p[2])*(q[2]-d)];
}
function taper(p, factor, axis) {
    const t = factor || 0.5;
    if (axis === 'y') {
        const scaleY = 1 - t * clamp(p[1], -1, 1);
        return [p[0]*scaleY, p[1], p[2]*scaleY];
    } else if (axis === 'x') {
        const scaleX = 1 - t * clamp(p[0], -1, 1);
        return [p[0], p[1]*scaleX, p[2]*scaleX];
    } else {
        const scaleZ = 1 - t * clamp(p[2], -1, 1);
        return [p[0]*scaleZ, p[1]*scaleZ, p[2]];
    }
}
function anisotropy(p, strength, axis) {
    const s = strength || 0.5;
    if (axis === 'x') return [p[0]*(1+s), p[1], p[2]];
    if (axis === 'z') return [p[0], p[1], p[2]*(1+s)];
    return [p[0], p[1]*(1+s), p[2]];
}
function smoothTransform(p, amount) {
    const a = amount || 0.05;
    const L = Math.hypot(p[0], p[1], p[2]);
    if (L < a) return [0,0,0];
    const factor = 1 - a/L;
    return [p[0]*factor, p[1]*factor, p[2]*factor];
}

// ========== ÉVALUATEUR AVEC DIAGNOSTIC ==========
class SDFEvaluatorOrganicOpt {
    constructor() {
        this._time = Date.now();
        this._animations = new Map();
        this._debugPoints = [
            [0,0,0], [1,0,0], [0,1,0], [0,0,1], [-1,0,0]
        ];
    }
    updateTime(now) { this._time = now; }

    evaluate(node, x, y, z) {
        if (!node) return 1e9;
        return this._eval(node, [x, y, z]);
    }

    _eval(node, p) {
        if (!node) return 1e9;
        if (node._type === 'primitive') {
            return this._evalPrimitive(node, p);
        } else if (node._type === 'transform') {
            return this._evalTransform(node, p);
        } else if (node._type === 'op') {
            return this._evalOp(node, p);
        }
        // Fallback
        warn("Type de nœud inconnu:", node._type);
        return sdfSphere(p, 1);
    }

    _evalPrimitive(node, p) {
        let kind = node.kind || node.op;
        const params = node.params || {};
        // Normalisation des kinds courants
        if (kind === 'tissue' || kind === 'blob' || kind === 'gelatinous') {
            kind = 'sphere'; // fallback sûr
        }
        switch (kind) {
            case 'sphere': return sdfSphere(p, params.r ?? 1);
            case 'box': return sdfBox(p, params.sx ?? 1, params.sy ?? 1, params.sz ?? 1);
            case 'cylinder': return sdfCylinder(p, params.r ?? 1, params.h ?? 1);
            case 'capsule': return sdfCapsule(p, params.ax??0, params.ay??0, params.az??0, params.bx??1, params.by??0, params.bz??0, params.r??0.5);
            case 'torus': return sdfTorus(p, params.r1 ?? 1.2, params.r2 ?? 0.35);
            case 'plane': return sdfPlane(p, params.nx??0, params.ny??1, params.nz??0, params.d??0);
            case 'ellipsoid': return sdfEllipsoid(p, params.rx??1, params.ry??1, params.rz??1);
            case 'rounded_box': return sdfRoundedBox(p, params.sx??1, params.sy??1, params.sz??1, params.rad??0.2);
            case 'cone': return sdfCone(p, params.r??0.5, params.h??1);
            case 'pyramid': return sdfPyramid(p, params.w??1, params.h??1);
            default:
                warn(`Primitive inconnue: ${kind}, utilisation sphère`);
                return sdfSphere(p, 1);
        }
    }

    _evalTransform(node, p) {
        let q = [p[0], p[1], p[2]];
        const op = node.op;
        const params = node.params || {};
        let scaleFactors = [1,1,1];

        // Appliquer la transformation sur le point
        switch (op) {
            case 'translate':
                q = translate(q, params.tx??0, params.ty??0, params.tz??0);
                break;
            case 'scale':
                const sx = params.factor?.[0] ?? params.sx ?? 1;
                const sy = params.factor?.[1] ?? params.sy ?? 1;
                const sz = params.factor?.[2] ?? params.sz ?? 1;
                if (sx <= 0 || sy <= 0 || sz <= 0) {
                    warn(`Facteur d'échelle invalide: (${sx},${sy},${sz})`);
                    return 1e9;
                }
                q = scale(q, sx, sy, sz);
                scaleFactors = [sx, sy, sz];
                break;
            case 'rotate':
                let qw=1,qx=0,qy=0,qz=0;
                if (params.angle !== undefined) {
                    const angleRad = params.angle * Math.PI/180, s=Math.sin(angleRad/2), c=Math.cos(angleRad/2);
                    const axis = params.axis||[0,1,0];
                    const norm = Math.hypot(...axis)||1;
                    qw=c; qx=(axis[0]/norm)*s; qy=(axis[1]/norm)*s; qz=(axis[2]/norm)*s;
                } else if (params.rotate) {
                    const rot=params.rotate; qw=rot.w??1; qx=rot.x??0; qy=rot.y??0; qz=rot.z??0;
                }
                q = rotateQuat(q, qw, qx, qy, qz);
                break;
            case 'noise':
                q = noiseDeform(q, params.amplitude, params.frequency);
                break;
            case 'warp':
                q = warpDeform(q, params.strength);
                break;
            case 'twist':
                q = twist(q, params.angle, params.height);
                break;
            case 'bend':
                q = bend(q, params.angle);
                break;
            case 'inflate':
                q = inflate(q, params.amount);
                break;
            case 'wave':
                q = waveDeform(q, params.amplitude, params.frequency, this._time);
                break;
            case 'rounded':
                q = roundedCorner(q, params.radius??0.1);
                break;
            case 'taper':
                q = taper(q, params.factor, params.axis || 'y');
                break;
            case 'anisotropy':
                q = anisotropy(q, params.strength, params.axis);
                break;
            case 'smooth':
                q = smoothTransform(q, params.amount);
                break;
            default:
                warn(`Transformation inconnue: ${op}`);
        }

        let d = this._eval(node.child, q);

        // Ajustement pour l'échelle
        if (op === 'scale') {
            const [sx,sy,sz] = scaleFactors;
            if (Math.abs(sx-sy)<EPS && Math.abs(sx-sz)<EPS) d *= sx;
            else d *= Math.pow(Math.abs(sx*sy*sz), 1/3);
        }

        // Animation
        if (node.animation && this._time) {
            d = this._applyAnimation(d, node.animation, this._time);
        }
        return d;
    }

    _evalOp(node, p) {
        const left = this._eval(node.left, p);
        const right = this._eval(node.right, p);
        const k = node.smoothness ?? 0.2;
        switch (node.op) {
            case 'smooth_union': return opSmoothUnion(left, right, k);
            case 'smooth_subtract': return opSmoothSubtract(left, right, k);
            case 'smooth_intersect': return opSmoothIntersect(left, right, k);
            case 'union': return opUnion(left, right);
            case 'subtract': return opSubtract(left, right);
            case 'intersect': return opIntersect(left, right);
            default: return opUnion(left, right);
        }
    }

    _applyAnimation(d, anim, timeMs) {
        if (!anim) return d;
        const t = timeMs * 0.001;
        const speed = anim.speed || 1;
        const intensity = anim.intensity || 1;
        switch (anim.type) {
            case 'pulsation':
                const scaleVar = (anim.scaleVariation || 0.2) * Math.sin(t * speed * Math.PI * 2);
                return d - scaleVar;
            case 'respiration':
                const breath = 0.1 * intensity * Math.sin(t * speed * Math.PI * 2);
                return d - breath;
            case 'oscillation':
                const osc = 0.05 * intensity * Math.sin(t * speed * Math.PI * 2);
                return d - osc;
            case 'progressiveMutation':
                const warp = anim.warpStrength || 0.2;
                return d - warp * Math.sin(t * speed);
            case 'animatedGrowth':
                const grow = 0.3 * intensity * (1 - Math.exp(-t * speed));
                return d - grow;
            default:
                return d;
        }
    }

    // Diagnostic : évalue la SDF en quelques points
    diagnose(node) {
        log("=== Diagnostic SDF ===");
        for (const pt of this._debugPoints) {
            const d = this.evaluate(node, pt[0], pt[1], pt[2]);
            log(`  point (${pt[0]},${pt[1]},${pt[2]}) -> distance = ${d.toFixed(4)}`);
        }
        // Test sur un petit cube
        let minD = Infinity, maxD = -Infinity;
        for (let x = -1.5; x <= 1.5; x+=0.5) {
            for (let y = -1.5; y <= 1.5; y+=0.5) {
                for (let z = -1.5; z <= 1.5; z+=0.5) {
                    const d = this.evaluate(node, x, y, z);
                    if (d < minD) minD = d;
                    if (d > maxD) maxD = d;
                }
            }
        }
        log(`  Distance min sur [-1.5,1.5]^3: ${minD.toFixed(4)}, max: ${maxD.toFixed(4)}`);
        if (minD > 0 && maxD > 0) log("  ⚠️ Aucune distance négative détectée → pas de surface dans cette boîte");
        else if (minD < 0 && maxD < 0) log("  ⚠️ Toutes distances négatives → la forme remplit toute la boîte");
        else if (minD < 0 && maxD > 0) log("  ✅ Intersection avec zéro détectée, surface présente");
        return { minD, maxD };
    }
}

// ========== CONSTRUCTION DU GRAPHE ==========
function createOrganicOptimizedEvaluator(graph) {
    log("=== createOrganicOptimizedEvaluator ===");
    if (!graph || typeof graph !== 'object') throw new Error("Graph invalide");

    // Normalisation
    if (!Array.isArray(graph.nodes)) {
        const arr = [];
        for (const [id, node] of Object.entries(graph.nodes || {})) arr.push({ id, ...node });
        graph.nodes = arr;
    }
    if (!graph.root && graph.rootNode) graph.root = graph.rootNode;

    const nodesMap = new Map(graph.nodes.map(n => [n.id, n]));
    const buildCache = new Map();

    function resolveRef(ref) {
        if (!ref) return null;
        if (typeof ref === 'string') return nodesMap.get(ref);
        if (ref.id) return nodesMap.get(ref.id);
        return ref;
    }

    function buildNode(ref) {
        if (!ref) return null;
        const raw = resolveRef(ref);
        if (!raw) return null;
        let normalized = { ...raw };
        if (normalized.type && !normalized._type) {
            normalized._type = normalized.type;
            if (normalized.op && normalized.type === 'primitive') normalized.kind = normalized.op;
            delete normalized.type;
        }
        if (normalized.op && !normalized._type && !normalized.type) {
            normalized._type = 'primitive';
            normalized.kind = normalized.op;
            delete normalized.op;
        }
        if (normalized.input && !normalized.child) {
            normalized.child = normalized.input;
            delete normalized.input;
        }
        const cacheKey = normalized.id || JSON.stringify(normalized);
        if (buildCache.has(cacheKey)) return buildCache.get(cacheKey);

        let result;
        if (normalized._type === 'primitive') {
            result = { _type: 'primitive', kind: normalized.kind || 'sphere', params: { ...(normalized.params || {}), ...normalized } };
            if (result.params.r === undefined && result.kind === 'sphere') result.params.r = 0.5;
        } else if (normalized._type === 'op') {
            const left = buildNode(normalized.left);
            const right = buildNode(normalized.right);
            result = { _type: 'op', op: normalized.op || 'smooth_union', left, right, smoothness: normalized.smoothness ?? normalized.k ?? 0.15 };
        } else if (normalized._type === 'transform') {
            const childRef = normalized.child || normalized.input || (normalized.children?.[0]);
            const child = buildNode(childRef);
            result = { _type: 'transform', op: normalized.op || 'translate', params: normalized.params || {}, child, animation: normalized.animation || null };
        } else {
            result = { _type: 'primitive', kind: 'sphere', params: { r: 0.5 } };
        }
        buildCache.set(cacheKey, result);
        return result;
    }

    const rootNode = buildNode({ id: graph.root });
    const evaluator = new SDFEvaluatorOrganicOpt();
    // Diagnostic automatique
    evaluator.diagnose(rootNode);
    log("✅ Évaluateur prêt");
    return { evaluator, rootNode };
}

module.exports = {
    SDFEvaluatorOrganicOpt,
    createOrganicOptimizedEvaluator
};