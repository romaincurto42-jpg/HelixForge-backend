// HelixForge 3.0 — Ajustement des plans HelixPlan

/**
 * Applique des dimensions corrigées à un plan.
 * @param {Object} plan - Plan HelixPlan
 * @param {Object} dims - Dimensions issues du service de précision
 * @returns {Object} Plan modifié
 */
function adjustPlanDimensions(plan, dims) {
  // Crée une copie profonde pour éviter les mutations indésirables
  const adjusted = JSON.parse(JSON.stringify(plan));

  // Parcourir les nœuds et ajuster les paramètres selon les noms
  for (const node of adjusted.nodes) {
    const id = node.node_id.toLowerCase();

    if (id.includes('table_top') && node.node_type === 'solid_block') {
      if (dims.width) node.params.width = dims.width;
      if (dims.depth) node.params.depth = dims.depth;
      if (dims.height) node.params.height = dims.height;
    }

    if (id.includes('leg') && node.node_type === 'solid_block') {
      if (dims.leg_height) node.params.height = dims.leg_height;
      if (dims.leg_diameter) {
        node.params.width = dims.leg_diameter;
        node.params.depth = dims.leg_diameter;
      }
    }

    // Générique pour tout solid_block
    if (node.node_type === 'solid_block') {
      if (dims.width && !node.params.width) node.params.width = dims.width;
      if (dims.depth && !node.params.depth) node.params.depth = dims.depth;
      if (dims.height && !node.params.height) node.params.height = dims.height;
    }

    // Cylindres
    if (node.node_type === 'solid_cylinder') {
      if (dims.leg_diameter) node.params.radius = dims.leg_diameter / 2;
      if (dims.height) node.params.height = dims.height;
    }
  }

  return adjusted;
}

/**
 * Ajuste le plan pour résoudre des problèmes topologiques.
 * @param {Object} plan - Plan HelixPlan
 * @param {Object} report - Rapport de validation
 * @returns {Object} Plan modifié
 */
function adjustPlanForTopology(plan, report) {
  const adjusted = JSON.parse(JSON.stringify(plan));

  for (const issue of report.issues) {
    if (issue.type === 'thin_walls') {
      // Exemple : augmenter l'épaisseur des parois concernées
      // Ici, on cherche des nœuds correspondant à la localisation
      // (implémentation simplifiée)
      for (const node of adjusted.nodes) {
        if (node.node_type === 'solid_block' && node.params.height < 2) {
          node.params.height = 2; // épaisseur minimale
        }
      }
    }

    if (issue.type === 'steep_overhangs') {
      // Ajouter des supports (pas directement modifiable dans le plan, mais on pourrait ajouter un flag)
      // Pour l'instant, on ne fait rien
    }
  }

  return adjusted;
}

module.exports = {
  adjustPlanDimensions,
  adjustPlanForTopology
};
