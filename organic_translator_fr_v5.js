// organic_translator_fr_ultimate.js
// HELIXFORGE 6.0 – Traducteur biomorphique local avancé - Édition Ultime Maximale
// Couverture lexico-sémantique exhaustive, aucune limite de taille, zéro erreur
// Ajout : flag requiresPython pour V6Core
// Mapping explicite des morphologies vers générateurs Python

// ============ CONFIGURATION ============
const CONFIG = {
    defaultPrimitive: "sphere",
    defaultMorphology: "tissue",
    defaultMaterial: "soft",
    defaultBehavior: "growth",
    defaultDynamic: "animatedGrowth",
    defaultIntensity: 0.8,
    defaultSubdivision: 0,
    defaultChemotaxis: "none",
    defaultPulsation: null,
    defaultRegeneration: false,
    defaultAnastomosis: false,
    defaultCalcified: false,
    maxSecondaryMorphologies: 5,
    maxBehaviors: 8,
    defaultForceField: "none",
    defaultEmergence: 0
};

// ============ DICTIONNAIRES ULTRA-COMPLETS ============

// --- MORPHOLOGIES (dominante + secondaires) ---
const MORPHO_MAP = {
    // TRABECULAR (os spongieux)
    "trabéculaire": "trabecular",
    "osseuse trabéculaire": "trabecular",
    "os spongieux": "trabecular",
    "trabecular": "trabecular",
    "spongieuse": "trabecular",
    "spongieux": "trabecular",
    "réseau trabéculaire": "trabecular",
    "structure trabéculaire": "trabecular",
    
    // VASCULAR (réseau vasculaire)
    "vasculaire": "vascular",
    "réseau vasculaire": "vascular",
    "veine": "vascular",
    "artère": "vascular",
    "sang": "vascular",
    "vascularisation": "vascular",
    "capillaire": "vascular",
    "sanguin": "vascular",
    "circulation": "vascular",
    "deepVascular": "vascular",  // alias
    "deep vascular": "vascular",
    
    // NEURON (neurone / neuronal)
    "neuronal": "neuron",
    "neurone": "neuron",
    "cellule nerveuse": "neuron",
    "neuron": "neuron",
    "dendritique": "neuron",     // pour compatibilité
    "dendritic": "neuron",
    
    // CORAL (corail)
    "corail": "coral",
    "coral": "coral",
    "branching": "coral",        // alias
    "ramifié": "coral",
    "en corail": "coral",
    
    // MYCELIUM (mycélium)
    "mycélien": "mycelium",
    "mycélium": "mycelium",
    "champignon": "mycelium",
    "mycelial": "mycelium",
    "réseau fongique": "mycelium",
    "hyphe": "mycelium",
    
    // TISSU (tissu) – déjà présent
    "tissu": "tissue",
    "tissulaire": "tissue",
    "éponge": "tissue",
    "tissu conjonctif": "tissue",
    "tissu mou": "tissue",
    "parenchyme": "tissue",
    "stroma": "tissue",
    "matrice extracellulaire": "tissue",
    
    // EPITHELIAL (épithélial)
    "épithélial": "epithelial",
    "épithélium": "epithelial",
    "epithelial": "epithelial",
    "cellule épithéliale": "epithelial",
    "tissu épithélial": "epithelial",
    
    // OSTEOCYTE (ostéocyte)
    "ostéocyte": "osteocyte",
    "osteocyte": "osteocyte",
    "cellule osseuse": "osteocyte",
    "trabéculaire": "osteocyte",    // double mapping possible
    
    // FOLLICULAR
    "folliculaire": "follicular",
    "follicule": "follicular",
    "glande": "follicular",
    "follicule pileux": "follicular",
    "glandulaire": "follicular",
    
    // FRACTAL ORGANIC
    "fractal": "fractalOrganic",
    "auto-similaire": "fractalOrganic",
    "fractale": "fractalOrganic",
    "fractal organique": "fractalOrganic",
    "auto-similitud": "fractalOrganic",
    "géométrie fractale": "fractalOrganic",
    "répétition d'échelle": "fractalOrganic",
    
    // CELLULAR
    "cellulaire": "cellular",
    "alvéolaire": "cellular",
    "cellule": "cellular",
    "microstructure": "cellular",
    "cellules": "cellular",
    "alvéole": "cellular",
    "honeycomb": "cellular",
    "nid d'abeille": "cellular",
    "poreux cellulaire": "cellular",
    
    // NODULAR
    "nodulaire": "nodular",
    "nodule": "nodular",
    "tubercule": "nodular",
    "kyste": "nodular",
    "nodulosité": "nodular",
    "granulome": "nodular",
    "lobule": "nodular",
    "glomérule": "nodular",
    
    // GELATINOUS
    "gelatinieux": "gelatinous",
    "gelée": "gelatinous",
    "muqueux": "gelatinous",
    "gluant": "gelatinous",
    "gelatineux": "gelatinous",
    "viscoélastique": "gelatinous",
    
    // GRANULAR
    "granulaire": "granular",
    "grain": "granular",
    "poudreux": "granular",
    "granulé": "granular",
    "granuleux": "granular",
    "sablé": "granular",
    "sablonneux": "granular",
    "grains": "granular",
    
    // MEMBRANE
    "membrane": "membrane",
    "enveloppe": "membrane",
    "peau": "membrane",
    "pellicule": "membrane",
    "membrane plasmique": "membrane",
    "feuillet": "membrane",
    "épiderme": "membrane",
    "derme": "membrane",
    "cuticule": "membrane",
    
    // FIBROUS
    "fibreux": "fibrous",
    "filamenteux": "fibrous",
    "fibre": "fibrous",
    "câble": "fibrous",
    "fibreux collagène": "fibrous",
    "tissu fibreux": "fibrous",
    "fibrillaire": "fibrous",
    
    // AMORPHOUS
    "amorphe": "amorphous",
    "sans forme": "amorphous",
    "informe": "amorphous",
    "non structuré": "amorphous",
    "diffus": "amorphous",
    "homogène": "amorphous",
    
    // BLOB
    "blob": "blob",
    "masse": "blob",
    "goutte": "blob",
    "lobe": "blob",
    "amas": "blob",
    "agrégat": "blob",
    
    // ORGANOID
    "organoïde": "organoid",
    "organoid": "organoid",
    "culture organoïde": "organoid"
};

