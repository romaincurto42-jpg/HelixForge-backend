const { exportStep } = require("@root/cad/export/step_exporter");

async function exportStepFromPlan(req, res) {
  try {
    const plan = req.body.plan;
    if (!plan) return res.status(400).json({ error: "Missing plan" });

    const stepPath = await exportStep(plan);
    res.json({ success: true, stepPath });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { exportStepFromPlan };
