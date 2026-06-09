// parsers/organic_parser_prod_v3.js
// Version HF6.0 – Extracteur sémantique universel (version ultime étendue)

const { OrganicV6Core } = require('./organic_v6_core');

class OrganicParserProdV3 {
    constructor() {
        // ========== LEXIQUES ULTRA-COMPLETS ==========
        this.morphologies = {
            // Primitives (rarement utilisées directement)
            sphere: ["sphère", "sphérique", "boule", "ball", "globe", "sphere", "rond", "arrondi"],
            capsule: ["capsule", "gélule", "pilule", "capsule", "cigare", "oblong"],
            cylinder: ["cylindre", "cylinder", "tube", "tuyau", "colonne", "tige", "barre"],
            torus: ["tore", "anneau", "donut", "torus", "bague"],
            plane: ["plan", "surface", "plane", "feuille", "disque", "plateforme"],
            cone: ["cône", "cone", "pyramide ronde", "entonnoir"],
            
            // Morphologies organiques principales
            coral: ["corail", "coral", "récif", "branchage", "ramifié corail"],
            tree: ["arbre", "tree", "végétal", "branchu", "frondaison", "chêne", "pin"],
            plant: ["plante", "plant", "végétation", "herbe", "fleur", "tige", "feuille"],
            root: ["racine", "root", "radicelle", "rhizome", "racinaire"],
            mycelial: ["mycélium", "mycelial", "champignon", "filament fongique", "moisissure", "fongique"],
            vascular: ["vasculaire", "réseau vasculaire", "sang", "veine", "artère", "capillaire", "vaisseau", "circulation"],
            neural: ["neurone", "neural", "synapse", "axone", "dendrite", "cerveau", "nerveux", "cellule nerveuse"],
            trabecular: ["trabéculaire", "os spongieux", "trabecular", "spongieux", "osseux"],
            cellular: ["cellulaire", "alvéolaire", "cellule", "microstructure", "honeycomb", "nid d'abeille", "éponge"],
            nodular: ["nodulaire", "nodule", "tubercule", "bouton", "kyste", "granulome"],
            fibrous: ["fibreux", "filamenteux", "fibre", "câble", "tissu fibreux", "collagène"],
            membrane: ["membrane", "enveloppe", "peau", "pellicule", "épiderme", "derme", "cuticule"],
            porous: ["poreux", "perforé", "aéré", "cavitaire", "alvéolé"],
            gelatinous: ["gélatineux", "gelée", "muqueux", "gluant", "visqueux"],
            granular: ["granulaire", "grain", "poudreux", "sablé", "granulé"],
            fractal: ["fractal organique", "fractale", "auto-similaire", "fractal"],
            blob: ["blob", "masse", "goutte", "lobe", "amas", "agrégat"],
            amorphous: ["amorphe", "informe", "sans forme", "diffus"],
            follicular: ["follicule", "folliculaire", "glande", "pore sébacé"],
            epithelial: ["épithélial", "épithélium", "epithelial", "tissu épithélial"],
            muscle: ["muscle", "musculaire", "strié", "lisse"],
            bone: ["os", "osseux", "bone", "squelettique", "calcifié"],
            cartilage: ["cartilage", "cartilagineux"],
            skin: ["peau", "épiderme", "derme", "skin", "cutanée"],
            organ: ["organe", "foie", "rein", "cœur", "poumon", "cerveau", "organ"],
            tumor: ["tumeur", "cancer", "kyste", "nodule", "tumor", "cancéreux"]
        };

        this.behaviors = {
            growth: ["croissance", "growth", "prolifération", "expansion", "développement", "accroissement"],
            contraction: ["contraction", "rétrécissement", "compression", "resserrement"],
            mutation: ["mutation", "dégénéré", "parasitaire", "cancéreux", "transformation", "altération"],
            fusion: ["fusion", "coalescence", "syncytium", "union", "mélange"],
            respiration: ["respiration", "pulsation", "battement", "oscillation", "rythmique"],
            deformation: ["déformation", "distorsion", "torsion", "tordu", "flexion", "vrillage"],
            necrosis: ["nécrose", "mort cellulaire", "nécrotique", "dépérissement"],
            healing: ["cicatrisation", "réparation", "régénération", "guérison"],
            differentiation: ["différenciation", "spécialisation", "maturation"],
            mitosis: ["mitose", "division cellulaire", "multiplication"],
            apoptosis: ["apoptose", "mort programmée", "suicide cellulaire"],
            undulation: ["ondulation", "ondulé", "vague", "wave", "fluctuation"],
            coalescence: ["coalescence", "fusion progressive"],
            hypertrophy: ["hypertrophie", "augmentation volume", "grossissement"],
            dysplasia: ["dysplasie", "désorganisation cellulaire", "anomalie structurale"],
            peristalsis: ["péristaltisme", "onde péristaltique", "contraction rythmique"],
            chemotaxis: ["chimiotaxie", "gradient chimique", "attiré chimique"],
            haptotaxis: ["haptotaxie", "adhésion", "collant", "substrat"],
            anastomosis: ["anastomose", "fusion vasculaire", "connexion", "jonction"],
            sporulation: ["sporulation", "spore", "formation de spores"],
            symbiosis: ["symbiose", "symbiotique", "association bénéfique"],
            parasitism: ["parasitisme", "parasite", "exploitation"],
            regeneration: ["régénération", "réparation tissulaire", "cicatrisation"],
            aging: ["vieillissement", "vieilli", "âgé", "senescence", "old"],
            inflammation: ["inflammation", "inflammé", "rougeur", "gonflement"],
            calcification: ["calcification", "calcifié", "minéralisation", "calcaire"]
        };

        this.materials = {
            soft: ["mou", "souple", "malléable", "tendre", "doux", "cotonneux"],
            viscous: ["visqueux", "gluant", "poisseux", "collant"],
            dense: ["dense", "compact", "solide", "ferme", "massif"],
            porous: ["poreux", "poreuse", "perforé", "aéré", "alvéolaire", "cavitaire"],
            irregular: ["irrégulier", "irrégulière", "chaotique", "rugueux", "accidenté"],
            fluid: ["fluide", "liquide", "coulant", "aqueux", "hydrique"],
            semisolid: ["semi-solide", "gel", "pâteux", "crémeux", "gélifié"],
            fibrous: ["fibreux", "fibreuse", "filamenteux", "tissé", "fibrillaire"],
            calcified: ["calcifié", "calcaire", "os", "minéralisé", "pierreux", "dur"],
            elastic: ["élastique", "extensible", "caoutchouteux", "flexible"],
            hydrophobic: ["hydrophobe", "barrière", "lipidique", "imperméable", "graisseux"],
            gelatinous: ["gélatineux", "gelée", "muqueux", "viscoélastique"],
            bone: ["osseux", "squelettique", "calcaire", "dur"],
            cartilage: ["cartilagineux", "cartilage", "souple mais ferme"],
            muscle: ["musculaire", "charnu", "strié"],
            skin: ["cutané", "épidermique", "peau"],
            nervous: ["nerveux", "neuronal", "synaptique"]
        };

        this.temporalDynamics = {
            animatedGrowth: ["croissance animée", "croissance progressive", "développement animé"],
            pulsation: ["pulsation", "battement rythmique", "palpitation"],
            respiration: ["respiration rythmique", "cycle respiratoire", "expansion"],
            progressiveMutation: ["mutation progressive", "métamorphose", "évolution"],
            oscillation: ["oscillation douce", "balancement", "vibration"],
            morphing: ["morphing", "transition morphologique", "changement forme"],
            metamorphosis: ["métamorphose", "transformation complète"],
            wavePropagation: ["onde mécanique", "propagation", "vague de déformation"],
            peristalsis: ["péristaltisme", "contraction ondulante"]
        };

        this.intensityMap = [
            { words: ["doux", "léger", "faible", "timide", "soft", "light"], factor: 0.4 },
            { words: ["modéré", "moyen", "normal", "raisonnable", "moderate", "medium"], factor: 0.8 },
            { words: ["fort", "prononcé", "intense", "marqué", "strong", "intense"], factor: 1.5 },
            { words: ["extrême", "violent", "apocalyptique", "démesuré", "extreme", "violent"], factor: 2.5 },
            { words: ["mutagène", "cataclysmique", "explosif", "mutagenic"], factor: 3.5 }
        ];

        this.implicitPatterns = [
            { pattern: /(corail|arbre|plante|racine|champignon)/i, features: { branching: 2.0, fractal: 1.0, growth: 1.0, organic: 1.0 } },
            { pattern: /(tumeur|cancer|kyste)/i, features: { nodular: 2.0, cellular: 1.0, mutation: 1.5, tumor: 1.0 } },
            { pattern: /(sang|vaisseau|artère|veine|circulation)/i, features: { vascular: 2.0, branching: 1.0, pulsation: 1.0 } },
            { pattern: /(peau|épiderme|derme)/i, features: { membrane: 2.0, soft: 1.0, healing: 1.0 } },
            { pattern: /(neurone|dendrite|axone|synapse|cerveau)/i, features: { neural: 2.0, branching: 1.5, differentiation: 1.0 } },
            { pattern: /(os spongieux|trabécule|calcaire)/i, features: { trabecular: 2.0, hard: 1.5, porous: 1.0, bone: 1.0 } },
            { pattern: /(champignon|mycélium|moisissure)/i, features: { mycelial: 2.0, sporulation: 1.5, branching: 1.0 } },
            { pattern: /(cellule|tissu|éponge)/i, features: { cellular: 1.5, porous: 1.0 } },
            { pattern: /(fibre|fibreux|collagène)/i, features: { fibrous: 2.0 } },
            { pattern: /(gel|gelée|gluant)/i, features: { gelatinous: 2.0, fluid: 1.0 } },
            { pattern: /(vague|ondulation)/i, features: { undulation: 2.0, membrane: 1.0 } },
            { pattern: /(régénération|cicatrisation)/i, features: { healing: 2.0, growth: 1.0 } },
            { pattern: /(vieillissement|vieux|âgé)/i, features: { old: 2.0, aging: 1.0 } },
            { pattern: /(jeune|sain)/i, features: { young: 2.0 } },
            { pattern: /(stress|inflammation)/i, features: { stressed: 2.0, inflammation: 1.0 } },
            { pattern: /(foie|rein|cœur|poumon)/i, features: { organ: 2.0, vascular: 1.0 } },
            { pattern: /(muscle)/i, features: { muscle: 2.0, fibrous: 1.0 } },
            { pattern: /(cartilage)/i, features: { cartilage: 2.0, soft: 1.0 } }
        ];

        this.rngSeed = null;
        this.organicCore = new OrganicV6Core(() => this.random());
        this.useV6 = true;
    }

