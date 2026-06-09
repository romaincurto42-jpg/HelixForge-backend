// backend/cad/scad/scad_engine.js
const {
  indent, DEFAULTS,
  scadSolidBlock, scadSolidCylinder, scadSolidSphere, scadSolidCone, scadSolidTorus,
  wrapTransform, wrapBooleanBinary, wrapBooleanNary,
  featureHole, featureFillet, featureChamfer, featureRib, featurePocket,
  presetPlate, presetSpacer, presetBox, presetBracket,
  polyline2d, bezierCurve2d, extrude, revolve, sweep, loft,
  arrayLinear, arrayRadial, mirror,
  scadSdfPlaceholder
} = require("@root/cad/scad/shape_library");

const { exportSdfNodeToStl } = require("../sdf/sdf_mesher");

function helixPlanToScad(plan, options = {}) {
  const {
    emitCall = true,
    defaults = {},
    transformOrder = ["scale", "rotate", "translate"],
    enableSdfStlExport = false,
    sdfBounds = { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 50 } },
    sdfResolution = 64,
    sdfOutputDir = null
  } = options;

  console.log("[scad_engine] enableSdfStlExport =", enableSdfStlExport);

  if (!plan || !Array.isArray(plan.nodes)) throw new Error("Plan invalide : nodes manquants.");
  const nodesById = new Map(plan.nodes.map(n => [n.node_id, n]));
  const rootId = plan.outputs?.node || plan.root;
  if (!rootId) throw new Error("Plan invalide : root manquant.");
  console.log("[scad_engine] rootId =", rootId);

  const cache = new Map();
  const mergedDefaults = {
    block: { ...DEFAULTS.block, ...(defaults.block || {}) },
    cylinder: { ...DEFAULTS.cylinder, ...(defaults.cylinder || {}) },
    sphere: { ...DEFAULTS.sphere, ...(defaults.sphere || {}) },
    cone: { ...DEFAULTS.cone, ...(defaults.cone || {}) },
    torus: { ...DEFAULTS.torus, ...(defaults.torus || {}) },
    hole: { ...DEFAULTS.hole, ...(defaults.hole || {}) },
    fillet: { ...DEFAULTS.fillet, ...(defaults.fillet || {}) },
    chamfer: { ...DEFAULTS.chamfer, ...(defaults.chamfer || {}) },
    rib: { ...DEFAULTS.rib, ...(defaults.rib || {}) },
    pocket: { ...DEFAULTS.pocket, ...(defaults.pocket || {}) },
    plate: { ...DEFAULTS.plate, ...(defaults.plate || {}) },
    spacer: { ...DEFAULTS.spacer, ...(defaults.spacer || {}) },
    box: { ...DEFAULTS.box, ...(defaults.box || {}) },
    bracket: { ...DEFAULTS.bracket, ...(defaults.bracket || {}) }
  };

  function emitNode(id) {
    if (cache.has(id)) return cache.get(id);
    const node = nodesById.get(id);
    if (!node) throw new Error(`Node introuvable : ${id}`);
    let code = "";

    console.log(`[scad_engine] Émission du nœud ${id} (type: ${node.node_type})`);

    switch (node.node_type) {
      // Primitives CAD
      case "solid_block": code = scadSolidBlock(node, mergedDefaults.block); break;
      case "solid_cylinder": code = scadSolidCylinder(node, mergedDefaults.cylinder); break;
      case "solid_sphere": code = scadSolidSphere(node, mergedDefaults.sphere); break;
      case "solid_cone": code = scadSolidCone(node, mergedDefaults.cone); break;
      case "solid_torus": code = scadSolidTorus(node, mergedDefaults.torus); break;

      // 2D
      case "polyline_2d": code = polyline2d(node); break;
      case "bezier_curve_2d": code = bezierCurve2d(node); break;

      // Extrusions
      case "extrude": {
        const profileId = node.inputs?.profile;
        if (!profileId) code = "// extrude sans profile";
        else code = extrude(node, emitNode(profileId));
        break;
      }
      case "revolve": {
        const profileId = node.inputs?.profile;
        if (!profileId) code = "// revolve sans profile";
        else code = revolve(node, emitNode(profileId));
        break;
      }
      case "sweep": {
        const profileId = node.inputs?.profile;
        const pathId = node.inputs?.path;
        if (!profileId || !pathId) code = "// sweep sans profile/path";
        else code = sweep(node, emitNode(profileId), emitNode(pathId));
        break;
      }
      case "loft": {
        const profiles = node.inputs?.profiles;
        if (!Array.isArray(profiles) || profiles.length < 2) code = "// loft avec <2 profiles";
        else code = loft(node, profiles.map(p => emitNode(p)));
        break;
      }

      // Booléens
      case "boolean_union":
      case "boolean_difference":
      case "boolean_intersection": {
        const children = node.inputs?.children;
        if (Array.isArray(children) && children.length) {
          const parts = [];
          for (const childId of children) {
            try {
              parts.push(emitNode(childId));
            } catch (err) {
              console.error(`[scad_engine] Erreur lors de l'émission de l'enfant ${childId}:`, err.message);
              parts.push(`// enfant manquant: ${childId}`);
            }
          }
          code = wrapBooleanNary(node, parts);
        } else {
          console.warn(`[scad_engine] Nœud ${id} (${node.node_type}) n'a pas d'enfants valides. children =`, children);
          code = `// boolean ${node.node_type} incomplet (aucun enfant)`;
        }
        break;
      }

      // Transformations
      case "transform": {
        // Accepter child ou target (selon l'assembleur)
        const targetId = node.inputs?.child || node.inputs?.target;
        if (!targetId) code = "// transform sans target";
        else code = wrapTransform(node, emitNode(targetId), transformOrder);
        break;
      }
      case "mirror": {
        const targetId = node.inputs?.child;
        if (!targetId) code = "// mirror sans child";
        else code = mirror(node, emitNode(targetId));
        break;
      }
      case "array_linear": {
        const childId = node.inputs?.child;
        if (!childId) code = "// array_linear sans child";
        else code = arrayLinear(node, emitNode(childId));
        break;
      }
      case "array_radial": {
        const childId = node.inputs?.child;
        if (!childId) code = "// array_radial sans child";
        else code = arrayRadial(node, emitNode(childId));
        break;
      }

      // Features
      case "feature_hole": {
        const targetId = node.inputs?.target;
        if (!targetId) code = "// feature_hole sans target";
        else code = featureHole(node, emitNode(targetId), mergedDefaults.hole);
        break;
      }
      case "feature_fillet": {
        const targetId = node.inputs?.target;
        if (!targetId) code = "// feature_fillet sans target";
        else code = featureFillet(node, emitNode(targetId), mergedDefaults.fillet);
        break;
      }
      case "feature_chamfer": {
        const targetId = node.inputs?.target;
        if (!targetId) code = "// feature_chamfer sans target";
        else code = featureChamfer(node, emitNode(targetId), mergedDefaults.chamfer);
        break;
      }
      case "feature_rib": {
        const targetId = node.inputs?.target;
        if (!targetId) code = "// feature_rib sans target";
        else code = featureRib(node, emitNode(targetId), mergedDefaults.rib);
        break;
      }
      case "feature_pocket": {
        const targetId = node.inputs?.target;
        if (!targetId) code = "// feature_pocket sans target";
        else code = featurePocket(node, emitNode(targetId), mergedDefaults.pocket);
        break;
      }

      // Presets
      case "preset_plate": code = presetPlate(node, mergedDefaults.plate); break;
      case "preset_spacer": code = presetSpacer(node, mergedDefaults.spacer); break;
      case "preset_box": code = presetBox(node, mergedDefaults.box); break;
      case "preset_bracket": code = presetBracket(node, mergedDefaults.bracket); break;

      // SDF (export STL)
      case "sdf_primitive":
      case "sdf_op":
      case "sdf_deform":
      case "sdf_mesher": {
        console.log(`[scad_engine] Nœud SDF détecté : ${node.node_type} (${node.node_id})`);
        let stlPath = null;
        if (enableSdfStlExport) {
          console.log(`[scad_engine] Appel exportSdfNodeToStl pour ${node.node_id}`);
          stlPath = exportSdfNodeToStl(node, nodesById, {
            bounds: sdfBounds,
            resolution: sdfResolution,
            outputDir: sdfOutputDir
          });
          console.log(`[scad_engine] STL path retourné : ${stlPath}`);
        } else {
          console.log(`[scad_engine] SDF export désactivé pour ${node.node_id}`);
        }
        code = scadSdfPlaceholder(node, stlPath);
        break;
      }

      default: code = `// node_type non géré : ${node.node_type}`;
    }

    cache.set(id, code);
    return code;
  }

  const mainBody = emitNode(rootId);
  console.log("[scad_engine] mainBody final :\n", mainBody);
  const boslHeader = 'include <BOSL2/std.scad>;\n\n';
  const moduleBody = `module helixforge_object() {\n${indent(mainBody)}\n}\n`;
  const call = emitCall ? "\nhelixforge_object();\n" : "\n";
  const scad = `// HelixForge 2.0 — SCAD généré depuis HelixPlan v4\n// Root node: ${rootId}\n\n${boslHeader}${moduleBody}${call}`;
  return scad;
}

module.exports = { helixPlanToScad };
