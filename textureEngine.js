// =============================================================================
// core/textureEngine.js
// Moteur de textures procédurales HF3 – Version ultime
// Toutes les textures organiques, états, processus, fractales et hybrides
// Réalisme époustouflant – Première mondiale pour la morphogenèse vivante
// =============================================================================

// ========================= 1. BRUITS & FRACTALES =========================

// Bruit de Perlin 3D (implémentation simplifiée mais réaliste)
function perlin3D(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const aaa = grad(p[X]+p[Y]+p[Z], x, y, z);
  const aba = grad(p[X]+p[Y+1]+p[Z], x, y-1, z);
  const aab = grad(p[X]+p[Y]+p[Z+1], x, y, z-1);
  const abb = grad(p[X]+p[Y+1]+p[Z+1], x, y-1, z-1);
  const baa = grad(p[X+1]+p[Y]+p[Z], x-1, y, z);
  const bba = grad(p[X+1]+p[Y+1]+p[Z], x-1, y-1, z);
  const bab = grad(p[X+1]+p[Y]+p[Z+1], x-1, y, z-1);
  const bbb = grad(p[X+1]+p[Y+1]+p[Z+1], x-1, y-1, z-1);
  return lerp(lerp(lerp(aaa, baa, u), lerp(aba, bba, u), v),
              lerp(lerp(aab, bab, u), lerp(abb, bbb, u), v), w);
}
function fade(t) { return t*t*t*(t*(t*6-15)+10); }
function lerp(a,b,t) { return a + t*(b-a); }
function grad(hash,x,y,z) {
  const h = hash & 15;
  const u = h<8 ? x : y;
  const v = h<4 ? y : (h===12||h===14 ? x : z);
  return ((h&1)===0 ? u : -u) + ((h&2)===0 ? v : -v);
}
const p = Array(512); (function initPerlin() {
  const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  for(let i=0; i<256; i++) p[256+i] = p[i] = permutation[i];
})();

// Bruit de Worley (Voronoi cellulaire) 3D – pores, cellules, fissures
function worley3D(p, scale=4.0) {
  const cellSize = 1.0 / scale;
  const xi = Math.floor(p.x * scale);
  const yi = Math.floor(p.y * scale);
  const zi = Math.floor(p.z * scale);
  let minDist = 1e9, secondDist = 1e9;
  for(let dx=-1; dx<=1; dx++) {
    for(let dy=-1; dy<=1; dy++) {
      for(let dz=-1; dz<=1; dz++) {
        const nx = xi + dx, ny = yi + dy, nz = zi + dz;
        const px = (nx + 0.5) * cellSize;
        const py = (ny + 0.5) * cellSize;
        const pz = (nz + 0.5) * cellSize;
        const dxp = p.x - px, dyp = p.y - py, dzp = p.z - pz;
        const d2 = dxp*dxp + dyp*dyp + dzp*dzp;
        if(d2 < minDist) { secondDist = minDist; minDist = d2; }
        else if(d2 < secondDist) secondDist = d2;
      }
    }
  }
  return { F1: Math.sqrt(minDist), F2: Math.sqrt(secondDist) };
}

// FBM sur Worley
function worleyFBM(p, octaves=3, scale=4.0, persistence=0.5) {
  let val = 0, amp = 0.5, freq = scale;
  for(let i=0; i<octaves; i++) {
    val += amp * (1.0 - worley3D(p, freq).F1);
    amp *= persistence;
    freq *= 2.0;
  }
  return Math.min(1.0, Math.max(0.0, val));
}

// Bruit de bruit (pour motifs complexes)
function fractalNoise(p, octaves=5, persistence=0.5, lacunarity=2.0) {
  let val = 0, amp = 0.5, freq = 1.0;
  for(let i=0; i<octaves; i++) {
    val += amp * perlin3D(p.x*freq, p.y*freq, p.z*freq);
    amp *= persistence;
    freq *= lacunarity;
  }
  return (val + 1.0) * 0.5;
}

