// HelixForge 3.0 — Primitive Detector (segments → primitives 3D)

// // const THREE = require("three");

function detectSphere(points) {
  if (points.length < 20) return null;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const zs = points.map(p => p.z);

  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;

//   const center = new THREE.Vector3(cx, cy, cz);

  const distances = points.map(p => p.distanceTo(center));
  const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance = distances.reduce((acc, d) => acc + Math.abs(d - avg), 0) / distances.length;

  if (variance < 0.5) {
    return {
      type: "sphere",
      radius: avg,
      center: [cx, cy, cz]
    };
  }
  return null;
}

function detectCylinder(points) {
  if (points.length < 20) return null;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  const radii = points.map(p => Math.hypot(p.x - cx, p.y - cy));
  const avg = radii.reduce((a, b) => a + b, 0) / radii.length;
  const variance = radii.reduce((acc, r) => acc + Math.abs(r - avg), 0) / radii.length;

  if (variance < 0.5) {
    const zs = points.map(p => p.z);
    return {
      type: "cylinder",
      radius: avg,
      height: Math.max(...zs) - Math.min(...zs),
      center: [cx, cy, (Math.min(...zs) + Math.max(...zs)) / 2]
    };
  }
  return null;
}

function detectBox(points) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const zs = points.map(p => p.z);

  return {
    type: "box",
    size: [
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      Math.max(...zs) - Math.min(...zs)
    ],
    position: [
      Math.min(...xs),
      Math.min(...ys),
      Math.min(...zs)
    ]
  };
}

function detectHole(points) {
  const cyl = detectCylinder(points);
  if (!cyl) return null;
  return {
    type: "hole",
    radius: cyl.radius,
    height: cyl.height,
    center: cyl.center
  };
}

function detectPrimitivesFromClusters(geometry, clusters) {
  const primitives = [];

  for (const cluster of clusters) {
    const points = [];
    for (const faceIndex of cluster) {
      const i = faceIndex * 3;
      const x1 = geometry.attributes.position.getX(i);
      const y1 = geometry.attributes.position.getY(i);
      const z1 = geometry.attributes.position.getZ(i);
      const x2 = geometry.attributes.position.getX(i + 1);
      const y2 = geometry.attributes.position.getY(i + 1);
      const z2 = geometry.attributes.position.getZ(i + 1);
      const x3 = geometry.attributes.position.getX(i + 2);
      const y3 = geometry.attributes.position.getY(i + 2);
      const z3 = geometry.attributes.position.getZ(i + 2);
//       points.push(new THREE.Vector3(x1, y1, z1));
//       points.push(new THREE.Vector3(x2, y2, z2));
//       points.push(new THREE.Vector3(x3, y3, z3));
    }

    const sphere = detectSphere(points);
    if (sphere) {
      primitives.push(sphere);
      continue;
    }

    const cylinder = detectCylinder(points);
    if (cylinder) {
      primitives.push(cylinder);
      continue;
    }

    const hole = detectHole(points);
    if (hole) {
      primitives.push(hole);
      continue;
    }

    primitives.push(detectBox(points));
  }

  return primitives;
}

module.exports = {
  detectPrimitivesFromClusters
};
