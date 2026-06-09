// ============================================================================
// HelixForge 3.0 — SERVER.JS (Version JSON uniquement, avec meshId)
// MODE ORGANIC : DÉLÉGATION AU GÉNÉRATEUR PYTHON UNIVERSEL AVEC PARSING OBJ
// MODE AUTO : PREVIEW IMMÉDIAT + FINAL EN BACKGROUND (STREAMING PROGRESSIF)
// ============================================================================

require("module-alias/register");

const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const crypto = require("crypto");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// --- Imports HF3 (conservés pour les modes strict et creative) ---
const { parseHF3: parseHF3V3, OrganicParserProdV3 } = require("./ai/parsers/organic_parser_prod_v3");
const { parseStrict } = require("./ai/parsers/strict_parser_godmode");
const { parseArtisticPrompt } = require("./ai/parsers/artistic_semantic_parser_production");
const { translateFRtoOrganic, organicTextToParserInput, translateFRtoHF5 } = require("./ai/prompt/organic_translator_fr_v5");
const { translateFRtoStrict } = require("./ai/prompt/strict_translator_fr");
const { generateMeshHF3 } = require("./engine/sdf/sdf_mesher_hf3");
const { generateHelixImage } = require("./engine/helixforge_engine");

// --- Imports pour le mode artistique avancé ---
const { artisticToArtisticGraph } = require("./utils/artisticToArtisticGraph");
const { createArtisticEvaluatorFromGraph } = require("./engine/sdf/sdf_evaluator_artistic");

// --- Import du traducteur artistique (Groq) ---
const { translateToArtistic } = require("./ai/prompt/artistic_translator");

// ========== Import du générateur organique V6 (Python bridge) ==========
const organicV6Core = new (require("./ai/parsers/organic_v6_core")).OrganicV6Core();

// ========== Import du client Groq pour le chat ==========
const { callGroq } = require("./ai/groq/groq_client");

// ========== CHARGEMENT ROBUSTE (fallback si nécessaire) ==========
let parseCreativeFn = null;
try {
    const creativeModule = require("./ai/parsers/artistic_semantic_parser_production");
    if (typeof creativeModule === 'function') {
        parseCreativeFn = creativeModule;
    } else if (creativeModule.parseArtisticPrompt) {
        parseCreativeFn = creativeModule.parseArtisticPrompt;
    } else if (creativeModule.parse) {
        parseCreativeFn = creativeModule.parse;
    } else {
        const functions = Object.values(creativeModule).filter(v => typeof v === 'function');
        if (functions.length > 0) parseCreativeFn = functions[0];
    }
    if (!parseCreativeFn) throw new Error("Aucune fonction trouvée");
    console.log("✅ Parser CREATIVE chargé avec succès");
} catch (err) {
    console.warn("⚠️ Impossible de charger le parser CREATIVE, fallback sur organic:", err.message);
}

const app = express();
const PORT = 3000;

// ============================================================================
// 🔧 MIDDLEWARES
// ============================================================================
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(fileUpload());

// ============================================================================
// 📁 STATIC FILES
// ============================================================================
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/models", express.static(path.join(__dirname, "models")));
app.use("/three", express.static(path.join(__dirname, "../node_modules/three")));
app.use('/node_modules', express.static(path.join(__dirname, "../node_modules")));
app.use("/libs", express.static(path.join(__dirname, "../frontend/libs")));
app.use("/models", express.static(path.join(__dirname, "ai/models")));
app.use("/backend-models", express.static(path.join(__dirname, "models")));

// ============================================================================
// 🚀 DÉMARRAGE AUTOMATIQUE DE FASTAPI (Vision 3D)
// ============================================================================
const { spawn } = require("child_process");

const fastapi = spawn(path.join(__dirname, "../venv/Scripts/python.exe"), [
    "-m", "uvicorn",
    "vision.api.vision_api:app",
    "--host", "0.0.0.0",
    "--port", "8000"
]);

fastapi.stdout.on("data", data => {
    console.log("[FASTAPI]", data.toString());
});

fastapi.stderr.on("data", data => {
    console.error("[FASTAPI ERROR]", data.toString());
});

// ============================================================================
// 📦 STOCKAGE DES TÂCHES EN ARRIÈRE-PLAN (pour mode auto)
// ============================================================================
const backgroundTasks = new Map(); // { meshId: { status, result, error, timestamp } }