// Motif de domain warping (pour textures très organiques)
function domainWarp(p, strength=0.2, octaves=3) {
  let qx = p.x, qy = p.y, qz = p.z;
  for(let i=0; i<octaves; i++) {
    const n1 = fractalNoise({x:qx, y:qy, z:qz}, 3);
    const n2 = fractalNoise({x:qy+1.3, y:qz+2.1, z:qx+0.7}, 3);
    const n3 = fractalNoise({x:qz+0.9, y:qx+1.8, z:qy+2.3}, 3);
    qx += strength * (n1 - 0.5);
    qy += strength * (n2 - 0.5);
    qz += strength * (n3 - 0.5);
  }
  return {x:qx, y:qy, z:qz};
}

// ========================= 2. UTILITAIRES =========================
function mixColor(a, b, t) { return [a[0]*(1-t)+b[0]*t, a[1]*(1-t)+b[1]*t, a[2]*(1-t)+b[2]*t]; }
function clamp(v, min=0, max=1) { return Math.min(max, Math.max(min, v)); }
function smoothstep(edge0, edge1, x) { const t = clamp((x-edge0)/(edge1-edge0)); return t*t*(3-2*t); }

// ========================= 3. TEXTURES DE BASE ORGANIQUE =========================
function skinSmooth(p, ctx) {
  const n = fractalNoise(p, 3, 0.5);
  const base = [0.82, 0.71, 0.63];
  const var1 = [0.75, 0.65, 0.58];
  let col = mixColor(base, var1, n*0.3);
  // micro-pores
  const pores = worley3D(p, 30).F1;
  col = mixColor(col, [0.78,0.67,0.59], smoothstep(0.1,0.3, pores)*0.2);
  return { r:col[0], g:col[1], b:col[2], roughness:0.45, metalness:0 };
}
function skinRough(p, ctx) {
  const n = fractalNoise(p, 4, 0.6);
  const base = [0.72, 0.62, 0.55];
  const dark = [0.55, 0.45, 0.40];
  let col = mixColor(base, dark, n*0.5);
  const cracks = worleyFBM(p, 3, 15);
  col = mixColor(col, [0.45,0.35,0.30], cracks*0.3);
  return { r:col[0], g:col[1], b:col[2], roughness:0.75, metalness:0 };
}
function skinThick(p, ctx) {
  const n = fractalNoise(p, 3);
  const fold = Math.sin(p.x*15)*Math.sin(p.y*12)*0.3;
  const base = [0.65, 0.52, 0.44];
  const light = [0.72, 0.60, 0.52];
  const col = mixColor(base, light, (n+fold)*0.6);
  return { r:col[0], g:col[1], b:col[2], roughness:0.68, metalness:0 };
}
function tissueCellular(p, ctx) {
  const cells = worley3D(p, 8).F2;
  const n = fractalNoise(p, 2);
  const col1 = [0.68, 0.58, 0.52];
  const col2 = [0.60, 0.50, 0.44];
  const col = mixColor(col1, col2, cells*1.2 + n*0.2);
  return { r:col[0], g:col[1], b:col[2], roughness:0.55, metalness:0 };
}
function tissueFibrous(p, ctx) {
  const angle = Math.atan2(p.y, p.x);
  const fibers = Math.sin(angle * 20 + p.z * 15) * 0.5 + 0.5;
  const base = [0.70, 0.60, 0.50];
  const light = [0.85, 0.75, 0.65];
  const col = mixColor(base, light, fibers);
  return { r:col[0], g:col[1], b:col[2], roughness:0.65, metalness:0 };
}
function wet(p, ctx) {
  const base = skinSmooth(p, ctx);
  return { r:base.r*0.9, g:base.g*0.9, b:base.b*0.9, roughness:0.2, metalness:0 };
}
function dry(p, ctx) {
  const base = skinRough(p, ctx);
  return { r:base.r*0.85, g:base.g*0.8, b:base.b*0.75, roughness:0.9, metalness:0 };
}
function gelatinous(p, ctx) {
  const n = fractalNoise(p, 4);
  const col = [0.55 + n*0.12, 0.50 + n*0.1, 0.45 + n*0.08];
  return { r:col[0], g:col[1], b:col[2], roughness:0.25, metalness:0.02 };
}
function cartilaginous(p, ctx) {
  const n = fractalNoise(p, 3);
  const cells = worley3D(p, 12).F1;
  const col = mixColor([0.85,0.82,0.78], [0.75,0.72,0.68], cells*0.8 + n*0.2);
  return { r:col[0], g:col[1], b:col[2], roughness:0.3, metalness:0 };
}
function osseous(p, ctx) {
  const pores = worley3D(p, 18).F1;
  const n = fractalNoise(p, 3);
  const col = mixColor([0.95,0.92,0.88], [0.75,0.70,0.65], pores*0.7 + n*0.3);
  return { r:col[0], g:col[1], b:col[2], roughness:0.6, metalness:0 };
}