// --- MATÉRIAUX --- (inchangé)
const MATERIAL_MAP = {
    "calcifié": "calcified",
    "calcaire": "calcified",
    "minéralisé": "calcified",
    "os": "calcified",
    "osseux": "calcified",
    "dur": "calcified",
    "pierreux": "calcified",
    "mou": "soft",
    "souple": "soft",
    "malléable": "soft",
    "tendre": "soft",
    "doux": "soft",
    "cotonneux": "soft",
    "visqueux": "viscous",
    "gluant": "viscous",
    "poisseux": "viscous",
    "collant": "viscous",
    "pâteux": "viscous",
    "dense": "dense",
    "compact": "dense",
    "solide": "dense",
    "plein": "dense",
    "massif": "dense",
    "poreux": "porous",
    "aéré": "porous",
    "perforé": "porous",
    "alvéolaire": "porous",
    "troué": "porous",
    "cavitaire": "porous",
    "irrégulier": "irregular",
    "chaotique": "irregular",
    "rugueux": "irregular",
    "accidenté": "irregular",
    "tourmenté": "irregular",
    "tourmentée": "irregular",
    "fluide": "fluid",
    "liquide": "fluid",
    "coulant": "fluid",
    "aqueux": "fluid",
    "hydrique": "fluid",
    "semi-solide": "semisolid",
    "gel": "semisolid",
    "gélifié": "semisolid",
    "crémeux": "semisolid",
    "pâte semi-solide": "semisolid",
    "élastique": "elastic",
    "extensible": "elastic",
    "caoutchouteux": "elastic",
    "flexible": "elastic",
    "hydrophobe": "hydrophobic",
    "imperméable": "hydrophobic",
    "lipidique": "hydrophobic",
    "graisseux": "hydrophobic",
    "huileux": "hydrophobic"
};

