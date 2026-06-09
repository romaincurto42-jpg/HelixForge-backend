// ============================================================================
// geo_translator.js — Transpileur FR → EN (Ultime v6.0) AVEC LOGS
// Détection de TOUTES les expressions françaises (géométries avancées,
// transformations, placements intelligents, contraintes, etc.)
// Génération de code HelixForge 7.0.0.
// ============================================================================

// ----------------------------------------------------------------------------
// 0. Import du générateur organique (ORGANIC 2.0)
// ----------------------------------------------------------------------------
const Organic = require("@root/ai/generators/organic_generator");

// ============================================================================
// 1. Dictionnaires étendus (incluant les nouvelles primitives)
// ============================================================================
const PRIMITIVES = {
  // Primitives de base
  "tore": "torus", "torus": "torus",
  "sphère": "sphere", "sphere": "sphere",
  "cylindre": "cylinder", "cylinder": "cylinder",
  "cube": "box", "boîte": "box",
  "plan": "plane", "polygone": "polygon",
  "texte": "text", "courbe": "curve",
  "loft": "loft", "sweep": "sweep",
  "nurbs": "nurbs", "cône": "cone",
  "ellipsoïde": "ellipsoid", "pyramide": "pyramid",
  "tube": "tube", "anneau": "torus", "hélice": "helix",
  // Nouvelles primitives
  "prisme": "prism",
  "prisme droit": "prism",
  "prisme oblique": "oblique_prism",
  "solide de révolution": "revolve",
  "extrusion": "extrude",
  "lissage": "loft",
  "sweep": "sweep",
  "tétraèdre": "tetrahedron",
  "octaèdre": "octahedron",
  "dodécaèdre": "dodecahedron",
  "icosaèdre": "icosahedron",
  "ressort": "spring",
  "maille": "mesh_grid",
  "treillis": "truss",
  "nœud de klein": "klein_bottle",
  "tore de klein": "klein_torus"
};

const DIMENSION_NAMES = {
  "rayon": "radius", "diamètre": "diameter",
  "hauteur": "height", "largeur": "width",
  "profondeur": "depth", "tube": "tube",
  "épaisseur": "thickness", "angle": "angle",
  "distance": "distance", "pas": "pitch",
  "tolérance": "tolerance",
  // Nouvelles dimensions
  "rayon principal": "major_radius",
  "rayon de section": "minor_radius",
  "angle de révolution": "rev_angle",
  "asymétrie": "asymmetry",
  "sommet": "apex",
  "polygone": "polygon",
  "côtés": "sides",
  "inclinaison": "tilt",
  "profil": "profile",
  "chemin": "path",
  "torsion": "twist",
  "échelle": "scale",
  "section": "cross_section"
};

const FEATURE_TYPES = {
  "trou": "hole", "congé": "fillet", "chanfrein": "chamfer",
  "coque": "shell", "rainure": "groove", "filetage": "thread",
  "nervure": "rib", "bossage": "boss", "dépouille": "draft",
  // Nouveaux trous
  "trou oblong": "oblong_hole",
  "trou taraudé": "threaded_hole",
  "trou conique": "conical_hole",
  "trou étagé": "stepped_hole",
  "trous répétés": "pattern_hole"
};

const BOOLEAN_OPS = {
  "union": "union", "intersection": "intersect",
  "différence": "subtract", "soustraction": "subtract",
  "fusionner": "blend", "clipper": "clip",
  "morph": "morph", "union lisse": "smooth_union",
  "xor": "xor", "différence symétrique": "xor",
  "découpe par plan": "slice",
  "emboutissage": "emboss", "débossage": "deboss",
  "filiage": "knurl"
};

const TRANSFORMATIONS = {
  "translation": "translate", "rotation": "rotate",
  "échelle": "scale", "miroir": "mirror",
  "twist": "twist", "bend": "bend", "taper": "taper",
  "gonfler": "inflate", "bruit": "noise",
  // Nouvelles transformations
  "aligner": "align", "distribuer": "distribute",
  "dupliquer": "duplicate", "métaball": "metaball",
  "attracteur": "attractor", "propagation": "propagate"
};

const PLACEMENT_RELATIONS = {
  "à gauche de": "left_of",
  "à droite de": "right_of",
  "au-dessus de": "above",
  "en dessous de": "below",
  "derrière": "behind",
  "devant": "front_of",
  "centré sur": "centered_on",
  "aligné à": "aligned_with"
};

const CONSTRAINTS = {
  "parallèle": "parallel", "perpendiculaire": "perpendicular",
  "égalité": "equal", "tangence": "tangent",
  "coïncidence": "coincident", "alignement": "collinear",
  "distance": "distance", "angle": "angle", "fixe": "fixed",
  "coaxial": "coaxial", "symétrique": "symmetric"
};

const MATERIALS = {
  "bois": "wood", "métal brossé": "brushed_metal",
  "plastique": "plastic", "verre": "glass",
  "caoutchouc": "rubber", "transparent": "transparent"
};

const EXPORT_FORMATS = {
  "stl": "stl", "obj": "obj", "gltf": "gltf",
  "step": "step", "amf": "amf", "3mf": "3mf",
  "svg": "svg", "json": "json", "openscad": "openscad",
  "blender": "blender_py"
};

