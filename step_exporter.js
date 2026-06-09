const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

// ============================================================
// HELIX PLAN → FREECAD EXPORTER (Advanced CSG + Primitives)
// ============================================================

const PRIMITIVE_MAKERS = {
  box: (p) => `Part.makeBox(${p.width || 50}, ${p.depth || 50}, ${p.height || 20})`,
  
  cylinder: (p) => `Part.makeCylinder(${p.radius || 10}, ${p.height || 20})`,
  
  sphere: (p) => `Part.makeSphere(${p.radius || 10})`,
  
  cone: (p) => `Part.makeCone(${p.radius1 || 10}, ${p.radius2 || 0}, ${p.height || 20})`,
  
  torus: (p) => `Part.makeTorus(${p.radius1 || 20}, ${p.radius2 || 5})`,
  
  wedge: (p) => `Part.makeWedge(${p.xmin || 0}, ${p.ymin || 0}, ${p.zmin || 0}, ${p.x2min || 0}, ${p.z2min || 0}, ${p.xmax || 10}, ${p.ymax || 10}, ${p.zmax || 10}, ${p.x2max || 10}, ${p.z2max || 10})`,
  
  prism: (p) => {
    const poly = p.polygon || [[0,0], [10,0], [5,10]];
    const height = p.height || 20;
    const points = poly.map(pt => `FreeCAD.Vector(${pt[0]}, ${pt[1]}, 0)`).join(", ");
    return `
((lambda pts: Part.makePolygon(pts + [pts[0]]).extrude(FreeCAD.Vector(0, 0, ${height})))
([${points}]))`;
  }
};

const BOOLEAN_OPS = {
  union: "fuse",
  cut: "cut", 
  intersect: "common",
  section: "section"
};

function buildTransform(node) {
  const t = node.transform || {};
  let code = "";
  
  // Translation
  if (t.translate) {
    const [x, y, z] = t.translate;
    code += `.translate(FreeCAD.Vector(${x}, ${y}, ${z}))`;
  }
  
  // Rotation (axis + angle en degrés)
  if (t.rotate) {
    const { axis = [0, 0, 1], angle = 0, center = [0, 0, 0] } = t.rotate;
    code += `.rotate(FreeCAD.Vector(${center[0]}, ${center[1]}, ${center[2]}), FreeCAD.Vector(${axis[0]}, ${axis[1]}, ${axis[2]}), ${angle})`;
  }
  
  // Scale
  if (t.scale) {
    const s = t.scale;
    code += `.scale(${s})`;
  }
  
  // Mirror
  if (t.mirror) {
    const { base = [0, 0, 0], normal = [1, 0, 0] } = t.mirror;
    code += `.mirror(FreeCAD.Vector(${base[0]}, ${base[1]}, ${base[2]}), FreeCAD.Vector(${normal[0]}, ${normal[1]}, ${normal[2]}))`;
  }
  
  return code;
}

function buildExtrusion(node) {
  const p = node.params || {};
  const profile = p.profile || "circle";
  const length = p.length || 20;
  
  let shapeCode;
  
  if (profile === "circle") {
    shapeCode = `Part.Wire(Part.makeCircle(${p.radius || 5}))`;
  } else if (profile === "rectangle") {
    const w = p.width || 10, h = p.height || 5;
    shapeCode = `Part.makePolygon([FreeCAD.Vector(0,0,0), FreeCAD.Vector(${w},0,0), FreeCAD.Vector(${w},${h},0), FreeCAD.Vector(0,${h},0), FreeCAD.Vector(0,0,0)])`;
  } else if (profile === "polygon" && p.points) {
    const pts = p.points.map(pt => `FreeCAD.Vector(${pt[0]}, ${pt[1]}, 0)`).join(", ");
    shapeCode = `Part.makePolygon([${pts}, FreeCAD.Vector(${p.points[0][0]}, ${p.points[0][1]}, 0)])`;
  } else if (profile === "wire" && p.wireId) {
    shapeCode = `wires["${p.wireId}"]`;
  }
  
  const direction = p.direction || [0, 0, 1];
  const twist = p.twist ? `, True, ${p.twist}` : "";
  
  return `Part.makeFace(${shapeCode}, "Part::FaceMakerBullseye").extrude(FreeCAD.Vector(${direction[0]}, ${direction[1]}, ${direction[2]}).normalize().multiply(${length})${twist})`;
}