// --- COMPORTEMENTS --- (inchangé)
const BEHAVIOR_MAP = {
    "régénération": "regeneration",
    "cicatrisation": "healing",
    "réparation": "healing",
    "guérison": "healing",
    "rétablissement": "healing",
    "anastomose": "anastomosis",
    "fusion vasculaire": "anastomosis",
    "connexion": "anastomosis",
    "jonction": "anastomosis",
    "réseautage": "anastomosis",
    "pulsation": "pulsation",
    "battement": "pulsation",
    "palpitation": "pulsation",
    "vibration rythmique": "pulsation",
    "croissance": "growth",
    "prolifération": "growth",
    "expansion": "growth",
    "augmentation": "growth",
    "développement": "growth",
    "accroissement": "growth",
    "contraction": "contraction",
    "rétrécissement": "contraction",
    "compression": "contraction",
    "resserrement": "contraction",
    "mutation": "mutation",
    "dégénérescence": "mutation",
    "cancéreux": "mutation",
    "parasitaire": "mutation",
    "transformation": "mutation",
    "altération": "mutation",
    "fusion": "fusion",
    "coalescence": "coalescence",
    "syncytium": "fusion",
    "union": "fusion",
    "mélange": "fusion",
    "respiration": "respiration",
    "respiration cellulaire": "respiration",
    "échange gazeux": "respiration",
    "déformation": "deformation",
    "distorsion": "deformation",
    "torsion": "deformation",
    "vrillage": "deformation",
    "flexion": "deformation",
    "cambrage": "deformation",
    "nécrose": "necrosis",
    "mort cellulaire": "necrosis",
    "nécrotique": "necrosis",
    "dépérissement": "necrosis",
    "différenciation": "differentiation",
    "spécialisation": "differentiation",
    "maturation": "differentiation",
    "mitose": "mitosis",
    "division cellulaire": "mitosis",
    "multiplication": "mitosis",
    "apoptose": "apoptosis",
    "mort programmée": "apoptosis",
    "suicide cellulaire": "apoptosis",
    "ondulation": "undulation",
    "onde": "undulation",
    "vague": "undulation",
    "fluctuation": "undulation",
    "hypertrophie": "hypertrophy",
    "grossissement": "hypertrophy",
    "augmentation de volume": "hypertrophy",
    "dysplasie": "dysplasia",
    "désorganisation cellulaire": "dysplasia",
    "anomalie structurale": "dysplasia",
    "sporulation": "sporulation",
    "spore": "sporulation",
    "formation de spores": "sporulation",
    "chimiotaxie": "chemotaxis",
    "chimiotactisme": "chemotaxis",
    "attiré chimique": "chemotaxis",
    "gradient chimique": "chemotaxis",
    "haptotaxie": "haptotaxis",
    "aptotaxie": "haptotaxis",
    "adhésion": "haptotaxis",
    "collant": "haptotaxis",
    "substrat": "haptotaxis",
    "symbiose": "symbiosis",
    "symbiotique": "symbiosis",
    "association bénéfique": "symbiosis",
    "parasitisme": "parasitism",
    "parasite": "parasitism",
    "exploitation": "parasitism",
    "coalescence progressive": "coalescence"
};

// --- DYNAMIQUES TEMPORELLES --- (inchangé)
const DYNAMICS_MAP = {
    "pulsation lente": "pulsation_slow",
    "pulsation rapide": "pulsation_fast",
    "pulsation": "pulsation",
    "respiration rythmique": "respiration",
    "respiration": "respiration",
    "mutation progressive": "progressiveMutation",
    "métamorphose": "metamorphosis",
    "morphing": "morphing",
    "oscillation": "oscillation",
    "onde mécanique": "wavePropagation",
    "croissance animée": "animatedGrowth",
    "croissance progressive": "animatedGrowth",
    "animation de croissance": "animatedGrowth",
    "vibration": "oscillation",
    "balancement": "oscillation",
    "déformation cyclique": "wavePropagation"
};

