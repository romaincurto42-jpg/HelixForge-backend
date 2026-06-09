// HelixForge 3.0 — Plan Reconstructor (primitives → HelixPlan v4)

const { detectSymmetry, detectPatterns } = require("@root/cad/reverse/pattern_detector");

function primitivesToHelixPlan(primitives) {
  const nodes = [];
  const assembly = [];
  const materials = {};
  const constraints = [];

  primitives.forEach((p, i) => {
    const id = `prim_${i}`;

    if (p.type === "box") {
      nodes.push({
        node_id: id,
        node_type: "solid_block",
        params: {
          width: p.size[0],
          height: p.size[1],
          depth: p.size[2]
        },
        inputs: {}
      });
    }

    if (p.type === "cylinder") {
      nodes.push({
        node_id: id,
        node_type: "solid_cylinder",
        params: {
          radius: p.radius,
          height: p.height
        },
        inputs: {}
      });
    }

    if (p.type === "sphere") {
      nodes.push({
        node_id: id,
        node_type: "solid_sphere",
        params: {
          radius: p.radius
        },
        inputs: {}
      });
    }

    if (p.type === "hole") {
      nodes.push({
        node_id: id,
        node_type: "feature_hole",
        params: {
          radius: p.radius,
          depth: p.height,
          position: p.center
        },
        inputs: {}
      });
    }
  });

  const sym = detectSymmetry(primitives);
  const patterns = detectPatterns(primitives);

  // Build a root node (union of all primitives if more than one)
  let rootId = null;
  if (nodes.length === 1) {
    rootId = nodes[0].node_id;
  } else if (nodes.length > 1) {
    // Create a union node to combine all primitives
    const unionId = "union_root";
    nodes.push({
      node_id: unionId,
      node_type: "boolean_union",
      params: {},
      inputs: {
        children: nodes.map(n => n.node_id)
      }
    });
    rootId = unionId;
  }

  return {
    mode: "CAD",
    meta: {
      source: "reverse_engineering_v1"
    },
    nodes,
    constraints,
    materials,
    assembly,
    patterns,
    symmetries: sym,
    outputs: { node: rootId }
  };
}

module.exports = {
  primitivesToHelixPlan
};