// ============================================================================
// 🟩 HF3 — GENERATION IMAGE
// ============================================================================
app.post("/api/hf3/image", async (req, res) => {
  try {
    const { prompt, mode } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    console.log("🟦 /api/hf3/image →", { prompt, mode });
    const result = await generateHelixImage(prompt, { router: { mode } });
    res.json({
      success: true,
      width: result.width,
      height: result.height,
      buffer: Array.from(result.buffer)
    });
  } catch (err) {
    console.error("❌ /api/hf3/image :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 🟩 HF3 — GENERATION MESH (JSON uniquement)
// ============================================================================
app.post("/api/hf3/mesh", async (req, res) => {
  const startTime = Date.now();
  try {
    let { prompt, mode = 'organic', resolution, useAI = true } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt requis" });

    let normalizedMode = mode;
    if (mode === 'creatif') normalizedMode = 'creative';
    if (!['strict', 'organic', 'creative', 'auto'].includes(normalizedMode)) normalizedMode = 'organic';

    console.log("🟦 /api/hf3/mesh →", { prompt: prompt.substring(0, 60), mode: normalizedMode, resolution, useAI });

    // ---------- NOUVEAU : MODE AUTO (preview immédiat + final en background) ----------
    if (normalizedMode === 'auto') {
      console.log("🌀 Mode AUTO activé : preview immédiat + génération finale asynchrone");

      const profile = translateFRtoHF5(prompt);
      profile.requiresPython = true;

      console.log("⚡ Génération preview...");
      const previewResult = await organicV6Core.callPythonGenerator(profile, 'preview');
      if (!previewResult || !previewResult.success || !previewResult.meshId) {
        throw new Error("Échec de la génération preview");
      }

      const finalMeshId = previewResult.meshId;
      const modelsDir = path.join(__dirname, "models");
      if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

      const objPreviewPath = path.join(modelsDir, `${finalMeshId}.obj`);
      let tries = 0;
      while (tries < 10 && (!fs.existsSync(objPreviewPath) || fs.statSync(objPreviewPath).size < 100)) {
        await new Promise(r => setTimeout(r, 200));
        tries++;
      }
      if (!fs.existsSync(objPreviewPath)) {
        console.warn("[AUTO] Preview OBJ non trouvé après attente, mais on répond quand même");
      }

      res.json({
        success: true,
        status: 'preview_ready',
        meshId: finalMeshId,
        meshPath: `/models/${finalMeshId}.obj`,
        message: 'Preview loaded. Final mesh generating in background...',
        mode: 'auto'
      });

      setImmediate(async () => {
        try {
          console.log(`[AUTO] Démarrage génération finale pour meshId=${finalMeshId}`);
          const finalResult = await organicV6Core.callPythonGenerator(profile, 'final');
          backgroundTasks.set(finalMeshId, {
            status: 'final_ready',
            result: finalResult,
            error: null,
            timestamp: Date.now()
          });
          console.log(`[AUTO] Génération finale terminée pour ${finalMeshId}`);
        } catch (err) {
          console.error(`[AUTO] Échec génération finale pour ${finalMeshId}:`, err);
          backgroundTasks.set(finalMeshId, {
            status: 'failed',
            result: null,
            error: err.message,
            timestamp: Date.now()
          });
        }
      });

      return;
    }

    // ---------- 1. MODE STRICT ----------
    if (normalizedMode === 'strict') {
      console.log("📘 Parser STRICT utilisé");
      let strictPrompt = prompt;
      if (useAI) {
        console.log("🤖 Traducteur STRICT activé");
        const translation = await translateFRtoStrict(prompt);
        if (translation.success && translation.strictSource) {
          strictPrompt = translation.strictSource;
          console.log("✅ Traduction STRICT réussie :", strictPrompt);
        } else {
          console.warn("⚠️ Traduction STRICT échouée, fallback au prompt original");
        }
      }
      const strictResult = parseStrict(strictPrompt);
      let graphData = null;
      if (strictResult && strictResult.graph && strictResult.graph.nodes && strictResult.graph.rootId) {
        graphData = strictResult.graph;
      } else if (strictResult && strictResult.rootId && strictResult.nodes) {
        graphData = { rootId: strictResult.rootId, nodes: strictResult.nodes };
      }
      let parsed = graphData ? {
        nodeGraph: { root: graphData.rootId, nodes: graphData.nodes },
        profile: { material: 'solid', dominant_morphology: 'primitive' },
        intensity: 0.5,
        mode: 'strict'
      } : strictResult;
      let graph = parsed?.nodeGraph;

      if (!graph || !graph.root || !graph.nodes || graph.nodes.length === 0) {
        console.error("❌ Graphe invalide :", graph);
        return res.status(400).json({ success: false, error: "Graphe invalide" });
      }

      const nodeCount = graph.nodes.length;
      let meshResolution = resolution || 256;
      if (!resolution) meshResolution = nodeCount <= 500 ? 256 : (nodeCount <= 1500 ? 256 : 128);
      meshResolution = Math.min(Math.max(meshResolution, 64), 256);
      console.log(`📊 Résolution adaptative: ${meshResolution}³ (nodes: ${nodeCount})`);

      let mesh;
      try {
        mesh = await generateMeshHF3(graph, {
          resolution: meshResolution,
          dynamicBounds: true,
          useAdaptive: true,
          isoLevel: 0,
          cacheEnabled: true,
          maxRetries: 2,
          mode: 'strict',
          profile: parsed.profile,
          includeUVs: true,
          includeNormals: true,
          includeVertexColors: true
        });
      } catch (err) {
        console.warn("⚠️ Première tentative échouée, fallback 128³...", err.message);
        mesh = await generateMeshHF3(graph, {
          resolution: 128,
          dynamicBounds: true,
          useAdaptive: false,
          isoLevel: 0,
          cacheEnabled: false,
          maxRetries: 1,
          mode: 'strict',
          profile: parsed.profile,
          includeUVs: true,
          includeNormals: true,
          includeVertexColors: true
        });
      }

      if (!mesh || !mesh.vertices || mesh.vertices.length === 0) throw new Error("Mesh généré vide");

      const vertexCount = mesh.vertices.length / 3;
      const indexCount = mesh.indices.length;
      console.log(`🟩 Mesh strict généré: ${vertexCount} vertices, ${indexCount} indices`);

      const modelId = crypto.randomUUID();
      const modelsDir = path.join(__dirname, "models");
      if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

      const materialProps = new OrganicParserProdV3().getMaterialProperties(parsed.profile.material, parsed.intensity);
      const jsonData = {
        id: modelId,
        prompt,
        mode: 'strict',
        profile: parsed.profile,
        intensity: parsed.intensity,
        vertices: Array.from(mesh.vertices),
        indices: Array.from(mesh.indices),
        normals: mesh.normals ? Array.from(mesh.normals) : null,
        uvs: mesh.uvs ? Array.from(mesh.uvs) : null,
        colors: mesh.colors ? Array.from(mesh.colors) : null,
        bounds: mesh.bounds,
        material: {
          color: materialProps.color,
          metalness: materialProps.metalness,
          roughness: materialProps.roughness,
          emissive: materialProps.emissive
        },
        generation: {
          nodeCount,
          resolution: meshResolution,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
      const jsonPath = path.join(modelsDir, `${modelId}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
      console.log(`💾 JSON sauvegardé: ${jsonPath}`);

      return res.json({
        success: true,
        modelId,
        meshId: modelId,
        mode: 'strict',
        profile: parsed.profile,
        intensity: parsed.intensity,
        mesh: {
          vertexCount,
          indexCount,
          resolution: meshResolution,
          hasUVs: !!mesh.uvs,
          hasNormals: !!mesh.normals,
          hasVertexColors: !!mesh.colors
        },
        jsonUrl: `/api/hf3/models/${modelId}.json`,
        generationTimeMs: Date.now() - startTime
      });
    }
    // ---------- 2. MODE CREATIVE ----------
    else if (normalizedMode === 'creative') {
      console.log("🎨 Mode CREATIVE - traduction IA (Groq) puis parser artistique avancé");
      let artisticResult = null;
      let usedAI = false;

      if (useAI) {
        try {
          console.log("🤖 Appel à artistic_translator (Groq)...");
          const defaultIntensity = 0.7;
          artisticResult = await translateToArtistic(prompt, defaultIntensity, { useCache: true, timeout: 15000 });
          console.log("✅ Traduction artistique IA réussie");
          usedAI = true;
        } catch (groqErr) {
          console.error("❌ Échec traduction IA (Groq), fallback parser statique:", groqErr.message);
          artisticResult = null;
        }
      }

      if (!artisticResult) {
        if (!parseCreativeFn) throw new Error("Parser creative non disponible");
        console.log("📜 Utilisation du parser artistique statique (fallback)");
        artisticResult = parseCreativeFn(prompt, { logLevel: 'info' });
      }

      console.log("✅ Résultat artistique obtenu, conversion en graphe SDF artistique");
      const intensity = artisticResult.intensity ?? 0.7;
      const artisticGraphData = artisticToArtisticGraph(artisticResult, intensity);
      const artisticGraph = artisticGraphData.nodeGraph;

      const { evaluator, rootNode } = createArtisticEvaluatorFromGraph(artisticGraph);

      const nodeCount = artisticGraph.nodes.length;
      let meshResolution = resolution || 256;
      if (!resolution) meshResolution = nodeCount <= 500 ? 256 : (nodeCount <= 1500 ? 256 : 128);
      meshResolution = Math.min(Math.max(meshResolution, 64), 256);
      console.log(`📊 Résolution adaptative: ${meshResolution}³ (nodes: ${nodeCount})`);

      let mesh;
      try {
        mesh = await generateMeshHF3(
          { evaluator, rootNode, graph: artisticGraph },
          {
            resolution: meshResolution,
            dynamicBounds: true,
            useAdaptive: true,
            isoLevel: 0,
            cacheEnabled: true,
            maxRetries: 2,
            mode: 'artistic',
            profile: artisticGraphData.profile,
            includeUVs: true,
            includeNormals: true,
            includeVertexColors: true
          }
        );
      } catch (err) {
        console.warn("⚠️ Première tentative échouée, fallback 128³...", err.message);
        mesh = await generateMeshHF3(
          { evaluator, rootNode, graph: artisticGraph },
          {
            resolution: 128,
            dynamicBounds: true,
            useAdaptive: false,
            isoLevel: 0,
            cacheEnabled: false,
            maxRetries: 1,
            mode: 'artistic',
            profile: artisticGraphData.profile
          }
        );
      }

      if (!mesh || !mesh.vertices || mesh.vertices.length === 0) throw new Error("Mesh généré vide");

      const vertexCount = mesh.vertices.length / 3;
      const indexCount = mesh.indices.length;
      console.log(`🟩 Mesh artistique généré: ${vertexCount} vertices, ${indexCount} indices`);

      const modelId = crypto.randomUUID();
      const modelsDir = path.join(__dirname, "models");
      if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

      const materialProps = new OrganicParserProdV3().getMaterialProperties(artisticGraphData.profile.material, artisticGraphData.intensity);
      const jsonData = {
        id: modelId,
        prompt,
        mode: 'creative',
        originalMode: mode,
        usedAI,
        profile: artisticGraphData.profile,
        intensity: artisticGraphData.intensity,
        vertices: Array.from(mesh.vertices),
        indices: Array.from(mesh.indices),
        normals: mesh.normals ? Array.from(mesh.normals) : null,
        uvs: mesh.uvs ? Array.from(mesh.uvs) : null,
        colors: mesh.colors ? Array.from(mesh.colors) : null,
        bounds: mesh.bounds,
        material: {
          color: materialProps.color,
          metalness: materialProps.metalness,
          roughness: materialProps.roughness,
          emissive: materialProps.emissive
        },
        generation: {
          nodeCount,
          resolution: meshResolution,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
      const jsonPath = path.join(modelsDir, `${modelId}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
      console.log(`💾 JSON sauvegardé: ${jsonPath}`);

      return res.json({
        success: true,
        modelId,
        meshId: modelId,
        mode: 'creative',
        profile: artisticGraphData.profile,
        intensity: artisticGraphData.intensity,
        mesh: {
          vertexCount,
          indexCount,
          resolution: meshResolution,
          hasUVs: !!mesh.uvs,
          hasNormals: !!mesh.normals,
          hasVertexColors: !!mesh.colors
        },
        jsonUrl: `/api/hf3/models/${modelId}.json`,
        generationTimeMs: Date.now() - startTime
      });
    }
    // ---------- 3. MODE ORGANIC : DÉLÉGATION AU GÉNÉRATEUR PYTHON AVEC PARSING OBJ ----------
    else {
      console.log("🌿 Mode ORGANIC - délégation au générateur Python universel (wrapper robuste)");

      const profile = translateFRtoHF5(prompt);
      console.log("📝 Profil HF5.0 :", profile);

      profile.requiresPython = true;

      const pythonResult = await organicV6Core.evaluateAsync(profile);

      if (!pythonResult || !pythonResult.success || !pythonResult.meshId) {
        console.error("[ORGANIC] Python returned invalid result:", pythonResult);
        throw new Error("Le générateur Python n'a pas retourné un mesh valide");
      }

      const modelsDir = path.join(__dirname, "models");
      const objPath = path.join(modelsDir, `${pythonResult.meshId}.obj`);
      const jsonPath = path.join(modelsDir, `${pythonResult.meshId}.json`);

      const fsExists = (p) => fs.existsSync(p);
      let tries = 0;
      while (tries < 10 && (!fsExists(objPath) || fs.statSync(objPath).size < 100)) {
        await new Promise(r => setTimeout(r, 200));
        tries++;
      }
      if (!fsExists(objPath)) {
        console.error("[ORGANIC] OBJ non trouvé après attente:", objPath);
        throw new Error("OBJ non trouvé après génération Python");
      }

      const head = fs.readFileSync(objPath, 'utf8').split(/\r?\n/).slice(0, 40).join("\n");
      if (!/^\s*v\s+/m.test(head)) {
        console.error("[ORGANIC] OBJ semble invalide (pas de sommets) :", head.split("\n").slice(0,6));
        throw new Error("OBJ généré invalide");
      }

      function parseObjToMesh(objText) {
        const verts = [];
        const indices = [];
        const lines = objText.split(/\r?\n/);
        for (const line of lines) {
          if (!line) continue;
          const t = line.trim().split(/\s+/);
          if (t[0] === 'v' && t.length >= 4) {
            verts.push(parseFloat(t[1]), parseFloat(t[2]), parseFloat(t[3]));
          } else if (t[0] === 'f' && t.length >= 4) {
            const idx = t.slice(1).map(s => parseInt(s.split('/')[0], 10) - 1);
            if (idx.length === 3) indices.push(idx[0], idx[1], idx[2]);
            else if (idx.length > 3) {
              for (let i = 1; i < idx.length - 1; i++) indices.push(idx[0], idx[i], idx[i+1]);
            }
          }
        }
        return { vertices: new Float32Array(verts), indices: new Uint32Array(indices) };
      }

      const objText = fs.readFileSync(objPath, 'utf8');
      const meshObj = parseObjToMesh(objText);

      if (!meshObj.vertices || meshObj.vertices.length < 3 || !meshObj.indices || meshObj.indices.length < 3) {
        console.error("[ORGANIC] Parsing OBJ a produit un mesh vide :", { verts: meshObj.vertices.length, idx: meshObj.indices.length });
        throw new Error("OBJ parsé invalide");
      }

      const jsonData = {
        id: pythonResult.meshId,
        prompt,
        mode: 'organic',
        profile,
        intensity: profile.intensity,
        vertices: Array.from(meshObj.vertices),
        indices: Array.from(meshObj.indices),
        bounds: pythonResult.bounds || null,
        generation: { timestamp: new Date().toISOString(), source: 'python-obj' }
      };
      if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
      console.log(`[ORGANIC] OBJ parsé et JSON sauvegardé: ${jsonPath} (verts:${meshObj.vertices.length/3}, tris:${meshObj.indices.length/3})`);

      return res.json({
        success: true,
        modelId: pythonResult.meshId,
        meshId: pythonResult.meshId,
        mode: 'organic',
        profile,
        intensity: profile.intensity,
        mesh: {
          vertexCount: meshObj.vertices.length / 3,
          indexCount: meshObj.indices.length,
          resolution: resolution || 256,
          hasUVs: false,
          hasNormals: false,
          hasVertexColors: false
        },
        jsonUrl: `/api/hf3/models/${pythonResult.meshId}.json`,
        objUrl: `/api/hf3/models/${pythonResult.meshId}.obj`,
        generationTimeMs: Date.now() - startTime
      });
    }
  } catch (err) {
    console.error("❌ /api/hf3/mesh :", err);
    console.error(err.stack);
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// ============================================================================
// 🟩 ROUTE DE POLLING POUR LE MODE AUTO (obtenir le résultat final)
// ============================================================================
app.get("/api/hf3/status/:meshId", (req, res) => {
  const { meshId } = req.params;
  const task = backgroundTasks.get(meshId);
  if (!task) {
    return res.json({ status: 'pending', message: 'Génération en cours ou non démarrée' });
  }
  if (task.status === 'final_ready') {
    return res.json({
      status: 'final_ready',
      meshId,
      meshPath: `/models/${meshId}.obj`,
      diagnostics: task.result?.diagnostics || {}
    });
  } else if (task.status === 'failed') {
    return res.json({ status: 'failed', error: task.error });
  }
  res.json({ status: 'processing', message: 'Final mesh still generating...' });
});

// ============================================================================
// 🟩 ROUTES POUR SERVIR LES FICHIERS JSON / OBJ
// ============================================================================
app.get("/api/hf3/models/:id", (req, res) => {
  const id = req.params.id;
  const modelsDir = path.join(__dirname, "models");
  let jsonPath = path.join(modelsDir, `${id}.json`);
  let objPath = path.join(modelsDir, `${id}.obj`);
  if (fs.existsSync(jsonPath)) {
    res.setHeader('Content-Type', 'application/json');
    return res.sendFile(jsonPath);
  } else if (fs.existsSync(objPath)) {
    res.setHeader('Content-Type', 'model/obj');
    return res.sendFile(objPath);
  }
  res.status(404).json({ error: "Modèle non trouvé" });
});

app.get("/api/hf3/mesh/:id", (req, res) => {
  const id = req.params.id;
  const modelsDir = path.join(__dirname, "models");
  const jsonPath = path.join(modelsDir, `${id}.json`);
  const objPath = path.join(modelsDir, `${id}.obj`);
  if (fs.existsSync(objPath)) {
    res.setHeader('Content-Type', 'model/obj');
    return res.sendFile(objPath);
  }
  if (fs.existsSync(jsonPath)) {
    res.setHeader('Content-Type', 'application/json');
    return res.sendFile(jsonPath);
  }
  res.status(404).json({ error: "Modèle non trouvé" });
});

// ============================================================================
// 🟩 HF3 — RECONSTRUCTION MULTI‑VIEW (2–6 images)
// ============================================================================
app.post("/api/hf3/reconstruct", async (req, res) => {
  try {
    if (!req.files || !req.files.images) {
      return res.status(400).json({ error: "Aucune image reçue" });
    }

    const images = Array.isArray(req.files.images)
      ? req.files.images
      : [req.files.images];

    if (images.length < 1) {
      return res.status(400).json({ error: "Minimum 1 image requise" });
    }

    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const savedPaths = [];
    for (const img of images) {
      const filename = `${crypto.randomUUID()}_${img.name}`;
      const filepath = path.join(uploadDir, filename);
      await img.mv(filepath);
      savedPaths.push(filepath);
    }

    const response = await fetch("http://localhost:8000/reconstruct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images: savedPaths,
        scale: 1.0,
        pivot: [0, 0, 0],
        format: "json"
      })
    });

    const result = await response.json();

    if (!result || !result.vertices) {
      return res.status(500).json({ error: "Reconstruction échouée" });
    }

    const meshId = crypto.randomUUID();
    const modelsDir = path.join(__dirname, "models");
    if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

    const jsonPath = path.join(modelsDir, `${meshId}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    return res.json({
      success: true,
      meshId,
      jsonUrl: `/api/hf3/models/${meshId}.json`
    });
  } catch (err) {
    console.error("❌ /api/hf3/reconstruct :", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 🟩 ROUTE DIRECTE POUR GÉNÉRATION ORGANIQUE (sans passer par /api/hf3/mesh)
// ============================================================================
app.post("/generateOrganicMesh", async (req, res) => {
  try {
    const profile = req.body;
    console.log("🟢 /generateOrganicMesh →", profile);
    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ error: "Profil invalide" });
    }
    const result = await organicV6Core.evaluateAsync(profile);
    res.json(result);
  } catch (err) {
    console.error("❌ /generateOrganicMesh :", err);
    res.status(500).json({ error: err.toString() });
  }
});

// ============================================================================
// 🧠 ENDPOINT POUR LE CHAT IA (GROQ)
// ============================================================================
app.post("/api/groq/chat", async (req, res) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: "Question manquante ou invalide" });
  }

  const systemPrompt = `Tu es un assistant expert de HelixForge, un logiciel de modélisation 3D scientifique. 
  Réponds de manière concise, précise et utile aux questions sur l'interface utilisateur, les outils disponibles (sélection, extrusion, loop cut, bevel, symétrie, croissance organique, mutation, analyses scientifiques, laboratoire virtuel, etc.), les raccourcis clavier (Ctrl+Z, Ctrl+Y, G, R, S, Suppr), et les fonctionnalités (path tracing, volume rendering, SDF, etc.). 
  Si tu ne connais pas la réponse, indique-le poliment. 
  N'invente pas de fonctionnalités inexistantes.`;

  const fullPrompt = `${systemPrompt}\n\nUtilisateur : ${question}\nAssistant :`;

  try {
    const answer = await callGroq(fullPrompt, "CAD");
    res.json({ answer: answer.trim() });
  } catch (err) {
    console.error("Erreur chat Groq:", err);
    res.status(500).json({ error: "Le service IA n'a pas pu répondre." });
  }
});

// ============================================================================
// 📚 ROUTES POUR LA BIBLIOTHÈQUE ORGANIQUE (ajoutées)
// ============================================================================

// Route pour lister la bibliothèque organique (catégories et fichiers OBJ)
app.get('/api/organic/library', (req, res) => {
    const dbPath = path.join(__dirname, 'python', 'organic', 'database');
    const categories = [];
    const files = {};
    try {
        const entries = fs.readdirSync(dbPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const cat = entry.name;
                categories.push(cat);
                const catPath = path.join(dbPath, cat);
                const objs = fs.readdirSync(catPath).filter(f => f.endsWith('.obj'));
                files[cat] = objs;
            }
        }
        res.json({ categories, files });
    } catch (err) {
        console.error("Erreur lecture bibliothèque organique:", err);
        res.status(500).json({ error: err.message });
    }
});

// Route pour servir un fichier OBJ d'une catégorie
app.get('/api/organic/obj/:category/:filename', (req, res) => {
    const { category, filename } = req.params;
    if (category.includes('..') || filename.includes('..')) {
        return res.status(400).json({ error: "Chemin invalide" });
    }
    const filePath = path.join(__dirname, 'python', 'organic', 'database', category, filename);
    if (fs.existsSync(filePath) && filePath.endsWith('.obj')) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Fichier OBJ non trouvé' });
    }
});

// Route pour servir un fichier .meta.json associé
app.get('/api/organic/meta/:category/:filename', (req, res) => {
    const { category, filename } = req.params;
    if (category.includes('..') || filename.includes('..')) {
        return res.status(400).json({ error: "Chemin invalide" });
    }
    const baseName = filename.replace(/\.obj$/i, '');
    const metaFileName = `${baseName}.meta.json`;
    const filePath = path.join(__dirname, 'python', 'organic', 'database', category, metaFileName);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Métadonnées non trouvées' });
    }
});

// ============================================================================
// 🟦 VIEWER HF3
// ============================================================================
app.get("/viewer", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/viewer.html"));
});

app.get("/viewer.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/viewer.html"));
});

// ============================================================================
// 🟦 FALLBACK (SPA)
// ============================================================================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ============================================================================
// 🚀 START SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log(`🚀 HelixForge 3.0 (HF3 MODE) démarré sur http://localhost:${PORT}`);
  console.log(`   ✅ Mode STRICT : parser SDF local`);
  console.log(`   ✅ Mode CREATIVE : traduction IA + SDF artistique`);
  console.log(`   ✅ Mode ORGANIC : délégation au générateur Python universel (avec parsing OBJ)`);
  console.log(`   ✅ Mode AUTO : preview immédiat + final en arrière-plan (polling)`);
  console.log(`   ✅ Route /generateOrganicMesh disponible`);
  console.log(`   ✅ Route /api/groq/chat disponible pour l'assistant IA`);
  console.log(`   ✅ Routes /api/organic/* disponibles pour la bibliothèque organique`);
});