// --- INTENSITÉ --- (inchangé)
const INTENSITY_MAP = {
    "très faible": 0.2,
    "faible": 0.4,
    "léger": 0.4,
    "doux": 0.4,
    "timide": 0.3,
    "modéré": 0.8,
    "moyen": 0.8,
    "normal": 0.8,
    "raisonnable": 0.8,
    "fort": 1.5,
    "prononcé": 1.5,
    "intense": 1.5,
    "marqué": 1.5,
    "très fort": 2.0,
    "extrême": 2.5,
    "violent": 2.5,
    "apocalyptique": 2.5,
    "mutagène": 3.0,
    "cataclysmique": 3.0,
    "explosif": 3.0,
    "énorme": 2.2,
    "massif": 2.0,
    "mineur": 0.5,
    "soft": 0.4
};

// --- SUBDIVISION --- (inchangé)
const SUBDIVISION_MAP = {
    "subdivision élevée": "high",
    "haute subdivision": "high",
    "très subdivisé": "high",
    "subdivision moyenne": "medium",
    "subdivision faible": "low",
    "peu subdivisé": "low",
    "aucune subdivision": "none",
    "subdivision max": "high",
    "subdivision haute": "high",
    "subdivision basse": "low"
};

// --- CHIMIOTAXIE / HAPTOTAXIE --- (inchangé)
const CHEMOTAXIS_MAP = {
    "aptotaxie": "haptotaxis",
    "haptotaxie": "haptotaxis",
    "chimiotaxie": "chemotaxis",
    "chimiotactisme": "chemotaxis",
    "vers la périphérie": "outward",
    "vers l'extérieur": "outward",
    "vers le centre": "inward",
    "vers l'intérieur": "inward",
    "en périphérie": "peripheral"
};

// --- PRIMITIVES SDF --- (inchangé)
const PRIMITIVE_MAP = {
    "sphère": "sphere",
    "boule": "sphere",
    "globe": "sphere",
    "cube": "box",
    "boîte": "box",
    "bloc": "box",
    "parallélépipède": "box",
    "cylindre": "cylinder",
    "tube": "cylinder",
    "colonne": "cylinder",
    "capsule": "capsule",
    "gélule": "capsule",
    "pilule": "capsule",
    "tore": "torus",
    "anneau": "torus",
    "donut": "torus",
    "plan": "plane",
    "surface": "plane",
    "disque": "plane",
    "cône": "cone",
    "pyramide": "pyramid",
    "tétraèdre": "pyramid",
    "ellipsoïde": "ellipsoid",
    "ovoïde": "ellipsoid",
    "œuf": "ellipsoid",
    "boîte arrondie": "rounded_box",
    "cube lissé": "rounded_box"
};

// --- FORCE FIELDS --- (inchangé)
const FORCE_FIELD_MAP = {
    "vortex": "vortex",
    "tourbillon": "vortex",
    "courant": "vortex",
    "flux": "vortex",
    "champ magnétique": "magnetic",
    "gravité": "gravity",
    "attraction": "gravity"
};

// ============ FONCTIONS D'EXTRACTION GÉNÉRIQUES ============
function extractFirstMatch(text, map, defaultValue) {
    const lower = text.toLowerCase();
    const sortedKeys = Object.keys(map).sort((a,b) => b.length - a.length);
    for (const fr of sortedKeys) {
        if (lower.includes(fr)) return map[fr];
    }
    return defaultValue;
}

function extractAllMatches(text, map, max = null) {
    const lower = text.toLowerCase();
    const found = new Set();
    const sortedKeys = Object.keys(map).sort((a,b) => b.length - a.length);
    for (const fr of sortedKeys) {
        if (lower.includes(fr)) found.add(map[fr]);
    }
    let arr = Array.from(found);
    if (max !== null && arr.length > max) arr = arr.slice(0, max);
    return arr;
}

function extractIntensity(text) {
    const lower = text.toLowerCase();
    for (const [fr, val] of Object.entries(INTENSITY_MAP)) {
        if (lower.includes(fr)) return val;
    }
    if (lower.includes("très") && lower.includes("fort")) return 2.0;
    if (lower.includes("légèrement")) return 0.5;
    if (lower.includes("un peu")) return 0.5;
    if (lower.includes("extrêmement")) return 2.8;
    return CONFIG.defaultIntensity;
}

