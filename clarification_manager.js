// HelixForge 3.0 — Gestion des sessions de clarification

const sessions = new Map(); // sessionId -> { question, context, createdAt }

function createClarificationSession(question, context) {
  const sessionId = Math.random().toString(36).substring(2, 15);
  sessions.set(sessionId, {
    question,
    context,
    createdAt: Date.now(),
    answer: null
  });
  return sessionId;
}

function getClarificationSession(sessionId) {
  return sessions.get(sessionId);
}

function setClarificationAnswer(sessionId, answer) {
  const session = sessions.get(sessionId);
  if (session) {
    session.answer = answer;
    session.answeredAt = Date.now();
    return true;
  }
  return false;
}

function cleanupOldSessions(maxAgeMs = 5 * 60 * 1000) { // 5 minutes
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > maxAgeMs) {
      sessions.delete(id);
    }
  }
}

setInterval(cleanupOldSessions, 60 * 1000); // nettoyage toutes les minutes

module.exports = {
  createClarificationSession,
  getClarificationSession,
  setClarificationAnswer
};
