// Contrôleur pour la génération d’assemblage
const { generateAssembly } = require("@root/services/assembly_generator");

async function createAssembly(req, res) {
  try {
    const { description } = req.body;
    if (!description) {
      return res.status(400).json({ error: 'Description manquante' });
    }
    const assembly = await generateAssembly(description);
    res.json({ success: true, assembly });
  } catch (err) {
    console.error('Assembly error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createAssembly };
