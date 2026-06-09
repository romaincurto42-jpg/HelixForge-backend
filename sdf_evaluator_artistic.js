// sdf_evaluator_artistic.js - Moteur SDF artistique (fractales, abstractions, champs)
// Support : primitives fractales/procédurales, blend avancés, transformations abstraites
// Extension : gestion complète des nœuds meta (material_layers, color_fields, style_tags) avec attachTo
// CORRECTION : prise en charge de la transformation 'repeat' via domainTilingPoint

const EPS = 1e-6;
const DEBUG = false;
function log(...args) { if (DEBUG) console.log("[SDF_ARTISTIC]", ...args); }

// ---------- Utilitaires sans allocation ----------
function dot3(ax, ay, az, bx, by, bz) { return ax*bx + ay*by + az*bz; }
function len2(x, y, z) { return x*x + y*y + z*z; }
function len(x, y, z) { return Math.sqrt(len2(x, y, z)); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function mix(a, b, t) { return a*(1-t) + b*t; }

// ---------- Primitives artistiques (inchangées) ----------
function sdfMandelbulb(x, y, z, power, iter) {
    let x1 = x, y1 = y, z1 = z;
    let dr = 1.0;
    let r = 0.0;
    const p = power || 8;
    const maxIter = iter || 12;
    for (let i = 0; i < maxIter; i++) {
        r = len(x1, y1, z1);
        if (r > 2.0) break;
        const theta = Math.acos(clamp(z1 / r, -1, 1));
        const phi = Math.atan2(y1, x1);
        const rp = Math.pow(r, p);
        dr = Math.pow(r, p-1) * p * dr + 1.0;
        const sinTheta = Math.sin(theta * p);
        x1 = rp * sinTheta * Math.cos(phi * p);
        y1 = rp * sinTheta * Math.sin(phi * p);
        z1 = rp * Math.cos(theta * p);
        x1 += x; y1 += y; z1 += z;
    }
    return 0.5 * Math.log(r) * r / dr;
}

function sdfMandelbox(x, y, z, scale, iter) {
    let x1 = x, y1 = y, z1 = z;
    const s = scale || 2.0;
    const maxIter = iter || 10;
    let r2 = 0.0;
    for (let i = 0; i < maxIter; i++) {
        x1 = clamp(x1, -1, 1) * 2 - x1;
        y1 = clamp(y1, -1, 1) * 2 - y1;
        z1 = clamp(z1, -1, 1) * 2 - z1;
        r2 = len2(x1, y1, z1);
        if (r2 < 0.25) {
            x1 *= 4; y1 *= 4; z1 *= 4;
        } else if (r2 < 1.0) {
            const t = 1.0 / r2;
            x1 *= t; y1 *= t; z1 *= t;
        }
        x1 = x1 * s + x;
        y1 = y1 * s + y;
        z1 = z1 * s + z;
    }
    return len(x1, y1, z1) * Math.pow(Math.abs(s), -maxIter);
}

function sdfJulia3D(x, y, z, cx, cy, cz, iter) {
    let x1 = x, y1 = y, z1 = z;
    const maxIter = iter || 10;
    const c = {x: cx||0.7885, y: cy||0.7885, z: cz||0};
    for (let i = 0; i < maxIter; i++) {
        const r2 = len2(x1, y1, z1);
        if (r2 > 4.0) break;
        const x2 = x1*x1 - y1*y1 - z1*z1 + c.x;
        const y2 = 2*x1*y1 + c.y;
        const z2 = 2*x1*z1 + c.z;
        x1 = x2; y1 = y2; z1 = z2;
    }
    return 0.25 * Math.log(len2(x1,y1,z1)) * Math.sqrt(len2(x1,y1,z1));
}

function sdfSierpinski3D(x, y, z, size, iter) {
    let x1 = x, y1 = y, z1 = z;
    const maxIter = iter || 5;
    const s = size || 2.0;
    for (let i = 0; i < maxIter; i++) {
        if (x1 + y1 < 0) { x1 = -y1; y1 = -x1; }
        if (x1 + z1 < 0) { x1 = -z1; z1 = -x1; }
        if (y1 + z1 < 0) { y1 = -z1; z1 = -y1; }
        x1 = x1*s - (s-1); y1 = y1*s - (s-1); z1 = z1*s - (s-1);
    }
    return len(x1, y1, z1) * Math.pow(s, -maxIter);
}
function sdfSphere(x, y, z, r) {
    return Math.sqrt(x*x + y*y + z*z) - r;
}
function sdfTorus(x, y, z, R, r) {
    const qx = Math.sqrt(x*x + z*z) - R;
    return Math.sqrt(qx*qx + y*y) - r;
}
function sdfCylinder(x, y, z, r) {
    return Math.sqrt(x*x + z*z) - r;
}
function sdfBox(x, y, z, sx, sy, sz) {
    const dx = Math.abs(x) - sx;
    const dy = Math.abs(y) - sy;
    const dz = Math.abs(z) - sz;
    return Math.min(Math.max(dx, Math.max(dy, dz)), 0.0) +
           len(Math.max(dx,0), Math.max(dy,0), Math.max(dz,0));
}
function sdfHexPrism(x, y, z, h, r) {
    const k = Math.sqrt(3.0);
    x = Math.abs(x);
    z = Math.abs(z);
    const qx = x - r;
    const qz = z - r/k;
    const d1 = Math.max(qx, qz);
    const d2 = Math.max(x - r, z - r);
    const d = Math.min(d1, d2);
    return Math.max(d, Math.abs(y) - h);
}
function sdfDiamondPrism(x, y, z, h, r) {
    const d = Math.abs(x) + Math.abs(z) - r;
    return Math.max(d, Math.abs(y) - h);
}
function sdfPyramid(x, y, z, h) {
    const m = h - y;
    const d = Math.max(Math.abs(x) + Math.abs(z) - m, -y);
    return d;
}
function sdfNoiseVolume(x, y, z, amp, freq, oct) {
    let val = 0, a = amp||0.5, f = freq||1.0, o = oct||3;
    for (let i = 0; i < o; i++) {
        val += a * Math.sin(x*f)*Math.cos(y*f)*Math.sin(z*f);
        a *= 0.5; f *= 2;
    }
    return val - 0.2;
}
function sdfPatternVolume(x, y, z, pattern) {
    switch(pattern) {
        case 'checkerboard': return (Math.floor(x)+Math.floor(y)+Math.floor(z)) % 2 === 0 ? -0.2 : 0.2;
        case 'stripes': return Math.sin(x*10) * Math.sin(z*10) - 0.5;
        default: return Math.sin(x*5)*Math.cos(y*5)*Math.sin(z*5);
    }
}
function sdfVoronoiCell(x, y, z, scale) {
    const s = scale || 2.0;
    const xi = Math.floor(x*s), yi = Math.floor(y*s), zi = Math.floor(z*s);
    let minDist = Infinity;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            for (let k = -1; k <= 1; k++) {
                const cx = xi + i + 0.5, cy = yi + j + 0.5, cz = zi + k + 0.5;
                const dx = (x - cx/s)*s, dy = (y - cy/s)*s, dz = (z - cz/s)*s;
                const d = len(dx, dy, dz);
                if (d < minDist) minDist = d;
            }
        }
    }
    return minDist - 0.3;
}
function sdfCellularNoise(x, y, z, freq) {
    const f = freq || 2.0;
    const xi = Math.floor(x*f), yi = Math.floor(y*f), zi = Math.floor(z*f);
    let min1 = Infinity, min2 = Infinity;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            for (let k = -1; k <= 1; k++) {
                const cx = xi + i + 0.5, cy = yi + j + 0.5, cz = zi + k + 0.5;
                const dx = (x - cx/f)*f, dy = (y - cy/f)*f, dz = (z - cz/f)*f;
                const d = len(dx, dy, dz);
                if (d < min1) { min2 = min1; min1 = d; }
                else if (d < min2) min2 = d;
            }
        }
    }
    return min2 - min1 - 0.1;
}
function sdfFbmVolume(x, y, z, amp, freq, oct, lac) {
    let val = 0, a = amp||0.5, f = freq||1.0, o = oct||4, l = lac||2.0;
    for (let i = 0; i < o; i++) {
        val += a * Math.sin(x*f)*Math.sin(y*f)*Math.sin(z*f);
        a /= l; f *= l;
    }
    return val - 0.2;
}
function sdfGradientField(x, y, z, dirX, dirY, dirZ, strength) {
    const dx = dirX||1, dy = dirY||0, dz = dirZ||0, s = strength||1.0;
    return dot3(x, y, z, dx, dy, dz) * s;
}
function sdfDisplacementField(x, y, z, freq, amp) {
    const f = freq||1.0, a = amp||0.2;
    return Math.sin(x*f)*Math.cos(y*f)*Math.sin(z*f) * a;
}
function sdfVectorField(x, y, z, fieldType) {
    if (fieldType === 'radial') return len(x, y, z) - 1.0;
    if (fieldType === 'vortex') return Math.atan2(y, x) - 0.5;
    return dot3(x, y, z, 1,1,1) * 0.5;
}
function sdfMetaballCluster(x, y, z, centers, r) {
    let sum = 0;
    const rad = r || 0.5;
    for (const c of centers) {
        const d = len(x-c.x, y-c.y, z-c.z);
        sum += rad / (d*d + 0.1);
    }
    return 1.0 / sum - 0.5;
}
function sdfRibbon(x, y, z, width, thickness) {
    const w = width||0.3, t = thickness||0.05;
    const d1 = Math.abs(y) - w;
    const d2 = Math.abs(z) - t;
    return Math.max(d1, d2, Math.abs(x) - 2.0);
}
function sdfSplineSurface(x, y, z, controlPoints) {
    let minDist = Infinity;
    for (let i = 0; i < controlPoints.length-1; i++) {
        const a = controlPoints[i];
        const b = controlPoints[i+1];
        const ax = a.x, ay = a.y, az = a.z;
        const bx = b.x, by = b.y, bz = b.z;
        const abx = bx-ax, aby = by-ay, abz = bz-az;
        const t = clamp(dot3(x-ax, y-ay, z-az, abx, aby, abz) / len2(abx, aby, abz), 0, 1);
        const px = ax + abx*t, py = ay + aby*t, pz = az + abz*t;
        const d = len(x-px, y-py, z-pz);
        if (d < minDist) minDist = d;
    }
    return minDist - 0.05;
}
function sdfImplicitSurface(x, y, z, coeffs) {
    const a = coeffs?.a||0, b = coeffs?.b||0, c = coeffs?.c||0, d = coeffs?.d||-1;
    return x*x + y*y + z*z + a*x + b*y + c*z + d;
}