    setSeed(seed) { this.rngSeed = seed; }
    random() {
        if (this.rngSeed !== null) {
            this.rngSeed = (this.rngSeed * 1664525 + 1013904223) >>> 0;
            return this.rngSeed / 4294967296;
        }
        return Math.random();
    }
    randRange(min, max) { return min + this.random() * (max - min); }

    tokenize(text) {
        return text.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .split(/[\s,.;:!?()]+/)
            .filter(t => t.length > 0);
    }

    computeSemanticScores(text) {
        const scores = {
            branching: 0, cellular: 0, fractal: 0, vascular: 0, neural: 0,
            mycelial: 0, trabecular: 0, fibrous: 0, membrane: 0, nodular: 0, porous: 0,
            soft: 0, hard: 0, fluid: 0, gelatinous: 0,
            pulsation: 0, growth: 0, mutation: 0,
            young: 0, old: 0, stressed: 0,
            coral: 0, tree: 0, plant: 0, root: 0,
            bone: 0, cartilage: 0, muscle: 0, skin: 0, organ: 0, tumor: 0,
            healing: 0, inflammation: 0, aging: 0, calcification: 0
        };
        const lower = text.toLowerCase();

        // Morphologies
        for (const [feat, words] of Object.entries(this.morphologies)) {
            let score = 0;
            for (const w of words) if (lower.includes(w)) score += 1;
            if (score > 0) {
                if (feat === 'branching' || feat === 'dendritic' || feat === 'coral' || feat === 'tree' || feat === 'plant' || feat === 'root') {
                    scores.branching += score;
                    if (feat === 'coral') scores.coral += score;
                    if (feat === 'tree') scores.tree += score;
                    if (feat === 'plant') scores.plant += score;
                    if (feat === 'root') scores.root += score;
                } else if (feat === 'cellular') scores.cellular += score;
                else if (feat === 'fractal') scores.fractal += score;
                else if (feat === 'vascular') scores.vascular += score;
                else if (feat === 'mycelial') scores.mycelial += score;
                else if (feat === 'trabecular') scores.trabecular += score;
                else if (feat === 'fibrous') scores.fibrous += score;
                else if (feat === 'membrane') scores.membrane += score;
                else if (feat === 'nodular') scores.nodular += score;
                else if (feat === 'porous') scores.porous += score;
                else if (feat === 'gelatinous') scores.gelatinous += score;
                else if (feat === 'bone') scores.bone += score;
                else if (feat === 'cartilage') scores.cartilage += score;
                else if (feat === 'muscle') scores.muscle += score;
                else if (feat === 'skin') scores.skin += score;
                else if (feat === 'organ') scores.organ += score;
                else if (feat === 'tumor') scores.tumor += score;
                else if (feat === 'soft' || feat === 'viscous' || feat === 'semisolid' || feat === 'elastic' || feat === 'gelatinous') scores.soft += score;
                else if (feat === 'calcified' || feat === 'dense' || feat === 'bone') scores.hard += score;
                else if (feat === 'fluid') scores.fluid += score;
            }
        }

        // Behaviors
        for (const [feat, words] of Object.entries(this.behaviors)) {
            let score = 0;
            for (const w of words) if (lower.includes(w)) score += 1;
            if (score > 0) {
                if (feat === 'growth') scores.growth += score;
                else if (feat === 'mutation') scores.mutation += score;
                else if (feat === 'respiration') scores.pulsation += score;
                else if (feat === 'undulation') scores.pulsation += score;
                else if (feat === 'differentiation') scores.cellular += score;
                else if (feat === 'healing') scores.healing += score;
                else if (feat === 'inflammation') scores.inflammation += score;
                else if (feat === 'aging') scores.aging += score;
                else if (feat === 'calcification') scores.calcification += score;
                else if (feat === 'peristalsis') scores.pulsation += score;
            }
        }

        // Materials
        for (const [feat, words] of Object.entries(this.materials)) {
            let score = 0;
            for (const w of words) if (lower.includes(w)) score += 1;
            if (score > 0) {
                if (feat === 'soft') scores.soft += score;
                else if (feat === 'calcified' || feat === 'bone') scores.hard += score;
                else if (feat === 'fluid') scores.fluid += score;
                else if (feat === 'gelatinous') scores.gelatinous += score;
                else if (feat === 'fibrous') scores.fibrous += score;
                else if (feat === 'porous') scores.porous += score;
            }
        }

        // Temporal dynamics
        for (const [feat, words] of Object.entries(this.temporalDynamics)) {
            let score = 0;
            for (const w of words) if (lower.includes(w)) score += 1;
            if (score > 0) {
                if (feat === 'pulsation') scores.pulsation += score;
                else if (feat === 'animatedGrowth') scores.growth += score;
            }
        }

        // Patterns
        for (const rule of this.implicitPatterns) {
            if (rule.pattern.test(text)) {
                for (const [feat, val] of Object.entries(rule.features)) {
                    if (scores.hasOwnProperty(feat)) scores[feat] += val;
                }
            }
        }

        for (const k of Object.keys(scores)) scores[k] = Math.min(scores[k], 3.0);
        return scores;
    }

