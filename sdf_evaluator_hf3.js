// ============================================================================
// sdf_evaluator_hf3.js — Moteur SDF pour graph HF3 (root + nodes)
// Version HF3+ COMPLETE : support STRICT + ORGANIC + META
// Inclut toutes les primitives, ops, transformations, organiques spéciaux et meta-nœuds.
// ============================================================================

const EPS = 1e-6;
const DEBUG = false;   // Désactiver logs

function log(...args) { if (DEBUG) console.log("[SDF_DEBUG]", ...args); }

function length(v) { return Math.hypot(v.x, v.y, v.z); }
function dot(a,b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
function clamp(x,a,b) { return Math.min(b,Math.max(a,x)); }

// ============================================================================
// PRIMITIVES (complètes)
// ============================================================================
function sdfSphere(p, r) { return length(p) - r; }
function sdfBox(p, size) {
    const q = { x: Math.abs(p.x)-size.x, y: Math.abs(p.y)-size.y, z: Math.abs(p.z)-size.z };
    return Math.min(Math.max(q.x, Math.max(q.y, q.z)), 0) + length({ x: Math.max(q.x,0), y: Math.max(q.y,0), z: Math.max(q.z,0) });
}
function sdfRoundedBox(p, size, radius) {
    const q = { x: Math.abs(p.x)-size.x+radius, y: Math.abs(p.y)-size.y+radius, z: Math.abs(p.z)-size.z+radius };
    return Math.min(Math.max(q.x, Math.max(q.y, q.z)), 0) + length({ x: Math.max(q.x,0), y: Math.max(q.y,0), z: Math.max(q.z,0) }) - radius;
}
function sdfPyramid(p, h, apexOffset) {
    const half = h * 0.5;
    const q = { x: Math.abs(p.x), z: Math.abs(p.z) };
    const slope = 1.0 - (p.y + half) / h;
    const dx = q.x - slope * half;
    const dz = q.z - slope * half;
    const d = Math.max(dx, dz, -p.y - half, p.y - half);
    return d;
}
function sdfHexPrism(p, r, h) {
    const q = { x: Math.abs(p.x), z: Math.abs(p.z) };
    const angle = Math.PI / 6;
    const cos30 = Math.cos(angle);
    const sin30 = Math.sin(angle);
    const d1 = Math.max(q.x - r, q.z - r);
    const d2 = Math.max(q.x * cos30 + q.z * sin30 - r, q.z * cos30 - q.x * sin30 - r);
    const d_hex = Math.min(d1, d2);
    const d_y = Math.abs(p.y) - h * 0.5;
    return Math.max(d_hex, d_y);
}
function sdfTriPrism(p, r, h, angle) {
    const theta = angle || 0;
    const c = Math.cos(theta), s = Math.sin(theta);
    const px = p.x * c - p.z * s;
    const pz = p.x * s + p.z * c;
    const d_tri = Math.max(Math.abs(px) - r, (pz + r * 0.577) - r * 0.577, -pz - r * 0.577);
    const d_y = Math.abs(p.y) - h * 0.5;
    return Math.max(d_tri, d_y);
}
function sdfCylinder(p, r, h) {
    const d = Math.hypot(p.x, p.y) - r;
    const dh = Math.abs(p.z) - h*0.5;
    return Math.max(d, dh);
}
function sdfCone(p, r, h) {
    const q = Math.hypot(p.x, p.y);
    const d = Math.max(q - r * (1 - (p.z + h*0.5)/h), Math.abs(p.z + h*0.5) - h*0.5);
    return d;
}
function sdfTorus(p, r1, r2) {
    const q = { x: Math.hypot(p.x, p.y) - r1, y: p.z };
    return length(q) - r2;
}
function sdfPlane(p, n, d) { return dot(p, n) + d; }
function sdfEllipsoid(p, rx, ry, rz) {
    const k0 = length({ x: p.x/rx, y: p.y/ry, z: p.z/rz });
    const k1 = length({ x: p.x/(rx*rx), y: p.y/(ry*ry), z: p.z/(rz*rz) });
    return k0 * (k0 - 1) / k1;
}
function sdfCapsule(p, a, b, r) {
    const pa = { x: p.x-a.x, y: p.y-a.y, z: p.z-a.z };
    const ba = { x: b.x-a.x, y: b.y-a.y, z: b.z-a.z };
    const h = clamp(dot(pa,ba)/dot(ba,ba), 0, 1);
    const closest = { x: a.x+ba.x*h, y: a.y+ba.y*h, z: a.z+ba.z*h };
    return length({ x: p.x-closest.x, y: p.y-closest.y, z: p.z-closest.z }) - r;
}
function sdfLineSegment(p, a, b, r) { return sdfCapsule(p, a, b, r); }

// ============================================================================
// BOOLEAN OPS (complètes)
// ============================================================================
function opUnion(a,b) { return Math.min(a,b); }
function opSubtract(a,b) { return Math.max(a, -b); }
function opIntersect(a,b) { return Math.max(a,b); }
function opSmoothUnion(a,b,k) {
    const h = clamp(0.5 + 0.5*(b-a)/k, 0, 1);
    return b*h + a*(1-h) - k*h*(1-h);
}
function opSmoothSubtract(a,b,k) {
    const h = clamp(0.5 - 0.5*(b+a)/k, 0, 1);
    return (b*h + a*(1-h)) - k*h*(1-h);
}
function opSmoothIntersect(a,b,k) {
    const h = clamp(0.5 - 0.5*(b-a)/k, 0, 1);
    return (b*h + a*(1-h)) + k*h*(1-h);
}
function opBlend(a, b, k) {
    const m = Math.exp(-a/k) + Math.exp(-b/k);
    return -k * Math.log(m);
}
function opLerpUnion(a, b, t) {
    return a * t + b * (1 - t) - 0.5 * Math.abs(a - b) * (1 - 2*t);
}
function opChamferUnion(a, b, d) {
    const u = opUnion(a, b);
    const inter = -Math.min(-a, -b);
    return u - Math.max(0, d - Math.abs(a - b)) * 0.5;
}

// ============================================================================
// TRANSFORMATIONS STRICTES
// ============================================================================
function translatePoint(p, t) { return { x: p.x - t.x, y: p.y - t.y, z: p.z - t.z }; }
function scalePoint(p, s) { return { x: p.x / s.x, y: p.y / s.y, z: p.z / s.z }; }

// Rotation avec quaternion (inverse pour compenser la rotation de l'objet)
function rotatePointQuat(p, q) {
    const x2=q.x+q.x, y2=q.y+q.y, z2=q.z+q.z;
    const xx=q.x*x2, xy=q.x*y2, xz=q.x*z2;
    const yy=q.y*y2, yz=q.y*z2, zz=q.z*z2;
    const wx=q.w*x2, wy=q.w*y2, wz=q.w*z2;
    return {
        x: (1 - (yy+zz))*p.x + (xy - wz)*p.y + (xz + wy)*p.z,
        y: (xy + wz)*p.x + (1 - (xx+zz))*p.y + (yz - wx)*p.z,
        z: (xz - wy)*p.x + (yz + wx)*p.y + (1 - (xx+yy))*p.z
    };
}


function skewPoint(p, angleX, angleY, angleZ) {
    const ax = angleX || 0, ay = angleY || 0, az = angleZ || 0;
    return {
        x: p.x + p.y * Math.tan(ax) + p.z * Math.tan(ay),
        y: p.y + p.x * Math.tan(ax) + p.z * Math.tan(az),
        z: p.z + p.x * Math.tan(ay) + p.y * Math.tan(az)
    };
}
function shearPoint(p, shearXY, shearXZ, shearYX, shearYZ, shearZX, shearZY) {
    return {
        x: p.x + (shearXY||0)*p.y + (shearXZ||0)*p.z,
        y: p.y + (shearYX||0)*p.x + (shearYZ||0)*p.z,
        z: p.z + (shearZX||0)*p.x + (shearZY||0)*p.y
    };
}
function stretchPoint(p, factors) {
    const fx = factors.x || 1, fy = factors.y || 1, fz = factors.z || 1;
    return { x: p.x / fx, y: p.y / fy, z: p.z / fz };
}
function reflectPoint(p, normal, pointOnPlane) {
    const n = normal;
    const d = dot(p, n) - dot(pointOnPlane, n);
    return { x: p.x - 2*d*n.x, y: p.y - 2*d*n.y, z: p.z - 2*d*n.z };
}
function projectPoint(p, normal, pointOnPlane) {
    const n = normal;
    const d = dot(p, n) - dot(pointOnPlane, n);
    return { x: p.x - d*n.x, y: p.y - d*n.y, z: p.z - d*n.z };
}

// ============================================================================
// TRANSFORMATIONS ORGANIQUES (complètes)
// ============================================================================
function applyWarp(p, strength) {
    const k = strength || 0.1;
    return {
        x: p.x + Math.sin(p.y) * k,
        y: p.y + Math.sin(p.z) * k,
        z: p.z + Math.sin(p.x) * k
    };
}
function applyTwist(p, angleDeg, height) {
    const angle = (angleDeg || 0) * Math.PI / 180;
    const h = height || 1;
    const t = clamp(p.y / h, -1, 1) * angle;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return {
        x: p.x * c - p.z * s,
        y: p.y,
        z: p.x * s + p.z * c
    };
}
function applyBend(p, amount) {
    const k = amount || 0.3;
    const t = clamp(p.x, -1, 1) * k;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return {
        x: p.x,
        y: p.y * c - p.z * s,
        z: p.y * s + p.z * c
    };
}
function applyNoise(p, amplitude, frequency) {
    const amp = amplitude || 0.05;
    const freq = frequency || 1.5;
    const n = (Math.sin(p.x * freq) + Math.sin(p.y * freq) + Math.sin(p.z * freq)) / 3;
    return {
        x: p.x + n * amp,
        y: p.y + n * amp,
        z: p.z + n * amp
    };
}
function applyInflate(p, amount) {
    const k = amount || 0.1;
    const len = length(p);
    const factor = 1 + k * Math.tanh(len);
    return {
        x: p.x * factor,
        y: p.y * factor,
        z: p.z * factor
    };
}
function applyDeflate(p, amount) {
    const k = amount || 0.1;
    const len = length(p);
    const factor = 1 - k * Math.tanh(len);
    return {
        x: p.x * factor,
        y: p.y * factor,
        z: p.z * factor
    };
}
function applyTurbulence(p, amp, freq, octaves) {
    let n = 0;
    let a = amp || 0.1;
    let f = freq || 2.0;
    const o = octaves || 3;
    for (let i = 0; i < o; i++) {
        n += Math.sin(p.x * f) * Math.sin(p.y * f) * Math.sin(p.z * f) * a;
        a *= 0.5;
        f *= 2.0;
    }
    return { x: p.x + n, y: p.y + n, z: p.z + n };
}
function applyFlow(p, direction, strength) {
    const dir = direction || { x:1, y:0, z:0 };
    const s = strength || 0.2;
    const flow = Math.sin(p.y * 2) * s;
    return {
        x: p.x + dir.x * flow,
        y: p.y + dir.y * flow,
        z: p.z + dir.z * flow
    };
}
function applyPulse(p, speed, phase) {
    const t = (Date.now() * 0.001 * (speed||1)) + (phase||0);
    const pulse = 1 + Math.sin(t) * 0.1;
    return { x: p.x * pulse, y: p.y * pulse, z: p.z * pulse };
}
function applySwell(p, center, radius, amount) {
    const c = center || { x:0, y:0, z:0 };
    const r = radius || 1;
    const a = amount || 0.2;
    const d = length({ x: p.x-c.x, y: p.y-c.y, z: p.z-c.z });
    const t = Math.max(0, 1 - d/r);
    const swell = 1 + a * t;
    return { x: p.x * swell, y: p.y * swell, z: p.z * swell };
}
function applyErode(p, intensity) {
    const i = intensity || 0.1;
    const n = Math.sin(p.x * 5) * Math.sin(p.y * 5) * Math.sin(p.z * 5);
    return { x: p.x + n * i, y: p.y + n * i, z: p.z + n * i };
}
function applySmoothDeform(p, axes, strength) {
    const s = strength || 0.1;
    return {
        x: p.x + Math.sin(p.y * axes.freqY || 1) * s,
        y: p.y + Math.sin(p.z * axes.freqZ || 1) * s,
        z: p.z + Math.sin(p.x * axes.freqX || 1) * s
    };
}

// ============================================================================
// NŒUDS ORGANIQUES SPÉCIAUX
// ============================================================================
function sdfOrganicMembrane(p, thickness, noiseAmp) {
    const n = (Math.sin(p.x*3) + Math.sin(p.z*3)) * (noiseAmp||0.05);
    return Math.abs(p.y - n) - (thickness||0.1);
}
function sdfOrganicBranch(p, start, end, radius, taper) {
    const t = dot({ x:p.x-start.x, y:p.y-start.y, z:p.z-start.z }, { x:end.x-start.x, y:end.y-start.y, z:end.z-start.z }) / length({ x:end.x-start.x, y:end.y-start.y, z:end.z-start.z });
    const r = radius * (1 - t * (taper||0));
    return sdfCapsule(p, start, end, r);
}
function sdfOrganicFiber(p, points, radius) {
    let minDist = Infinity;
    for (let i = 0; i < points.length-1; i++) {
        const d = sdfCapsule(p, points[i], points[i+1], radius);
        minDist = Math.min(minDist, d);
    }
    return minDist;
}

// ============================================================================
// META NŒUDS
// ============================================================================
class MetaContext {
    constructor() {
        this.bounds = null;
        this.material = null;
        this.metadata = {};
        this.lodLevel = 0;
        this.layerMask = 0xFFFFFFFF;
    }
}

// ============================================================================
// CACHE LRU
// ============================================================================
class LRUCache {
    constructor(limit=50000) {
        this.limit = limit;
        this.map = new Map();
    }
    get(key) {
        const val = this.map.get(key);
        if (val === undefined) return undefined;
        this.map.delete(key); this.map.set(key, val);
        return val;
    }
    set(key, val) {
        if (this.map.size >= this.limit) {
            const first = this.map.keys().next().value;
            this.map.delete(first);
        }
        this.map.set(key, val);
    }
}
function makeKey(p) { return `${Math.floor(p.x*1000)},${Math.floor(p.y*1000)},${Math.floor(p.z*1000)}`; }

// ============================================================================
// SDF EVALUATOR
// ============================================================================
class SDFEvaluator {
    constructor(useCache=true, cacheLimit=50000) {
        this.cache = useCache ? new LRUCache(cacheLimit) : null;
        this.meta = new MetaContext();
    }
    evaluate(node, p) {
    if (!node) return 1e9;

    if (this.cache) {
        // Assigner un id de cache unique par nœud si absent
        if (!node._cacheId) {
            node._cacheId = Math.random().toString(36).slice(2);
        }
        const key = node._cacheId + '|' + makeKey(p);

        const cached = this.cache.get(key);
        if (cached !== undefined) return cached;

        const val = this._evalNode(node, p);
        this.cache.set(key, val);
        return val;
    }

    return this._evalNode(node, p);
}

    _evalNode(node, p) {
        switch (node.type) {
            case 'primitive': return this._evalPrimitive(node, p);
            case 'op': return this._evalBoolean(node, p);
            case 'transform': return this._evalTransform(node, p);
            case 'meta':
                this._applyMeta(node);
                return this.evaluate(node.child, p);
            default: return 1e9;
        }
    }
    _applyMeta(metaNode) {
        if (metaNode.bounds) this.meta.bounds = metaNode.bounds;
        if (metaNode.material) this.meta.material = metaNode.material;
        if (metaNode.metadata) Object.assign(this.meta.metadata, metaNode.metadata);
        if (metaNode.lod) this.meta.lodLevel = metaNode.lod.level;
        if (metaNode.layer) this.meta.layerMask = metaNode.layer.mask;
    }
    _evalPrimitive(prim, p) {
        const kind = prim.kind || prim.type;
        const params = prim.params || prim;
        let val;
        switch (kind) {
            case 'sphere': val = sdfSphere(p, params.r); break;
            case 'box': {
                let size;
                if (Array.isArray(params.size)) size = { x: params.size[0], y: params.size[1], z: params.size[2] };
                else if (typeof params.size === 'number') size = { x: params.size, y: params.size, z: params.size };
                else size = { x: params.width||1, y: params.height||1, z: params.depth||1 };
                val = sdfBox(p, size);
                break;
            }
            case 'rounded_box': {
                let size, radius;
                if (Array.isArray(params.size)) size = { x: params.size[0], y: params.size[1], z: params.size[2] };
                else size = { x: params.width||1, y: params.height||1, z: params.depth||1 };
                radius = params.radius || 0.2;
                val = sdfRoundedBox(p, size, radius);
                break;
            }
            case 'pyramid': val = sdfPyramid(p, params.height || 1, params.apexOffset || 0); break;
            case 'hex_prism': val = sdfHexPrism(p, params.radius || 0.5, params.height || 1); break;
            case 'tri_prism': val = sdfTriPrism(p, params.radius || 0.5, params.height || 1, params.angle || 0); break;
            case 'line_segment': {
                const a = params.a || {x:-0.5,y:0,z:0};
                const b = params.b || {x:0.5,y:0,z:0};
                val = sdfLineSegment(p, a, b, params.r);
                break;
            }
            case 'cylinder': val = sdfCylinder(p, params.r, params.height); break;
            case 'cone': val = sdfCone(p, params.r, params.height); break;
            case 'torus': val = sdfTorus(p, params.rmajor || params.r1, params.rminor || params.r2); break;
            case 'plane': val = sdfPlane(p, params.normal || {x:0,y:1,z:0}, params.d||0); break;
            case 'ellipsoid': val = sdfEllipsoid(p, params.rx, params.ry, params.rz); break;
            case 'capsule': {
                const a = params.a || {x:0,y:0,z:-params.height/2};
                const b = params.b || {x:0,y:0,z: params.height/2};
                val = sdfCapsule(p, a, b, params.r);
                break;
            }
            case 'organic_blob':
            case 'organic_lobe':
            case 'organic_cluster':
            case 'organic_noise_displace':
            case 'organic_blend':
            case 'organic_soft_union':
            case 'organic_membrane':
            case 'organic_branch':
            case 'organic_fiber':
                val = this._evalOrganicSpecial(kind, p, params);
                break;
            default: val = 1e9;
        }
        return val;
    }
    _evalOrganicSpecial(kind, p, params) {
        switch (kind) {
            case 'organic_membrane': return sdfOrganicMembrane(p, params.thickness, params.noiseAmp);
            case 'organic_branch': return sdfOrganicBranch(p, params.start, params.end, params.radius, params.taper);
            case 'organic_fiber': return sdfOrganicFiber(p, params.points || [], params.radius);
            default: return 1e9;
        }
    }
    _evalBoolean(opNode, p) {
        const left = this._evalNode(opNode.left, p);
        const right = this._evalNode(opNode.right, p);
        const k = opNode.smoothness || 0.2;
        switch (opNode.op) {
            case 'union': return opUnion(left, right);
            case 'subtract': return opSubtract(left, right);
            case 'intersect': return opIntersect(left, right);
            case 'smooth_union': return opSmoothUnion(left, right, k);
            case 'smooth_subtract': return opSmoothSubtract(left, right, k);
            case 'smooth_intersect': return opSmoothIntersect(left, right, k);
            case 'blend': return opBlend(left, right, k);
            case 'lerp_union': return opLerpUnion(left, right, opNode.t || 0.5);
            case 'chamfer_union': return opChamferUnion(left, right, opNode.chamfer || 0.1);
            default: return 1e9;
        }
    }
    _evalTransform(transNode, p) {
        let q = p;

        // TRANSFORMATIONS STRICTES
        if (transNode.translate) {
            const t = Array.isArray(transNode.translate)
                ? { x: transNode.translate[0], y: transNode.translate[1], z: transNode.translate[2] }
                : transNode.translate;
            q = translatePoint(q, t);
        }
        if (transNode.scale) {
            const s = Array.isArray(transNode.scale)
                ? { x: transNode.scale[0], y: transNode.scale[1], z: transNode.scale[2] }
                : transNode.scale;
            q = scalePoint(q, s);
        }
        if (transNode.rotate) {
            const r = Array.isArray(transNode.rotate)
                ? { x: transNode.rotate[0], y: transNode.rotate[1], z: transNode.rotate[2], w: transNode.rotate[3] }
                : transNode.rotate;
            q = rotatePointQuat(q, r);
        }
        if (transNode.mirror) {
            const { planeNormal, planeDist } = transNode.mirror;
            const d = dot(q, planeNormal) + planeDist;
            if (d < 0) q = { x: q.x - 2*d*planeNormal.x, y: q.y - 2*d*planeNormal.y, z: q.z - 2*d*planeNormal.z };
        }
        if (transNode.repeat) {
            const { size, offset } = transNode.repeat;
            q = {
                x: q.x - size.x * Math.round((q.x - offset.x)/size.x),
                y: q.y - size.y * Math.round((q.y - offset.y)/size.y),
                z: q.z - size.z * Math.round((q.z - offset.z)/size.z)
            };
        }
        if (transNode.skew) {
            const { angleX, angleY, angleZ } = transNode.skew;
            q = skewPoint(q, angleX, angleY, angleZ);
        }
        if (transNode.shear) {
            const { xy, xz, yx, yz, zx, zy } = transNode.shear;
            q = shearPoint(q, xy, xz, yx, yz, zx, zy);
        }
        if (transNode.stretch) {
            q = stretchPoint(q, transNode.stretch.factors);
        }
        if (transNode.reflect) {
            const { normal, point } = transNode.reflect;
            q = reflectPoint(q, normal, point);
        }
        if (transNode.project) {
            const { normal, point } = transNode.project;
            q = projectPoint(q, normal, point);
        }

        // TRANSFORMATIONS ORGANIQUES
        if (transNode.warp) q = applyWarp(q, transNode.warp.strength);
        if (transNode.twist) q = applyTwist(q, transNode.twist.angle, transNode.twist.height);
        if (transNode.bend) q = applyBend(q, transNode.bend.amount);
        if (transNode.noise) q = applyNoise(q, transNode.noise.amplitude, transNode.noise.frequency);
        if (transNode.inflate) q = applyInflate(q, transNode.inflate.amount);
        if (transNode.deflate) q = applyDeflate(q, transNode.deflate.amount);
        if (transNode.turbulence) q = applyTurbulence(q, transNode.turbulence.amplitude, transNode.turbulence.frequency, transNode.turbulence.octaves);
        if (transNode.flow) q = applyFlow(q, transNode.flow.direction, transNode.flow.strength);
        if (transNode.pulse) q = applyPulse(q, transNode.pulse.speed, transNode.pulse.phase);
        if (transNode.swell) q = applySwell(q, transNode.swell.center, transNode.swell.radius, transNode.swell.amount);
        if (transNode.erode) q = applyErode(q, transNode.erode.intensity);
        if (transNode.smooth_deform) q = applySmoothDeform(q, transNode.smooth_deform.axes, transNode.smooth_deform.strength);

        return this._evalNode(transNode.child, q);
    }
}

// ============================================================================
// BUILD GRAPH → EVALUATOR (avec support de tous les nouveaux types)
// ============================================================================
function createEvaluatorFromGraph(graph) {

    if (!Array.isArray(graph.nodes)) {
        const arr = [];
        for (const [id, node] of Object.entries(graph.nodes)) {
            arr.push({ id, ...node });
        }
        graph.nodes = arr;
    }

    if (!graph.root && graph.rootNode) {
        graph.root = graph.rootNode;
    }

    // Prétraitement pour normaliser les nœuds
    for (const node of graph.nodes) {
        // Primitives legacy
        if (["sphere","box","cylinder","cone","torus","plane","ellipsoid","capsule",
             "rounded_box","pyramid","hex_prism","tri_prism","line_segment",
             "organic_blob","organic_lobe","organic_cluster","organic_noise_displace",
             "organic_blend","organic_soft_union","organic_membrane","organic_branch","organic_fiber"].includes(node.type)) {
            node.kind = node.type;
            node.type = "primitive";
            node.params = node.params || node;
        }
        // Opérations booléennes
        if (["union","subtract","intersect","smooth_union","smooth_subtract","smooth_intersect",
             "blend","lerp_union","chamfer_union"].includes(node.type)) {
            node.op = node.type;
            node.type = "op";
        }
        // Transformations strictes
        if (["translate","scale","rotate","mirror","repeat","skew","shear","stretch","reflect","project"].includes(node.type)) {
            node.type = "transform";
            node.child = { id: node.input };
        }
        // Transformations organiques
        if (["warp","twist","bend","noise","inflate","deflate","turbulence","flow","pulse","swell","erode","smooth_deform"].includes(node.type)) {
            node.type = "transform";
            node.child = { id: node.input };
        }
        // Meta-nœuds
        if (["bounds_override","material_tag","metadata","sdf_passthrough","sdf_cache_node","sdf_lod","sdf_layer","sdf_mask"].includes(node.type)) {
            node.type = "meta";
            node.child = { id: node.input };
        }
        // Extensions pour organic_parser
        if (node.type === "erosion") {
            node.type = "transform";
            node.erode = { intensity: node.params?.amount || 0.2 };
            node.child = { id: node.input };
        }
        if (node.type === "smooth") {
            node.type = "transform";
            const strength = (node.params?.iterations || 1) * 0.05;
            node.smooth_deform = { axes: { freqX: 1, freqY: 1, freqZ: 1 }, strength: strength };
            node.child = { id: node.input };
        }
        if (node.type === "animate" || node.type === "mutate") {
            node.type = "transform";
            // ne pas mettre de propriété active → no-op
            node.child = { id: node.input };
        }
        // S'assurer que les transform ont child
        if (node.type === "transform" && node.input && !node.child) {
            node.child = { id: node.input };
        }
    }

    console.log("[sdf_evaluator] createEvaluatorFromGraph: graph reçu, nodes count:", graph.nodes.length);

    const nodesMap = new Map();
    for (const n of graph.nodes) nodesMap.set(n.id, n);

    function buildNode(nodeRef) {
        let raw;
        if (nodeRef.id) {
            raw = nodesMap.get(nodeRef.id);
            if (!raw) {
                console.warn("[buildNode] unknown id:", nodeRef.id);
                return null;
            }
        } else {
            raw = nodeRef;
        }
        if (!raw) return null;

        let type = raw.type;
        if (!type) {
            if (raw.kind) type = 'primitive';
            else if (raw.op) type = 'op';
            else if (raw.translate || raw.scale || raw.rotate || raw.warp || raw.twist || raw.bend || raw.noise ||
                     raw.inflate || raw.deflate || raw.turbulence || raw.flow || raw.pulse || raw.swell || raw.erode || raw.smooth_deform ||
                     raw.skew || raw.shear || raw.stretch || raw.reflect || raw.project)
                type = 'transform';
            else if (raw.r !== undefined || raw.size !== undefined || raw.height !== undefined) type = 'primitive';
            else if (raw.bounds || raw.material || raw.metadata) type = 'meta';
            else {
                console.warn("[buildNode] unknown node type:", raw);
                return null;
            }
        }

        if (type === 'primitive') {
            const kind = raw.kind || raw.type;
            const params = raw.params || raw;
            return { type: 'primitive', kind, params };
        }
        if (type === 'op') {
            return {
                type: 'op',
                op: raw.op,
                left: buildNode(raw.left),
                right: buildNode(raw.right),
                smoothness: raw.smoothness,
                t: raw.t,
                chamfer: raw.chamfer
            };
        }
        if (type === 'transform') {
            const child = buildNode(raw.child);
            if (!child) return null;
            return {
                type: 'transform',
                translate: raw.translate || null,
                scale: raw.scale || null,
                rotate: raw.rotate || null,
                mirror: raw.mirror || null,
                repeat: raw.repeat || null,
                skew: raw.skew || null,
                shear: raw.shear || null,
                stretch: raw.stretch || null,
                reflect: raw.reflect || null,
                project: raw.project || null,
                warp: raw.warp || null,
                twist: raw.twist || null,
                bend: raw.bend || null,
                noise: raw.noise || null,
                inflate: raw.inflate || null,
                deflate: raw.deflate || null,
                turbulence: raw.turbulence || null,
                flow: raw.flow || null,
                pulse: raw.pulse || null,
                swell: raw.swell || null,
                erode: raw.erode || null,
                smooth_deform: raw.smooth_deform || null,
                child: child
            };
        }
        if (type === 'meta') {
            const child = buildNode(raw.child);
            return {
                type: 'meta',
                bounds: raw.bounds || null,
                material: raw.material || null,
                metadata: raw.metadata || null,
                lod: raw.lod || null,
                layer: raw.layer || null,
                child: child
            };
        }
        console.warn("[buildNode] unknown node type:", raw);
        return null;
    }

    const rootNode = buildNode({ id: graph.root });
    if (!rootNode) throw new Error("Failed to build root node from graph");
    const evaluator = new SDFEvaluator(false);


    console.log("[sdf_evaluator] createEvaluatorFromGraph success");
    return { evaluator, rootNode };
}

module.exports = {
    SDFEvaluator,
    createEvaluatorFromGraph,
    // Primitives
    sdfSphere, sdfBox, sdfRoundedBox, sdfPyramid, sdfHexPrism, sdfTriPrism,
    sdfCylinder, sdfCone, sdfTorus, sdfPlane, sdfEllipsoid, sdfCapsule, sdfLineSegment,
    // Ops
    opUnion, opSubtract, opIntersect, opSmoothUnion, opSmoothSubtract, opSmoothIntersect,
    opBlend, opLerpUnion, opChamferUnion,
    // Organiques spéciaux
    sdfOrganicMembrane, sdfOrganicBranch, sdfOrganicFiber
};
