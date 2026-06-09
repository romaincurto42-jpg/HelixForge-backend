// HelixForge 3.0 — Shape Reconstruction (Contours + Depth → Primitives → HelixPlan v4)

function bbox2D(points) {
  if (!points || points.length === 0) return { w: 0, h: 0 };
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    w: maxX - minX,
    h: maxY - minY,
    minX, minY, maxX, maxY
  };
}

function isCircle(points) {
  if (!points || points.length < 6) return false;
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let sum = 0;
  for (const p of points) {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    sum += Math.abs(Math.sqrt(dx * dx + dy * dy));
  }
  const avg = sum / points.length;
  const variance = points.reduce((acc, p) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    return acc + Math.abs(r - avg);
  }, 0) / points.length;
  return variance < 5; // seuil empirique
}

function fuseContoursAndDepth(contoursByView, depth) {
  const front = contoursByView.front || [];
  const side = contoursByView.left || contoursByView.right || [];
  const top = contoursByView.top || [];

  const frontBox = bbox2D(front);
  const sideBox = bbox2D(side);
  const topBox = bbox2D(top);

  const width = frontBox.w || 80;
  const height = frontBox.h || 60;
  const depthSide = sideBox.w || null;
  const depthTop = topBox.h || null;
  const depthFinal = depthSide ?? depthTop ?? 40;

  return {
    type: "block",
    size: [width, height, depthFinal],
    contours: { front, side, top },
    depthMap: depth
  };
}

function detectPrimitives(reconstruction, intent = {}) {
  const prims = [];
  const { size, contours } = reconstruction;
  const [w, h, d] = size;

  if (isCircle(contours.front)) {
    prims.push({
      type: "cylinder",
      radius: w / 2,
      height: d,
      position: [0, 0, 0]
    });
  } else {
    prims.push({
      type: "box",
      size: [w, h, d],
      position: [0, 0, 0]
    });
  }

  if (intent.type === "bag" || intent.object === "bag") {
    prims.push({
      type: "extrude",
      profile: [[0, 0], [w * 0.25, h * 0.4], [w * 0.5, 0]],
      height: 5,
      position: [w * 0.25, d, h]
    });
  }

  return prims;
}

function primitivesToHelixPlan(primitives, intent = {}) {
  const nodes = [];
  const materials = {};
  const assembly = [];

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
    } else if (p.type === "cylinder") {
      nodes.push({
        node_id: id,
        node_type: "solid_cylinder",
        params: {
          radius: p.radius,
          height: p.height
        },
        inputs: {}
      });
    } else if (p.type === "extrude") {
      nodes.push({
        node_id: id,
        node_type: "extrude",
        params: {
          profile: p.profile,
          height: p.height
        },
        inputs: {}
      });
    }
  });

  return {
    meta: {
      source: "vision_engine_v3",
      intent: intent.type || intent.object || "unknown"
    },
    nodes,
    materials,
    assembly,
    outputs: { node: nodes[0]?.node_id || null }
  };
}

module.exports = {
  fuseContoursAndDepth,
  detectPrimitives,
  primitivesToHelixPlan
};