// ========================= 4. MICRO-STRUCTURES =========================
function cellsRound(p, ctx) {
  const cell = worley3D(p, 10).F2;
  const border = Math.sin(cell*Math.PI*20);
  const col = mixColor([0.75,0.65,0.55], [0.85,0.75,0.65], border);
  return { r:col[0], g:col[1], b:col[2], roughness:0.5, metalness:0 };
}
function cellsElongated(p, ctx) {
  const stretch = {x:p.x*2, y:p.y*0.8, z:p.z*1.5};
  const cell = worley3D(stretch, 12).F1;
  const col = mixColor([0.70,0.60,0.50], [0.80,0.70,0.60], cell);
  return { r:col[0], g:col[1], b:col[2], roughness:0.55, metalness:0 };
}
function cellsDividing(p, ctx) {
  const cell = worley3D(p, 8).F1;
  const division = fractalNoise(p, 2, 0.7);
  const col = mixColor([0.68,0.55,0.48], [0.78,0.65,0.58], division);
  return { r:col[0], g:col[1], b:col[2], roughness:0.5, metalness:0 };
}
function poresOpen(p, ctx) {
  const pores = 1.0 - worleyFBM(p, 3, 25);
  const col = mixColor([0.80,0.70,0.60], [0.40,0.30,0.20], pores);
  return { r:col[0], g:col[1], b:col[2], roughness:0.7, metalness:0 };
}
function poresClosed(p, ctx) {
  const pores = worley3D(p, 20).F1;
  const col = mixColor([0.78,0.68,0.58], [0.72,0.62,0.52], smoothstep(0.1,0.3, pores));
  return { r:col[0], g:col[1], b:col[2], roughness:0.48, metalness:0 };
}
function microVeins(p, ctx) {
  const veins = Math.sin(p.x*40)*Math.sin(p.z*40) + Math.sin(p.y*50);
  const pattern = smoothstep(0.6,0.9, (veins+1)/2);
  const col = mixColor([0.72,0.62,0.54], [0.55,0.40,0.35], pattern);
  return { r:col[0], g:col[1], b:col[2], roughness:0.5, metalness:0 };
}
function microStrates(p, ctx) {
  const strata = Math.sin(p.y*25) * 0.5 + 0.5;
  const col = mixColor([0.68,0.60,0.52], [0.58,0.50,0.42], strata);
  return { r:col[0], g:col[1], b:col[2], roughness:0.52, metalness:0 };
}
function granules(p, ctx) {
  const gran = worleyFBM(p, 4, 15);
  const col = mixColor([0.70,0.62,0.55], [0.60,0.52,0.45], gran);
  return { r:col[0], g:col[1], b:col[2], roughness:0.65, metalness:0 };
}
function membrane(p, ctx) {
  const n = fractalNoise(p, 4);
  const col = [0.65 + n*0.1, 0.55 + n*0.08, 0.50 + n*0.05];
  return { r:col[0], g:col[1], b:col[2], roughness:0.35, metalness:0 };
}

