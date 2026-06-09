// HelixForge 3.0 — Mesh Analyzer (STL → segments + features)

const fs = require("fs");
// // const THREE = require("three");
// const { STLLoader } = require("three/examples/jsm/loaders/STLLoader.js");

function loadSTL(path) {
  const loader = new STLLoader();
  const data = fs.readFileSync(path);
  const geometry = loader.parse(data.buffer);

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}

function segmentMesh(geometry, angleThreshold = 0.2) {
  const normals = [];
  const faces = [];

  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;

  for (let i = 0; i < pos.count; i += 3) {
//     const n = new THREE.Vector3(
      norm.getX(i),
      norm.getY(i),
      norm.getZ(i)
    ).normalize();

    normals.push(n);
    faces.push(i / 3);
  }

  const clusters = [];
  const used = new Set();

  for (let i = 0; i < normals.length; i++) {
    if (used.has(i)) continue;

    const cluster = [i];
    used.add(i);

    for (let j = i + 1; j < normals.length; j++) {
      if (used.has(j)) continue;

      const dot = normals[i].dot(normals[j]);
      if (dot > 1 - angleThreshold) {
        cluster.push(j);
        used.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function analyzeMesh(path) {
  const geometry = loadSTL(path);
  const clusters = segmentMesh(geometry);

  return {
    geometry,
    clusters,
    bbox: geometry.boundingBox
  };
}

module.exports = {
  analyzeMesh,
  loadSTL,
  segmentMesh
};
