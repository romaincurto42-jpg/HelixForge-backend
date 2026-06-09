// backend/ai/prompt/artistic_translator.js
// Traducteur artistique via Groq pour générer des descriptions 3D procédurales
// Version corrigée : suppression de 'repeat' (formes disjointes), remplacé par
// transformations continues : twist + fractal_noise + scale + bend

const { Groq } = require('groq-sdk');
const crypto = require('crypto');

// Configuration
const GROQ_MODEL = process.env.ARTISTIC_GROQ_MODEL || "llama-3.3-70b-versatile";
const TEMPERATURE = 0.85;
const MAX_TOKENS = 1200;

// Cache
const translationCache = new Map();
const CACHE_TTL = 1000 * 60 * 60;

// Système prompt – on interdit formellement 'repeat'
const SYSTEM_PROMPT = `Tu es un expert en modélisation 3D procédurale pour un moteur SDF.
Génère un objet JSON conforme au schéma ci-dessous.
N'utilise JAMAIS la transformation "repeat" : elle crée des copies déconnectées.
Pour obtenir des ramifications (branches, arbre), combine plutôt "twist", "fractal_noise", "scale", "bend".
Pour une forme qui monte : "translate" en Y et "scale" en Y.

Schéma JSON :
{
  "geometry": {
    "primary": "string", // cylinder, cone, sphere, cube, torus, fractal...
    "params": { ... }
  },
  "transformPipeline": [
    { "type": "twist", "angle": number },
    { "type": "fractal_noise", "amplitude": number, "octaves": number },
    { "type": "scale", "sx": number, "sy": number, "sz": number },
    { "type": "translate", "tx": number, "ty": number, "tz": number },
    { "type": "bend", "intensity": number }
  ],
  "styles": ["string"],
  "material": { "type": "string", "color": [number,number,number] },
  "materialLayers": [],
  "colorFields": [],
  "intensity": number
}

Règles :
- Pour "branches" ou "arbre" : primary = "cylinder", puis twist angle 30-60°, fractal_noise amplitude 0.3-0.5, octaves 4-5, scale sy 1.2-1.5.
- Pour "monte vers le haut" : translate ty 0.5-1.0, scale sy 1.2-1.5.
- Ne renvoie que le JSON, pas de commentaire.`;

/**
 * Traduit un prompt utilisateur en objet artistique structuré
 */
async function translateToArtistic(userPrompt, intensity = 0.7, options = {}) {
    const { useCache = true, timeout = 15000, fallbackOnly = false } = options;
    const intensityClamped = Math.min(1.0, Math.max(0.0, intensity));

    // Cache
    let cacheKey = null;
    if (useCache) {
        const hash = crypto.createHash('md5').update(userPrompt).digest('hex');
        cacheKey = `${hash}_${Math.floor(intensityClamped * 10)}`;
        if (translationCache.has(cacheKey)) {
            const cached = translationCache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL) return cached.result;
            else translationCache.delete(cacheKey);
        }
    }

    if (!fallbackOnly) {
        try {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const completion = await groq.chat.completions.create({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userPrompt }
                ],
                temperature: TEMPERATURE,
                max_tokens: MAX_TOKENS,
                response_format: { type: "json_object" }
            });
            const rawContent = completion.choices[0]?.message?.content;
            if (!rawContent) throw new Error("Réponse vide");
            let artistic = JSON.parse(rawContent);
            artistic = validateAndNormalize(artistic, intensityClamped);
            if (useCache && cacheKey) translationCache.set(cacheKey, { result: artistic, timestamp: Date.now() });
            return artistic;
        } catch (err) {
            console.error("[ArtisticTranslator] Erreur Groq, fallback:", err.message);
            return generateFallbackArtistic(userPrompt, intensityClamped);
        }
    } else {
        return generateFallbackArtistic(userPrompt, intensityClamped);
    }
}

/**
 * Valide et normalise, et remplace toute occurrence de 'repeat' par des alternatives
 */
function validateAndNormalize(artistic, defaultIntensity) {
    if (!artistic.geometry) artistic.geometry = {};
    if (!artistic.geometry.primary) artistic.geometry.primary = "sphere";
    if (!artistic.geometry.params) artistic.geometry.params = {};

    const validPrimitives = ["sphere","cube","torus","cylinder","cone","fractal","mandelbulb","mandelbox","julia","sierpinski","menger","cloud","fluid","mobius","klein","heart","rounded_box","capsule"];
    if (!validPrimitives.includes(artistic.geometry.primary)) artistic.geometry.primary = "sphere";

    if (!Array.isArray(artistic.transformPipeline)) artistic.transformPipeline = [];
    if (!Array.isArray(artistic.styles)) artistic.styles = [];
    if (!artistic.material) artistic.material = { type: "soft", color: [0.7,0.6,0.5] };
    if (!artistic.material.color) artistic.material.color = [0.7,0.6,0.5];
    if (!Array.isArray(artistic.materialLayers)) artistic.materialLayers = [];
    if (!Array.isArray(artistic.colorFields)) artistic.colorFields = [];
    if (typeof artistic.intensity !== "number") artistic.intensity = defaultIntensity;
    artistic.intensity = Math.min(1.0, Math.max(0.0, artistic.intensity));

    // Remplacer toutes les transformations 'repeat' par un twist + fractal_noise
    const newPipeline = [];
    for (const t of artistic.transformPipeline) {
        if (t.type === 'repeat') {
            console.log("[ArtisticTranslator] Transformation 'repeat' détectée → remplacée par twist + fractal_noise");
            newPipeline.push({ type: "twist", angle: 45 * artistic.intensity });
            newPipeline.push({ type: "fractal_noise", amplitude: 0.4 * artistic.intensity, octaves: 5 });
        } else {
            newPipeline.push(t);
        }
    }
    artistic.transformPipeline = newPipeline;

    return artistic;
}

