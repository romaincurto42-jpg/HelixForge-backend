const express = require("express");
const router = express.Router();
const { generateHelixPlan } = require('../helixplan/helixplan_generator'); // destructuration

router.post("/helixplan", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const output = await generateHelixPlan(prompt); // bonne fonction

    res.json({ helixplan: output });
  } catch (err) {
    console.error("Erreur HelixPlan:", err);
    res.status(500).json({ error: err.toString() });
  }
});

module.exports = router;