// ========================= 5. ÉTATS PHYSIQUES =========================
function young(p, ctx) {
  const base = skinSmooth(p, ctx);
  const vitality = 1.0 - ctx.morpho.age;
  const brighter = [base.r+0.08, base.g+0.06, base.b+0.04];
  const col = mixColor([base.r,base.g,base.b], brighter, vitality);
  return { r:col[0], g:col[1], b:col[2], roughness:0.4, metalness:0 };
}
function old(p, ctx) {
  const base = skinRough(p, ctx);
  const ageSpot = fractalNoise(p, 3, 0.7);
  const dark = [0.55,0.45,0.38];
  const col = mixColor([base.r,base.g,base.b], dark, ageSpot*ctx.morpho.age);
  return { r:col[0], g:col[1], b:col[2], roughness:0.8, metalness:0 };
}
function stressed(p, ctx) {
  const base = skinRough(p, ctx);
  const stressMark = fractalNoise(p, 4, 0.8);
  const red = [0.85,0.55,0.45];
  const col = mixColor([base.r,base.g,base.b], red, stressMark*ctx.morpho.stress);
  return { r:col[0], g:col[1], b:col[2], roughness:0.7, metalness:0 };
}
function relaxed(p, ctx) {
  const base = skinSmooth(p, ctx);
  const soft = [base.r*1.02, base.g*1.01, base.b*1.0];
  return { r:soft[0], g:soft[1], b:soft[2], roughness:0.5, metalness:0 };
}
function tensionStriae(p, ctx) {
  const tensionDir = Math.sin(p.x*30 + p.z*20) * 0.5 + 0.5;
  const col = mixColor([0.72,0.62,0.54], [0.62,0.52,0.44], tensionDir);
  return { r:col[0], g:col[1], b:col[2], roughness:0.6, metalness:0 };
}
function relaxedFolds(p, ctx) {
  const folds = Math.sin(p.x*8)*Math.sin(p.z*8)*0.3;
  const col = mixColor([0.75,0.65,0.57], [0.68,0.58,0.50], folds+0.5);
  return { r:col[0], g:col[1], b:col[2], roughness:0.55, metalness:0 };
}
function wetStagnant(p, ctx) {
  const base = wet(p, ctx);
  const algae = fractalNoise(p, 3);
  const green = [0.25,0.45,0.20];
  const col = mixColor([base.r,base.g,base.b], green, algae*0.5);
  return { r:col[0], g:col[1], b:col[2], roughness:0.25, metalness:0 };
}
function dryFatigued(p, ctx) {
  const base = dry(p, ctx);
  const crackPattern = worleyFBM(p, 3, 12);
  const darkCrack = [0.35,0.25,0.20];
  const col = mixColor([base.r,base.g,base.b], darkCrack, crackPattern*0.6);
  return { r:col[0], g:col[1], b:col[2], roughness:0.85, metalness:0 };
}

