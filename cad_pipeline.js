// backend/services/pipeline/cad_pipeline.js

// ============================================================
// Générateur SCAD à partir d'un HelixPlan V4
// + Pipeline STL : helixPlanToStl(plan, options)
// ============================================================

const { scadToStl } = require("../../cad/stl/stl_engine");

/**
 * Génère le code OpenSCAD à partir d'un HelixPlan V4
 */
function generateScadFromPlan(plan) {
  if (!plan || !plan.nodes) return "";

  const nodesMap = new Map();
  for (const node of plan.nodes) {
    nodesMap.set(node.node_id, node);
  }

  const outputNodeId = plan.outputs?.node;
  if (!outputNodeId) return "";

  // Helper pour estimer une "hauteur" d'un nœud (utile pour certaines déformations)
  function getNodeHeight(nodeId) {
    const n = nodesMap.get(nodeId);
    if (!n || !n.params) return 10;
    if (typeof n.params.height === "number") return n.params.height;
    if (typeof n.params.depth === "number") return n.params.depth;
    return 100;
  }

  // Génération récursive SCAD
  function generateNodeScad(nodeId, indentLevel = 0) {
    const node = nodesMap.get(nodeId);
    if (!node) return "";

    const indent = "  ".repeat(indentLevel);
    const p = node.params || {};
    const inputs = node.inputs || {};

    switch (node.node_type) {
      // =========================
      // SOLIDES DE BASE
      // =========================
      case "solid_block":
        return `${indent}cube([${p.width}, ${p.depth}, ${p.height}], center=false);`;

      case "solid_cylinder": {
        const fn = p.$fn ? `$fn=${p.$fn}` : "$fn=64";
        return `${indent}cylinder(h=${p.height}, r=${p.radius}, ${fn}, center=false);`;
      }

      case "solid_sphere":
        return `${indent}sphere(r=${p.radius}, $fn=64);`;

      case "solid_cone":
        return `${indent}cylinder(h=${p.height}, r1=${p.r1}, r2=${p.r2}, center=false);`;

      // =========================
      // EXTRUSION POLYGONALE
      // =========================
      case "solid_polygon_extrude": {
        const sides = p.sides || 6;
        const radius = p.radius || 10;
        const height = p.height || 10;
        const points = [];
        for (let i = 0; i < sides; i++) {
          const angle = (2 * Math.PI * i) / sides;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          points.push([x, y]);
        }
        const ptsStr = points.map(pt => `[${pt[0]}, ${pt[1]}]`).join(", ");
        return (
          `${indent}linear_extrude(height=${height}) {\n` +
          `${indent}  polygon(points=[${ptsStr}]);\n` +
          `${indent}}`
        );
      }

      // =========================
      // TRANSFORMATIONS
      // =========================
      case "transform": {
        const childId = inputs.child;
        if (!childId) return `${indent}// transform sans child`;
        const t = Array.isArray(p.translation)
          ? p.translation
          : p.translation && typeof p.translation === "object"
          ? [p.translation.x || 0, p.translation.y || 0, p.translation.z || 0]
          : [0, 0, 0];
        const r = Array.isArray(p.rotation) ? p.rotation : [0, 0, 0];

        let code = "";
        if (t[0] !== 0 || t[1] !== 0 || t[2] !== 0) {
          code += `${indent}translate([${t.join(", ")}]) {\n`;
        }
        if (r[0] !== 0 || r[1] !== 0 || r[2] !== 0) {
          code += `${indent}rotate([${r.join(", ")}]) {\n`;
        }

        const childScad = generateNodeScad(childId, indentLevel + 1);
        code += childScad + "\n";

        if (r[0] !== 0 || r[1] !== 0 || r[2] !== 0) {
          code += `${indent}}\n`;
        }
        if (t[0] !== 0 || t[1] !== 0 || t[2] !== 0) {
          code += `${indent}}\n`;
        }
        return code.trimEnd();
      }

      // =========================
      // BOOLÉENS
      // =========================
      case "boolean_union": {
        const children = inputs.children || [];
        const body = children
          .map(id => generateNodeScad(id, indentLevel + 1))
          .join("\n");
        return `${indent}union() {\n${body}\n${indent}}`;
      }

      case "boolean_difference": {
        const children = inputs.children || [];
        const body = children
          .map(id => generateNodeScad(id, indentLevel + 1))
          .join("\n");
        return `${indent}difference() {\n${body}\n${indent}}`;
      }

      // =========================
      // DÉFORMATIONS / OPÉRATIONS
      // =========================
      case "deform_twist": {
        const childId = inputs.child;
        if (!childId) return `${indent}// deform_twist sans child`;
        const angle = p.angle || 45;
        const steps = p.steps || 20;
        const h = getNodeHeight(childId);

        // Approche simplifiée : on suppose un profil extrudable
        const childScad = generateNodeScad(childId, indentLevel + 1);
        return (
          `${indent}// Twist approximatif\n` +
          `${indent}linear_extrude(height=${h}, twist=${angle}, slices=${steps}) {\n` +
          `${childScad}\n` +
          `${indent}}`
        );
      }

      case "operation_fillet": {
        const childId = inputs.child;
        if (!childId) return `${indent}// fillet sans child`;
        const r = p.radius || 2;
        const childScad = generateNodeScad(childId, indentLevel + 1);
        return (
          `${indent}// Fillet via minkowski (coûteux)\n` +
          `${indent}minkowski() {\n` +
          `${childScad}\n` +
          `${indent}  sphere(r=${r}, $fn=32);\n` +
          `${indent}}`
        );
      }

      case "operation_chamfer": {
        const childId = inputs.child;
        if (!childId) return `${indent}// chamfer sans child`;
        const dist = p.distance || 2;
        const childScad = generateNodeScad(childId, indentLevel + 1);
        // Approximation simple : on laisse un commentaire + solide original
        return (
          `${indent}// Chamfer approximatif (non implémenté précisément)\n` +
          `${indent}// distance = ${dist}\n` +
          childScad
        );
      }

      // =========================
      // PATTERNS
      // =========================
      case "pattern_linear": {
        const childId = inputs.child;
        if (!childId) return `${indent}// pattern_linear sans child`;
        const count = p.count || 3;
        const spacing = p.spacing || [20, 0, 0];
        const childScad = generateNodeScad(childId, indentLevel + 2);

        let code = `${indent}for (i = [0:${count - 1}]) {\n`;
        code += `${indent}  translate([${spacing[0]}*i, ${spacing[1]}*i, ${spacing[2]}*i]) {\n`;
        code += `${childScad}\n`;
        code += `${indent}  }\n`;
        code += `${indent}}`;
        return code;
      }

      case "pattern_circular": {
        const childId = inputs.child;
        if (!childId) return `${indent}// pattern_circular sans child`;
        const count = p.count || 6;
        const angle = p.angle || 360;
        const center = p.center || [0, 0, 0];
        const childScad = generateNodeScad(childId, indentLevel + 2);

        let code = `${indent}for (i = [0:${count - 1}]) {\n`;
        code += `${indent}  rotate([0, 0, ${angle / count} * i]) {\n`;
        code += `${indent}    translate([${center[0]}, ${center[1]}, ${center[2]}]) {\n`;
        code += `${childScad}\n`;
        code += `${indent}    }\n`;
        code += `${indent}  }\n`;
        code += `${indent}}`;
        return code;
      }

      // =========================
      // FALLBACK
      // =========================
      default:
        return `${indent}// Unknown node_type: ${node.node_type}\n${indent}cube([5,5,5]);`;
    }
  }

  return generateNodeScad(outputNodeId, 0);
}

/**
 * Pipeline complet : HelixPlan V4 → SCAD → STL
 */
async function helixPlanToStl(plan, options = {}) {
  const scadCode = generateScadFromPlan(plan);
  const stlPath = await scadToStl(scadCode, options);
  return stlPath;
}

module.exports = {
  generateScadFromPlan,
  helixPlanToStl,
};