    computeIntensity(text, scores) {
        let intensity = 1.0;
        for (const level of this.intensityMap)
            for (const w of level.words)
                if (text.includes(w)) { intensity = level.factor; break; }
        if (scores.mutation > 0) intensity *= (1 + Math.min(scores.mutation * 0.2, 1.0));
        if (scores.growth > 1) intensity *= 1.1;
        if (scores.old > 1) intensity *= 1.1;
        if (scores.stressed > 1) intensity *= 1.05;
        return Math.min(Math.max(intensity, 0.3), 3.5);
    }

    getDominantMorphology(scores) {
        const candidates = [
            { name: 'coral', score: scores.coral + scores.branching * 0.8 },
            { name: 'tree', score: scores.tree + scores.branching * 0.8 },
            { name: 'plant', score: scores.plant + scores.branching * 0.5 },
            { name: 'root', score: scores.root + scores.branching * 0.6 },
            { name: 'mycelial', score: scores.mycelial + scores.branching * 0.5 },
            { name: 'vascular', score: scores.vascular + scores.branching * 0.3 },
            { name: 'neural', score: scores.neural + scores.branching * 0.4 },
            { name: 'trabecular', score: scores.trabecular + scores.bone },
            { name: 'cellular', score: scores.cellular + scores.porous },
            { name: 'fibrous', score: scores.fibrous },
            { name: 'membrane', score: scores.membrane },
            { name: 'nodular', score: scores.nodular + scores.tumor },
            { name: 'gelatinous', score: scores.gelatinous },
            { name: 'fractal', score: scores.fractal },
            { name: 'blob', score: scores.amorphous }
        ];
        let best = candidates.reduce((a,b) => a.score > b.score ? a : b, candidates[0]);
        if (best.score < 0.5) return 'cellular';
        return best.name;
    }