// ---------- Opérations artistiques (blends avancés) ----------
function opExponentialBlend(a, b, k) {
    const t = Math.exp(-Math.abs(a)/k) + Math.exp(-Math.abs(b)/k);
    return -k * Math.log(Math.max(t, 1e-6));
}
function opPolynomialBlend(a, b, k, p) {
    const pow = p||2;
    const h = clamp(0.5 + 0.5*(b-a)/k, 0, 1);
    return mix(a, b, h) - k * Math.pow(h * (1-h), pow);
}
function opCurvatureBlend(a, b, k, r) {
    const curvature = r||0.2;
    const h = clamp(0.5 + 0.5*(b-a)/k, 0, 1);
    const curve = curvature * Math.sin(h * Math.PI);
    return mix(a, b, h) - k * h * (1-h) - curve;
}
function opDomainRepetition(x, y, z, rep, out) {
    out[0] = x - rep.x * Math.round(x / rep.x);
    out[1] = y - rep.y * Math.round(y / rep.y);
    out[2] = z - rep.z * Math.round(z / rep.z);
}
function opDomainRotationFractal(x, y, z, angle, out) {
    const theta = angle * Math.PI/180;
    const c = Math.cos(theta), s = Math.sin(theta);
    const x1 = x*c - z*s;
    const z1 = x*s + z*c;
    out[0] = x1; out[1] = y; out[2] = z1;
}
function opDomainFolding(x, y, z, foldAxis, out) {
    if (foldAxis === 'x') { out[0] = Math.abs(x); out[1]=y; out[2]=z; }
    else if (foldAxis === 'y') { out[0]=x; out[1]=Math.abs(y); out[2]=z; }
    else if (foldAxis === 'z') { out[0]=x; out[1]=y; out[2]=Math.abs(z); }
}
function opMultiLayerSDF(layers, weights, x, y, z) {
    let sum = 0, wsum = 0;
    for (let i = 0; i < layers.length; i++) {
        const d = layers[i](x, y, z);
        const w = weights?.[i]||1;
        sum += d * w;
        wsum += w;
    }
    return sum / wsum;
}
function opMultiOctaveDisplacement(base, freq, amp, oct, x, y, z) {
    let disp = 0;
    let f = freq||1, a = amp||0.1;
    for (let i = 0; i < oct; i++) {
        disp += a * Math.sin(x*f)*Math.cos(y*f)*Math.sin(z*f);
        f *= 2; a *= 0.5;
    }
    return base(x, y, z) + disp;
}
function opMultiMaterialBlending(distA, matA, distB, matB, blendWidth) {
    const w = blendWidth||0.1;
    const t = clamp((distA - distB) / w, 0, 1);
    return { dist: mix(distA, distB, t), material: mix(matA, matB, t) };
}

