// HelixForge 2.0 — Bibliothèque géométrique universelle CAD + SDF

function node(id, type, params = {}, inputs = {}) {
  return { node_id: id, node_type: type, params, inputs };
}
function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 8);
}

function solidBlock({ width = 100, depth = 100, height = 100 }) {
  const id = uid("block");
  return { nodes: [node(id, "solid_block", { width, depth, height })], root: id };
}
function solidCylinder({ radius = 20, height = 50 }) {
  const id = uid("cyl");
  return { nodes: [node(id, "solid_cylinder", { radius, height })], root: id };
}
function solidSphere({ radius = 30 }) {
  const id = uid("sphere");
  return { nodes: [node(id, "solid_sphere", { radius })], root: id };
}
function sdfSphere({ radius = 30 }) {
  const id = uid("sdf_sphere");
  return { nodes: [node(id, "sdf_primitive", { shape: "sphere", radius })], root: id };
}
function sdfBox({ size = [40, 40, 40] }) {
  const id = uid("sdf_box");
  return { nodes: [node(id, "sdf_primitive", { shape: "box", size })], root: id };
}
function sdfCylinder({ radius = 20, height = 50 }) {
  const id = uid("sdf_cyl");
  return { nodes: [node(id, "sdf_primitive", { shape: "cylinder", radius, height })], root: id };
}
function translate(target, vec = [0, 0, 0]) {
  const id = uid("translate");
  return { nodes: [node(id, "transform", { translation: vec }, { target })], root: id };
}
function rotate(target, rot = [0, 0, 0]) {
  const id = uid("rotate");
  return { nodes: [node(id, "transform", { rotation: rot }, { target })], root: id };
}
function scale(target, s = [1, 1, 1]) {
  const id = uid("scale");
  return { nodes: [node(id, "transform", { scale: s }, { target })], root: id };
}
function sdfTwist(target, angle = 45) {
  const id = uid("twist");
  return { nodes: [node(id, "sdf_deform", { twist: angle }, { child: target })], root: id };
}
function sdfBend(target, amount = 20) {
  const id = uid("bend");
  return { nodes: [node(id, "sdf_deform", { bend: amount }, { child: target })], root: id };
}
function booleanUnion(a, b) {
  const id = uid("union");
  return { nodes: [node(id, "boolean_union", {}, { a, b })], root: id };
}
function booleanDifference(a, b) {
  const id = uid("diff");
  return { nodes: [node(id, "boolean_difference", {}, { a, b })], root: id };
}
function booleanIntersection(a, b) {
  const id = uid("intersect");
  return { nodes: [node(id, "boolean_intersection", {}, { a, b })], root: id };
}
function sdfSmoothUnion(a, b, k = 20) {
  const id = uid("sdf_su");
  return { nodes: [node(id, "sdf_op", { op: "smooth_union", k }, { a, b })], root: id };
}
function sdfSmoothSubtract(a, b, k = 20) {
  const id = uid("sdf_ss");
  return { nodes: [node(id, "sdf_op", { op: "smooth_subtract", k }, { a, b })], root: id };
}
function sdfSmoothIntersection(a, b, k = 20) {
  const id = uid("sdf_si");
  return { nodes: [node(id, "sdf_op", { op: "smooth_intersection", k }, { a, b })], root: id };
}
function sdfMesher(target, resolution = 80) {
  const id = uid("mesher");
  return { nodes: [node(id, "sdf_mesher", { resolution }, { child: target })], root: id };
}

module.exports = {
  solidBlock, solidCylinder, solidSphere,
  sdfSphere, sdfBox, sdfCylinder,
  translate, rotate, scale,
  sdfTwist, sdfBend,
  booleanUnion, booleanDifference, booleanIntersection,
  sdfSmoothUnion, sdfSmoothSubtract, sdfSmoothIntersection,
  sdfMesher
};
