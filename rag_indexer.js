const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const NodeCache = require('node-cache');

const DB_PATH = path.join(process.cwd(), 'rag_index.db');

class RAGIndexer {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.cache = new NodeCache({ stdTTL: 3600 });
        this.isReady = true;
    }

    findSimilar(query, topK = 3) {
        const cacheKey = query.toLowerCase().trim();
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const queryLower = query.toLowerCase();
        const queryKeywords = this.extractKeywords(queryLower).split(' ');
        if (queryKeywords.length === 0) return [];

        const mode = this.detectMode(query);
        // Récupérer un échantillon d'exemples du bon mode (les 5000 derniers, pour diversité)
        const sql = `SELECT prompt, plan, keywords FROM examples WHERE mode = ? ORDER BY id DESC LIMIT 5000`;
        const stmt = this.db.prepare(sql);
        let rows;
        try {
            rows = stmt.all(mode);
        } catch (err) {
            console.error("SQL error:", err);
            return [];
        }
        if (!rows || !Array.isArray(rows)) return [];

        const scored = rows.map(row => {
            const rowKeywords = (row.keywords && typeof row.keywords === 'string') ? row.keywords.split(' ') : [];
            const common = queryKeywords.filter(k => rowKeywords.includes(k)).length;
            return { ...row, score: common };
        });
        scored.sort((a,b) => b.score - a.score);
        const top = scored.slice(0, topK).map(row => ({
            prompt: row.prompt,
            plan: JSON.parse(row.plan)
        }));
        this.cache.set(cacheKey, top);
        return top;
    }

    detectMode(query) {
        const lower = query.toLowerCase();
        if (/blob|organique|lisse|sculpture|sdf|sphère.*lisse|goutte|tore|anneau|capsule|métaball/.test(lower)) return 'SDF';
        return 'CAD';
    }

    extractKeywords(text) {
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
}

let instance = null;
module.exports = {
    getIndexer: () => {
        if (!instance) instance = new RAGIndexer();
        return instance;
    },
    resetIndexer: () => { instance = null; }
};