// ---------- Transformations artistiques ----------
function foldPoint(x, y, z, limit, out) {
    out[0] = 2*limit - Math.abs(x); out[1] = y; out[2] = z;
}
function boxFoldPoint(x, y, z, r, out) {
    out[0] = clamp(x, -r, r) * 2 - x;
    out[1] = clamp(y, -r, r) * 2 - y;
    out[2] = clamp(z, -r, r) * 2 - z;
}
function sphereFoldPoint(x, y, z, minR, maxR, out) {
    const r2 = len2(x,y,z);
    if (r2 < minR*minR) {
        const t = (maxR*maxR) / (minR*minR);
        out[0] = x * t; out[1] = y * t; out[2] = z * t;
    } else if (r2 < maxR*maxR) {
        const t = (maxR*maxR) / r2;
        out[0] = x * t; out[1] = y * t; out[2] = z * t;
    } else { out[0]=x; out[1]=y; out[2]=z; }
}
function kaleidoscopeFold(x, y, z, sectors, out) {
    let angle = Math.atan2(y, x);
    const step = 2*Math.PI / sectors;
    angle = Math.abs(angle % step) * 2 - step;
    const r = len(x, y, 0);
    out[0] = r * Math.cos(angle);
    out[1] = r * Math.sin(angle);
    out[2] = z;
}
function swirlPoint(x, y, z, strength, out) {
    const r = len(x, y, z);
    const angle = strength * r;
    const c = Math.cos(angle), s = Math.sin(angle);
    out[0] = x*c - y*s;
    out[1] = x*s + y*c;
    out[2] = z;
}
function vortexPoint(x, y, z, strength, out) {
    const r = len(x, y, 0);
    const angle = strength / (r+0.1);
    const c = Math.cos(angle), s = Math.sin(angle);
    out[0] = x*c - y*s;
    out[1] = x*s + y*c;
    out[2] = z;
}
function ripplePoint(x, y, z, freq, amp, out) {
    const r = len(x, y, z);
    const offset = Math.sin(r * freq) * amp;
    const factor = 1 + offset / (r+EPS);
    out[0] = x * factor;
    out[1] = y * factor;
    out[2] = z * factor;
}
function wavePoint(x, y, z, dir, freq, amp, out) {
    if (dir === 'x') out[0] = x + Math.sin(z*freq)*amp;
    else if (dir === 'y') out[1] = y + Math.sin(x*freq)*amp;
    else out[2] = z + Math.sin(y*freq)*amp;
}
function spiralPoint(x, y, z, twist, out) {
    const r = len(x, y, z);
    const angle = twist * r;
    const c = Math.cos(angle), s = Math.sin(angle);
    out[0] = x*c - y*s;
    out[1] = x*s + y*c;
    out[2] = z;
}
function radialTwistPoint(x, y, z, strength, out) {
    const r = len(x, y, 0);
    const angle = strength * r;
    const c = Math.cos(angle), s = Math.sin(angle);
    out[0] = x*c - y*s;
    out[1] = x*s + y*c;
    out[2] = z;
}
function polarWarpPoint(x, y, z, strength, out) {
    const r = len(x, y, z);
    const theta = Math.atan2(y, x);
    const phi = Math.acos(clamp(z/r, -1, 1));
    const nr = r + Math.sin(theta*strength)*0.1;
    const ntheta = theta + Math.sin(phi*strength)*0.2;
    const nphi = phi + Math.sin(r*strength)*0.1;
    out[0] = nr * Math.sin(nphi) * Math.cos(ntheta);
    out[1] = nr * Math.sin(nphi) * Math.sin(ntheta);
    out[2] = nr * Math.cos(nphi);
}
function uvWarpPoint(x, y, z, strength, out) {
    out[0] = x + Math.sin(y*strength)*0.1;
    out[1] = y + Math.cos(z*strength)*0.1;
    out[2] = z + Math.sin(x*strength)*0.1;
}
function domainDistortionPoint(x, y, z, freq, amp, out) {
    out[0] = x + Math.sin(y*freq)*amp;
    out[1] = y + Math.sin(z*freq)*amp;
    out[2] = z + Math.sin(x*freq)*amp;
}
function domainMirroringPoint(x, y, z, axis, out) {
    if (axis === 'x') out[0] = Math.abs(x);
    else if (axis === 'y') out[1] = Math.abs(y);
    else if (axis === 'z') out[2] = Math.abs(z);
    else { out[0]=x; out[1]=y; out[2]=z; }
}
function domainTilingPoint(x, y, z, size, out) {
    out[0] = (x % size) - size/2;
    out[1] = (y % size) - size/2;
    out[2] = (z % size) - size/2;
}

