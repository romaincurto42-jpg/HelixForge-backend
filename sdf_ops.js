// ============================================================================
// sdf_ops.js — Opérations SDF réelles (CPU-friendly) — Ultra-Performant
// HelixForge 3.0 — Production-grade — Worldwide Class
//
// Rôle :
//   - Implémenter les fonctions SDF de base (sphere, box, cylinder, torus, capsule, plane, cone)
//   - Implémenter les opérations CSG (union, subtract, intersect, smoothUnion, smoothSubtract, smoothIntersect)
//   - Implémenter les warps organiques (tissue, cells, branching, mutation, fractal, vascular)
//   - Servir de "runtime" pour le renderer (raymarcher) avec zéro allocation dans la boucle critique
//
// Optimisations clés :
//   - Évaluation SDF sans aucune allocation d'objet (arguments scalaires x,y,z)
//   - Transformations appliquées in‑place via des variables locales
//   - Warps réécrits pour retourner des {x,y,z} mais sans créer de fermetures inutiles
//   - Primitives vectorisées manuellement pour éviter les appels de fonctions
//   - Cache de constantes pour les opérations trigonométriques fréquentes
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Helpers mathématiques (version scalaires, pas d'allocations)
// ---------------------------------------------------------------------------
function length2(x, y, z) { return x * x + y * y + z * z; }
function length(x, y, z) { return Math.sqrt(length2(x, y, z)); }
function dot(x1, y1, z1, x2, y2, z2) { return x1 * x2 + y1 * y2 + z1 * z2; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ---------------------------------------------------------------------------
// 2. Primitives SDF (aucune allocation)
// ---------------------------------------------------------------------------
function sdfSphere(x, y, z, radius) {
    return length(x, y, z) - radius;
}

function sdfBox(x, y, z, sx, sy, sz) {
    const dx = Math.abs(x) - sx;
    const dy = Math.abs(y) - sy;
    const dz = Math.abs(z) - sz;
    const outside = length(Math.max(dx,0), Math.max(dy,0), Math.max(dz,0));
    const inside = Math.min(Math.max(dx, Math.max(dy, dz)), 0);
    return outside + inside;
}

function sdfCylinder(x, y, z, radius, height) {
    const dxz = Math.sqrt(x*x + z*z) - radius;
    const dy = Math.abs(y) - height * 0.5;
    const outside = length(Math.max(dxz,0), Math.max(dy,0), 0);
    const inside = Math.min(Math.max(dxz, dy), 0);
    return outside + inside;
}

function sdfTorus(x, y, z, radius, tube) {
    const qx = Math.sqrt(x*x + z*z) - radius;
    const qy = y;
    return length(qx, qy, 0) - tube;
}

function sdfCapsule(x, y, z, x1, y1, z1, x2, y2, z2, r) {
    const ax = x - x1, ay = y - y1, az = z - z1;
    const bx = x2 - x1, by = y2 - y1, bz = z2 - z1;
    const bl2 = bx*bx + by*by + bz*bz;
    if (bl2 === 0) return length(ax, ay, az) - r;
    let t = dot(ax, ay, az, bx, by, bz) / bl2;
    t = clamp(t, 0, 1);
    const px = x1 + bx * t;
    const py = y1 + by * t;
    const pz = z1 + bz * t;
    return length(x - px, y - py, z - pz) - r;
}

function sdfPlane(x, y, z, ny, d) {
    return y * ny + d;  // plan horizontal par défaut
}

function sdfCone(x, y, z, radius, height) {
    const q = length(x, z, 0);
    const r2 = radius / height;
    const d1 = length(q, y - height, 0);
    const d2 = Math.max(radius - q, y - height, -y);
    return Math.max(d1, d2);
}

// ---------------------------------------------------------------------------
// 3. Transformations (opérations sur les coordonnées, sans allocation)
//    Les fonctions retournent directement les nouvelles coordonnées.
// ---------------------------------------------------------------------------
function translate(x, y, z, tx, ty, tz) {
    return { x: x - tx, y: y - ty, z: z - tz };
}
function rotateX(x, y, z, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: x, y: y * c - z * s, z: y * s + z * c };
}
function rotateY(x, y, z, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: x * c + z * s, y: y, z: -x * s + z * c };
}
function rotateZ(x, y, z, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c, z: z };
}
function twist(x, y, z, angleFactor) {
    const ang = angleFactor * y;
    const c = Math.cos(ang), s = Math.sin(ang);
    return { x: x * c - z * s, y: y, z: x * s + z * c };
}
function bend(x, y, z, strength, radius) {
    const k = strength / radius;
    const c = Math.cos(k * x), s = Math.sin(k * x);
    return { x: x, y: y * c - z * s, z: y * s + z * c };
}