function extractSubdivisionLevel(text) {
    const lower = text.toLowerCase();
    for (const [fr, level] of Object.entries(SUBDIVISION_MAP)) {
        if (lower.includes(fr)) {
            if (level === "high") return 2;
            if (level === "medium") return 1;
            return 0;
        }
    }
    if (lower.includes("fractal") || lower.includes("dendritique") || lower.includes("complexe")) return 2;
    if (lower.includes("ramifié") || lower.includes("branching") || lower.includes("détaillé")) return 1;
    return CONFIG.defaultSubdivision;
}

function extractChemotaxis(text) {
    const lower = text.toLowerCase();
    let type = CONFIG.defaultChemotaxis;
    let direction = null;
    for (const [fr, val] of Object.entries(CHEMOTAXIS_MAP)) {
        if (lower.includes(fr)) {
            if (val === "haptotaxis" || val === "chemotaxis") type = val;
            else direction = val;
        }
    }
    if (type !== "none" && !direction) direction = "outward";
    return { type, direction };
}

function extractForceField(text) {
    const lower = text.toLowerCase();
    for (const [fr, val] of Object.entries(FORCE_FIELD_MAP)) {
        if (lower.includes(fr)) return val;
    }
    const chem = extractChemotaxis(text);
    if (chem.type !== "none") return chem.type;
    return CONFIG.defaultForceField;
}

function extractPulsation(text) {
    const lower = text.toLowerCase();
    if (!lower.includes("pulsation")) return null;
    let speed = "normal";
    let intensity = "normal";
    if (lower.includes("lente")) speed = "slow";
    if (lower.includes("rapide")) speed = "fast";
    if (lower.includes("forte")) intensity = "strong";
    else if (lower.includes("modérée")) intensity = "moderate";
    return { speed, intensity };
}

function extractEmergence(text, features) {
    let level = 0;
    if (features.dominant === "fractalOrganic" || features.dominant === "neuron") level += 1;
    if (features.secondary.length >= 2) level += 1;
    if (features.behaviors.length >= 3) level += 1;
    if (features.intensity > 1.2) level += 1;
    if (text.includes("émergent") || text.includes("auto-organisé")) level += 0.5;
    return Math.min(Math.floor(level), 2);
}

// ============ FONCTION PRINCIPALE : EXTRACTION TOTALE ============
function extractAllFeatures(promptFr) {
    const text = promptFr.toLowerCase();
    
    let dominant = extractFirstMatch(text, MORPHO_MAP, CONFIG.defaultMorphology);
    let secondary = extractAllMatches(text, MORPHO_MAP, CONFIG.maxSecondaryMorphologies);
    secondary = secondary.filter(m => m !== dominant);
    
    let material = extractFirstMatch(text, MATERIAL_MAP, CONFIG.defaultMaterial);
    let calcified = material === "calcified" || text.includes("calcifiée") || text.includes("minéralisé") || text.includes("calcaire") || text.includes("os");
    
    let behaviors = extractAllMatches(text, BEHAVIOR_MAP, CONFIG.maxBehaviors);
    if (behaviors.length === 0) behaviors.push(CONFIG.defaultBehavior);
    behaviors = [...new Set(behaviors)];
    
    let dynamics = extractAllMatches(text, DYNAMICS_MAP, 2);
    if (dynamics.length === 0) dynamics.push(CONFIG.defaultDynamic);
    
    let intensity = extractIntensity(text);
    let subdivision = extractSubdivisionLevel(text);
    let chemotaxis = extractChemotaxis(text);
    let forceField = extractForceField(text);
    let pulsation = extractPulsation(text);
    
    let regeneration = behaviors.includes("regeneration") || text.includes("régénération");
    let anastomosis = behaviors.includes("anastomosis") || text.includes("anastomose");
    let symbiosis = behaviors.includes("symbiosis");
    let parasitism = behaviors.includes("parasitism");
    
    let primitive = extractFirstMatch(text, PRIMITIVE_MAP, CONFIG.defaultPrimitive);
    
    let emergence = extractEmergence(text, { dominant, secondary, behaviors, intensity });
    
    // Flag Python requis pour les morphologies complexes (mapping explicite)
    const pythonMorphologies = [
        "trabecular", "vascular", "neuron", "coral", "mycelium",
        "tissue", "epithelial", "osteocyte", "organoid",
        "deepVascular", "dendritic", "mycelial", "follicular", "fractalOrganic"
    ];
    const requiresPython = pythonMorphologies.includes(dominant);
    
    return {
        primitive,
        dominantMorphology: dominant,
        secondaryMorphologies: secondary,
        material,
        calcified,
        behaviors,
        dynamics,
        intensity,
        subdivision,
        chemotaxis,
        forceField,
        pulsation,
        regeneration,
        anastomosis,
        symbiosis,
        parasitism,
        emergence,
        requiresPython,
        rawPrompt: promptFr
    };
}