// ---------- Classe Transform précalculée pour les transformations simples ----------
class TransformArtistic {
    constructor(tx,ty,tz, sx,sy,sz, rotMat) {
        this.tx=tx; this.ty=ty; this.tz=tz;
        this.sx=sx; this.sy=sy; this.sz=sz;
        this.rotMat=rotMat;
    }
    apply(x,y,z,out) {
        let lx = x-this.tx, ly = y-this.ty, lz = z-this.tz;
        lx /= this.sx; ly /= this.sy; lz /= this.sz;
        if (this.rotMat) {
            const m = this.rotMat;
            out[0] = m[0]*lx + m[3]*ly + m[6]*lz;
            out[1] = m[1]*lx + m[4]*ly + m[7]*lz;
            out[2] = m[2]*lx + m[5]*ly + m[8]*lz;
        } else { out[0]=lx; out[1]=ly; out[2]=lz; }
    }
}

function quatToMatrix(qw,qx,qy,qz) {
    const xx=qx*qx, yy=qy*qy, zz=qz*qz;
    const xy=qx*qy, xz=qx*qz, yz=qy*qz;
    const wx=qw*qx, wy=qw*qy, wz=qw*qz;
    return [
        1-2*(yy+zz), 2*(xy-wz), 2*(xz+wy),
        2*(xy+wz), 1-2*(xx+zz), 2*(yz-wx),
        2*(xz-wy), 2*(yz+wx), 1-2*(xx+yy)
    ];
}

// ---------- Évaluateur artistique étendu pour les meta nodes ----------
class SDFEvaluatorArtistic {
    constructor() {
        this._tmp = [0,0,0];
        this._tmp2 = [0,0,0];
        this._time = Date.now();
        // Meta state enrichi pour supporter materialLayers, colorFields, styleTags
        this.meta = {
            materialLayers: [],     // liste d'objets { material, blend, weight, color }
            colorFields: {},        // map des champs de couleur
            styleTags: [],          // liste de styles
            lodFractalScale: 1.0,
            maskFields: null,
            patternSelector: null
        };
        this._metaStack = [];
    }
    updateTime(now) { this._time = now; }
    evaluate(node, x, y, z) {
        if (!node) return 1e9;
        return this._evalNode(node, x, y, z);
    }
    evaluateObj(node, p) { return this.evaluate(node, p.x, p.y, p.z); }

    _evalNode(node, x, y, z) {
        switch (node._type) {
            case 'primitive': return this._primitive(node, x, y, z);
            case 'op': return this._boolean(node, x, y, z);
            case 'transform': return this._transform(node, x, y, z);
            case 'meta': return this._meta(node, x, y, z);
            default: return 1e9;
        }
    }

