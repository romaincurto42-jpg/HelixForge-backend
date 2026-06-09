// backend/cad/scad/shape_library.js

// ========== 1. UTILITAIRES ==========
function indent(code, level = 1) {
  const pad = "  ".repeat(level);
  return code.split("\n").map(line => line.trim() ? pad + line : line).join("\n");
}

function mergeDeep(target, source) {
  const output = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

function validateParams(params, required, optional = {}) {
  for (const r of required) {
    if (params[r] === undefined) throw new Error(`Paramètre manquant: ${r}`);
  }
  return { ...optional, ...params };
}

// ========== 2. CONFIGURATION ET RÈGLES EXTERNES ==========
const DEFAULT_RULES = {
  node_mapping: {
    solid_block: "scadSolidBlock",
    solid_cylinder: "scadSolidCylinder",
    solid_sphere: "scadSolidSphere",
    solid_cone: "scadSolidCone",
    solid_torus: "scadSolidTorus",
    transform: "wrapTransform",
    boolean_union: "wrapBooleanNary",
    boolean_difference: "wrapBooleanNary",
    boolean_intersection: "wrapBooleanNary",
    feature_hole: "featureHole",
    feature_fillet: "featureFillet",
    feature_chamfer: "featureChamfer",
    feature_rib: "featureRib",
    feature_pocket: "featurePocket",
    preset_plate: "presetPlate",
    preset_spacer: "presetSpacer",
    preset_box: "presetBox",
    preset_bracket: "presetBracket",
    polyline_2d: "polyline2d",
    bezier_2d: "bezierCurve2d",
    extrude_linear: "extrude",
    extrude_rotate: "revolve",
    sweep: "sweep",
    loft: "loft",
    array_linear: "arrayLinear",
    array_radial: "arrayRadial",
    mirror: "mirror"
  },
  defaults: {
    block: { width: 10, depth: 10, height: 10 },
    cylinder: { radius: 5, height: 10 },
    sphere: { radius: 5 },
    cone: { r1: 5, r2: 0, height: 10 },
    torus: { radius: 20, tube: 5 },
    hole: { radius: 2, depth: 20, position: [0,0,0] },
    fillet: { radius: 2 },
    chamfer: { size: 2 },
    rib: { width: 2, height: 10, thickness: 2 },
    pocket: { width: 20, depth: 20, height: 5, position: [0,0,0] },
    plate: { width: 100, depth: 80, thickness: 3 },
    spacer: { radius: 5, height: 20 },
    box: { width: 100, depth: 80, height: 40, wall: 3 },
    bracket: { width: 40, depth: 40, thickness: 4, height: 40 }
  },
  transform_order: ["scale", "rotate", "translate"]
};

let rulesCache = null;

function loadRules(rulesSource) {
  if (rulesCache) return rulesCache;
  let rules = DEFAULT_RULES;
  if (rulesSource) {
    if (typeof rulesSource === 'string') {
      try {
        const fs = require('fs');
        const content = fs.readFileSync(rulesSource, 'utf8');
        rules = mergeDeep(rules, JSON.parse(content));
        console.log(`[shape_library] Règles chargées depuis ${rulesSource}`);
      } catch (err) {
        console.warn(`[shape_library] Impossible de charger ${rulesSource}: ${err.message}`);
      }
    } else if (typeof rulesSource === 'object') {
      rules = mergeDeep(rules, rulesSource);
    }
  }
  rulesCache = rules;
  return rules;
}

// ========== 3. GÉNÉRATEURS DE PRIMITIVES ==========
function scadSolidBlock(node, defaults = {}) {
  const p = validateParams({ ...defaults, ...(node.params || {}) }, [], DEFAULT_RULES.defaults.block);
  return `cube([${p.width}, ${p.depth}, ${p.height}], center = false);`;
}

function scadSolidCylinder(node, defaults = {}) {
  const p = validateParams({ ...defaults, ...(node.params || {}) }, [], DEFAULT_RULES.defaults.cylinder);
  return `cylinder(h = ${p.height}, r = ${p.radius}, center = false);`;
}

function scadSolidSphere(node, defaults = {}) {
  const p = validateParams({ ...defaults, ...(node.params || {}) }, [], DEFAULT_RULES.defaults.sphere);
  return `sphere(r = ${p.radius});`;
}

function scadSolidCone(node, defaults = {}) {
  const p = validateParams({ ...defaults, ...(node.params || {}) }, [], DEFAULT_RULES.defaults.cone);
  return `cylinder(h = ${p.height}, r1 = ${p.r1}, r2 = ${p.r2}, center = false);`;
}

function scadSolidTorus(node, defaults = {}) {
  const p = validateParams({ ...defaults, ...(node.params || {}) }, [], DEFAULT_RULES.defaults.torus);
  return `rotate_extrude() translate([${p.radius}, 0, 0]) circle(r = ${p.tube});`;
}

function scadSolidPolyhedron(node) {
  const p = node.params || {};
  const points = p.points || [];
  const faces = p.faces || [];
  const pts = points.map(pt => `[${pt.join(',')}]`).join(',');
  const fcs = faces.map(f => `[${f.join(',')}]`).join(',');
  return `polyhedron(points=[${pts}], faces=[${fcs}]);`;
}

function scadSolidPolygon(node) {
  const points = node.params?.points || [];
  const pts = points.map(p => `[${p[0]},${p[1]}]`).join(',');
  return `polygon(points=[${pts}]);`;
}

// ========== 4. TRANSFORMATIONS (ordre configurable) ==========
function wrapTransform(node, childCode, transformOrder = null) {
  const p = node.params || {};
  const order = transformOrder || DEFAULT_RULES.transform_order;
  let code = childCode;
  for (const op of order) {
    if (op === 'translate' && p.translation && Array.isArray(p.translation)) {
      const [x, y, z] = p.translation;
      code = `translate([${x}, ${y}, ${z}]) {\n${indent(code)}\n}`;
    } else if (op === 'rotate' && p.rotation && Array.isArray(p.rotation)) {
      const [rx, ry, rz] = p.rotation;
      code = `rotate([${rx}, ${ry}, ${rz}]) {\n${indent(code)}\n}`;
    } else if (op === 'scale' && p.scale && Array.isArray(p.scale)) {
      const [sx, sy, sz] = p.scale;
      code = `scale([${sx}, ${sy}, ${sz}]) {\n${indent(code)}\n}`;
    } else if (op === 'color' && p.color && Array.isArray(p.color)) {
      const [r,g,b,a] = p.color;
      code = `color([${r}, ${g}, ${b}, ${a || 1}]) {\n${indent(code)}\n}`;
    }
  }
  return code;
}

// ========== 5. OPÉRATIONS BOOLÉENNES (binaire et n-aire) ==========
function wrapBooleanBinary(node, aCode, bCode) {
  const type = node.node_type;
  if (type === "boolean_union") return `union() {\n${indent(aCode)}\n${indent(bCode)}\n}`;
  if (type === "boolean_difference") return `difference() {\n${indent(aCode)}\n${indent(bCode)}\n}`;
  if (type === "boolean_intersection") return `intersection() {\n${indent(aCode)}\n${indent(bCode)}\n}`;
  return aCode;
}

function wrapBooleanNary(node, childrenCodes) {
  const type = node.node_type;
  const body = childrenCodes.map(c => indent(c)).join("\n");
  if (type === "boolean_union") return `union() {\n${body}\n}`;
  if (type === "boolean_difference") return `difference() {\n${body}\n}`;
  if (type === "boolean_intersection") return `intersection() {\n${body}\n}`;
  return body;
}

// ========== 6. FEATURES (trous, congés, etc.) ==========
function featureHole(node, targetCode, defaults = {}) {
  const d = { ...DEFAULT_RULES.defaults.hole, ...defaults };
  const p = { ...d, ...(node.params || {}) };
  const pos = p.position || [0,0,0];
  const hole = `translate([${pos[0]},${pos[1]},${pos[2]}]) cylinder(h=${p.depth}, r=${p.radius}, center=false);`;
  return `difference() {\n${indent(targetCode)}\n${indent(hole)}\n}`;
}

function featureFillet(node, targetCode, defaults = {}) {
  const d = { ...DEFAULT_RULES.defaults.fillet, ...defaults };
  const p = { ...d, ...(node.params || {}) };
  return `fillet3d(r=${p.radius}) {\n${indent(targetCode)}\n}`;
}

function featureChamfer(node, targetCode, defaults = {}) {
  const d = { ...DEFAULT_RULES.defaults.chamfer, ...defaults };
  const p = { ...d, ...(node.params || {}) };
  return `chamfer3d(size=${p.size}) {\n${indent(targetCode)}\n}`;
}

function featureRib(node, targetCode, defaults = {}) {
  const d = { ...DEFAULT_RULES.defaults.rib, ...defaults };
  const p = { ...d, ...(node.params || {}) };
  const rib = `cube([${p.width}, ${p.thickness}, ${p.height}], center=true);`;
  return `union() {\n${indent(targetCode)}\n${indent(rib)}\n}`;
}

function featurePocket(node, targetCode, defaults = {}) {
  const d = { ...DEFAULT_RULES.defaults.pocket, ...defaults };
  const p = { ...d, ...(node.params || {}) };
  const pos = p.position || [0,0,0];
  const pocket = `translate([${pos[0]},${pos[1]},${pos[2]}]) cube([${p.width},${p.depth},${p.height}], center=false);`;
  return `difference() {\n${indent(targetCode)}\n${indent(pocket)}\n}`;
}

// ========== 7. PRÉSERVES (plate, spacer, box, bracket) ==========
function presetPlate(node, defaults = {}) {
  const d = { ...DEFAULT_RULES.defaults.plate, ...defaults };
  const p = { ...d, ...(node.params || {}) };
  return `cube([${p.width}, ${p.depth}, ${p.thickness}], center=false);`;
}

function presetSpacer(node, defaults = {}) {
  const d = { ...DEFAULT_RULES.defaults.spacer, ...defaults };
  const p = { ...d, ...(node.params || {}) };
  return `cylinder(h=${p.height}, r=${p.radius}, center=false);`;
}

function presetBox(node, defaults = {}) {
  const d = { ...DEFAULT_RULES.defaults.box, ...defaults };
  const p = { ...d, ...(node.params || {}) };
  const outer = `cube([${p.width}, ${p.depth}, ${p.height}], center=false);`;
  const inner = `cube([${p.width-2*p.wall}, ${p.depth-2*p.wall}, ${p.height-p.wall}], center=false);`;
  const innerPos = `translate([${p.wall},${p.wall},${p.wall}]) ${inner}`;
  return `difference() {\n${indent(outer)}\n${indent(innerPos)}\n}`;
}

function presetBracket(node, defaults = {}) {
  const d = { ...DEFAULT_RULES.defaults.bracket, ...defaults };
  const p = { ...d, ...(node.params || {}) };
  const base = `cube([${p.width}, ${p.depth}, ${p.thickness}], center=false);`;
  const vert = `cube([${p.thickness}, ${p.depth}, ${p.height}], center=false);`;
  return `union() {\n${indent(base)}\n${indent(vert)}\n}`;
}

// ========== 8. PROFILS 2D ET EXTRUSIONS ==========
function polyline2d(node) {
  const points = node.params?.points || [];
  const closed = node.params?.closed || false;
  const pts = points.map(p => `[${p[0]},${p[1]}]`).join(",");
  return `polygon(points=[${pts}], ${closed ? "convexity=2" : ""});`;
}

function bezierCurve2d(node) {
  const points = node.params?.points || [];
  const seg = node.params?.segments || 20;
  const pts = points.map(p => `[${p[0]},${p[1]}]`).join(",");
  return `bezier_polygon(points=[${pts}], $fn=${seg});`;
}

function extrude(node, profileCode) {
  const { height = 10, twist = 0, slices = 1, scale = 1 } = node.params || {};
  return `linear_extrude(height=${height}, twist=${twist}, slices=${slices}, scale=${scale}) {\n${indent(profileCode)}\n}`;
}

function revolve(node, profileCode) {
  const { angle = 360, convexity = 10 } = node.params || {};
  return `rotate_extrude(angle=${angle}, convexity=${convexity}) {\n${indent(profileCode)}\n}`;
}

function sweep(node, profileCode, pathCode) {
  return `sweep(${profileCode}, ${pathCode});`;
}

function loft(node, profileCodes) {
  const body = profileCodes.map(c => indent(c)).join(",\n");
  return `loft([\n${body}\n]);`;
}

// ========== 9. MOTIFS AVANCÉS (linéaire, radial, grille, hélicoïdal) ==========
function arrayLinear(node, childCode) {
  const { count = 2, step = [10,0,0] } = node.params || {};
  return `for (i = [0:${count-1}]) translate([i*${step[0]}, i*${step[1]}, i*${step[2]}]) {\n${indent(childCode)}\n}`;
}

function arrayRadial(node, childCode) {
  const { count = 4, radius = 10, axis = [0,0,1] } = node.params || {};
  if (axis[0] !== 0 || axis[1] !== 0 || axis[2] !== 1) {
    // rotation selon axe arbitraire – on simplifie avec rotate autour de Z
    console.warn("arrayRadial: seul l'axe Z est pleinement supporté dans OpenSCAD");
  }
  return `for (i = [0:${count-1}]) rotate([0,0,i*360/${count}]) translate([${radius},0,0]) {\n${indent(childCode)}\n}`;
}

function arrayGrid(node, childCode) {
  const { rows = 2, cols = 2, stepX = 10, stepY = 10, stepZ = 0 } = node.params || {};
  let code = "";
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const x = j * stepX;
      const y = i * stepY;
      const z = (i + j) * stepZ;
      code += `translate([${x}, ${y}, ${z}]) {\n${indent(childCode, 1)}\n}\n`;
    }
  }
  return code.trim();
}