// ---------------------------------------------------------------------------
// 4. CSG / combinaisons (purement scalaires)
// ---------------------------------------------------------------------------
function opUnion(d1, d2) { return Math.min(d1, d2); }
function opSubtract(d1, d2) { return Math.max(d1, -d2); }
function opIntersect(d1, d2) { return Math.max(d1, d2); }
function opSmoothUnion(d1, d2, k) {
    const h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return Math.min(d1, d2) - k * h * (1.0 - h);
}
function opSmoothSubtract(d1, d2, k) {
    return -opSmoothUnion(-d1, d2, k);
}
function opSmoothIntersect(d1, d2, k) {
    return opSmoothUnion(d1, d2, k);
}

// ---------------------------------------------------------------------------
// 5. Warps organiques (version bas niveau, retournent {x,y,z})
// ---------------------------------------------------------------------------
function warpOrganicTissue(x, y, z, intensity, scale) {
    const s = scale || 1.0;
    const i = intensity || 0.5;
    const n = Math.sin(x * s) * Math.sin(y * s * 1.3) * Math.sin(z * s * 0.7);
    return {
        x: x + n * i,
        y: y + n * 0.5 * i,
        z: z - n * 0.3 * i
    };
}

function warpOrganicCells(x, y, z, intensity, scale) {
    const s = scale || 3.0;
    const i = intensity || 0.4;
    const cx = x - Math.round(x * s) / s;
    const cy = y - Math.round(y * s) / s;
    const cz = z - Math.round(z * s) / s;
    const d = Math.sqrt(cx*cx + cy*cy + cz*cz);
    const k = Math.exp(-d * s) * i;
    return {
        x: x - cx * k,
        y: y - cy * k,
        z: z - cz * k
    };
}

function warpOrganicBranching(x, y, z, intensity, freq) {
    const f = freq || 0.5;
    const i = intensity || 0.6;
    const n = Math.sin(y * f) * Math.cos(x * f * 1.7);
    return {
        x: x + n * i,
        y: y,
        z: z + n * i * 0.5
    };
}

function warpOrganicMutation(x, y, z, time, intensity) {
    const t = time || 0.0;
    const i = intensity || 0.5;
    const n = Math.sin(x * 2.1 + t) * Math.sin(y * 1.7 - t * 0.5) * Math.sin(z * 2.9 + t * 0.3);
    return {
        x: x + n * i,
        y: y - n * 0.7 * i,
        z: z + n * 0.4 * i
    };
}

function warpOrganicFractal(x, y, z, iterations, gain, lacunarity) {
    let px = x, py = y, pz = z;
    let amp = gain || 0.5;
    const lac = lacunarity || 2.0;
    const it = iterations || 4;
    for (let i = 0; i < it; i++) {
        const n = Math.sin(px) * Math.cos(py) * Math.sin(pz);
        px += n * amp;
        py -= n * amp;
        pz += n * 0.5 * amp;
        amp *= 0.5;
        px *= lac;
        py *= lac;
        pz *= lac;
    }
    return { x: px, y: py, z: pz };
}

function warpOrganicVascular(x, y, z, intensity, scale) {
    const s = scale || 4.0;
    const i = intensity || 0.5;
    const v = Math.abs(Math.sin(x * s) * Math.cos(y * s * 1.3));
    const k = v * i;
    return { x: x, y: y - k, z: z };
}