   buildGrowthProfile(prompt, scores, intensity) {
    // === EXTRACTION MULTI-MORPHOLOGIES ===
    const morphs = this.extractMorphologies(prompt, scores);
    const allMorphs = morphs.all; // ['neuron', 'vascular', 'cellular', ...]
    const dominant = morphs.dominant;
    const secondary = morphs.secondary;

    console.log("[Parser] Composition:", allMorphs);
    console.log("[Parser] Dominant:", dominant, "| Secondaires:", secondary);

    // === CONFIGURATION COMPOSITIONNELLE ===
    // Au lieu d'un switch sur dominant, on cumule les configs
    
    let primitive = "sphere";
    let branchingEnabled = false;
    let subdivisionEnabled = false;
    let branchingDepth = Math.floor(2 + intensity * 6);
    let branchingAngle = 45;
    let branchingRadiusInitial = 0.15;
    let branchingLength = 0.3;
    let branchingLengthDecay = 0.8;
    let branchingRadiusDecay = 0.7;
    let branchingSymmetry = "radial";
    let branchingTropism = [0, -0.1, 0];
    let branchingCurvature = true;
    let branchingCurvatureStrength = 0.2;
    let apicalDominance = 0.5;
    let phototropism = 0.0;
    let gravitropism = 0.1;
    let subdivisionType = "cellular";
    let subdivisionDensity = 0.3;
    let cellRadius = 0.08 + intensity * 0.1;
    let trabecularThickness = 0.05;
    let trabecularSpacing = 0.3;
    let fractalIterations = Math.floor(3 + intensity * 4);
    let materialType = "soft_tissue";
    let materialRoughness = 0.6;
    let materialMetalness = 0.0;
    let materialSubsurface = 0.3;
    let materialBaseColor = [0.8, 0.6, 0.5];
    let dynamics = null;

    // === CUMUL DES CONFIGS (comme les if Python) ===
    
    // NEURONE
    if (allMorphs.includes('neuron')) {
        branchingEnabled = true;
        branchingDepth = Math.max(branchingDepth, Math.floor(3 + intensity * 5));
        branchingAngle = 25;
        branchingRadiusInitial = Math.max(branchingRadiusInitial, 0.08);
        materialType = "nervous";
        materialBaseColor = [0.9, 0.85, 0.8];
    }

    // VASCULAR
    if (allMorphs.includes('vascular')) {
        branchingEnabled = true;
        branchingDepth = Math.max(branchingDepth, Math.floor(5 + intensity * 5));
        branchingAngle = 30;
        branchingRadiusInitial = Math.max(branchingRadiusInitial, 0.12);
        branchingSymmetry = "bilateral";
        materialType = "fluid";
        materialBaseColor = [0.9, 0.1, 0.1];
        materialRoughness = 0.3;
    }

    // CORAIL / L-SYSTEM
    if (allMorphs.includes('coral')) {
        branchingEnabled = true;
        branchingDepth = Math.max(branchingDepth, Math.floor(4 + intensity * 6));
        branchingAngle = 40;
        branchingMaxBranches = Math.max(2, 3);
        branchingSymmetry = "radial";
        phototropism = 0.2;
        gravitropism = -0.1;
        materialType = "calcified";
        materialBaseColor = [0.8, 0.5, 0.3];
    }

    // TRABECULAR / BONE
    if (allMorphs.includes('bone') || allMorphs.includes('trabecular')) {
        subdivisionEnabled = true;
        subdivisionType = "trabecular";
        subdivisionDensity = Math.max(subdivisionDensity, 0.3 + intensity * 0.4);
        trabecularThickness = 0.03 + intensity * 0.05;
        trabecularSpacing = 0.2;
        materialType = "osseous";
        materialBaseColor = [0.95, 0.9, 0.85];
        materialRoughness = 0.8;
    }

    // CELLULAR
    if (allMorphs.includes('cellular')) {
        subdivisionEnabled = true;
        subdivisionType = "cellular";
        subdivisionDensity = Math.max(subdivisionDensity, 0.5 + intensity * 0.5);
        cellRadius = 0.12;
        materialType = "epithelial";
        materialBaseColor = [0.85, 0.6, 0.5];
    }

    // FRACTAL
    if (allMorphs.includes('fractal')) {
        subdivisionEnabled = true;
        subdivisionType = "fractal";
        fractalIterations = Math.max(fractalIterations, Math.floor(3 + intensity * 5));
        materialType = "calcified";
        materialBaseColor = [0.7, 0.8, 0.9];
    }

    // MUSCLE
    if (allMorphs.includes('muscle')) {
        materialType = "muscle";
        materialBaseColor = [0.7, 0.3, 0.3];
    }

    // MEMBRANE / SKIN
    if (allMorphs.includes('membrane')) {
        primitive = "plane";
        branchingEnabled = false;
        materialType = "elastic";
        materialBaseColor = [0.9, 0.8, 0.7];
    }

    // FIBROUS
    if (allMorphs.includes('fibrous')) {
        primitive = "cylinder";
        branchingEnabled = true;
        branchingAngle = 10;
        branchingRadiusInitial = 0.05;
        materialType = "fibrous";
        materialBaseColor = [0.7, 0.5, 0.3];
    }

    // NODULAR
    if (allMorphs.includes('nodular')) {
        subdivisionEnabled = true;
        subdivisionType = "cellular";
        subdivisionDensity = 0.8;
        cellRadius = 0.15;
        materialType = "soft_tissue";
        materialBaseColor = [0.9, 0.5, 0.3];
    }

    // GELATINOUS
    if (allMorphs.includes('gelatinous')) {
        materialType = "gelatinous";
        materialBaseColor = [0.9, 0.8, 0.7];
        materialRoughness = 0.3;
    }

    // Fallback si aucune morphologie
    if (allMorphs.length === 0 || allMorphs[0] === 'tissue') {
        primitive = "sphere";
    }

    // === AJUSTEMENTS MATÉRIAUX (comme avant) ===
    if (scores.hard > scores.soft) {
        materialType = "calcified";
        materialRoughness = Math.min(0.95, materialRoughness * 1.2);
    }
    if (scores.fluid > 0.5) {
        materialType = "fluid";
        materialRoughness = 0.2;
    }
    // ... etc (garder le reste des ajustements) ...

    // === DYNAMIQUE ===
    if (scores.pulsation > 0.5) {
        dynamics = { enabled: true, type: "pulsation", speed: 0.5 + intensity * 2.0, amplitude: 0.1 };
    } else if (scores.growth > 0.5) {
        dynamics = { enabled: true, type: "animated_growth", speed: 0.5, amplitude: 0.05 };
    }

    // === CONSTRUCTION FINALE ===
    const gp = {
        name: prompt.slice(0, 50),
        version: "3.0",
        seed: this.rngSeed || 0,
        requiresPython: true,
        
        // === CLÉS POUR LE PYTHON (composition) ===
        dominantMorphology: dominant,
        secondaryMorphologies: secondary,  // ← NOUVEAU : liste des secondaires
        morphologies: allMorphs,           // ← NOUVEAU : toutes les morphologies
        
        scale: 1.0 + intensity * 0.5,
        deformation: {
            noise_octaves: 4,
            noise_amplitude: 0.1 + intensity * 0.2,
            noise_frequency: 2.0,
            warp_strength: 0.05 + intensity * 0.15,
            warp_type: "domain",
            twist_angle: 0,
            twist_axis: [0, 1, 0],
            taper_factor: 0,
            taper_axis: "y",
            inflate_amount: 0,
            smooth_amount: 0.05,
            aging_factor: scores.old > scores.young ? (scores.old * 0.3) : 0,
            disease_factor: scores.mutation > 0 ? (scores.mutation * 0.2) : 0
        },
        branching: {
            enabled: branchingEnabled,
            depth: branchingDepth,
            angle: branchingAngle,
            angle_variance: 15,
            length: branchingLength,
            length_decay: branchingLengthDecay,
            radius_initial: branchingRadiusInitial,
            radius_decay: branchingRadiusDecay,
            max_branches: 2,
            branch_probability: 0.7,
            symmetry: branchingSymmetry,
            tropism: branchingTropism,
            smoothness: 0.25,
            use_curvature: branchingCurvature,
            curvature_strength: branchingCurvatureStrength,
            apical_dominance: apicalDominance,
            phototropism: phototropism,
            gravitropism: gravitropism,
            thigmotropism: 0
        },
        subdivision: {
            enabled: subdivisionEnabled,
            type: subdivisionType,
            density: subdivisionDensity,
            cell_radius: cellRadius,
            cell_radius_variance: 0.3,
            spread: 1.5,
            smoothness: 0.2,
            trabecular_thickness: trabecularThickness,
            trabecular_spacing: trabecularSpacing,
            voronoi_sites: 50,
            fractal_iterations: fractalIterations,
            fractal_scale: 0.6,
            anisotropy: 0,
            gradient_density: false
        },
        material: {
            type: materialType,
            base_color: materialBaseColor,
            roughness: materialRoughness,
            metalness: materialMetalness,
            subsurface: materialSubsurface,
            emissive: [0, 0, 0],
            opacity: 1.0,
            ior: 1.4,
            vascularization: scores.vascular > 0 ? 0.5 : 0,
            wetness: scores.fluid > 0 ? 0.5 : 0
        },
        dynamics: dynamics,
        target_vertex_count: 50000,
        export_formats: ["obj", "ply"],
        generate_uvs: true,
        generate_normals: true,
        generate_vertex_colors: true,
        user_data: {
            scores: scores,
            intensity: intensity,
            dominant: dominant,
            secondary: secondary,
            all_morphologies: allMorphs
        }
    };
        return gp;
    }