// ========================= 6. PROCESSUS BIOLOGIQUES =========================
function growth(p, ctx) {
  const grad = 1.0 - Math.min(1.0, Math.sqrt(p.x*p.x+p.y*p.y+p.z*p.z) / 2.0);
  const n = fractalNoise(p, 3);
  const youngColor = [0.45,0.65,0.35];
  const oldColor = [0.65,0.45,0.35];
  const col = mixColor(youngColor, oldColor, grad*0.8 + n*0.2);
  return { r:col[0], g:col[1], b:col[2], roughness:0.5, metalness:0 };
}
function healing(p, ctx) {
  const scar = worley3D(p, 20).F1;
  const col = mixColor([0.80,0.70,0.60], [0.95,0.85,0.75], smoothstep(0.1,0.3, scar));
  return { r:col[0], g:col[1], b:col[2], roughness:0.48, metalness:0 };
}
function inflammation(p, ctx) {
  const infl = fractalNoise(p, 3, 0.7);
  const redInfl = [0.90,0.45,0.40];
  const base = skinSmooth(p, ctx);
  const col = mixColor([base.r,base.g,base.b], redInfl, infl*ctx.morpho.stress);
  return { r:col[0], g:col[1], b:col[2], roughness:0.55, metalness:0 };
}
function necrosisLight(p, ctx) {
  const base = skinSmooth(p, ctx);
  const necro = fractalNoise(p, 4) * ctx.morpho.necrosis;
  const dark = [0.35,0.20,0.15];
  const col = mixColor([base.r,base.g,base.b], dark, necro);
  return { r:col[0], g:col[1], b:col[2], roughness:0.7, metalness:0 };
}
function necrosisHeavy(p, ctx) {
  const base = necrosisLight(p, ctx);
  const cracks = worleyFBM(p, 4, 12);
  const black = [0.08,0.04,0.02];
  const col = mixColor([base.r,base.g,base.b], black, cracks*ctx.morpho.necrosis);
  return { r:col[0], g:col[1], b:col[2], roughness:0.92, metalness:0 };
}
function decompositionWet(p, ctx) {
  const n = fractalNoise(p, 4);
  const greenMold = [0.20,0.35,0.15];
  const brownRot = [0.40,0.25,0.12];
  const col = mixColor(greenMold, brownRot, n);
  return { r:col[0], g:col[1], b:col[2], roughness:0.85, metalness:0 };
}
function decompositionDry(p, ctx) {
  const dust = worleyFBM(p, 3, 20);
  const base = [0.55,0.45,0.35];
  const ashy = [0.35,0.30,0.25];
  const col = mixColor(base, ashy, dust);
  return { r:col[0], g:col[1], b:col[2], roughness:0.95, metalness:0 };
}
function cracksDeep(p, ctx) {
  const crackVal = worleyFBM(p, 4, 15);
  const darkFill = [0.10,0.06,0.04];
  const surface = [0.65,0.55,0.45];
  const col = mixColor(surface, darkFill, crackVal*0.8);
  return { r:col[0], g:col[1], b:col[2], roughness:0.88, metalness:0 };
}
function necrosisFibrous(p, ctx) {
  const fibers = tissueFibrous(p, ctx);
  const necro = necrosisLight(p, ctx);
  const col = mixColor([fibers.r,fibers.g,fibers.b], [necro.r,necro.g,necro.b], 0.6);
  return { r:col[0], g:col[1], b:col[2], roughness:0.78, metalness:0 };
}
function fungusMold(p, ctx) {
  const mold = worleyFBM(p, 3, 8);
  const col = mixColor([0.30,0.40,0.20], [0.50,0.35,0.20], mold);
  return { r:col[0], g:col[1], b:col[2], roughness:0.8, metalness:0 };
}