    _pushMeta(m) {
        this._metaStack.push({
            materialLayers: [...this.meta.materialLayers],
            colorFields: {...this.meta.colorFields},
            styleTags: [...this.meta.styleTags],
            lodFractalScale: this.meta.lodFractalScale,
            maskFields: this.meta.maskFields,
            patternSelector: this.meta.patternSelector
        });
        if (m.materialLayers) this.meta.materialLayers = m.materialLayers;
        if (m.colorFields) Object.assign(this.meta.colorFields, m.colorFields);
        if (m.styleTags) this.meta.styleTags = m.styleTags;
        if (m.lodFractalScale) this.meta.lodFractalScale = m.lodFractalScale;
        if (m.maskFields) this.meta.maskFields = m.maskFields;
        if (m.patternSelector) this.meta.patternSelector = m.patternSelector;
    }
    _popMeta() {
        const prev = this._metaStack.pop();
        if (prev) this.meta = prev;
    }

    // Nouvelle méthode pour fusionner plusieurs meta nodes attachés
    _mergeAttachedMetas(attachedMetas) {
        if (!attachedMetas || attachedMetas.length === 0) return null;
        const merged = {
            materialLayers: [],
            colorFields: {},
            styleTags: []
        };
        for (const meta of attachedMetas) {
            if (meta.kind === 'material_layer') {
                merged.materialLayers.push({
                    material: meta.material,
                    blend: meta.blend,
                    weight: meta.weight,
                    color: meta.color,
                    layerIndex: meta.layerIndex
                });
            } else if (meta.kind === 'color_field') {
                merged.colorFields[meta.fieldType] = {
                    colors: meta.colors,
                    intensity: meta.intensity,
                    mapping: meta.mapping
                };
            } else if (meta.kind === 'style_tags') {
                merged.styleTags.push(...(meta.styles || []));
            }
        }
        return merged;
    }

    _primitive(p, x, y, z) {
        switch (p.kind) {
            case 'mandelbulb': return sdfMandelbulb(x, y, z, p.power, p.iter);
            case 'mandelbox': return sdfMandelbox(x, y, z, p.scale, p.iter);
            case 'julia3D': return sdfJulia3D(x, y, z, p.cx, p.cy, p.cz, p.iter);
            case 'sierpinski3D': return sdfSierpinski3D(x, y, z, p.size, p.iter);
            case 'noise_volume': return sdfNoiseVolume(x, y, z, p.amp, p.freq, p.oct);
            case 'pattern_volume': return sdfPatternVolume(x, y, z, p.pattern);
            case 'voronoi_cell': return sdfVoronoiCell(x, y, z, p.scale);
            case 'cellular_noise': return sdfCellularNoise(x, y, z, p.freq);
            case 'fbm_volume': return sdfFbmVolume(x, y, z, p.amp, p.freq, p.oct, p.lac);
            case 'gradient_field': return sdfGradientField(x, y, z, p.dirX, p.dirY, p.dirZ, p.strength);
            case 'displacement_field': return sdfDisplacementField(x, y, z, p.freq, p.amp);
            case 'vector_field': return sdfVectorField(x, y, z, p.fieldType);
            case 'metaball_cluster': return sdfMetaballCluster(x, y, z, p.centers, p.r);
            case 'ribbon': return sdfRibbon(x, y, z, p.width, p.thickness);
            case 'spline_surface': return sdfSplineSurface(x, y, z, p.points);
            case 'implicit_surface': return sdfImplicitSurface(x, y, z, p.coeffs);
            case 'sphere': return sdfSphere(x, y, z, p.r);
            case 'torus': return sdfTorus(x, y, z, p.R, p.r);
            case 'cylinder': return sdfCylinder(x, y, z, p.r);
            case 'box': return sdfBox(x, y, z, p.sx, p.sy, p.sz);
            case 'prism_hex': return sdfHexPrism(x, y, z, p.h, p.r);
            case 'prism_diamond': return sdfDiamondPrism(x, y, z, p.h, p.r);
            case 'pyramid': return sdfPyramid(x, y, z, p.h);
            default: return 1e9;
        }
    }

    _boolean(op, x, y, z) {
        const left = this._evalNode(op.left, x, y, z);
        const right = this._evalNode(op.right, x, y, z);
        const k = op.smoothness || 0.2;
        switch (op.op) {
            case 'exponential_blend': return opExponentialBlend(left, right, k);
            case 'polynomial_blend': return opPolynomialBlend(left, right, k, op.power);
            case 'curvature_blend': return opCurvatureBlend(left, right, k, op.curvature);
            case 'multi_layer_sdf': return opMultiLayerSDF([()=>left, ()=>right], [0.5,0.5], x, y, z);
            case 'multi_octave_displacement': return opMultiOctaveDisplacement(()=>left, op.freq, op.amp, op.oct, x, y, z);
            default: return left < right ? left : right;
        }
    }

