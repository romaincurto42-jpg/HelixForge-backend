// backend/services/planCache.js

/**
 * Cache des plans HelixPlan pour l'historique.
 * Chaque objet est identifié par un objectId unique, et on conserve une pile des versions précédentes.
 */
const planHistory = new Map(); // Map<objectId, { current: plan, previous: plan[] }>

/**
 * Stocke un nouveau plan et sauvegarde l'ancien dans l'historique.
 * @param {string} objectId - Identifiant de l'objet.
 * @param {object} plan - Plan HelixPlan à stocker.
 * @returns {void}
 */
function savePlan(objectId, plan) {
  if (!planHistory.has(objectId)) {
    planHistory.set(objectId, { current: plan, previous: [] });
  } else {
    const entry = planHistory.get(objectId);
    entry.previous.push(entry.current);
    entry.current = plan;
    // Limiter la taille de l'historique (optionnel)
    if (entry.previous.length > 20) entry.previous.shift();
  }
}

/**
 * Récupère le plan actuel.
 * @param {string} objectId - Identifiant de l'objet.
 * @returns {object|null} Plan actuel ou null.
 */
function getCurrentPlan(objectId) {
  const entry = planHistory.get(objectId);
  return entry ? entry.current : null;
}

/**
 * Récupère le plan précédent (undo) et le remet comme courant.
 * @param {string} objectId - Identifiant de l'objet.
 * @returns {object|null} Plan précédent ou null.
 */
function undoPlan(objectId) {
  const entry = planHistory.get(objectId);
  if (!entry || entry.previous.length === 0) return null;
  const previousPlan = entry.previous.pop();
  entry.current = previousPlan;
  return previousPlan;
}

/**
 * Initialise un nouvel objet avec un plan.
 * @param {string} objectId - Identifiant de l'objet.
 * @param {object} plan - Plan initial.
 * @returns {void}
 */
function initPlan(objectId, plan) {
  planHistory.set(objectId, { current: plan, previous: [] });
}

module.exports = { savePlan, getCurrentPlan, undoPlan, initPlan };
