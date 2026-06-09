// Contrôleur pour la précision dimensionnelle
const { applyDimensionalConstraints } = require("@root/services/dimensional_precision");

async function computePrecision(req, res) {
  try {
    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ error: 'Plan JSON manquant' });
    }
    const result = await applyDimensionalConstraints(plan);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Precision error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { computePrecision };