// ========================= 7. TEXTURES VÉGÉTALES =========================
function barkYoung(p, ctx) {
  const n = fractalNoise(p, 4);
  const col = mixColor([0.55,0.38,0.22], [0.45,0.32,0.18], n);
  return { r:col[0], g:col[1], b:col[2], roughness:0.72, metalness:0 };
}
function barkOld(p, ctx) {
  const cracks = worleyFBM(p, 4, 12);
  const base = [0.45,0.30,0.18];
  const dark = [0.25,0.15,0.08];
  const col = mixColor(base, dark, cracks);
  return { r:col[0], g:col[1], b:col[2], roughness:0.85, metalness:0 };
}
function leafHealthy(p, ctx) {
  const veins = Math.sin(p.x*50)*Math.sin(p.z*50);
  const green = [0.25,0.65,0.20];
  const lightGreen = [0.40,0.80,0.30];
  const col = mixColor(green, lightGreen, (veins+1)/2);
  return { r:col[0], g:col[1], b:col[2], roughness:0.48, metalness:0 };
}
function leafDry(p, ctx) {
  const yellowBrown = [0.70,0.55,0.20];
  const brown = [0.55,0.35,0.15];
  const n = fractalNoise(p, 3);
  const col = mixColor(yellowBrown, brown, n);
  return { r:col[0], g:col[1], b:col[2], roughness:0.88, metalness:0 };
}
function leafDiseased(p, ctx) {
  const spots = worleyFBM(p, 3, 20);
  const green = leafHealthy(p, ctx);
  const darkSpot = [0.35,0.25,0.10];
  const col = mixColor([green.r,green.g,green.b], darkSpot, spots*0.8);
  return { r:col[0], g:col[1], b:col[2], roughness:0.68, metalness:0 };
}
function moss(p, ctx) {
  const mossDensity = worley3D(p, 8).F1;
  const green = [0.20,0.55,0.15];
  const darkGreen = [0.12,0.35,0.08];
  const col = mixColor(green, darkGreen, mossDensity);
  return { r:col[0], g:col[1], b:col[2], roughness:0.85, metalness:0 };
}
function lichen(p, ctx) {
  const pattern = fractalNoise(p, 4);
  const grayGreen = [0.55,0.65,0.55];
  const yellow = [0.80,0.75,0.40];
  const col = mixColor(grayGreen, yellow, pattern);
  return { r:col[0], g:col[1], b:col[2], roughness:0.78, metalness:0 };
}
function rootFibrous(p, ctx) {
  const fibers = Math.sin(p.x*25 + p.z*18) * 0.5 + 0.5;
  const col = mixColor([0.55,0.40,0.25], [0.45,0.30,0.18], fibers);
  return { r:col[0], g:col[1], b:col[2], roughness:0.8, metalness:0 };
}
function stemFibrous(p, ctx) {
  const vertStripes = Math.sin(p.y*30) * 0.5 + 0.5;
  const col = mixColor([0.50,0.70,0.35], [0.35,0.55,0.25], vertStripes);
  return { r:col[0], g:col[1], b:col[2], roughness:0.65, metalness:0 };
}
function mushroomCap(p, ctx) {
  const radial = Math.atan2(p.x, p.z) / (Math.PI*2);
  const n = fractalNoise(p, 3);
  const redBrown = [0.75,0.35,0.25];
  const cream = [0.90,0.85,0.70];
  const col = mixColor(redBrown, cream, radial*0.8 + n*0.2);
  return { r:col[0], g:col[1], b:col[2], roughness:0.6, metalness:0 };
}
function spores(p, ctx) {
  const sporePattern = worleyFBM(p, 4, 35);
  const col = mixColor([0.50,0.30,0.20], [0.70,0.50,0.40], sporePattern);
  return { r:col[0], g:col[1], b:col[2], roughness:0.75, metalness:0 };
}
function chlorophyll(p, ctx) {
  const n = fractalNoise(p, 4);
  const col = [0.20 + n*0.15, 0.65 + n*0.15, 0.15 + n*0.1];
  return { r:col[0], g:col[1], b:col[2], roughness:0.5, metalness:0 };
}