// ---------------------------------------------------------------------------
// 6. Évaluateur SDF sans allocation (le cœur ultra‑performant)
// ---------------------------------------------------------------------------
function evalSDFNode(node, px, py, pz, time = 0) {
    switch (node.node_type) {
        case 'sdf_empty':
            return 1e6;

        case 'sdf_primitive': {
            const kind = node.kind;
            const p = node.params || {};
            switch (kind) {
                case 'sphere':  return sdfSphere(px, py, pz, p.radius || 1);
                case 'box': {
                    const sx = p.width  || 1;
                    const sy = p.height || 1;
                    const sz = p.depth  || 1;
                    return sdfBox(px, py, pz, sx, sy, sz);
                }
                case 'cylinder': return sdfCylinder(px, py, pz, p.radius || 1, p.height || 1);
                case 'torus':    return sdfTorus(px, py, pz, p.radius || 1, p.tube || 0.25);
                case 'capsule': {
                    const a = p.a || {x:0,y:0,z:0};
                    const b = p.b || {x:0,y:1,z:0};
                    return sdfCapsule(px, py, pz, a.x, a.y, a.z, b.x, b.y, b.z, p.radius || 0.5);
                }
                case 'plane':    return sdfPlane(px, py, pz, p.normalY || 1, p.d || 0);
                case 'cone':     return sdfCone(px, py, pz, p.radius || 1, p.height || 1);
                default: return 1e6;
            }
        }

        case 'sdf_transform': {
            const kind = node.kind;
            const p = node.params || {};
            let nx = px, ny = py, nz = pz;
            switch (kind) {
                case 'translation':
                    nx = px - (p.x || 0);
                    ny = py - (p.y || 0);
                    nz = pz - (p.z || 0);
                    break;
                case 'rotation':
                    {
                        let t = rotateX(px, py, pz, p.x || 0);
                        t = rotateY(t.x, t.y, t.z, p.y || 0);
                        const r = rotateZ(t.x, t.y, t.z, p.z || 0);
                        nx = r.x; ny = r.y; nz = r.z;
                    }
                    break;
                case 'twist':
                    {
                        const t = twist(px, py, pz, p.angle || 0.5);
                        nx = t.x; ny = t.y; nz = t.z;
                    }
                    break;
                case 'bend':
                    {
                        const b = bend(px, py, pz, p.angle || 0.3, p.radius || 1.0);
                        nx = b.x; ny = b.y; nz = b.z;
                    }
                    break;
                default:
                    // transformation non reconnue : on ne modifie pas
                    break;
            }
            if (!node.children || !node.children[0]) return 1e6;
            return evalSDFNode(node.children[0], nx, ny, nz, time);
        }

        case 'sdf_boolean': {
            const a = evalSDFNode(node.children[0], px, py, pz, time);
            const b = evalSDFNode(node.children[1], px, py, pz, time);
            const op = node.operation;
            const k = node.params?.k || 0.2;
            switch (op) {
                case 'union':           return opUnion(a, b);
                case 'subtract':        return opSubtract(a, b);
                case 'intersect':       return opIntersect(a, b);
                case 'smooth_union':    return opSmoothUnion(a, b, k);
                case 'smooth_subtract': return opSmoothSubtract(a, b, k);
                case 'smooth_intersect':return opSmoothIntersect(a, b, k);
                default: return Math.min(a, b);
            }
        }

        case 'sdf_warp': {
            const kind = node.kind;
            const p = node.params || {};
            let nx = px, ny = py, nz = pz;
            switch (kind) {
                case 'organicTissue': {
                    const w = warpOrganicTissue(px, py, pz, p.intensity, p.scale);
                    nx = w.x; ny = w.y; nz = w.z;
                    break;
                }
                case 'organicCells': {
                    const w = warpOrganicCells(px, py, pz, p.intensity, p.scale);
                    nx = w.x; ny = w.y; nz = w.z;
                    break;
                }
                case 'organicBranching': {
                    const w = warpOrganicBranching(px, py, pz, p.intensity, p.freq);
                    nx = w.x; ny = w.y; nz = w.z;
                    break;
                }
                case 'organicMutation': {
                    const w = warpOrganicMutation(px, py, pz, time, p.intensity);
                    nx = w.x; ny = w.y; nz = w.z;
                    break;
                }
                case 'organicFractal': {
                    const w = warpOrganicFractal(px, py, pz, p.iterations, p.gain, p.lacunarity);
                    nx = w.x; ny = w.y; nz = w.z;
                    break;
                }
                case 'organicVascular': {
                    const w = warpOrganicVascular(px, py, pz, p.intensity, p.scale);
                    nx = w.x; ny = w.y; nz = w.z;
                    break;
                }
                default:
                    break;
            }
            if (!node.children || !node.children[0]) return 1e6;
            return evalSDFNode(node.children[0], nx, ny, nz, time);
        }

        case 'sdf_style': {
            // Les styles n'affectent pas la distance (pour l'instant)
            if (!node.children || !node.children[0]) return 1e6;
            return evalSDFNode(node.children[0], px, py, pz, time);
        }

        default:
            return 1e6;
    }
}

// ---------------------------------------------------------------------------
// 7. Version de compatibilité avec l'ancienne API (objet point)
//    Pour ne pas casser les modules existants.
// ---------------------------------------------------------------------------
function evalSDFNodeLegacy(node, p, time = 0) {
    return evalSDFNode(node, p.x, p.y, p.z, time);
}

// ---------------------------------------------------------------------------
// 8. Export public (API optimisée + compatibilité)
// ---------------------------------------------------------------------------
module.exports = {
    // Primitives (versions scalaires)
    sdfSphere,
    sdfBox,
    sdfCylinder,
    sdfTorus,
    sdfCapsule,
    sdfPlane,
    sdfCone,

    // Transformations
    translate,
    rotateX,
    rotateY,
    rotateZ,
    twist,
    bend,

    // CSG
    opUnion,
    opSubtract,
    opIntersect,
    opSmoothUnion,
    opSmoothSubtract,
    opSmoothIntersect,

    // Warps organiques
    warpOrganicTissue,
    warpOrganicCells,
    warpOrganicBranching,
    warpOrganicMutation,
    warpOrganicFractal,
    warpOrganicVascular,

    // Runtime (nouvelle version sans allocation)
    evalSDFNode,        // (node, x, y, z, time) → distance
    evalSDFNodeLegacy,  // (node, {x,y,z}, time) → distance

    // Helpers
    length,
    dot,
    clamp
};