    _transform(t, x, y, z) {
        let px = x, py = y, pz = z;
        const out = this._tmp;
        if (t.transform) {
            t.transform.apply(px, py, pz, out);
            px = out[0]; py = out[1]; pz = out[2];
        } else {
            if (t.translate) { px -= t.tx; py -= t.ty; pz -= t.tz; }
            if (t.scale) { px /= t.sx; py /= t.sy; pz /= t.sz; }
            if (t.rotate) {
                const q = this._tmp2;
                rotatePointQuat(px, py, pz, t.qw, t.qx, t.qy, t.qz, out);
                px=out[0]; py=out[1]; pz=out[2];
            }
            if (t.fold) foldPoint(px, py, pz, t.foldLimit, out);
            else if (t.box_fold) boxFoldPoint(px, py, pz, t.boxFoldR, out);
            else if (t.sphere_fold) sphereFoldPoint(px, py, pz, t.sphereMinR, t.sphereMaxR, out);
            else if (t.kaleidoscope_fold) kaleidoscopeFold(px, py, pz, t.kaleidSectors, out);
            else if (t.swirl) swirlPoint(px, py, pz, t.swirlStrength, out);
            else if (t.vortex) vortexPoint(px, py, pz, t.vortexStrength, out);
            else if (t.ripple) ripplePoint(px, py, pz, t.rippleFreq, t.rippleAmp, out);
            else if (t.wave) wavePoint(px, py, pz, t.waveDir, t.waveFreq, t.waveAmp, out);
            else if (t.spiral) spiralPoint(px, py, pz, t.spiralTwist, out);
            else if (t.radial_twist) radialTwistPoint(px, py, pz, t.radialTwistStr, out);
            else if (t.polar_warp) polarWarpPoint(px, py, pz, t.polarWarpStr, out);
            else if (t.uv_warp) uvWarpPoint(px, py, pz, t.uvWarpStr, out);
            else if (t.domain_distortion) domainDistortionPoint(px, py, pz, t.distortFreq, t.distortAmp, out);
            else if (t.domain_mirroring) domainMirroringPoint(px, py, pz, t.mirrorAxis, out);
            else if (t.domain_tiling) domainTilingPoint(px, py, pz, t.tileSize, out);
            else if (t.repeat) domainTilingPoint(px, py, pz, t.tileSize, out); // 🔥 CORRECTION : support de 'repeat'
            else out[0]=px, out[1]=py, out[2]=pz;
            px = out[0]; py = out[1]; pz = out[2];
        }
        return this._evalNode(t.child, px, py, pz);
    }

    _meta(m, x, y, z) {
        this._pushMeta(m);
        const res = this._evalNode(m.child, x, y, z);
        this._popMeta();
        return res;
    }
}

// Helper pour rotation
function rotatePointQuat(x, y, z, qw, qx, qy, qz, out) {
    const qix = -qx, qiy = -qy, qiz = -qz, qiw = qw;
    const x2 = qix+qix, y2 = qiy+qiy, z2 = qiz+qiz;
    const xx = qix*x2, xy = qix*y2, xz = qix*z2;
    const yy = qiy*y2, yz = qiy*z2, zz = qiz*z2;
    const wx = qiw*x2, wy = qiw*y2, wz = qiw*z2;
    out[0] = (1-(yy+zz))*x + (xy-wz)*y + (xz+wy)*z;
    out[1] = (xy+wz)*x + (1-(xx+zz))*y + (yz-wx)*z;
    out[2] = (xz-wy)*x + (yz+wx)*y + (1-(xx+yy))*z;
}