// ========================= 8. TEXTURES CHIMIQUES & RÉACTIONS =========================
function oxidationOrganic(p, ctx) {
  const rust = worleyFBM(p, 3, 10);
  const base = [0.65,0.55,0.45];
  const orange = [0.75,0.45,0.20];
  const col = mixColor(base, orange, rust);
  return { r:col[0], g:col[1], b:col[2], roughness:0.72, metalness:0 };
}
function crystallization(p, ctx) {
  const crystal = Math.sin(p.x*40)*Math.sin(p.y*40)*Math.sin(p.z*40);
  const col = mixColor([0.85,0.80,0.90], [0.70,0.65,0.75], (crystal+1)/2);
  return { r:col[0], g:col[1], b:col[2], roughness:0.35, metalness:0.1 };
}
function burnCarbonization(p, ctx) {
  const burn = fractalNoise(p, 4);
  const black = [0.10,0.08,0.05];
  const char = [0.25,0.20,0.15];
  const col = mixColor(char, black, burn);
  return { r:col[0], g:col[1], b:col[2], roughness:0.9, metalness:0 };
}
function acidification(p, ctx) {
  const acid = worleyFBM(p, 3, 12);
  const greenish = [0.55,0.65,0.45];
  const pale = [0.80,0.75,0.65];
  const col = mixColor(greenish, pale, acid);
  return { r:col[0], g:col[1], b:col[2], roughness:0.68, metalness:0 };
}
function biologicalCorrosion(p, ctx) {
  const corr = fractalNoise(p, 5);
  const col = mixColor([0.60,0.50,0.40], [0.35,0.40,0.30], corr);
  return { r:col[0], g:col[1], b:col[2], roughness:0.82, metalness:0 };
}

// ========================= 9. FRACTALES MATHÉMATIQUES =========================
function worleyCellular(p, ctx) {
  const cell = worley3D(p, 8).F1;
  const col = [0.5 + cell*0.3, 0.4 + cell*0.2, 0.3 + cell*0.15];
  return { r:col[0], g:col[1], b:col[2], roughness:0.6, metalness:0 };
}
function perlinOrganic(p, ctx) {
  const n = fractalNoise(p, 5);
  const col = [0.6 + n*0.2, 0.5 + n*0.15, 0.4 + n*0.1];
  return { r:col[0], g:col[1], b:col[2], roughness:0.55, metalness:0 };
}
function fbmLiving(p, ctx) {
  const n = fractalNoise(domainWarp(p, 0.15), 6, 0.5, 2.0);
  const col = mixColor([0.70,0.55,0.45], [0.50,0.40,0.35], n);
  return { r:col[0], g:col[1], b:col[2], roughness:0.65, metalness:0 };
}
function voronoiPorous(p, ctx) {
  const vor = worley3D(p, 12).F2;
  const col = mixColor([0.78,0.68,0.58], [0.60,0.50,0.42], vor);
  return { r:col[0], g:col[1], b:col[2], roughness:0.58, metalness:0 };
}
function fractalGrowth(p, ctx) {
  const growthPattern = fractalNoise(p, 6, 0.4, 2.2);
  const col = mixColor([0.45,0.55,0.35], [0.85,0.75,0.55], growthPattern);
  return { r:col[0], g:col[1], b:col[2], roughness:0.5, metalness:0 };
}

// ========================= 10. TEXTURES HYBRIDES (ORGANIC+CREATIVE) =========================
function bioluminescent(p, ctx) {
  const glow = fractalNoise(p, 4);
  const col = [0.2 + glow*0.6, 0.6 + glow*0.3, 0.3 + glow*0.5];
  return { r:col[0], g:col[1], b:col[2], roughness:0.3, metalness:0 };
}
function alienTissue(p, ctx) {
  const pattern = worleyFBM(p, 4, 8);
  const col = mixColor([0.55,0.25,0.65], [0.35,0.15,0.45], pattern);
  return { r:col[0], g:col[1], b:col[2], roughness:0.5, metalness:0.05 };
}
function mutantSurface(p, ctx) {
  const n = fractalNoise(domainWarp(p, 0.3), 5);
  const col = mixColor([0.80,0.40,0.30], [0.40,0.70,0.30], n);
  return { r:col[0], g:col[1], b:col[2], roughness:0.7, metalness:0 };
}
function chaoticGrowth(p, ctx) {
  const chaos = (perlin3D(p.x*5, p.y*5, p.z*5) + worley3D(p, 6).F1) / 2;
  const col = mixColor([0.90,0.50,0.20], [0.20,0.30,0.50], chaos);
  return { r:col[0], g:col[1], b:col[2], roughness:0.8, metalness:0 };
}
function luminousMembrane(p, ctx) {
  const lum = fractalNoise(p, 3);
  const col = [0.3 + lum*0.5, 0.2 + lum*0.4, 0.5 + lum*0.4];
  return { r:col[0], g:col[1], b:col[2], roughness:0.2, metalness:0 };
}