// ============================================================================
// 2. Utilitaires (inchangés mais améliorés)
// ============================================================================
function extractNumber(token) {
  const match = token.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function tokenizeFrench(text) {
  console.log("[tokenizeFrench] Texte reçu:", text);
  const regex = /([a-zA-ZÀ-ÖØ-öø-ÿ]+(?:['\-\s][a-zA-ZÀ-ÖØ-öø-ÿ]+)*|\d+(?:\.\d+)?|[(){},;:])/gi;
  const matches = text.match(regex);
  if (!matches) {
    console.warn("[tokenizeFrench] Aucun token trouvé");
    return [];
  }
  const tokens = matches.map(m => m.toLowerCase());
  console.log("[tokenizeFrench] Tokens générés:", tokens);
  return tokens;
}

// ----------------------------------------------------------------------------
// 2b. Détection du style organique étendu (ORGANIC 2.0 amélioré)
// ----------------------------------------------------------------------------
function detectOrganicStyleExtended(promptLower) {
  if (promptLower.includes("filament") || promptLower.includes("filamenteux"))
    return { style: "filament", params: {} };
  if (promptLower.includes("membrane") || promptLower.includes("surface"))
    return { style: "membrane", params: {} };
  if (promptLower.includes("capsule") || promptLower.includes("allongé"))
    return { style: "capsule", params: {} };
  if (promptLower.includes("vrille") || promptLower.includes("tendril"))
    return { style: "tendril", params: {} };
  if (promptLower.includes("spore"))
    return { style: "spore", params: {} };
  if (promptLower.includes("tige") || promptLower.includes("stalk"))
    return { style: "stalk", params: {} };
  
  if (promptLower.includes("spirale") || promptLower.includes("vrillé") || 
      promptLower.includes("torsion") || promptLower.includes("torsadé")) {
    let turns = 2;
    const turnMatch = promptLower.match(/(\d+)\s*(?:tours|turns?|fois)/);
    if (turnMatch) turns = parseInt(turnMatch[1]);
    return { style: "filament", params: { twistTurns: turns, length: 150, radius: 12 } };
  }
  
  if (promptLower.includes("étiré") || promptLower.includes("allongé")) {
    let length = 180;
    const lengthMatch = promptLower.match(/(\d+)\s*mm/);
    if (lengthMatch) length = parseInt(lengthMatch[1]);
    return { style: "capsule", params: { length, radius: 15 } };
  }
  
  if (promptLower.includes("gonflé") || promptLower.includes("boursouflé")) {
    return { style: "blob", params: { radius: 45, turbulence: 1.2 } };
  }
  
  return { style: "blob", params: {} };
}

function generateOrganicFromPrompt(prompt, lower) {
  const { style, params: extraParams } = detectOrganicStyleExtended(lower);
  
  if (style === "filament") {
    const length = extraParams.length || 150;
    const radius = extraParams.radius || 12;
    const twistTurns = extraParams.twistTurns || 2;
    let sdf = Organic.genFilament(length, radius, twistTurns);
    if (lower.includes("gonflé") || lower.includes("gonflement")) sdf += `\ninflate(1.3)`;
    if (lower.includes("étiré") || lower.includes("allongé")) sdf += `\nstretch("Y", 1.5)`;
    if (lower.includes("croissance") || lower.includes("vivant") || lower.includes("chaotique")) sdf += `\nnoise(1.2, 0.3, true)`;
    return sdf;
  }
  
  if (style === "capsule") {
    const length = extraParams.length || 140;
    const radius = extraParams.radius || 18;
    let sdf = Organic.genCapsule(length, radius);
    if (lower.includes("gonflé")) sdf += `\ninflate(1.2)`;
    if (lower.includes("croissance")) sdf += `\nnoise(0.8, 0.25, true)`;
    return sdf;
  }
  
  if (style === "blob") {
    const radius = extraParams.radius || 42;
    const turb = extraParams.turbulence || 0.9;
    let sdf = Organic.genBlob(radius, turb);
    if (lower.includes("étiré")) sdf += `\nstretch("Y", 1.5)`;
    if (lower.includes("spirale")) sdf += `\ntwist(90, "ramp")`;
    if (lower.includes("gonflé")) sdf += `\ninflate(1.2)`;
    return sdf;
  }
  
  switch (style) {
    case "membrane": return Organic.genMembrane();
    case "tendril": return Organic.genTendril();
    case "spore": return Organic.genSpore();
    case "stalk": return Organic.genStalk();
    default: return Organic.genBlob();
  }
}

// ----------------------------------------------------------------------------
// 3. Analyseur syntaxique étendu (intégrant toutes les nouvelles détections)
// ----------------------------------------------------------------------------
class FrenchTranspiler {
  constructor(tokens, originalText) {
    this.tokens = tokens;
    this.pos = 0;
    this.originalText = originalText;
    console.log("[FrenchTranspiler] Constructeur, tokens:", tokens, "originalText:", originalText);
  }

  peek() { return this.tokens[this.pos]; }
  consume() { return this.tokens[this.pos++]; }
  match(expected) {
    if (this.pos < this.tokens.length && this.peek() === expected) {
      this.consume();
      return true;
    }
    return false;
  }
  isAtEnd() { return this.pos >= this.tokens.length; }

  parseNumber() {
    const token = this.peek();
    if (token && extractNumber(token) !== null) {
      this.consume();
      return extractNumber(token);
    }
    return null;
  }

  parseIdentifier() {
    const token = this.peek();
    if (token && /^[a-z_][a-z0-9_]*$/i.test(token)) {
      this.consume();
      return token;
    }
    return null;
  }

  // --- Détection avancée de transformations (toutes les expressions demandées) ---
  parseAdvancedTransformations() {
    const transforms = [];
    const lower = this.originalText.toLowerCase();

    if (lower.includes("torsion") || lower.includes("vrillage") || lower.includes("vrillé") || lower.includes("torsadé")) {
      let angle = 45, intensity = "normal", progressive = false;
      if (lower.includes("douce")) intensity = "low";
      else if (lower.includes("forte")) intensity = "high";
      if (lower.includes("progressive") || lower.includes("progressif")) progressive = true;
      if (progressive) transforms.push({ kind: "twist", params: { angle, type: "ramp" } });
      else transforms.push({ kind: "twist", params: { angle, intensity } });
    }

    if (lower.includes("courbure") || lower.includes("courbé") || lower.includes("plié")) {
      let angle = 15, direction = null;
      if (lower.includes("vers l'avant") || lower.includes("vers l’avant")) direction = "+Y";
      if (lower.includes("vers l'arrière") || lower.includes("vers l’arrière")) direction = "-Y";
      if (lower.includes("fort")) angle = 45;
      transforms.push({ kind: "bend", params: { angle, direction, radius: 50 } });
    }

    if (lower.includes("gonfl") || lower.includes("gonflement")) {
      let factor = 1, local = false;
      if (lower.includes("local")) local = true;
      const match = lower.match(/gonfl[ée]?ment?\s+de\s*(\d+(?:\.\d+)?)/);
      if (match) factor = parseFloat(match[1]);
      transforms.push({ kind: "inflate", params: { factor, local } });
    }
    if (lower.includes("bruit") || lower.includes("turbulence") || lower.includes("chaotique") ||
        lower.includes("irrégulier") || lower.includes("fracturé") || lower.includes("craquelé")) {
      let amplitude = 3, frequency = 0.2, fractal = false;
      if (lower.includes("fractal")) fractal = true;
      if (lower.includes("profond")) fractal = true;
      if (lower.includes("faible")) amplitude = 1;
      if (lower.includes("fort")) amplitude = 5;
      transforms.push({ kind: "noise", params: { amplitude, frequency, fractal } });
    }

    if (lower.includes("ondulé") || lower.includes("vagues") || lower.includes("ondulation")) {
      transforms.push({ kind: "wave", params: { amplitude: 2, frequency: 0.5 } });
    }

    if (lower.includes("dépouille")) {
      let angle = 2;
      const match = lower.match(/dépouille\s+de\s*(\d+(?:\.\d+)?)/);
      if (match) angle = parseFloat(match[1]);
      transforms.push({ kind: "draft", params: { angle } });
    }

    if (lower.includes("effilement") || lower.includes("conicité") || lower.includes("effilé") ||
        lower.includes("conique") || lower.includes("rétréci")) {
      let factor = 0.8;
      const match = lower.match(/(effilement|conicité|effilé|rétréci)\s+de\s*(\d+(?:\.\d+)?)/);
      if (match) factor = parseFloat(match[2]);
      transforms.push({ kind: "taper", params: { factor } });
    }

    if (lower.includes("étirement") || lower.includes("étiré")) {
      let axis = "X", factor = 1.5;
      if (lower.includes("vertical")) axis = "Z";
      if (lower.includes("horizontal")) axis = "X,Y";
      const match = lower.match(/étir[ée]?ment?\s+de\s*(\d+(?:\.\d+)?)/);
      if (match) factor = parseFloat(match[1]);
      transforms.push({ kind: "stretch", params: { axis, factor } });
    }

    if (lower.includes("spirale")) {
      if (lower.includes("organique")) {
        transforms.push({ kind: "twist", params: { angle: 90, type: "ramp" } });
        transforms.push({ kind: "noise", params: { amplitude: 1, frequency: 0.1, fractal: true } });
      } else {
        transforms.push({ kind: "twist", params: { angle: 360, type: "ramp" } });
      }
    }

    if (lower.includes("massif")) {
      transforms.push({ kind: "scale", params: { x: 1.5, y: 1.5, z: 1.5 } });
      transforms.push({ kind: "inflate", params: { factor: 1.2 } });
    }

    if (lower.includes("compact")) {
      transforms.push({ kind: "scale", params: { x: 0.7, y: 0.7, z: 0.7 } });
      transforms.push({ kind: "smooth", params: { intensity: 0.5 } });
    }

    if (lower.includes("organique") || lower.includes("sculpture") || lower.includes("biomorphique")) {
      transforms.push({ kind: "smooth", params: { intensity: 0.8 } });
      transforms.push({ kind: "noise", params: { amplitude: 2, frequency: 0.3, fractal: true } });
    }

    if (lower.includes("amas") || lower.includes("grappe") || lower.includes("cellulaire") || lower.includes("alvéolé")) {
      transforms.push({ kind: "blob", params: { count: 5, radius: 10 } });
    }
    if (lower.includes("ramifié") || lower.includes("racines")) {
      transforms.push({ kind: "branching", params: { levels: 3, angle: 45 } });
    }

    if (lower.includes("lisse")) transforms.push({ kind: "smooth", params: { intensity: 0.5 } });
    if (lower.includes("poli")) transforms.push({ kind: "smooth", params: { intensity: 0.9 } });
    if (lower.includes("rugueux") || lower.includes("granuleux")) transforms.push({ kind: "noise", params: { amplitude: 1.5 } });
    if (lower.includes("strié") || lower.includes("rayé")) transforms.push({ kind: "stripe", params: { direction: "Y" } });
    if (lower.includes("spiralé")) transforms.push({ kind: "twist", params: { angle: 45 } });
    if (lower.includes("poreux")) transforms.push({ kind: "voronoi", params: { scale: 0.5 } });
    if (lower.includes("martelé")) transforms.push({ kind: "hammer", params: { frequency: 0.2 } });
    if (lower.includes("texturé")) transforms.push({ kind: "noise", params: { amplitude: 1 } });

    if (lower.includes("flux") || lower.includes("tourbillon") || lower.includes("vortex")) {
      transforms.push({ kind: "vortex", params: { strength: 1.0 } });
    }
    if (lower.includes("implosion")) transforms.push({ kind: "implode", params: { factor: 0.5 } });
    if (lower.includes("explosion")) transforms.push({ kind: "explode", params: { factor: 1.5 } });
    if (lower.includes("dilaté")) transforms.push({ kind: "inflate", params: { factor: 1.3 } });
    if (lower.includes("compressé")) transforms.push({ kind: "scale", params: { x: 0.5, y: 0.5, z: 0.5 } });
    if (lower.includes("distordu")) transforms.push({ kind: "twist", params: { angle: 30 } });
    if (lower.includes("morphing")) transforms.push({ kind: "morph", params: { blend: 0.5 } });
    if (lower.includes("liquéfié")) transforms.push({ kind: "smooth", params: { intensity: 1.0 } });
    if (lower.includes("érodé") || lower.includes("usé")) transforms.push({ kind: "erosion", params: { intensity: 0.3 } });
    if (lower.includes("futuriste")) transforms.push({ kind: "sharp", params: { edges: true } });

    return transforms;
  }

  // --- Détection de primitives implicites (cylindrique, sphérique, etc.) ---
  parseImplicitPrimitive() {
    const lower = this.originalText.toLowerCase();
    if (lower.includes("cylindrique")) return "cylinder";
    if (lower.includes("sphérique")) return "sphere";
    if (lower.includes("conique")) return "cone";
    if (lower.includes("pyramidal")) return "pyramid";
    if (lower.includes("cubique") || lower.includes("rectangulaire")) return "box";
    if (lower.includes("ovale") || lower.includes("elliptique")) return "ellipsoid";
    if (lower.includes("tubulaire")) return "tube";
    if (lower.includes("annulaire") || lower.includes("anneau")) return "torus";
    if (lower.includes("hélicoïdal")) return "helix";
    return null;
  }

  // --- Détection de features avancées (creux, percé, ajouré, emboîté, empilé) ---
  parseAdvancedFeatures() {
    const features = [];
    const lower = this.originalText.toLowerCase();
    if (lower.includes("creux")) features.push({ type: "shell", thickness: 2 });
    if (lower.includes("percé") || lower.includes("troué")) features.push({ type: "hole", diameter: 5, mode: "through" });
    if (lower.includes("ajouré")) features.push({ type: "pattern", kind: "grid", spacing: 10 });
    if (lower.includes("emboîté")) features.push({ type: "boolean", operation: "union", align: true });
    if (lower.includes("superposé")) features.push({ type: "stack", axis: "Z", count: 3 });
    if (lower.includes("empilé")) features.push({ type: "repeat", axis: "Z", count: 5 });
    return features;
  }

  // --- Dimensions ---
  parseDimension() {
    const dimWord = this.peek();
    const dimEng = DIMENSION_NAMES[dimWord];
    if (!dimEng) return null;
    this.consume();
    let value = null;
    if (this.peek() && (extractNumber(this.peek()) !== null || /^\d/.test(this.peek()))) {
      const numToken = this.consume();
      value = extractNumber(numToken);
      if (this.peek() && /^mm|cm|m$/.test(this.peek())) this.consume();
    }
    return { name: dimEng, value };
  }

  parseDimensionList() {
    const dims = [];
    let first = this.parseDimension();
    if (first) dims.push(first);
    while (this.match("et") || this.match("par")) {
      const next = this.parseDimension();
      if (next) dims.push(next);
      else break;
    }
    return dims;
  }

  // --- Position ---
  parsePosition() {
    if (this.match("centré")) return { type: "Center" };
    if (this.peek() === "à" || this.peek() === "au") {
      this.consume();
      if (this.match("centre")) return { type: "Center" };
      if (this.peek() === "(") {
        this.consume();
        const x = this.parseNumber();
        this.match(",");
        const y = this.parseNumber();
        this.match(",");
        const z = this.parseNumber();
        this.match(")");
        return { type: "Coord3D", x, y, z };
      }
    }
    return null;
  }

  // --- Features classiques (trou, congé, etc.) ---
  parseFeature() {
    const featWord = this.peek();
    const featEng = FEATURE_TYPES[featWord];
    if (!featEng) return null;
    this.consume();
    this.match("de");
    let value = null, diameter = null;
    if (this.peek() && extractNumber(this.peek()) !== null) {
      const num = this.parseNumber();
      if (featEng === "hole") diameter = num;
      else value = num;
      this.match("mm");
    }
    let mode = null;
    if (this.match("au") && this.match("centre")) mode = "center";
    const obj = { type: featEng };
    if (diameter !== null) obj.diameter = diameter;
    if (value !== null) obj.value = value;
    if (mode) obj.mode = mode;
    return obj;
  }

  parseFeatureList() {
    const feats = [];
    let f = this.parseFeature();
    if (f) feats.push(f);
    while (this.match("et")) {
      f = this.parseFeature();
      if (f) feats.push(f);
    }
    return feats;
  }

  // --- Transformations classiques (avec parenthèses) ---
  parseTransformation() {
    const transWord = this.peek();
    const transEng = TRANSFORMATIONS[transWord];
    if (!transEng) return null;
    this.consume();
    let params = {};
    if (this.match("(")) {
      let firstArg = true;
      while (!this.match(")") && this.pos < this.tokens.length) {
        if (!firstArg) this.match(",");
        firstArg = false;
        if (DIMENSION_NAMES[this.peek()]) {
          const dim = DIMENSION_NAMES[this.peek()];
          this.consume();
          this.match("=");
          const val = this.parseNumber();
          params[dim] = val;
        } else {
          const x = this.parseNumber();
          this.match(",");
          const y = this.parseNumber();
          this.match(",");
          const z = this.parseNumber();
          params = { x, y, z };
        }
      }
    }
    return { kind: transEng, params };
  }

  parseTransformationList() {
    const list = [];
    while (true) {
      const t = this.parseTransformation();
      if (!t) break;
      list.push(t);
      this.match("et");
    }
    return list;
  }

  // --- Forme simple (shape) ---
  parseShape() {
    console.log("[parseShape] Début, token courant:", this.peek());
    this.match("un"); this.match("une");
    let prim = this.parsePrimitive();
    if (!prim) prim = this.parseImplicitPrimitive();
    if (!prim) {
      console.log("[parseShape] Aucune primitive trouvée");
      return null;
    }
    console.log("[parseShape] Primitive trouvée:", prim);
    let dimensions = null;
    let dimensionsList = [];
    if (this.match("de")) {
      dimensionsList = this.parseDimensionList();
      if (dimensionsList.length) dimensions = dimensionsList;
      console.log("[parseShape] Dimensions:", dimensions);
    }
    let position = this.parsePosition();
    let standardTransforms = this.parseTransformationList();
    let advancedTransforms = this.parseAdvancedTransformations();
    let allTransforms = [...standardTransforms, ...advancedTransforms];
    let features = [];
    if (this.match("avec")) {
      features = this.parseFeatureList();
    } else if (this.match("et")) {
      features = this.parseFeatureList();
    }
    let advancedFeatures = this.parseAdvancedFeatures();
    features.push(...advancedFeatures);
    return { type: "Shape", prim, dimensions, position, transformations: allTransforms, features };
  }

  parsePrimitive() {
    const prim = PRIMITIVES[this.peek()];
    if (prim) { this.consume(); return prim; }
    return null;
  }

  // --- NURBS, Loft, Sweep (version simplifiée mais fonctionnelle) ---
  parseNURBS() {
    if (!this.match("surface") || !this.match("nurbs")) return null;
    let points = null, weights = null;
    if (this.match("(")) {
      points = this.parsePointList();
      if (this.match(",")) weights = this.parsePointList();
      this.match(")");
    }
    return { type: "NURBS", points, weights };
  }

  parsePointList() {
    const points = [];
    if (!this.match("[")) return points;
    while (!this.match("]") && this.pos < this.tokens.length) {
      const p = this.parseCoord3D();
      if (p) points.push(p);
      this.match(",");
    }
    return points;
  }

  parseCoord3D() {
    if (!this.match("(")) return null;
    const x = this.parseNumber();
    this.match(",");
    const y = this.parseNumber();
    this.match(",");
    const z = this.parseNumber();
    this.match(")");
    return { x, y, z };
  }

  parseLoft() {
    if (!this.match("loft")) return null;
    let profiles = [];
    if (this.match("entre")) {
      profiles = this.parseProfileList();
    }
    return { type: "Loft", profiles };
  }

  parseProfileList() {
    const list = [];
    do {
      const shape = this.parseShape();
      if (shape) list.push(shape);
      else break;
    } while (this.match(","));
    return list;
  }

  parseSweep() {
    if (!this.match("sweep")) return null;
    let profile = null, curve = null;
    if (this.match("du")) profile = this.parseShape();
    if (this.match("le") && this.match("long") && this.match("de")) {
      curve = this.parseCurveReference();
    }
    return { type: "Sweep", profile, curve };
  }

  parseCurveReference() {
    if (this.peek() && /^[a-z_][a-z0-9_]*$/.test(this.peek())) {
      const name = this.consume();
      return { type: "Identifier", name };
    }
    return this.parseCurve();
  }

  parseCurve() {
    if (!this.match("courbe")) return null;
    if (this.match("passant") && this.match("par")) {
      const points = [];
      while (true) {
        const p = this.parseCoord3D();
        if (!p) break;
        points.push(p);
        if (!this.match(",")) break;
      }
      return { type: "Curve", points };
    }
    return null;
  }

  // --- Opérations booléennes ---
  parseBooleanOp() {
    const opWord = this.peek();
    const opEng = BOOLEAN_OPS[opWord];
    if (!opEng) return null;
    this.consume();
    if (!this.match("(")) return null;
    const left = this.parseExpression();
    if (!left) return null;
    this.match(",");
    const right = this.parseExpression();
    this.match(")");
    let extra = null;
    if (this.match(",")) extra = this.parseNumber();
    return { type: "BooleanOp", operator: opEng, left, right, extra };
  }

  // --- Patterns ---
  parsePattern() {
    if (this.match("répéter")) {
      const count = this.parseNumber();
      this.match("fois");
      const transform = this.parseTransformation();
      let shape = null;
      if (this.match("(")) {
        shape = this.parseExpression();
        this.match(")");
      } else {
        shape = this.parseExpression();
      }
      return { type: "Pattern", kind: "linear", count, transform, shape };
    }
    if (this.match("motif")) {
      const kind = this.peek();
      if (kind === "circulaire") {
        this.consume();
        let count = null;
        if (this.match("(")) {
          count = this.parseNumber();
          this.match(")");
        }
        const shape = this.parseExpression();
        return { type: "Pattern", kind: "circular", count, shape };
      }
      if (kind === "grille") {
        this.consume();
        let nx = null, ny = null, dx = null, dy = null;
        if (this.match("(")) {
          nx = this.parseNumber();
          this.match(",");
          ny = this.parseNumber();
          this.match(")");
        }
        if (this.match("espacement")) {
          if (this.match("(")) {
            dx = this.parseNumber();
            this.match(",");
            dy = this.parseNumber();
            this.match(")");
          }
        }
        const shape = this.parseExpression();
        return { type: "Pattern", kind: "grid", nx, ny, dx, dy, shape };
      }
    }
    return null;
  }

  // --- Déclarations (module, import, export, classe, etc.) ---
  parseDeclaration() {
    const kw = this.peek();
    const eng = DECLARATIONS[kw];
    if (!eng) return null;
    this.consume();
    if (eng === "module") {
      const name = this.parseIdentifier();
      let params = [];
      if (this.match("(")) {
        while (!this.match(")") && this.pos < this.tokens.length) {
          const p = this.parseIdentifier();
          params.push(p);
          this.match(",");
        }
      }
      this.match("{");
      const body = this.parseBlock();
      return { type: "ModuleDecl", name, params, body };
    }
    if (eng === "import") {
      let path = this.parseStringOrIdent();
      let alias = null;
      if (this.match("comme")) alias = this.parseIdentifier();
      return { type: "Import", path, alias };
    }
    if (eng === "export") {
      let decl = null;
      if (this.match("shape") || this.match("un") || this.match("une")) {
        decl = this.parseShape();
      } else if (this.match("function")) {
        decl = this.parseFunction();
      } else {
        decl = this.parseIdentifier();
      }
      return { type: "Export", declaration: decl };
    }
    if (eng === "class") {
      const name = this.parseIdentifier();
      let typeParams = [];
      if (this.match("<")) {
        while (!this.match(">")) {
          typeParams.push(this.parseIdentifier());
          this.match(",");
        }
      }
      this.match("{");
      const members = this.parseClassMembers();
      return { type: "ClassDecl", name, typeParams, members };
    }
    if (eng === "interface") {
      const name = this.parseIdentifier();
      let typeParams = [];
      if (this.match("<")) {
        while (!this.match(">")) {
          typeParams.push(this.parseIdentifier());
          this.match(",");
        }
      }
      this.match("{");
      const methods = this.parseInterfaceMethods();
      return { type: "InterfaceDecl", name, typeParams, methods };
    }
    if (eng === "trait") {
      const name = this.parseIdentifier();
      this.match("{");
      const members = this.parseTraitMembers();
      return { type: "TraitDecl", name, members };
    }
    if (eng === "macro") {
      const name = this.parseIdentifier();
      this.match("(");
      const params = [];
      while (!this.match(")")) {
        params.push(this.parseIdentifier());
        this.match(",");
      }
      this.match("{");
      const body = this.parseBlock();
      return { type: "MacroDecl", name, params, body };
    }
    if (eng === "template") {
      const name = this.parseIdentifier();
      this.match("(");
      const params = [];
      while (!this.match(")")) {
        params.push(this.parseIdentifier());
        this.match(",");
      }
      this.match("{");
      const body = this.parseBlock();
      return { type: "TemplateDecl", name, params, body };
    }
    if (eng === "let" || eng === "const") {
      const name = this.parseIdentifier();
      let typeAnn = null;
      if (this.match(":")) typeAnn = this.parseTypeExpr();
      let value = null;
      if (this.match("=")) value = this.parseExpression();
      return { type: "VariableDecl", kind: eng, name, type: typeAnn, value };
    }
    if (eng === "function") {
      return this.parseFunction();
    }
    if (eng === "type") {
      const name = this.parseIdentifier();
      let typeParams = [];
      if (this.match("<")) {
        while (!this.match(">")) {
          typeParams.push(this.parseIdentifier());
          this.match(",");
        }
      }
      this.match("=");
      const typeExpr = this.parseTypeExpr();
      return { type: "TypeDecl", name, typeParams, typeExpr };
    }
    return null;
  }

  parseStringOrIdent() {
    if (this.peek() && /^".*"$/.test(this.peek())) {
      const str = this.consume();
      return str.slice(1, -1);
    }
    return this.parseIdentifier();
  }

  parseBlock() {
    const statements = [];
    while (!this.match("}") && this.pos < this.tokens.length) {
      const stmt = this.parseExpression();
      if (stmt) statements.push(stmt);
      else break;
    }
    return { type: "Block", statements };
  }

  parseFunction() {
    const name = this.parseIdentifier();
    this.match("(");
    const params = [];
    while (!this.match(")")) {
      const pname = this.parseIdentifier();
      let ptype = null;
      if (this.match(":")) ptype = this.parseTypeExpr();
      params.push({ name: pname, type: ptype });
      this.match(",");
    }
    let returnType = null;
    if (this.match(":")) returnType = this.parseTypeExpr();
    this.match("{");
    const body = this.parseBlock();
    return { type: "FunctionDecl", name, params, returnType, body };
  }

  parseTypeExpr() {
    if (this.match("nombre")) return { type: "PrimitiveType", name: "number" };
    if (this.match("texte")) return { type: "PrimitiveType", name: "string" };
    if (this.match("booléen")) return { type: "PrimitiveType", name: "bool" };
    if (this.match("vecteur3")) return { type: "PrimitiveType", name: "vec3" };
    const id = this.parseIdentifier();
    if (id) return { type: "TypeRef", name: id };
    return null;
  }

  parseClassMembers() {
    const members = [];
    while (!this.match("}") && this.pos < this.tokens.length) {
      if (this.match("constructeur")) {
        members.push(this.parseConstructor());
      } else if (this.match("let") || this.match("const")) {
        members.push(this.parseVariableDecl());
      } else {
        const name = this.parseIdentifier();
        if (!name) break;
        this.match("(");
        const params = [];
        while (!this.match(")")) {
          const pname = this.parseIdentifier();
          let ptype = null;
          if (this.match(":")) ptype = this.parseTypeExpr();
          params.push({ name: pname, type: ptype });
          this.match(",");
        }
        let returnType = null;
        if (this.match(":")) returnType = this.parseTypeExpr();
        this.match("{");
        const body = this.parseBlock();
        members.push({ type: "Method", name, params, returnType, body });
      }
    }
    return members;
  }

  parseConstructor() {
    this.match("(");
    const params = [];
    while (!this.match(")")) {
      const pname = this.parseIdentifier();
      let ptype = null;
      if (this.match(":")) ptype = this.parseTypeExpr();
      params.push({ name: pname, type: ptype });
      this.match(",");
    }
    this.match("{");
    const body = this.parseBlock();
    return { type: "Constructor", params, body };
  }

  parseVariableDecl() {
    const kind = this.previous(); // let or const
    const name = this.parseIdentifier();
    let typeAnn = null;
    if (this.match(":")) typeAnn = this.parseTypeExpr();
    let value = null;
    if (this.match("=")) value = this.parseExpression();
    return { type: "VariableDecl", kind, name, type: typeAnn, value };
  }

  parseInterfaceMethods() {
    const methods = [];
    while (!this.match("}") && this.pos < this.tokens.length) {
      const name = this.parseIdentifier();
      if (!name) break;
      this.match("(");
      const params = [];
      while (!this.match(")")) {
        const pname = this.parseIdentifier();
        this.match(":");
        const ptype = this.parseTypeExpr();
        params.push({ name: pname, type: ptype });
        this.match(",");
      }
      this.match(":");
      const retType = this.parseTypeExpr();
      methods.push({ name, params, returnType: retType });
      this.match(";");
    }
    return methods;
  }

  parseTraitMembers() {
    const members = [];
    while (!this.match("}") && this.pos < this.tokens.length) {
      if (this.match("let") || this.match("const")) {
        members.push(this.parseVariableDecl());
      } else {
        const name = this.parseIdentifier();
        if (!name) break;
        this.match("(");
        const params = [];
        while (!this.match(")")) {
          const pname = this.parseIdentifier();
          this.match(":");
          const ptype = this.parseTypeExpr();
          params.push({ name: pname, type: ptype });
          this.match(",");
        }
        this.match(":");
        const retType = this.parseTypeExpr();
        members.push({ type: "MethodSignature", name, params, returnType: retType });
        this.match(";");
      }
    }
    return members;
  }

  // --- Simulation, IA, Validation ---
  parseSimulation() {
    if (!this.match("simuler")) return null;
    const simType = this.peek();
    this.consume();
    let target = null, duration = null, params = {};
    if (this.match("sur")) target = this.parseExpression();
    if (this.match("pendant")) duration = this.parseNumber();
    if (this.match("(")) {
      const kind = this.peek();
      this.consume();
      const val = this.parseNumber();
      this.match(")");
      params = { kind, value: val };
    }
    return { type: "Simulation", simType, target, duration, params };
  }

  parseIA() {
    if (this.match("générée") && this.match("par") && this.match("ia")) {
      const description = this.parseStringOrIdent();
      let params = {};
      if (this.match("avec")) {
        while (!this.isAtEnd() && !this.match(".")) {
          const key = this.parseIdentifier();
          if (this.match("=")) {
            const val = this.parseExpression();
            params[key] = val;
          }
          this.match(",");
        }
      }
      return { type: "ShapeFromIA", description, params };
    }
    if (this.match("optimiser")) {
      const objective = this.parseExpression();
      this.match("pour");
      this.match("réduire");
      const metric = this.peek();
      this.consume();
      return { type: "IAOptimize", objective, metric };
    }
    return null;
  }

  parseValidation() {
    if (!this.match("valider")) return null;
    const kind = this.peek();
    this.consume();
    const target = this.parseExpression();
    return { type: "Validation", kind, target };
  }

  // --- Rendu et Scène ---
  parseRender() {
    if (this.match("matériau")) {
      const name = this.parseIdentifier();
      let params = {};
      if (this.match("(")) {
        while (!this.match(")")) {
          const key = this.parseIdentifier();
          this.match("=");
          const val = this.parseExpression();
          params[key] = val;
          this.match(",");
        }
      }
      return { type: "Material", name, params };
    }
    if (this.match("lumière")) {
      const lightType = this.peek();
      this.consume();
      const pos = this.parseCoord3D();
      return { type: "Light", lightType, position: pos };
    }
    if (this.match("caméra")) {
      if (this.match("position")) {
        const pos = this.parseCoord3D();
        return { type: "Camera", position: pos };
      }
    }
    if (this.match("assemblage")) {
      const name = this.parseIdentifier();
      this.match("{");
      const members = [];
      while (!this.match("}")) {
        const m = this.parseExpression();
        if (m) members.push(m);
      }
      return { type: "Assembly", name, members };
    }
    if (this.match("groupe")) {
      const name = this.parseIdentifier();
      this.match("{");
      const children = [];
      while (!this.match("}")) {
        const c = this.parseExpression();
        if (c) children.push(c);
      }
      return { type: "Group", name, children };
    }
    if (this.match("instance")) {
      this.match("de");
      const source = this.parseExpression();
      return { type: "Instance", source };
    }
    return null;
  }

  // --- Contraintes ---
  parseConstraint() {
    const left = this.parseExpression();
    const relWord = this.peek();
    const relation = CONSTRAINTS[relWord];
    if (!relation) return null;
    this.consume();
    const right = this.parseExpression();
    let fixed = false;
    if (this.match("fixe")) fixed = true;
    return { type: "Constraint", left, relation, right, fixed };
  }

  // --- Point d'entrée principal ---
  parseExpression() {
    let expr = this.parsePattern();
    if (expr) return expr;
    expr = this.parseBooleanOp();
    if (expr) return expr;
    expr = this.parseNURBS();
    if (expr) return expr;
    expr = this.parseLoft();
    if (expr) return expr;
    expr = this.parseSweep();
    if (expr) return expr;
    expr = this.parseRender();
    if (expr) return expr;
    expr = this.parseSimulation();
    if (expr) return expr;
    expr = this.parseIA();
    if (expr) return expr;
    expr = this.parseValidation();
    if (expr) return expr;
    expr = this.parseConstraint();
    if (expr) return expr;
    expr = this.parseDeclaration();
    if (expr) return expr;
    expr = this.parseShape();
    if (expr) return expr;
    return null;
  }
}

// ----------------------------------------------------------------------------
// 4. Générateur de code anglais (complet, étendu)
// ----------------------------------------------------------------------------
function generateCode(ast) {
  if (!ast) return "";
  switch (ast.type) {
    case "Shape": {
      let code = `shape ${ast.prim}`;
      if (ast.dimensions && ast.dimensions.length) {
        const params = ast.dimensions.map(d => `${d.name}=${d.value}`).join(", ");
        code += `(${params})`;
      } else {
        code += "()";
      }
      if (ast.position) {
        if (ast.position.type === "Center") code += " centered";
        else if (ast.position.type === "Coord3D") {
          code += ` at (${ast.position.x}, ${ast.position.y}, ${ast.position.z})`;
        }
      }
      for (const tf of (ast.transformations || [])) {
        let args = "";
        if (tf.kind === "twist") {
          args = `${tf.params.angle}`;
          if (tf.params.type) args += `, "${tf.params.type}"`;
        } else if (tf.kind === "bend") {
          args = `${tf.params.angle}, ${tf.params.radius}`;
          if (tf.params.direction) args += `, "${tf.params.direction}"`;
        } else if (tf.kind === "inflate") {
          args = `${tf.params.factor}`;
        } else if (tf.kind === "noise") {
          args = `${tf.params.amplitude}, ${tf.params.frequency}`;
          if (tf.params.fractal !== undefined) args += `, ${tf.params.fractal}`;
        } else if (tf.kind === "wave") {
          args = `${tf.params.amplitude}, ${tf.params.frequency}`;
        } else if (tf.kind === "draft") {
          args = `${tf.params.angle}`;
        } else if (tf.kind === "taper") {
          args = `${tf.params.factor}`;
        } else if (tf.kind === "stretch") {
          args = `"${tf.params.axis}", ${tf.params.factor}`;
        } else if (tf.kind === "scale") {
          args = `${tf.params.x}, ${tf.params.y}, ${tf.params.z}`;
        } else if (tf.kind === "smooth") {
          args = `${tf.params.intensity}`;
        } else if (tf.kind === "stripe") {
          args = `"${tf.params.direction}"`;
        } else if (tf.kind === "blob") {
          args = `${tf.params.count}, ${tf.params.radius}`;
        } else if (tf.kind === "branching") {
          args = `${tf.params.levels}, ${tf.params.angle}`;
        } else if (tf.kind === "vortex") {
          args = `${tf.params.strength}`;
        } else if (tf.kind === "erosion") {
          args = `${tf.params.intensity}`;
        } else if (tf.kind === "voronoi") {
          args = `${tf.params.scale}`;
        } else if (tf.kind === "hammer") {
          args = `${tf.params.frequency}`;
        } else if (tf.kind === "implode") {
          args = `${tf.params.factor}`;
        } else if (tf.kind === "explode") {
          args = `${tf.params.factor}`;
        } else if (tf.kind === "morph") {
          args = `${tf.params.blend}`;
        } else if (tf.kind === "sharp") {
          args = `${tf.params.edges}`;
        } else if (tf.params.x !== undefined && tf.params.y !== undefined && tf.params.z !== undefined) {
          args = `${tf.params.x}, ${tf.params.y}, ${tf.params.z}`;
        } else {
          const values = Object.values(tf.params);
          args = values.join(", ");
        }
        code += `\n${tf.kind}(${args})`;
      }
      if (ast.features && ast.features.length) {
        code += " with ";
        const featStrs = ast.features.map(f => {
          if (f.type === "hole") return `hole(diameter=${f.diameter}${f.mode === "center" ? ", at center" : ""})`;
          if (f.type === "fillet") return `fillet(radius=${f.value})`;
          if (f.type === "chamfer") return `chamfer(distance=${f.value})`;
          if (f.type === "shell") return `shell(thickness=${f.thickness})`;
          if (f.type === "pattern") return `pattern(${f.kind}, spacing=${f.spacing})`;
          return `${f.type}()`;
        });
        code += featStrs.join(" and ");
      }
      return code;
    }
    case "BooleanOp": {
      const left = generateCode(ast.left);
      const right = generateCode(ast.right);
      let extra = ast.extra ? `, ${ast.extra}` : "";
      return `${ast.operator}(${left}, ${right}${extra})`;
    }
    case "Pattern": {
      const shapeCode = generateCode(ast.shape);
      if (ast.kind === "linear") {
        const transCode = `${ast.transform.kind}(${ast.transform.params.x !== undefined ? `${ast.transform.params.x}, ${ast.transform.params.y}, ${ast.transform.params.z}` : ""})`;
        return `repeat ${ast.count} times ${transCode} ( ${shapeCode} )`;
      } else if (ast.kind === "circular") {
        return `pattern circular(${ast.count}) ( ${shapeCode} )`;
      } else if (ast.kind === "grid") {
        return `pattern grid(${ast.nx}, ${ast.ny}) spacing(${ast.dx}, ${ast.dy}) ( ${shapeCode} )`;
      }
      return shapeCode;
    }
    case "NURBS": {
      let pointsStr = "[";
      if (ast.points) pointsStr += ast.points.map(p => `(${p.x},${p.y},${p.z})`).join(", ");
      pointsStr += "]";
      let weightsStr = "";
      if (ast.weights) weightsStr = `, ${JSON.stringify(ast.weights)}`;
      return `shape nurbs(${pointsStr}${weightsStr})`;
    }
    default:
      return "";
  }
}

// ----------------------------------------------------------------------------
// 5. Fonction publique (avec MODE ORGANIC 2.0 amélioré) - AVEC LOGS
// ----------------------------------------------------------------------------
function translateFRtoEN(prompt) {
  console.log("[translateFRtoEN] Début avec prompt:", prompt);
  const cleaned = prompt.replace(/[.,;!?]/g, " ").replace(/'/g, " ");
  const lower = cleaned.toLowerCase();
  console.log("[translateFRtoEN] cleaned:", cleaned);
  console.log("[translateFRtoEN] lower:", lower);

  if (
    lower.includes("organique") ||
    lower.includes("vivant") ||
    lower.includes("biomorph") ||
    lower.includes("chaotique") ||
    lower.includes("croissance") ||
    lower.includes("naturel") ||
    lower.includes("spirale") ||
    lower.includes("torsion") ||
    lower.includes("étiré") ||
    lower.includes("gonflé")
  ) {
    console.log("[translateFRtoEN] Mode organique détecté, appel à generateOrganicFromPrompt");
    const result = generateOrganicFromPrompt(cleaned, lower);
    console.log("[translateFRtoEN] Résultat organique:", result);
    return result;
  }

  console.log("[translateFRtoEN] Tokenisation...");
  const tokens = tokenizeFrench(cleaned);
  console.log("[translateFRtoEN] Tokens:", tokens);
  const transpiler = new FrenchTranspiler(tokens, cleaned);
  console.log("[translateFRtoEN] Transpiler créé, appel à parseShape()");
  let ast = transpiler.parseShape();
  console.log("[translateFRtoEN] AST après parseShape:", JSON.stringify(ast, null, 2));

  if (!ast) {
    console.log("[translateFRtoEN] AST est null, utilisation des transformations avancées");
    const transforms = transpiler.parseAdvancedTransformations();
    console.log("[translateFRtoEN] Transforms:", transforms);
    ast = {
      type: "Shape",
      prim: "box",
      dimensions: [],
      position: null,
      transformations: transforms,
      features: []
    };
    console.log("[translateFRtoEN] AST fallback:", JSON.stringify(ast, null, 2));
  }

  console.log("[translateFRtoEN] Appel à generateCode()");
  const code = generateCode(ast);
  console.log("[translateFRtoEN] Code généré:", code);
  return code;
}

// ============================================================================
// 6. Fonctions de conversion vers SDF standard (HelixForge 3.0) - AVEC LOGS
// ============================================================================

function convertToStandardSDF(generatedCode) {
  console.log("[convertToStandardSDF] Entrée:", generatedCode);
  let sdf = generatedCode;
  sdf = sdf.replace(/^\s*shape\s+/, '');
  console.log("[convertToStandardSDF] Après suppression 'shape':", sdf);
  sdf = sdf.replace(/box\s*\(\s*size\s*=\s*(\d+)\s*\)/g, 'box(size=[$1,$1,$1])');
  sdf = sdf.replace(/box\s*\(\s*size\s*=\s*\[(\d+),\s*(\d+),\s*(\d+)\]\s*\)/g, 'box(size=[$1,$2,$3])');
  sdf = sdf.replace(/sphere\s*\(\s*radius\s*=\s*(\d+)\s*\)/g, 'sphere(r=$1)');
  sdf = sdf.replace(/cylinder\s*\(\s*radius\s*=\s*(\d+),\s*height\s*=\s*(\d+)\s*\)/g, 'cylinder(r=$1, height=$2)');
  sdf = sdf.replace(/torus\s*\(\s*major_radius\s*=\s*(\d+),\s*minor_radius\s*=\s*(\d+)\s*\)/g, 'torus(rmajor=$1, rminor=$2)');
  sdf = sdf.replace(/cone\s*\(\s*radius\s*=\s*(\d+),\s*height\s*=\s*(\d+)\s*\)/g, 'cone(r=$1, h=$2)');
  sdf = sdf.replace(/\bat center\b/gi, 'translate(0,0,0)');
  sdf = sdf.replace(/\bcentered\b/gi, '');
  sdf = sdf.replace(/at\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/gi, 'translate($1,$2,$3)');
  const withHoleMatch = sdf.match(/(.+?)\s+with\s+hole\(diameter=(\d+)(?:,\s*at center)?\)/i);
  if (withHoleMatch) {
    console.log("[convertToStandardSDF] Détection de trou:", withHoleMatch);
    const baseShape = withHoleMatch[1].trim();
    const diam = withHoleMatch[2];
    const holeRadius = parseFloat(diam) / 2;
    sdf = `subtract( ${baseShape}, sphere(r=${holeRadius}) translate(0,0,0) )`;
    console.log("[convertToStandardSDF] Après remplacement trou:", sdf);
  }
  sdf = sdf.replace(/\s+/g, ' ').trim();
  const knownPrimitives = /(box|sphere|cylinder|torus|cone|ellipsoid|pyramid|prism|extrude|loft|sweep|tetrahedron|octahedron|dodecahedron|icosahedron|spring|helix|mesh_grid|truss)/i;
  if (!knownPrimitives.test(sdf)) {
    console.warn("[convertToStandardSDF] Aucune primitive reconnue, retour du cube par défaut");
    return "box(size=[10,10,10])";
  }
  console.log("[convertToStandardSDF] Sortie finale:", sdf);
  return sdf;
}

function translateFRtoSDF(prompt) {
  console.log("[translateFRtoSDF] Appel avec prompt:", prompt);
  const rawCode = translateFRtoEN(prompt);
  console.log("[translateFRtoSDF] rawCode de translateFRtoEN:", rawCode);
  const result = convertToStandardSDF(rawCode);
  console.log("[translateFRtoSDF] Résultat final:", result);
  return result;
}

// ============================================================================
// 7. Exports pour compatibilité ascendante
// ============================================================================
module.exports = {
  translateFRtoEN,     // Ancienne version (format "shape box()...")
  translateFRtoSDF     // Nouvelle version (SDF standard pour parseStrict)
};