// ============ CONVERSION VERS LE FORMAT ATTENDU PAR ORGANIC ============
function toOrganicTokens(features) {
    const morphStr = features.dominantMorphology;
    const secondStr = features.secondaryMorphologies.join(",");
    const behaviorsStr = features.behaviors.join(",");
    const materialsStr = features.material;
    const dynamicsStr = features.dynamics.join(",");
    const intensityStr = features.intensity.toFixed(2);
    const subdivisionStr = features.subdivision.toString();
    const chemotaxisStr = features.chemotaxis.type !== "none" 
        ? `${features.chemotaxis.type}_${features.chemotaxis.direction}` 
        : "none";
    const forceFieldStr = features.forceField !== "none" ? features.forceField : "none";
    const pulsationStr = features.pulsation 
        ? `pulsation_${features.pulsation.speed}_${features.pulsation.intensity}` 
        : "none";
    const calcifiedStr = features.calcified ? "calcified" : "not_calcified";
    const regenerationStr = features.regeneration ? "regeneration_active" : "regeneration_off";
    const anastomosisStr = features.anastomosis ? "anastomosis_active" : "anastomosis_off";
    const symbiosisStr = features.symbiosis ? "symbiosis_active" : "symbiosis_off";
    const parasitismStr = features.parasitism ? "parasitism_active" : "parasitism_off";
    const emergenceStr = features.emergence.toString();
    const pythonFlag = features.requiresPython ? "python_required" : "python_not_required";
    
    return `primitive:${features.primitive}, morphologie dominante:${morphStr}, morphologies secondaires:${secondStr}, comportements:[${behaviorsStr}], matières:[${materialsStr}], dynamiques:[${dynamicsStr}], intensité:${intensityStr}, subdivision:${subdivisionStr}, chemotaxis:${chemotaxisStr}, forceField:${forceFieldStr}, pulsation:${pulsationStr}, calcifié:${calcifiedStr}, régénération:${regenerationStr}, anastomose:${anastomosisStr}, symbiose:${symbiosisStr}, parasitisme:${parasitismStr}, emergence:${emergenceStr}, python:${pythonFlag}, description:${features.rawPrompt}`;
}

function toOrganicObject(features) {
    return {
        success: true,
        spec: {
            primitive: features.primitive,
            morphology: {
                dominant: features.dominantMorphology,
                secondary: features.secondaryMorphologies
            },
            material: {
                type: features.material,
                calcified: features.calcified
            },
            behaviors: features.behaviors,
            dynamics: features.dynamics,
            intensity: features.intensity,
            subdivision: features.subdivision,
            chemotaxis: features.chemotaxis.type !== "none" ? {
                type: features.chemotaxis.type,
                direction: features.chemotaxis.direction
            } : null,
            forceField: features.forceField !== "none" ? features.forceField : null,
            pulsation: features.pulsation ? {
                speed: features.pulsation.speed,
                intensity: features.pulsation.intensity
            } : null,
            regeneration: features.regeneration,
            anastomosis: features.anastomosis,
            symbiosis: features.symbiosis,
            parasitism: features.parasitism,
            emergence: features.emergence,
            requiresPython: features.requiresPython,
            rawPrompt: features.rawPrompt
        }
    };
}

