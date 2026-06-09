const clarificationManager = require("@root/services/clarification_manager");

async function requestClarification(req, res) {
  try {
    const { question, context } = req.body;
    if (!question) return res.status(400).json({ error: 'Question manquante' });

    const sessionId = clarificationManager.createClarificationSession(question, context);
    res.json({ sessionId, question });
  } catch (err) {
    console.error('Clarification request error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function submitAnswer(req, res) {
  try {
    const { sessionId, answer } = req.body;
    if (!sessionId || !answer) return res.status(400).json({ error: 'SessionId ou answer manquant' });

    const success = clarificationManager.setClarificationAnswer(sessionId, answer);
    if (!success) return res.status(404).json({ error: 'Session introuvable' });

    // Optionnel : relancer le traitement avec le nouveau contexte
    res.json({ success: true });
  } catch (err) {
    console.error('Submit answer error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { requestClarification, submitAnswer };