// ---------- Construction du graphe artistique avec support des meta attachés ----------
function createArtisticEvaluatorFromGraph(graph) {
    if (!Array.isArray(graph.nodes)) {
        const arr = [];
        for (const [id, node] of Object.entries(graph.nodes)) arr.push({ id, ...node });
        graph.nodes = arr;
    }
    if (!graph.root && graph.rootNode) graph.root = graph.rootNode;

    // Normalisation des types
    for (const node of graph.nodes) {
        if ([
            "mandelbulb","mandelbox","julia3D","sierpinski3D",
            "noise_volume","pattern_volume","voronoi_cell","cellular_noise",
            "fbm_volume","gradient_field","displacement_field","vector_field",
            "metaball_cluster","ribbon","spline_surface","implicit_surface",
            "sphere","torus","cylinder","box","prism_hex","prism_diamond","pyramid"
        ].includes(node.type)) {
            node.kind = node.type;
            node.type = "primitive";
            node.params = node.params || node;
        }
        if (["exponential_blend","polynomial_blend","curvature_blend","domain_repetition_fractal",
             "domain_rotation_fractal","domain_folding","multi_layer_sdf","multi_octave_displacement",
             "multi_material_blending"].includes(node.type)) {
            node.op = node.type;
            node.type = "op";
        }
        if (["translate","scale","rotate","fold","box_fold","sphere_fold","kaleidoscope_fold",
             "swirl","vortex","ripple","wave","spiral","radial_twist","polar_warp","uv_warp",
             "domain_distortion","domain_mirroring","domain_tiling","repeat"].includes(node.type)) {
            node.type = "transform";
            node.child = { id: node.input };
        }
        if (node.type === "transform" && node.input && !node.child) node.child = { id: node.input };
    }

    const nodesMap = new Map(graph.nodes.map(n => [n.id, n]));

    // Construire une map des meta nodes attachés à chaque node id
    const attachedMetasMap = new Map();
    for (const node of graph.nodes) {
        if (node.type === 'meta' && node.attachTo) {
            if (!attachedMetasMap.has(node.attachTo)) attachedMetasMap.set(node.attachTo, []);
            attachedMetasMap.get(node.attachTo).push(node);
        }
    }

    function buildNode(ref) {
        let raw = ref && typeof ref === 'object' && ref.id ? nodesMap.get(ref.id) : ref;
        if (!raw) return null;

        // Récupérer les meta nodes attachés à ce node (si c'est un node avec un ID)
        const attached = raw.id && attachedMetasMap.has(raw.id) ? attachedMetasMap.get(raw.id) : [];

        let builtNode = null;
        if (raw.type === 'primitive') {
            const p = { _type: 'primitive', kind: raw.kind };
            const params = raw.params;
            switch (p.kind) {
                case 'mandelbulb': p.power = params.power ?? 8; p.iter = params.iter ?? 12; break;
                case 'mandelbox': p.scale = params.scale ?? 2; p.iter = params.iter ?? 10; break;
                case 'julia3D': p.cx = params.cx ?? 0.7885; p.cy = params.cy ?? 0.7885; p.cz = params.cz ?? 0; p.iter = params.iter ?? 10; break;
                case 'sierpinski3D': p.size = params.size ?? 2; p.iter = params.iter ?? 5; break;
                case 'noise_volume': p.amp = params.amp ?? 0.5; p.freq = params.freq ?? 1; p.oct = params.oct ?? 3; break;
                case 'pattern_volume': p.pattern = params.pattern ?? 'checkerboard'; break;
                case 'voronoi_cell': p.scale = params.scale ?? 2; break;
                case 'cellular_noise': p.freq = params.freq ?? 2; break;
                case 'fbm_volume': p.amp = params.amp ?? 0.5; p.freq = params.freq ?? 1; p.oct = params.oct ?? 4; p.lac = params.lac ?? 2; break;
                case 'gradient_field': p.dirX = params.dirX ?? 1; p.dirY = params.dirY ?? 0; p.dirZ = params.dirZ ?? 0; p.strength = params.strength ?? 1; break;
                case 'displacement_field': p.freq = params.freq ?? 1; p.amp = params.amp ?? 0.2; break;
                case 'vector_field': p.fieldType = params.fieldType ?? 'radial'; break;
                case 'metaball_cluster': p.centers = params.centers ?? [{x:-0.5,y:0,z:0},{x:0.5,y:0,z:0}]; p.r = params.r ?? 0.5; break;
                case 'ribbon': p.width = params.width ?? 0.3; p.thickness = params.thickness ?? 0.05; break;
                case 'spline_surface': p.points = params.points ?? [{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:1,y:0,z:0}]; break;
                case 'implicit_surface': p.coeffs = params.coeffs ?? {a:0,b:0,c:0,d:-1}; break;
                case 'sphere': p.r = params.r ?? 1.0; break;
                case 'box': p.sx = params.sx ?? 1; p.sy = params.sy ?? 1; p.sz = params.sz ?? 1; break;
                case 'prism_hex': p.h = params.h ?? 1; p.r = params.r ?? 1; break;
                case 'prism_diamond': p.h = params.h ?? 1; p.r = params.r ?? 1; break;
                case 'pyramid': p.h = params.h ?? 1; break;
                case 'torus': p.R = params.R ?? 1.2; p.r = params.r ?? 0.4; break;
                case 'cylinder': p.r = params.r ?? 0.6; break;
                default: return null;
            }
            builtNode = p;
        } else if (raw.type === 'op') {
            const left = buildNode(raw.left);
            const right = buildNode(raw.right);
            if (!left || !right) return null;
            const opNode = { _type: 'op', op: raw.op, left, right, smoothness: raw.smoothness ?? 0.2 };
            if (raw.power) opNode.power = raw.power;
            if (raw.curvature) opNode.curvature = raw.curvature;
            if (raw.freq) opNode.freq = raw.freq;
            if (raw.amp) opNode.amp = raw.amp;
            if (raw.oct) opNode.oct = raw.oct;
            builtNode = opNode;
        } else if (raw.type === 'transform') {
            let child = buildNode(raw.child);
            if (!child) return null;
            let tx=0, ty=0, tz=0, sx=1, sy=1, sz=1, rotMat=null;
            let hasBase = false;
            if (raw.translate) { tx = raw.tx; ty = raw.ty; tz = raw.tz; hasBase=true; }
            if (raw.scale) { sx = raw.sx; sy = raw.sy; sz = raw.sz; hasBase=true; }
            let qw=1,qx=0,qy=0,qz=0;
            if (raw.rotate) { qx=raw.qx||0; qy=raw.qy||0; qz=raw.qz||0; qw=raw.qw||1; rotMat=quatToMatrix(qw,qx,qy,qz); hasBase=true; }
            const hasArtistic = !!(raw.fold || raw.box_fold || raw.sphere_fold || raw.kaleidoscope_fold ||
                                   raw.swirl || raw.vortex || raw.ripple || raw.wave || raw.spiral ||
                                   raw.radial_twist || raw.polar_warp || raw.uv_warp || raw.domain_distortion ||
                                   raw.domain_mirroring || raw.domain_tiling || raw.repeat);
            if (hasBase && !hasArtistic) {
                const transform = new TransformArtistic(tx,ty,tz, sx,sy,sz, rotMat);
                builtNode = { _type: 'transform', transform, child };
            } else {
                const tNode = { _type: 'transform', child };
                if (raw.translate) { tNode.translate=true; tNode.tx=tx; tNode.ty=ty; tNode.tz=tz; }
                if (raw.scale) { tNode.scale=true; tNode.sx=sx; tNode.sy=sy; tNode.sz=sz; }
                if (raw.rotate) { tNode.rotate=true; tNode.qw=qw; tNode.qx=qx; tNode.qy=qy; tNode.qz=qz; }
                if (raw.fold) { tNode.fold=true; tNode.foldLimit = raw.fold.limit ?? 1.0; }
                if (raw.box_fold) { tNode.box_fold=true; tNode.boxFoldR = raw.box_fold.radius ?? 1.0; }
                if (raw.sphere_fold) { tNode.sphere_fold=true; tNode.sphereMinR = raw.sphere_fold.minRadius ?? 0.5; tNode.sphereMaxR = raw.sphere_fold.maxRadius ?? 1.0; }
                if (raw.kaleidoscope_fold) { tNode.kaleidoscope_fold=true; tNode.kaleidSectors = raw.kaleidoscope_fold.sectors ?? 6; }
                if (raw.swirl) { tNode.swirl=true; tNode.swirlStrength = raw.swirl.strength ?? 1.0; }
                if (raw.vortex) { tNode.vortex=true; tNode.vortexStrength = raw.vortex.strength ?? 2.0; }
                if (raw.ripple) { tNode.ripple=true; tNode.rippleFreq = raw.ripple.frequency ?? 5.0; tNode.rippleAmp = raw.ripple.amplitude ?? 0.1; }
                if (raw.wave) { tNode.wave=true; tNode.waveDir = raw.wave.direction ?? 'x'; tNode.waveFreq = raw.wave.frequency ?? 2.0; tNode.waveAmp = raw.wave.amplitude ?? 0.2; }
                if (raw.spiral) { tNode.spiral=true; tNode.spiralTwist = raw.spiral.twist ?? 2.0; }
                if (raw.radial_twist) { tNode.radial_twist=true; tNode.radialTwistStr = raw.radial_twist.strength ?? 1.0; }
                if (raw.polar_warp) { tNode.polar_warp=true; tNode.polarWarpStr = raw.polar_warp.strength ?? 0.5; }
                if (raw.uv_warp) { tNode.uv_warp=true; tNode.uvWarpStr = raw.uv_warp.strength ?? 0.3; }
                if (raw.domain_distortion) { tNode.domain_distortion=true; tNode.distortFreq = raw.domain_distortion.frequency ?? 2.0; tNode.distortAmp = raw.domain_distortion.amplitude ?? 0.2; }
                if (raw.domain_mirroring) { tNode.domain_mirroring=true; tNode.mirrorAxis = raw.domain_mirroring.axis ?? 'x'; }
                if (raw.domain_tiling) { tNode.domain_tiling=true; tNode.tileSize = raw.domain_tiling.size ?? 1.0; }
                if (raw.repeat) { tNode.repeat=true; tNode.tileSize = raw.repeat.period ?? raw.repeat.size ?? 1.0; }
                builtNode = tNode;
            }
        } else {
            return null;
        }

        // Si des meta nodes sont attachés, on les fusionne et on enveloppe le builtNode dans un meta node
        if (attached.length > 0) {
            const mergedMeta = {
                _type: 'meta',
                child: builtNode,
                materialLayers: [],
                colorFields: {},
                styleTags: []
            };
            for (const meta of attached) {
                if (meta.kind === 'material_layer') {
                    mergedMeta.materialLayers.push({
                        material: meta.material,
                        blend: meta.blend,
                        weight: meta.weight,
                        color: meta.color,
                        layerIndex: meta.layerIndex
                    });
                } else if (meta.kind === 'color_field') {
                    mergedMeta.colorFields[meta.fieldType] = {
                        colors: meta.colors,
                        intensity: meta.intensity,
                        mapping: meta.mapping
                    };
                } else if (meta.kind === 'style_tags') {
                    mergedMeta.styleTags.push(...(meta.styles || []));
                }
            }
            return mergedMeta;
        }
        return builtNode;
    }

    const rootNode = buildNode({ id: graph.root });
    if (!rootNode) throw new Error("Failed to build artistic root node");
    const evaluator = new SDFEvaluatorArtistic();
    log("Artistic evaluator created with meta support and repeat fix");
    return { evaluator, rootNode };
}

module.exports = {
    SDFEvaluatorArtistic,
    createArtisticEvaluatorFromGraph,
    // Primitives
    sdfMandelbulb, sdfMandelbox, sdfJulia3D, sdfSierpinski3D,
    sdfNoiseVolume, sdfPatternVolume, sdfVoronoiCell, sdfCellularNoise, sdfFbmVolume,
    sdfGradientField, sdfDisplacementField, sdfVectorField,
    sdfMetaballCluster, sdfRibbon, sdfSplineSurface, sdfImplicitSurface,
    // Opérations
    opExponentialBlend, opPolynomialBlend, opCurvatureBlend,
    opMultiLayerSDF, opMultiOctaveDisplacement,
    // Transformations
    foldPoint, boxFoldPoint, sphereFoldPoint, kaleidoscopeFold,
    swirlPoint, vortexPoint, ripplePoint, wavePoint, spiralPoint,
    radialTwistPoint, polarWarpPoint, uvWarpPoint,
    domainDistortionPoint, domainMirroringPoint, domainTilingPoint
};