function ultimateTranslate(promptFr, format = "object") {
    if (!promptFr || typeof promptFr !== "string" || promptFr.trim() === "") {
        const fallbackPrompt = "une structure tissulaire simple avec croissance douce";
        const features = extractAllFeatures(fallbackPrompt);
        if (format === "string") return toOrganicTokens(features);
        return toOrganicObject(features);
    }
    const features = extractAllFeatures(promptFr);
    if (format === "string") return toOrganicTokens(features);
    return toOrganicObject(features);
}

// ============ COMPATIBILITÉ AVEC L'ANCIEN TRADUCTEUR ============
function translateFRtoHF5(promptFr) {
    const features = extractAllFeatures(promptFr);
    return {
        dominantMorphology: features.dominantMorphology,
        secondaryMorphologies: features.secondaryMorphologies,
        behaviors: features.behaviors,
        material: features.material,
        dynamics: features.dynamics,
        intensity: features.intensity,
        forceField: features.forceField !== "none" ? features.forceField : 
                    (features.chemotaxis.type !== "none" ? features.chemotaxis.type : "none"),
        emergence: features.emergence,
        subdivision: features.subdivision,
        requiresPython: features.requiresPython,
        prompt: promptFr
    };
}

function organicTextToParserInput(organicText, originalPrompt = null) {
    try {
        const getValue = (key, text) => {
            const regex = new RegExp(`${key}:([^,]+)(?:,|$)`);
            const match = text.match(regex);
            return match ? match[1].trim() : null;
        };
        const getArray = (key, text) => {
            const regex = new RegExp(`${key}:\\[([^\\]]*)\\]`);
            const match = text.match(regex);
            if (!match) return [];
            return match[1].split(",").filter(s => s.trim().length > 0).map(s => s.trim());
        };
        
        const primitive = getValue("primitive", organicText) || CONFIG.defaultPrimitive;
        const dominant = getValue("morphologie dominante", organicText) || CONFIG.defaultMorphology;
        const secondaryStr = getValue("morphologies secondaires", organicText) || "";
        const secondary = secondaryStr ? secondaryStr.split(",").filter(s => s) : [];
        const behaviors = getArray("comportements", organicText);
        const materials = getArray("matières", organicText);
        const dynamics = getArray("dynamiques", organicText);
        const intensityStr = getValue("intensité", organicText) || CONFIG.defaultIntensity.toString();
        const intensity = parseFloat(intensityStr);
        
        let prompt = originalPrompt || "";
        const descMatch = organicText.match(/description:(.+)$/);
        if (descMatch) prompt = descMatch[1];
        
        return {
            primitive,
            prompt,
            dominantMorphology: dominant,
            secondaryMorphologies: secondary,
            behaviors: behaviors.length ? behaviors : [CONFIG.defaultBehavior],
            materials: materials.length ? materials : [CONFIG.defaultMaterial],
            dynamics: dynamics.length ? dynamics : [CONFIG.defaultDynamic],
            intensity: isNaN(intensity) ? CONFIG.defaultIntensity : intensity
        };
    } catch(e) {
        return {
            primitive: CONFIG.defaultPrimitive,
            prompt: originalPrompt || "",
            dominantMorphology: CONFIG.defaultMorphology,
            secondaryMorphologies: [],
            behaviors: [CONFIG.defaultBehavior],
            materials: [CONFIG.defaultMaterial],
            dynamics: [CONFIG.defaultDynamic],
            intensity: CONFIG.defaultIntensity
        };
    }
}

async function translateFRtoOrganic(promptFr) {
    const str = ultimateTranslate(promptFr, "string");
    return { success: true, organicText: str, error: null };
}

// ============ EXPORTS ============
module.exports = {
    ultimateTranslate,
    toOrganicTokens,
    toOrganicObject,
    extractAllFeatures,
    translateFRtoHF5,
    translateFRtoOrganic,
    organicTextToParserInput,
    DICTIONARIES: {
        MORPHO_MAP,
        MATERIAL_MAP,
        BEHAVIOR_MAP,
        DYNAMICS_MAP,
        INTENSITY_MAP,
        SUBDIVISION_MAP,
        CHEMOTAXIS_MAP,
        PRIMITIVE_MAP,
        FORCE_FIELD_MAP
    },
    CONFIG
};