function buildRevolution(node) {
  const p = node.params || {};
  const profile = p.profile || "circle";
  const angle = p.angle || 360;
  
  let shapeCode;
  if (profile === "circle") {
    shapeCode = `Part.Wire(Part.makeCircle(${p.radius || 5}, FreeCAD.Vector(${p.offset || 20}, 0, 0)))`;
  } else if (p.wireId) {
    shapeCode = `wires["${p.wireId}"]`;
  }
  
  return `Part.makeFace(${shapeCode}, "Part::FaceMakerBullseye").revolve(FreeCAD.Vector(0,0,0), FreeCAD.Vector(0,0,1), ${angle})`;
}

function buildLoft(node, shapesVar) {
  const sections = node.sections || [];
  const ruled = node.ruled ? "True" : "False";
  const closed = node.closed ? "True" : "False";
  
  const sectionVars = sections.map((s, i) => {
    if (typeof s === "string") return `Part.Wire(${shapesVar}["${s}"].Shape.Edges)`;
    return `loft_sections[${i}]`;
  }).join(", ");
  
  return `Part.makeLoft([${sectionVars}], ${ruled}, ${closed}, ${node.solid !== false ? "True" : "False"})`;
}

function buildSweep(node, shapesVar) {
  const profile = node.profile;
  const path = node.path;
  
  return `Part.makeSweepSurface(Part.Wire(${shapesVar}["${profile}"].Shape.Edges), Part.Wire(${shapesVar}["${path}"].Shape.Edges), ${node.frenet || "True"})`;
}

