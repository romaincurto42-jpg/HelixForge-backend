// HelixForge 2.0 — Client Groq PRODUCTION-GRADE (CommonJS)

const Groq = require("groq-sdk");

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const MODELS = {
  CAD: "llama-3.3-70b-versatile",
  SDF: "llama-3.3-70b-versatile"      // modèle accessible
};

const MAX_RETRIES = 3;
const TIMEOUT_MS = 25_000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("⏳ Timeout Groq")), ms))
  ]);
}

async function callGroq(fullPrompt, mode = "CAD") {
  const model = MODELS[mode] || MODELS.CAD;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`⚡ [Groq] Appel modèle ${model} (tentative ${attempt}/${MAX_RETRIES})`);
      const completion = await withTimeout(
        client.chat.completions.create({
          model,
          messages: [{ role: "user", content: fullPrompt }],
          temperature: 0.15,
          max_tokens: 4096
        }),
        TIMEOUT_MS
      );
      const text = completion.choices?.[0]?.message?.content || "";
      if (!text.trim()) throw new Error("Réponse vide du modèle.");
      console.log("✅ [Groq] Réponse reçue.");
      return text;
    } catch (err) {
      lastError = err;
      console.error(`❌ [Groq] Erreur tentative ${attempt}:`, err.message);
      if (attempt < MAX_RETRIES) console.log("🔁 Nouvelle tentative…");
    }
  }
  console.error("💥 [Groq] Échec après toutes les tentatives.");
  throw lastError || new Error("Groq a échoué sans message d’erreur.");
}

module.exports = { callGroq };