function arrayHelical(node, childCode) {
  const { turns = 2, count = 20, radius = 10, height = 20 } = node.params || {};
  let code = "";
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360 * turns;
    const z = (i / count) * height;
    code += `rotate([0,0,${angle}]) translate([${radius},0,${z}]) {\n${indent(childCode, 1)}\n}\n`;
  }
  return code.trim();
}

function mirror(node, childCode) {
  const plane = node.params?.plane || "X";
  const vec = { X: [1,0,0], Y: [0,1,0], Z: [0,0,1] }[plane] || [1,0,0];
  return `mirror([${vec[0]}, ${vec[1]}, ${vec[2]}]) {\n${indent(childCode)}\n}`;
}

// ========== 10. SUPPORT POUR SDF (PLACEHOLDER) ==========
function scadSdfPlaceholder(node, stlPath = null) {
  if (stlPath) return `// SDF node "${node.node_id}" exporté en STL\nimport("${stlPath}");`;
  return `// SDF node "${node.node_id}" — aucun STL généré`;
}

// ========== 11. DISPATCHER AVEC RÈGLES ==========
const generatorMap = {
  scadSolidBlock,
  scadSolidCylinder,
  scadSolidSphere,
  scadSolidCone,
  scadSolidTorus,
  scadSolidPolyhedron,
  scadSolidPolygon,
  wrapTransform,
  wrapBooleanBinary,
  wrapBooleanNary,
  featureHole,
  featureFillet,
  featureChamfer,
  featureRib,
  featurePocket,
  presetPlate,
  presetSpacer,
  presetBox,
  presetBracket,
  polyline2d,
  bezierCurve2d,
  extrude,
  revolve,
  sweep,
  loft,
  arrayLinear,
  arrayRadial,
  arrayGrid,
  arrayHelical,
  mirror,
  scadSdfPlaceholder
};