function buildNodeCode(node, index, shapesVar = "shapes") {
  const name = node.name || `obj_${index}`;
  const p = node.params || {};
  let code = "";
  let shapeExpr = "";
  
  switch (node.node_type) {
    // === PRIMITIVES SOLIDES ===
    case "box":
    case "cylinder":
    case "sphere":
    case "cone":
    case "torus":
    case "wedge":
    case "prism":
      shapeExpr = PRIMITIVE_MAKERS[node.node_type](p);
      break;
      
    // === OPERATIONS D'EXTRUSION ===
    case "extrude":
    case "extrusion":
      shapeExpr = buildExtrusion(node);
      break;
      
    case "revolve":
    case "revolution":
      shapeExpr = buildRevolution(node);
      break;
      
    case "loft":
      shapeExpr = buildLoft(node, shapesVar);
      break;
      
    case "sweep":
      shapeExpr = buildSweep(node, shapesVar);
      break;
      
    // === OPERATIONS BOOLEENNES ===
    case "union":
    case "fuse":
      const operandsU = node.operands || node.objects || [];
      code = `${name} = ${shapesVar}["${operandsU[0]}"].fuse([${shapesVar}["${op}"] for op in ${JSON.stringify(operandsU.slice(1))}])\n`;
      code += `${shapesVar}["${name}"] = ${name}`;
      return code;
      
    case "cut":
    case "difference":
      const operandsC = node.operands || [node.base, node.tool];
      code = `${name} = ${shapesVar}["${operandsC[0]}"].cut(${shapesVar}["${operandsC[1]}"])\n`;
      code += `${shapesVar}["${name}"] = ${name}`;
      return code;
      
    case "intersect":
    case "common":
    case "intersection":
      const operandsI = node.operands || node.objects || [];
      code = `${name} = ${shapesVar}["${operandsI[0]}"].common([${shapesVar}["${op}"] for op in ${JSON.stringify(operandsI.slice(1))}])\n`;
      code += `${shapesVar}["${name}"] = ${name}`;
      return code;
      
    case "section":
      const operandsS = node.operands || [node.base, node.tool];
      code = `${name} = ${shapesVar}["${operandsS[0]}"].section(${shapesVar}["${operandsS[1]}"])\n`;
      code += `${shapesVar}["${name}"] = ${name}`;
      return code;
      
    // === FILLET / CHAMFER ===
    case "fillet":
      const edges = p.edges || "all";
      const radius = p.radius || 1;
      if (edges === "all") {
        code = `${name} = ${shapesVar}["${p.target}"].makeFillet(${radius}, ${shapesVar}["${p.target}"].Shape.Edges)`;
      } else {
        code = `${name} = ${shapesVar}["${p.target}"].makeFillet(${radius}, [${shapesVar}["${p.target}"].Shape.Edges[i] for i in ${JSON.stringify(edges)}])`;
      }
      code += `\n${shapesVar}["${name}"] = ${name}`;
      return code;
      
    case "chamfer":
      const chamfEdges = p.edges || "all";
      const chamfDist = p.distance || 1;
      if (chamfEdges === "all") {
        code = `${name} = ${shapesVar}["${p.target}"].makeChamfer(${chamfDist}, ${shapesVar}["${p.target}"].Shape.Edges)`;
      } else {
        code = `${name} = ${shapesVar}["${p.target}"].makeChamfer(${chamfDist}, [${shapesVar}["${p.target}"].Shape.Edges[i] for i in ${JSON.stringify(chamfEdges)}])`;
      }
      code += `\n${shapesVar}["${name}"] = ${name}`;
      return code;
      
    // === SHELL / OFFSET ===
    case "shell":
      const faces = p.faces || "all";
      const thickness = p.thickness || 1;
      code = `${name} = ${shapesVar}["${p.target}"].makeThickness([${shapesVar}["${p.target}"].Shape.Faces[${faces === "all" ? ":" : JSON.stringify(faces)}]], ${thickness}, ${p.tolerance || 0.001})`;
      code += `\n${shapesVar}["${name}"] = ${name}`;
      return code;
      
    case "offset":
      code = `${name} = ${shapesVar}["${p.target}"].makeOffsetShape(${p.offset || 1}, ${p.tolerance || 0.001}, fill=${p.fill ? "True" : "False"})`;
      code += `\n${shapesVar}["${name}"] = ${name}`;
      return code;
      
    // === WIRE / SKETCH (pour extrusions/lofts) ===
    case "wire":
    case "sketch":
    case "profile":
      const points = p.points || p.path || [[0,0], [10,0], [10,10]];
      const z = p.planeZ || 0;
      const ptsStr = points.map(pt => `FreeCAD.Vector(${pt[0]}, ${pt[1]}, ${z})`).join(", ");
      code = `${name} = Part.makePolygon([${ptsStr}])`;
      code += `\nwires["${name}"] = ${name}`;
      return code;
      
    case "circle_wire":
      code = `${name} = Part.Wire(Part.makeCircle(${p.radius || 5}, FreeCAD.Vector(${p.x || 0}, ${p.y || 0}, ${p.z || 0})))`;
      code += `\nwires["${name}"] = ${name}`;
      return code;
      
    case "rectangle_wire":
      const [x, y, z0] = [p.x || 0, p.y || 0, p.z || 0];
      const [w, h] = [p.width || 10, p.height || 5];
      code = `${name} = Part.makePolygon([FreeCAD.Vector(${x},${y},${z0}), FreeCAD.Vector(${x+w},${y},${z0}), FreeCAD.Vector(${x+w},${y+h},${z0}), FreeCAD.Vector(${x},${y+h},${z0}), FreeCAD.Vector(${x},${y},${z0})])`;
      code += `\nwires["${name}"] = ${name}`;
      return code;
      
    // === COMPOUND / MIRROR / ARRAY ===
    case "compound":
      const objects = node.objects || [];
      code = `${name} = Part.makeCompound([${shapesVar}["${obj}"] for obj in ${JSON.stringify(objects)}])`;
      code += `\n${shapesVar}["${name}"] = ${name}`;
      return code;
      
    case "mirror":
      const base = node.base || node.target;
      const [mx, my, mz] = p.normal || [1, 0, 0];
      const [bx, by, bz] = p.base || [0, 0, 0];
      code = `${name} = ${shapesVar}["${base}"].mirror(FreeCAD.Vector(${bx}, ${by}, ${bz}), FreeCAD.Vector(${mx}, ${my}, ${mz}))`;
      code += `\n${shapesVar}["${name}"] = ${name}`;
      return code;
      
    case "array":
      const arrBase = node.base || node.target;
      const count = p.count || 3;
      const interval = p.interval || [10, 0, 0];
      code = `
${name}_list = [${shapesVar}["${arrBase}"]]
for i in range(1, ${count}):
    copy = ${shapesVar}["${arrBase}"].copy()
    copy.translate(FreeCAD.Vector(${interval[0]}*i, ${interval[1]}*i, ${interval[2]}*i))
    ${name}_list.append(copy)
${name} = ${name}_list[0].fuse(${name}_list[1:])
`;
      code += `${shapesVar}["${name}"] = ${name}`;
      return code;
      
    case "polar_array":
      const polBase = node.base || node.target;
      const polCount = p.count || 4;
      const polAngle = 360 / polCount;
      const polAxis = p.axis || [0, 0, 1];
      const polCenter = p.center || [0, 0, 0];
      code = `
${name}_list = [${shapesVar}["${polBase}"]]
for i in range(1, ${polCount}):
    copy = ${shapesVar}["${polBase}"].copy()
    copy.rotate(FreeCAD.Vector(${polCenter[0]}, ${polCenter[1]}, ${polCenter[2]}), FreeCAD.Vector(${polAxis[0]}, ${polAxis[1]}, ${polAxis[2]}), ${polAngle}*i)
    ${name}_list.append(copy)
${name} = ${name}_list[0].fuse(${name}_list[1:])
`;
      code += `${shapesVar}["${name}"] = ${name}`;
      return code;
      
    // === LEGACY ===
    case "solid_block":
      shapeExpr = PRIMITIVE_MAKERS.box(p);
      break;
      
    default:
      // Fallback: tentative de primitive par nom
      if (PRIMITIVE_MAKERS[node.node_type]) {
        shapeExpr = PRIMITIVE_MAKERS[node.node_type](p);
      } else {
        console.warn(`Type de nœud inconnu: ${node.node_type}`);
        return `# Ignoré: ${node.node_type}`;
      }
  }
  
  // Application des transformations et création finale
  const transforms = buildTransform(node);
  
  if (transforms) {
    code = `${name} = ${shapeExpr}${transforms}`;
  } else {
    code = `${name} = ${shapeExpr}`;
  }
  
  code += `\n${shapesVar}["${name}"] = ${name}`;
  
  return code;
}

