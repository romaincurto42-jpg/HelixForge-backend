const { generateSDFMesh } = require("../cad/sdf/sdf_router");

exports.render = async (req, res) => {
  try {
    const { plan, mode } = req.body;

    const mesh = await generateSDFMesh(plan, { mode });

    res.json({ success: true, mesh });
  } catch (err) {
    console.error("❌ SDF Render Error:", err);
    res.status(500).json({ error: err.message });
  }
};