function getGenerator(nodeType, rules = DEFAULT_RULES) {
  const mapping = rules.node_mapping;
  const generatorName = mapping[nodeType];
  if (!generatorName) return null;
  return generatorMap[generatorName];
}

// ========== 12. FONCTION PRINCIPALE D'EXPORT ==========
function generateScad(node, context = {}, rules = null) {
  rules = rules || loadRules(null);
  const generator = getGenerator(node.node_type, rules);
  if (!generator) {
    console.warn(`[generateScad] Aucun générateur pour le type ${node.node_type}`);
    return `// Node ${node.node_id} (type ${node.node_type}) non supporté`;
  }

  // Résolution récursive des entrées
  const inputs = node.inputs || {};
  const childrenResults = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'string') {
      // référence à un autre nœud – à résoudre dans un contexte externe
      childrenResults[key] = `/* ref ${value} */`;
    } else if (value && typeof value === 'object' && value.node_type) {
      childrenResults[key] = generateScad(value, context, rules);
    }
  }

  // Appel du générateur
  if (node.node_type === 'transform') {
    const childCode = childrenResults.child || '';
    const order = rules.transform_order;
    return generator(node, childCode, order);
  }
  if (node.node_type === 'boolean_union' || node.node_type === 'boolean_difference' || node.node_type === 'boolean_intersection') {
    const children = inputs.children || [];
    if (children.length === 2 && generator === wrapBooleanNary) {
      // fallback binaire
      const binGen = getGenerator('boolean_binary', rules);
      if (binGen) return binGen(node, childrenResults[0], childrenResults[1]);
    }
    const codes = children.map(c => generateScad(c, context, rules));
    return generator(node, codes);
  }
  if (node.node_type === 'feature_hole' || node.node_type === 'feature_fillet' || node.node_type === 'feature_chamfer' ||
      node.node_type === 'feature_rib' || node.node_type === 'feature_pocket') {
    const targetCode = childrenResults.target || '';
    return generator(node, targetCode);
  }
  if (node.node_type === 'extrude_linear' || node.node_type === 'extrude_rotate') {
    const profileCode = childrenResults.profile || '';
    return generator(node, profileCode);
  }
  if (node.node_type === 'sweep') {
    const profileCode = childrenResults.profile || '';
    const pathCode = childrenResults.path || '';
    return generator(node, profileCode, pathCode);
  }
  if (node.node_type === 'loft') {
    const profileCodes = childrenResults.profiles || [];
    return generator(node, profileCodes);
  }
  if (node.node_type === 'array_linear' || node.node_type === 'array_radial' || node.node_type === 'array_grid' || node.node_type === 'array_helical' || node.node_type === 'mirror') {
    const childCode = childrenResults.child || '';
    return generator(node, childCode);
  }
  return generator(node);
}

// ========== 13. API PUBLIQUE ==========
module.exports = {
  indent,
  loadRules,
  generateScad,
  // Exports individuels pour compatibilité descendante
  DEFAULTS: DEFAULT_RULES.defaults,
  scadSolidBlock,
  scadSolidCylinder,
  scadSolidSphere,
  scadSolidCone,
  scadSolidTorus,
  wrapTransform,
  wrapBooleanBinary,
  wrapBooleanNary,
  featureHole,
  featureFillet,
  featureChamfer,
  featureRib,
  featurePocket,
  presetPlate,
  presetSpacer,
  presetBox,
  presetBracket,
  polyline2d,
  bezierCurve2d,
  extrude,
  revolve,
  sweep,
  loft,
  arrayLinear,
  arrayRadial,
  mirror,
  scadSdfPlaceholder,
  // Nouvelles primitives et motifs
  scadSolidPolyhedron,
  scadSolidPolygon,
  arrayGrid,
  arrayHelical
};