function buildFreeCADScript(plan, outPath) {
  const nodes = plan.nodes || [];
  const exportList = plan.export || nodes.filter(n => n.export !== false).map(n => n.name || `obj_${nodes.indexOf(n)}`);
  
  let script = `
import FreeCAD
import Part
import sys

doc = FreeCAD.newDocument("HelixExport")
shapes = {}
wires = {}
loft_sections = []

// === CONSTRUCTION DES PROFILS POUR LOFTS/EXTRUSIONS ===
`;

  // Construction des nœuds
  nodes.forEach((node, i) => {
    script += "\n" + buildNodeCode(node, i) + "\n";
  });

  script += `

// === AJOUT AU DOCUMENT ET EXPORT ===
export_objects = []
for name in ${JSON.stringify(exportList)}:
    if name in shapes:
        obj = doc.addObject("Part::Feature", name)
        obj.Shape = shapes[name]
        export_objects.append(obj)

doc.recompute()

// Export STEP avec couleurs si spécifié
if export_objects:
    Part.export(export_objects, "${outPath.replace(/\\/g, "/")}")
    print("Exporté: ${outPath.replace(/\\/g, "/")}")
else:
    print("Aucun objet à exporter")
    sys.exit(1)
`;

  return script;
}

async function exportStep(plan, options = {}) {
  const outDir = options.outDir || path.join(process.cwd(), "models", "step");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const filename = options.filename || "helix_plan.step";
  const outPath = path.join(outDir, filename);
  const pyPath = path.join(outDir, filename.replace(".step", ".py"));

  const script = buildFreeCADScript(plan, outPath);
  fs.writeFileSync(pyPath, script, "utf8");

  return new Promise((resolve, reject) => {
    const freecadPath = options.freecadPath || `"C:\\Program Files\\FreeCAD 1.1\\bin\\freecadcmd.exe"`;
    
    execFile(
      freecadPath,
      [pyPath],
      { shell: true, timeout: 60000 },
      (err, stdout, stderr) => {
        if (err) {
          console.error("FreeCAD Error:", stderr);
          return reject(err);
        }
        console.log("FreeCAD Output:", stdout);
        resolve({ stepPath: outPath, pyPath, script });
      }
    );
  });
}

// ============================================================
// EXEMPLES D'UTILISATION
// ============================================================

const EXAMPLE_PLAN = {
  nodes: [
    // Deux boîtes de base
    { node_type: "box", name: "base", params: { width: 100, depth: 60, height: 20 } },
    { node_type: "box", name: "cutout", params: { width: 40, depth: 40, height: 25 }, transform: { translate: [30, 10, 0] } },
    
    // Soustraction = base - cutout
    { node_type: "cut", name: "part_a", operands: ["base", "cutout"] },
    
    // Cylindre avec chanfrein
    { node_type: "cylinder", name: "pillar", params: { radius: 15, height: 50 }, transform: { translate: [80, 30, 0] } },
    { node_type: "fillet", name: "pillar_round", params: { target: "pillar", radius: 3 } },
    
    // Union finale
    { node_type: "union", name: "final_part", operands: ["part_a", "pillar_round"] },
    
    // Miroir
    { node_type: "mirror", name: "mirrored", base: "final_part", params: { normal: [1, 0, 0], base: [50, 0, 0] } }
  ],
  export: ["final_part", "mirrored"]
};

// Export simple
// exportStep(EXAMPLE_PLAN).then(console.log).catch(console.error);

module.exports = { 
  exportStep, 
  buildFreeCADScript,
  PRIMITIVE_MAKERS,
  BOOLEAN_OPS 
};