    async parse(prompt, options = {}) {
        if (options.seed !== undefined) this.setSeed(options.seed);
        else this.rngSeed = null;
        const mode = options.mode || 'final';
        const scores = this.computeSemanticScores(prompt);
        const intensity = this.computeIntensity(prompt, scores);
        const growthProfile = this.buildGrowthProfile(prompt, scores, intensity);
        console.log("[OrganicParser] Scores extraits:", scores);
        console.log("[OrganicParser] Morphologie dominante:", growthProfile.dominantMorphology);
        console.log("[OrganicParser] GrowthProfile construit, délégation au générateur Python");
        const result = await this.organicCore.callPythonGenerator(growthProfile, mode);
        if (!result || !result.success) {
            throw new Error("Échec de la génération Python");
        }
        return {
            success: true,
            mode: "organic",
            intensity: intensity,
            growthProfile: growthProfile,
            scores: scores,
            meshId: result.meshId,
            meshPath: result.meshPath,
            jsonUrl: result.jsonUrl,
            generationTimeMs: result.generationTimeMs
        };
    }

    getMaterialProperties(material, intensity = 1.0) {
        const base = {
            soft:       { color: 0xffaa88, metalness: 0.10, roughness: 0.70, emissive: 0x000000 },
            viscous:    { color: 0xcc8866, metalness: 0.05, roughness: 0.85, emissive: 0x331100 },
            dense:      { color: 0xaa8866, metalness: 0.50, roughness: 0.40, emissive: 0x000000 },
            porous:     { color: 0xccaa88, metalness: 0.05, roughness: 0.80, emissive: 0x221100 },
            irregular:  { color: 0xaa8866, metalness: 0.20, roughness: 0.65, emissive: 0x000000 },
            fluid:      { color: 0x88aaff, metalness: 0.05, roughness: 0.30, emissive: 0x004466 },
            semisolid:  { color: 0xccaa99, metalness: 0.10, roughness: 0.70, emissive: 0x221100 },
            fibrous:    { color: 0xccaa77, metalness: 0.40, roughness: 0.55, emissive: 0x000000 },
            calcified:  { color: 0xddccaa, metalness: 0.60, roughness: 0.35, emissive: 0x000000 },
            elastic:    { color: 0xccaa88, metalness: 0.15, roughness: 0.60, emissive: 0x000000 },
            hydrophobic:{ color: 0xaaccdd, metalness: 0.05, roughness: 0.50, emissive: 0x002233 },
            gelatinous: { color: 0xeeddcc, metalness: 0.05, roughness: 0.30, emissive: 0x000000 },
            osseous:    { color: 0xddccaa, metalness: 0.60, roughness: 0.35, emissive: 0x000000 },
            nervous:    { color: 0xccaa88, metalness: 0.10, roughness: 0.40, emissive: 0x000000 },
            epithelial: { color: 0xccaa88, metalness: 0.05, roughness: 0.50, emissive: 0x000000 },
            muscle:     { color: 0xaa6644, metalness: 0.10, roughness: 0.60, emissive: 0x000000 },
            cartilage:  { color: 0xddccbb, metalness: 0.05, roughness: 0.45, emissive: 0x000000 }
        };
        let props = base[material] || base.soft;
        const factor = Math.min(1.0, intensity / 2.0);
        return {
            color: props.color,
            metalness: Math.min(0.85, props.metalness + factor * 0.2),
            roughness: Math.max(0.20, props.roughness - factor * 0.3),
            emissive: intensity > 1.5 ? 0x442200 : props.emissive
        };
    }
}

const organicParser = new OrganicParserProdV3();

function parseHF3(prompt, options = {}) {
    return organicParser.parse(prompt, options);
}

module.exports = {
    parseHF3,
    OrganicParserProdV3,
    organicParser
};