// HelixForge 2.0 — Générateur paramétrique de meubles

function node(id, type, params = {}, inputs = {}) {
  return { node_id: id, node_type: type, params, inputs };
}
function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 8);
}

function generateTable({ width = 1200, depth = 700, height = 750, topThickness = 25, legSize = 60 }) {
  const top = uid("table_top");
  const leg1 = uid("table_leg1");
  const leg2 = uid("table_leg2");
  const leg3 = uid("table_leg3");
  const leg4 = uid("table_leg4");

  const nodes = [
    node(top, "solid_block", { width, depth, height: topThickness }),
    node(leg1, "solid_block", { width: legSize, depth: legSize, height: height - topThickness }),
    node(leg2, "solid_block", { width: legSize, depth: legSize, height: height - topThickness }),
    node(leg3, "solid_block", { width: legSize, depth: legSize, height: height - topThickness }),
    node(leg4, "solid_block", { width: legSize, depth: legSize, height: height - topThickness })
  ];

  nodes.push(
    node(uid("leg1_pos"), "transform", { translation: [0, 0, topThickness] }, { target: leg1 }),
    node(uid("leg2_pos"), "transform", { translation: [width - legSize, 0, topThickness] }, { target: leg2 }),
    node(uid("leg3_pos"), "transform", { translation: [0, depth - legSize, topThickness] }, { target: leg3 }),
    node(uid("leg4_pos"), "transform", { translation: [width - legSize, depth - legSize, topThickness] }, { target: leg4 })
  );

  const u1 = uid("table_u1");
  const u2 = uid("table_u2");
  const u3 = uid("table_u3");
  const final = uid("table_final");
  nodes.push(
    node(u1, "boolean_union", {}, { a: top, b: leg1 }),
    node(u2, "boolean_union", {}, { a: u1, b: leg2 }),
    node(u3, "boolean_union", {}, { a: u2, b: leg3 }),
    node(final, "boolean_union", {}, { a: u3, b: leg4 })
  );

  return {
    mode: "CAD",
    nodes,
    outputs: { node: final }
  };
}

function generateStool({ seatDiameter = 350, height = 450, legThickness = 40 }) {
  const seat = uid("stool_seat");
  const leg1 = uid("stool_leg1");
  const leg2 = uid("stool_leg2");
  const leg3 = uid("stool_leg3");
  const nodes = [
    node(seat, "solid_cylinder", { radius: seatDiameter / 2, height: 30 }),
    node(leg1, "solid_block", { width: legThickness, depth: legThickness, height: height - 30 }),
    node(leg2, "solid_block", { width: legThickness, depth: legThickness, height: height - 30 }),
    node(leg3, "solid_block", { width: legThickness, depth: legThickness, height: height - 30 })
  ];
  const r = seatDiameter / 2 - legThickness;
  nodes.push(
    node(uid("leg1_pos"), "transform", { translation: [r, 0, 30] }, { target: leg1 }),
    node(uid("leg2_pos"), "transform", { translation: [-r / 2, r * 0.86, 30] }, { target: leg2 }),
    node(uid("leg3_pos"), "transform", { translation: [-r / 2, -r * 0.86, 30] }, { target: leg3 })
  );
  const u1 = uid("stool_u1");
  const u2 = uid("stool_u2");
  const final = uid("stool_final");
  nodes.push(
    node(u1, "boolean_union", {}, { a: seat, b: leg1 }),
    node(u2, "boolean_union", {}, { a: u1, b: leg2 }),
    node(final, "boolean_union", {}, { a: u2, b: leg3 })
  );
  return {
    mode: "CAD",
    nodes,
    outputs: { node: final }
  };
}

function generateShelf({ width = 800, depth = 300, height = 1800, boardThickness = 20, shelfCount = 4 }) {
  const nodes = [];
  const boards = [];
  for (let i = 0; i < shelfCount; i++) {
    const id = uid("shelf_board");
    const z = (height / (shelfCount + 1)) * (i + 1);
    nodes.push(node(id, "solid_block", { width, depth, height: boardThickness }));
    nodes.push(node(uid("board_pos"), "transform", { translation: [0, 0, z] }, { target: id }));
    boards.push(id);
  }
  let current = boards[0];
  for (let i = 1; i < boards.length; i++) {
    const u = uid("shelf_union");
    nodes.push(node(u, "boolean_union", {}, { a: current, b: boards[i] }));
    current = u;
  }
  return {
    mode: "CAD",
    nodes,
    outputs: { node: current }
  };
}

function generateDesk({ width = 1400, depth = 700, height = 750, topThickness = 25, cabinetWidth = 400 }) {
  const top = uid("desk_top");
  const cabL = uid("desk_cab_left");
  const cabR = uid("desk_cab_right");
  const nodes = [
    node(top, "solid_block", { width, depth, height: topThickness }),
    node(cabL, "solid_block", { width: cabinetWidth, depth, height: height - topThickness }),
    node(cabR, "solid_block", { width: cabinetWidth, depth, height: height - topThickness })
  ];
  nodes.push(
    node(uid("cabL_pos"), "transform", { translation: [0, 0, topThickness] }, { target: cabL }),
    node(uid("cabR_pos"), "transform", { translation: [width - cabinetWidth, 0, topThickness] }, { target: cabR })
  );
  const u1 = uid("desk_u1");
  const final = uid("desk_final");
  nodes.push(node(u1, "boolean_union", {}, { a: top, b: cabL }));
  nodes.push(node(final, "boolean_union", {}, { a: u1, b: cabR }));
  return {
    mode: "CAD",
    nodes,
    outputs: { node: final }
  };
}

function generateFurnitureComponent(type, params = {}) {
  switch (type) {
    case "table": return generateTable(params);
    case "stool": return generateStool(params);
    case "shelf": return generateShelf(params);
    case "desk": return generateDesk(params);
    default: return generateTable(params);
  }
}

module.exports = { generateFurnitureComponent, generateTable, generateStool, generateShelf, generateDesk };
