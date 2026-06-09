// Contrôleur pour la validation de topologie
const { validateStl } = require("@root/services/topology_validator");

async function validateSTL(req, res) {
  try {
    const { stlPath, method } = req.body;
    if (!stlPath) {
      return res.status(400).json({ error: 'Chemin STL manquant' });
    }
    const report = await validateStl(stlPath, method || 'FDM_3D_PRINTING');
    res.json({ success: true, report });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { validateSTL };
