// HelixForge 3.0 — Générateur mécanique paramétrique (compatible HelixPlan v4)

function node(id, type, params = {}, inputs = {}) {
  return { node_id: id, node_type: type, params, inputs };
}

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 8);
}

// ─────────────────────────────────────────────
//  WRAPPER HELIXPLAN V4
// ─────────────────────────────────────────────

function wrapV4(plan) {
  return {
    mode: "CAD",
    nodes: plan.nodes,
    outputs: { node: plan.root }
  };
}

// ─────────────────────────────────────────────
//  PRIMITIVES MÉCANIQUES
// ─────────────────────────────────────────────

function generatePlate({ width = 100, depth = 80, height = 3 }) {
  const id = uid("plate");
  return wrapV4({
    nodes: [
      node(id, "solid_block", { width, depth, height })
    ],
    root: id
  });
}

function generateSpacer({ diameter = 10, height = 20 }) {
  const id = uid("spacer");
  return wrapV4({
    nodes: [
      node(id, "solid_cylinder", { radius: diameter / 2, height })
    ],
    root: id
  });
}

function generateBox({ width = 100, depth = 80, height = 40, wall = 3 }) {
  const outer = uid("box_outer");
  const inner = uid("box_inner");
  const innerPos = uid("box_inner_pos");
  const result = uid("box");

  return wrapV4({
    nodes: [
      node(outer, "solid_block", { width, depth, height }),
      node(inner, "solid_block", {
        width: width - 2 * wall,
        depth: depth - 2 * wall,
        height: height - wall
      }),
      node(innerPos, "transform", { translation: [wall, wall, wall] }, { target: inner }),
      node(result, "boolean_difference", {}, { a: outer, b: innerPos })
    ],
    root: result
  });
}

function generateBracket({ width = 40, depth = 40, thickness = 4, height = 40 }) {
  const base = uid("bracket_base");
  const vertical = uid("bracket_vertical");
  const union = uid("bracket_union");

  return wrapV4({
    nodes: [
      node(base, "solid_block", { width, depth, height: thickness }),
      node(vertical, "solid_block", { width: thickness, depth, height }),
      node(union, "boolean_union", {}, { a: base, b: vertical })
    ],
    root: union
  });
}

function generateHinge({ radius = 8, length = 40, axisRadius = 3 }) {
  const cylA = uid("hinge_a");
  const cylB = uid("hinge_b");
  const cylBpos = uid("hinge_b_pos");
  const axis = uid("hinge_axis");
  const unionAB = uid("hinge_union_ab");
  const final = uid("hinge_final");

  return wrapV4({
    nodes: [
      node(cylA, "solid_cylinder", { radius, height: length }),
      node(cylB, "solid_cylinder", { radius, height: length }),
      node(cylBpos, "transform", { translation: [radius * 2, 0, 0] }, { target: cylB }),
      node(unionAB, "boolean_union", {}, { a: cylA, b: cylBpos }),
      node(axis, "solid_cylinder", { radius: axisRadius, height: length }),
      node(final, "boolean_union", {}, { a: unionAB, b: axis })
    ],
    root: final
  });
}

// ─────────────────────────────────────────────
//  WRAPPER INTELLIGENT POUR IA-CORE
// ─────────────────────────────────────────────

function generateMechanical(prompt) {
  const p = prompt.toLowerCase();

  // Engrenage → pas encore de générateur dédié → fallback interne
  if (p.includes("engrenage") || p.includes("gear")) {
    return generateSpacer({ diameter: 20, height: 10 });
  }

  if (p.includes("plaque") || p.includes("plate")) {
    return generatePlate({});
  }

  if (p.includes("entretoise") || p.includes("spacer")) {
    return generateSpacer({});
  }

  if (p.includes("boitier") || p.includes("box") || p.includes("enclosure")) {
    return generateBox({});
  }

  if (p.includes("support") || p.includes("bracket")) {
    return generateBracket({});
  }

  if (p.includes("charniere") || p.includes("hinge")) {
    return generateHinge({});
  }

  // Fallback mécanique par défaut
  return generatePlate({});
}

// ─────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────

module.exports = {
  generateMechanical,
  generatePlate,
  generateSpacer,
  generateBox,
  generateBracket,
  generateHinge
};
