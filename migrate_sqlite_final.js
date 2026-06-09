const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const PROJECT_ROOT = path.join(__dirname, '../..');
const DB_PATH = path.join(PROJECT_ROOT, 'rag_index.db');
const CAD_PATH = path.join(PROJECT_ROOT, 'datasets', 'text2cad_500k.jsonl');
const SDF_PATH = path.join(PROJECT_ROOT, 'datasets', 'sdf_synthetic_500k.jsonl');

console.log("🚀 Migration finale des datasets 500k vers SQLite...");

function extractKeywords(text) {
    const stopWords = new Set([
        'le','la','les','un','une','des','du','de','en','avec','pour','et','ou','sur','sous',
        'the','a','an','of','with','for','and','to','in','on','at','by','is','are','be',
        'créer','puis','ensuite','forme','première','seconde','deux','une','un','mm','cm'
    ]);
    return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w))
        .join(' ');
}

async function loadFile(db, filePath, forcedMode, label) {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Fichier introuvable : ${filePath}`);
        return;
    }
    console.log(`📚 Chargement ${label} (${path.basename(filePath)})...`);
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
    });
    const insertStmt = db.prepare(`INSERT INTO examples (prompt, plan, mode, keywords) VALUES (?, ?, ?, ?)`);
    let count = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            const text = obj.text || obj.prompt;
            if (!text) continue;

            let rawPlan = obj.plan;
            if (!rawPlan) continue;

            let nodes, modeDetected, outputs;
            if (Array.isArray(rawPlan)) {
                nodes = rawPlan;
                modeDetected = forcedMode || 'SDF';
                outputs = { node: nodes[nodes.length-1]?.node_id || 'final' };
            } else if (rawPlan.nodes && Array.isArray(rawPlan.nodes)) {
                nodes = rawPlan.nodes;
                modeDetected = rawPlan.mode || forcedMode || 'CAD';
                outputs = rawPlan.outputs || { node: nodes[nodes.length-1]?.node_id || 'final' };
            } else {
                continue;
            }

            const planStr = JSON.stringify({ mode: modeDetected, nodes, outputs });
            const keywords = extractKeywords(text);
            insertStmt.run(text, planStr, modeDetected, keywords);
            count++;
            if (count % 10000 === 0) console.log(`   ${count} exemples...`);
        } catch (err) {
            // ignorer les lignes mal formées
        }
    }
    console.log(`   ✅ ${count} exemples pour ${label}`);
    insertStmt.finalize();
}

async function migrate() {
    const db = new sqlite3.Database(DB_PATH);
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS examples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt TEXT NOT NULL,
            plan TEXT NOT NULL,
            mode TEXT NOT NULL,
            keywords TEXT
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_mode ON examples(mode)`);
    });
    await loadFile(db, CAD_PATH, 'CAD', 'CAD-500k');
    await loadFile(db, SDF_PATH, 'SDF', 'SDF-500k');
    db.close();
    console.log('✅ Migration terminée. Base SQLite prête.');
}

migrate().catch(console.error);