// ========================= 11. MOTEUR PRINCIPAL =========================
// Sélection et mélange dynamique des textures selon contexte
const textureEngine = {
  sampleMaterial(p, context) {
    const { morpho, mode } = context;
    const stress = morpho.stress || 0;
    const necrosis = morpho.necrosis || 0;
    const organismType = morpho.organismType || 0.5;
    const age = morpho.age || 0;
    const exposure = morpho.exposure || 0.5;
    let result;

    // Choix primaire selon l'état de nécrose et stress
    if (necrosis > 0.8) result = necrosisHeavy(p, context);
    else if (necrosis > 0.4) result = necrosisLight(p, context);
    else if (stress > 0.7) result = stressed(p, context);
    else if (stress > 0.3 && necrosis > 0.1) result = cracksDeep(p, context);
    else if (organismType > 0.8) { // végétal pur
      if (age > 0.6) result = barkOld(p, context);
      else result = barkYoung(p, context);
      // Ajouter mousse aléatoire
      if (worley3D(p, 10).F1 < 0.3) result = moss(p, context);
    }
    else if (organismType < 0.2) { // animal pur
      if (age > 0.7) result = old(p, context);
      else if (exposure > 0.7) result = wet(p, context);
      else if (exposure < 0.3) result = dry(p, context);
      else result = skinSmooth(p, context);
    }
    else { // hybride
      const blend = fractalNoise(p, 3);
      const veg = barkYoung(p, context);
      const ani = skinSmooth(p, context);
      const col = mixColor([ani.r,ani.g,ani.b], [veg.r,veg.g,veg.b], blend);
      result = { r:col[0], g:col[1], b:col[2], roughness:0.6, metalness:0 };
    }

    // Application des micro-détails en superposition (par ex. veines, pores)
    const micro = fractalNoise(p, 5, 0.4, 2.5);
    result.r += micro * 0.03;
    result.g += micro * 0.02;
    result.b += micro * 0.01;
    result.roughness = clamp(result.roughness + (stress * 0.2) + (necrosis * 0.3), 0.1, 0.98);
    result.metalness = Math.min(0.05, result.metalness + (organismType<0.2 ? 0 : 0));
    return result;
  },

  // Exposition directe de toutes les textures pour combinaisons avancées
  skinSmooth, skinRough, skinThick, tissueCellular, tissueFibrous, wet, dry, gelatinous, cartilaginous, osseous,
  cellsRound, cellsElongated, cellsDividing, poresOpen, poresClosed, microVeins, microStrates, granules, membrane,
  young, old, stressed, relaxed, tensionStriae, relaxedFolds, wetStagnant, dryFatigued,
  growth, healing, inflammation, necrosisLight, necrosisHeavy, decompositionWet, decompositionDry, cracksDeep, necrosisFibrous, fungusMold,
  barkYoung, barkOld, leafHealthy, leafDry, leafDiseased, moss, lichen, rootFibrous, stemFibrous, mushroomCap, spores, chlorophyll,
  oxidationOrganic, crystallization, burnCarbonization, acidification, biologicalCorrosion,
  worleyCellular, perlinOrganic, fbmLiving, voronoiPorous, fractalGrowth,
  bioluminescent, alienTissue, mutantSurface, chaoticGrowth, luminousMembrane
};

// Export CommonJS pour Node.js
module.exports = { textureEngine };