// backend/cad/scene/scene_graph.js
// Gestion des assemblages, groupes, instances → graphe SDF de scène

/**
 * Construit un nœud SDF d'assemblage à partir d'un nœud AST "Assembly".
 *
 * node attendu :
 * {
 *   type: "Assembly",
 *   name: string,
 *   members: [ astShapeOrExpr, ... ]
 * }
 */
function buildAssembly(node, shapeToSDF) {
  if (!node || node.type !== "Assembly") {
    throw new Error("buildAssembly: nœud invalide ou non Assembly");
  }

  const children = (node.members || []).map(memberAst =>
    shapeToSDF(memberAst)
  );

  return {
    node_type: "sdf_assembly",
    params: {
      name: node.name
    },
    children
  };
}

/**
 * Construit un nœud SDF de groupe logique.
 *
 * node attendu :
 * {
 *   type: "Group",
 *   name: string,
 *   children: [ astShapeOrExpr, ... ]
 * }
 */
function buildGroup(node, shapeToSDF) {
  if (!node || node.type !== "Group") {
    throw new Error("buildGroup: nœud invalide ou non Group");
  }

  const children = (node.children || []).map(childAst =>
    shapeToSDF(childAst)
  );

  return {
    node_type: "sdf_group",
    params: {
      name: node.name
    },
    children
  };
}

/**
 * Construit une instance d'un autre nœud SDF.
 *
 * node attendu :
 * {
 *   type: "Instance",
 *   source: astExpressionOuShape
 * }
 *
 * resolveRef doit résoudre l'expression vers un nœud SDF de base
 * (par exemple via un environnement de symboles).
 */
function buildInstance(node, resolveRef) {
  if (!node || node.type !== "Instance") {
    throw new Error("buildInstance: nœud invalide ou non Instance");
  }

  const target = resolveRef(node.source);
  if (!target) {
    throw new Error("buildInstance: référence introuvable pour l'instance");
  }

  return {
    node_type: "sdf_instance",
    params: {
      ref: target // ou target.id selon ton système
    },
    children: []
  };
}

module.exports = {
  buildAssembly,
  buildGroup,
  buildInstance
};
