// organicV6Core.js
// HELIXFORGE 6.0 — Bridge Python universel pour GrowthProfile
// Délégation exclusive au générateur Python avec arguments --input et --output

const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

class OrganicV6Core {
    constructor(randomFn = Math.random, options = {}) {
        this.random = randomFn;
        this.seed = options.seed || Date.now();
        this.iteration = 0;
        // Paramètres résiduels (non utilisés mais gardés pour compatibilité)
        this.config = {
            noiseOctaves: 4,
            noisePersistence: 0.5,
            noiseLacunarity: 2.0,
            globalSmoothness: 0.35,
            finalScale: 1.8
        };
    }

    // ========== BRIDGE PYTHON UNIVERSEL ==========
   async callPythonGenerator(growthProfile, mode = 'final') {
    const isPreview = mode === 'preview';
    
    const id = crypto.randomUUID();
    
    const enrichedProfile = {
        ...growthProfile,
        id: id,
        ...(isPreview ? {
            n_candidates: 1,
            quick_mode: true,
            export_formats: ['obj'],
            target_vertex_count: 15000,
            skip_reaction_diffusion: true
        } : {
            n_candidates: growthProfile.n_candidates || 3,
            full_postprocess: true,
            export_formats: ['obj', 'ply', 'stl'],
            target_vertex_count: null,
            run_reaction_diffusion: true
        })
    };
    
    return new Promise((resolve, reject) => {
        console.log(`[Python] Début génération (mode=${mode}) avec GrowthProfile`);
        // Point d'entrée mis à jour
        const script = path.join(__dirname, "../../python/organic/helixforge_ultimate.py");
        const modelsDir = path.join(__dirname, "../../models");
        const tmpDir = path.join(__dirname, "../../../tmp");

        if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const inputFile = path.join(tmpDir, `${id}.json`);
        const outputFile = path.join(modelsDir, `${id}.obj`);

        fs.writeFileSync(inputFile, JSON.stringify(enrichedProfile, null, 2));
        console.log(`[Python] Fichier entrée : ${inputFile}`);
        console.log(`[Python] Fichier sortie : ${outputFile}`);

        // Commande avec --format obj pour garantir la sortie OBJ
        execFile("python", [script, "--input", inputFile, "--output", outputFile, "--format", "obj"], (err, stdout, stderr) => {
            console.log("[Python] STDOUT:", stdout);
            console.log("[Python] STDERR:", stderr);
            
            try { fs.unlinkSync(inputFile); } catch(e) {}
            
            if (err) {
                reject(new Error(`Python failed: ${stderr || err.message}`));
                return;
            }
            
            // Recherche du fichier OBJ généré (le script Python peut renommer)
            const files = fs.readdirSync(modelsDir)
                .filter(f => f.endsWith('.obj'))
                .map(f => ({
                    name: f,
                    path: path.join(modelsDir, f),
                    time: fs.statSync(path.join(modelsDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);
            
            const actualFile = files.length > 0 ? files[0].path : null;
            
            if (!actualFile || !fs.existsSync(actualFile)) {
                reject(new Error(`Aucun fichier OBJ trouvé dans ${modelsDir}. Stderr: ${stderr}`));
                return;
            }
            
            console.log("[Python] Fichier réel trouvé :", actualFile);
            
            try {
                fs.renameSync(actualFile, outputFile);
                console.log("[Python] Renommé en :", outputFile);
            } catch(e) {
                console.warn("[Python] Impossible de renommer, utilisation du chemin original");
            }
            
            resolve({
                success: true,
                meshId: id,
                meshPath: `/models/${id}.obj`,
                jsonUrl: `/models/${id}.obj`,
                mode: mode,
                profile: enrichedProfile
            });
        });
    });
}

    // ========== WRAPPER POUR LE PARSER ==========
    async evaluateAsync(growthProfile, mode = 'final') {
        // Délégation systématique au générateur Python
        console.log("[Core] Délégation au générateur Python pour profil universel");
        return await this.callPythonGenerator(growthProfile, mode);
    }

    // ========== MÉTHODES LEGACY (conservées pour compatibilité éventuelle, non utilisées) ==========
    // Elles sont gardées pour ne pas casser d'anciens appels, mais ne sont plus utilisées dans le pipeline organique.
    nodePrimitive(op, params) {
        return { type: "primitive", op, params, children: [], animation: null };
    }
    nodeTransform(op, child, params) {
        return { type: "transform", op, params, children: [child], animation: null };
    }
    nodeCombine(op, left, right, params = {}) {
        return { type: "combine", op, params, children: [left, right], animation: null };
    }
    randRange(min, max) {
        return min + this.random() * (max - min);
    }
}

module.exports = { OrganicV6Core };