/**
 * Fallback interne – ne génère jamais de 'repeat'
 */
function generateFallbackArtistic(userPrompt, intensity) {
    const lower = userPrompt.toLowerCase();
    let primary = "cylinder";
    let params = { radius: 0.6, height: 1.2 };
    const transformPipeline = [];

    const hasBranches = lower.includes("branche") || lower.includes("ramification") || lower.includes("arbre") || lower.includes("étend");
    const monte = lower.includes("monte") || lower.includes("vers le haut") || lower.includes("vertical");
    const longue = lower.includes("longue") || lower.includes("haut");

    // Choix de la primitive
    if (lower.includes("cone") || lower.includes("pyramide")) {
        primary = "cone";
        params = { radius: 0.8, height: 1.5 };
    } else if (lower.includes("cube")) {
        primary = "cube";
        params = { size: 1.0 };
    } else if (lower.includes("tore")) {
        primary = "torus";
        params = { majorRadius: 1.2, minorRadius: 0.4 };
    } else {
        primary = "cylinder";
        params = { radius: 0.5 + intensity * 0.3, height: 1.2 + intensity * 0.8 };
    }
    if (longue) params.height = (params.height || 1.0) + 0.5 * intensity;
    if (hasBranches) params.height = (params.height || 1.0) + 0.6 * intensity;

    // Transformations pour la verticalité
    if (monte) {
        transformPipeline.push({ type: "translate", ty: 0.5 + intensity * 0.5 });
        transformPipeline.push({ type: "scale", sy: 1.2 + intensity * 0.6 });
    }

    // Branches : twist + fractal_noise + scale (pas de repeat)
    if (hasBranches) {
        transformPipeline.push({ type: "twist", angle: 60 * intensity });
        transformPipeline.push({ type: "fractal_noise", amplitude: 0.5 * intensity, octaves: 5 });
        transformPipeline.push({ type: "scale", sy: 1.3 + intensity * 0.4 });
    } else if (intensity > 0.5) {
        transformPipeline.push({ type: "twist", angle: 30 * intensity });
        transformPipeline.push({ type: "fractal_noise", amplitude: 0.3 * intensity, octaves: 3 });
    }

    if (transformPipeline.length === 0 && intensity > 0.2) {
        transformPipeline.push({ type: "scale", sx: 1.05, sy: 1.1, sz: 1.05 });
    }

    // Styles
    const styles = [];
    if (hasBranches) styles.push("organic");
    if (lower.includes("psychédélique")) styles.push("psychedelic");
    if (lower.includes("cyberpunk")) styles.push("cyberpunk");
    if (lower.includes("surréaliste")) styles.push("surrealism");
    if (styles.length === 0) styles.push("abstract");

    // Matériau
    let materialType = "soft";
    let materialColor = [0.7, 0.6, 0.5];
    if (lower.includes("verre")) materialType = "glass";
    else if (lower.includes("métal")) materialType = "metal";
    else if (lower.includes("liquide")) materialType = "liquid";
    else if (lower.includes("énergie")) materialType = "energy";
    else if (lower.includes("néon")) materialType = "neon";
    else if (lower.includes("bois") || hasBranches) {
        materialType = "wood";
        materialColor = [0.55, 0.35, 0.2];
    }

    if (lower.includes("rouge")) materialColor = [1, 0.2, 0.2];
    else if (lower.includes("bleu")) materialColor = [0.2, 0.4, 1];
    else if (lower.includes("vert")) materialColor = [0.2, 0.8, 0.3];
    else if (lower.includes("doré")) materialColor = [1, 0.8, 0.2];
    else if (materialType === "wood") materialColor = [0.55, 0.35, 0.2];

    return {
        geometry: { primary, params },
        transformPipeline,
        styles,
        material: { type: materialType, color: materialColor },
        materialLayers: [],
        colorFields: [],
        intensity: intensity
    };
}

function clearCache() {
    translationCache.clear();
}

module.exports = {
    translateToArtistic,
    clearCache,
    _validateAndNormalize: validateAndNormalize,
    _generateFallback: generateFallbackArtistic
};
