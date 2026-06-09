const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ========== CONFIGURATION ==========
const SERVER_ENTRY = './server.js';      // chemin vers ton server.js
const PROJECT_ROOT = path.resolve(__dirname);  // racine du projet
const IGNORE_DIRS = ['node_modules', 'venv', '.git', 'uploads', 'models', '__pycache__', '.vscode'];
const EXTENSIONS = ['.js', '.json', '.py', '.html', '.css', '.svg', '.png', '.jpg', '.jpeg', '.gltf', '.obj', '.mtl'];

// Ensemble des fichiers collectés (chemins absolus)
const collectedFiles = new Set();

// ========== FONCTIONS UTILITAIRES ==========
function isIgnored(dir) {
    return IGNORE_DIRS.includes(path.basename(dir));
}

function collectDirectoryRecursive(dirPath, relativeRoot = PROJECT_ROOT) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (isIgnored(fullPath)) continue;
        if (entry.isDirectory()) {
            collectDirectoryRecursive(fullPath, relativeRoot);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (EXTENSIONS.includes(ext)) {
                collectedFiles.add(fullPath);
            }
        }
    }
}

function extractRequiresFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const requires = new Set();
    // Match require('./path') ou require("../path")
    const requireRegex = /require\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
        requires.add(match[1]);
    }
    // Match import ... from './path'
    const importRegex = /import\s+.*\s+from\s*['"](\.\.?\/[^'"]+)['"]/g;
    while ((match = importRegex.exec(content)) !== null) {
        requires.add(match[1]);
    }
    // Match const { ... } = require(...) déjà capturé par le premier.
    // On cherche aussi les appels à express.static pour récupérer les dossiers statiques
    const staticRegex = /express\.static\s*\(\s*path\.join\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]/g;
    while ((match = staticRegex.exec(content)) !== null) {
        const staticDir = match[1];
        const absDir = path.resolve(path.dirname(filePath), staticDir);
        if (fs.existsSync(absDir)) {
            collectDirectoryRecursive(absDir);
        }
    }
    // sendFile calls
    const sendFileRegex = /res\.sendFile\s*\(\s*path\.join\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]/g;
    while ((match = sendFileRegex.exec(content)) !== null) {
        const relPath = match[1];
        const absPath = path.resolve(path.dirname(filePath), relPath);
        if (fs.existsSync(absPath)) collectedFiles.add(absPath);
    }
    return requires;
}

function resolveRequire(baseFile, requiredPath) {
    const baseDir = path.dirname(baseFile);
    const absPath = path.resolve(baseDir, requiredPath);
    // Ajoute l'extension si manquante
    if (fs.existsSync(absPath)) return absPath;
    if (fs.existsSync(absPath + '.js')) return absPath + '.js';
    if (fs.existsSync(absPath + '.json')) return absPath + '.json';
    if (fs.existsSync(path.join(absPath, 'index.js'))) return path.join(absPath, 'index.js');
    return null;
}

function analyzeFile(filePath, visited = new Set()) {
    if (visited.has(filePath)) return;
    if (!fs.existsSync(filePath)) return;
    visited.add(filePath);
    collectedFiles.add(filePath);
    console.log(`📄 Analyse: ${path.relative(PROJECT_ROOT, filePath)}`);

    const requires = extractRequiresFromFile(filePath);
    for (const req of requires) {
        const resolved = resolveRequire(filePath, req);
        if (resolved && !visited.has(resolved)) {
            analyzeFile(resolved, visited);
        } else if (!resolved) {
            console.warn(`⚠️ Require non résolu: ${req} dans ${path.relative(PROJECT_ROOT, filePath)}`);
        }
    }
}

// ========== MAIN ==========
function main() {
    const entryPath = path.resolve(PROJECT_ROOT, SERVER_ENTRY);
    if (!fs.existsSync(entryPath)) {
        console.error(`❌ Fichier entry ${entryPath} introuvable.`);
        return;
    }

    // 1. Analyse récursive des require/import JS
    console.log('🔍 Analyse des dépendances JS...');
    analyzeFile(entryPath);

    // 2. Détection des dossiers statiques via les constantes dans server.js (on a déjà capturé express.static)
    //    Mais on peut aussi forcer l'ajout de certains dossiers fréquents
    const extraStaticDirs = [
        path.join(PROJECT_ROOT, 'public'),
        path.join(PROJECT_ROOT, 'frontend'),
        path.join(PROJECT_ROOT, 'frontend/libs'),
        path.join(PROJECT_ROOT, 'uploads'),
        path.join(PROJECT_ROOT, 'models'),
        path.join(PROJECT_ROOT, 'node_modules/three')
    ];
    for (const dir of extraStaticDirs) {
        if (fs.existsSync(dir)) {
            collectDirectoryRecursive(dir);
        }
    }

    // 3. Détection des fichiers Python appelés via spawn (vision API)
    // On repère le module vision.api.vision_api:app -> fichier vision/api/vision_api.py
    const pythonApiFile = path.join(PROJECT_ROOT, 'vision', 'api', 'vision_api.py');
    if (fs.existsSync(pythonApiFile)) {
        collectedFiles.add(pythonApiFile);
        // Optionnel: analyser aussi les imports Python de ce fichier (pour être complet)
        // On peut appeler un outil externe comme `pipreqs` ou simple regex
        // Par simplicité, on ajoute tout le dossier `vision` (à adapter)
        const visionDir = path.join(PROJECT_ROOT, 'vision');
        if (fs.existsSync(visionDir)) collectDirectoryRecursive(visionDir);
    }

    // 4. Détection de la bibliothèque organique (python/organic/database) - ce sont des assets, pas du code source
    //    On peut les ignorer ou les lister selon ton besoin. Je les ignore ici (car ce sont des OBJ externes)
    //    Si tu veux les inclure, décommente:
    // const organicDb = path.join(PROJECT_ROOT, 'python', 'organic', 'database');
    // if (fs.existsSync(organicDb)) collectDirectoryRecursive(organicDb);

    // 5. Écrire la liste finale
    const outputFile = path.join(PROJECT_ROOT, 'all_sources.txt');
    const sorted = Array.from(collectedFiles).sort();
    fs.writeFileSync(outputFile, sorted.join('\n'));
    console.log(`\n✅ Liste écrite dans ${outputFile}`);
    console.log(`📦 Total fichiers sources: ${sorted.length}`);
}

main();