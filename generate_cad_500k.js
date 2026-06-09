// backend/scripts/generate_cad_500k.js
const fs = require('fs');
const path = require('path');

// ============================================================
// TEMPLATES CAD (catégories variées)
// ============================================================

const templates = [
    // ----- MEUBLES -----
    // 1. Table rectangulaire
    {
        category: "table",
        patterns: [
            "table rectangulaire {w}x{d}mm hauteur {h}mm",
            "table {w}x{d}mm avec 4 pieds",
            "meuble table dimensions {w}x{d}x{h}mm"
        ],
        generator: (w, d, h) => {
            const topThick = 30;
            const legH = h - topThick;
            const legSize = 50;
            const nodes = [
                { node_id: "top", node_type: "solid_block", params: { width: w, depth: d, height: topThick }, inputs: {} },
                { node_id: "leg1", node_type: "solid_block", params: { width: legSize, depth: legSize, height: legH }, inputs: {} },
                { node_id: "leg2", node_type: "solid_block", params: { width: legSize, depth: legSize, height: legH }, inputs: {} },
                { node_id: "leg3", node_type: "solid_block", params: { width: legSize, depth: legSize, height: legH }, inputs: {} },
                { node_id: "leg4", node_type: "solid_block", params: { width: legSize, depth: legSize, height: legH }, inputs: {} },
                { node_id: "leg1pos", node_type: "transform", params: { translation: [-w/2+legSize/2, -d/2+legSize/2, -topThick/2] }, inputs: { child: "leg1" } },
                { node_id: "leg2pos", node_type: "transform", params: { translation: [ w/2-legSize/2, -d/2+legSize/2, -topThick/2] }, inputs: { child: "leg2" } },
                { node_id: "leg3pos", node_type: "transform", params: { translation: [-w/2+legSize/2,  d/2-legSize/2, -topThick/2] }, inputs: { child: "leg3" } },
                { node_id: "leg4pos", node_type: "transform", params: { translation: [ w/2-legSize/2,  d/2-legSize/2, -topThick/2] }, inputs: { child: "leg4" } }
            ];
            let current = "top";
            for (let i = 1; i <= 4; i++) {
                const unionId = `union${i}`;
                nodes.push({ node_id: unionId, node_type: "boolean_union", params: {}, inputs: { children: [current, `leg${i}pos`] } });
                current = unionId;
            }
            return { nodes, output: current };
        }
    },
    // 2. Chaise
    {
        category: "chair",
        patterns: [
            "chaise confortable largeur {w}mm profondeur {d}mm hauteur {h}mm",
            "chaise avec dossier hauteur {h}mm",
            "siège {w}x{d}mm hauteur assise {h}mm"
        ],
        generator: (w, d, h) => {
            const seatH = 30;
            const legH = h - seatH;
            const legSize = 40;
            const backH = 400;
            const nodes = [
                { node_id: "seat", node_type: "solid_block", params: { width: w, depth: d, height: seatH }, inputs: {} },
                { node_id: "back", node_type: "solid_block", params: { width: w, depth: 20, height: backH }, inputs: {} },
                { node_id: "backpos", node_type: "transform", params: { translation: [0, d/2 + 10, seatH + backH/2] }, inputs: { child: "back" } },
                { node_id: "leg1", node_type: "solid_block", params: { width: legSize, depth: legSize, height: legH }, inputs: {} },
                { node_id: "leg2", node_type: "solid_block", params: { width: legSize, depth: legSize, height: legH }, inputs: {} },
                { node_id: "leg3", node_type: "solid_block", params: { width: legSize, depth: legSize, height: legH }, inputs: {} },
                { node_id: "leg4", node_type: "solid_block", params: { width: legSize, depth: legSize, height: legH }, inputs: {} },
                { node_id: "leg1pos", node_type: "transform", params: { translation: [-w/2+legSize/2, -d/2+legSize/2, -seatH/2] }, inputs: { child: "leg1" } },
                { node_id: "leg2pos", node_type: "transform", params: { translation: [ w/2-legSize/2, -d/2+legSize/2, -seatH/2] }, inputs: { child: "leg2" } },
                { node_id: "leg3pos", node_type: "transform", params: { translation: [-w/2+legSize/2,  d/2-legSize/2, -seatH/2] }, inputs: { child: "leg3" } },
                { node_id: "leg4pos", node_type: "transform", params: { translation: [ w/2-legSize/2,  d/2-legSize/2, -seatH/2] }, inputs: { child: "leg4" } }
            ];
            let current = "seat";
            for (let i = 1; i <= 4; i++) {
                const unionId = `union${i}`;
                nodes.push({ node_id: unionId, node_type: "boolean_union", params: {}, inputs: { children: [current, `leg${i}pos`] } });
                current = unionId;
            }
            const finalUnion = "final";
            nodes.push({ node_id: finalUnion, node_type: "boolean_union", params: {}, inputs: { children: [current, "backpos"] } });
            return { nodes, output: finalUnion };
        }
    },
    // 3. Étagère
    {
        category: "shelf",
        patterns: [
            "étagère murale {w}x{d}mm épaisseur {h}mm",
            "tablette {w}mm de large"
        ],
        generator: (w, d, h) => {
            const nodes = [
                { node_id: "shelf", node_type: "solid_block", params: { width: w, depth: d, height: h }, inputs: {} }
            ];
            return { nodes, output: "shelf" };
        }
    },

    // ----- SUPPORTS ÉLECTRONIQUES -----
    // 4. Support téléphone (simple cale inclinée)
    {
        category: "phone_stand",
        patterns: [
            "support téléphone incliné largeur {w}mm hauteur {h}mm",
            "socle pour smartphone {w}x{d}x{h}mm"
        ],
        generator: (w, d, h) => {
            const nodes = [
                { node_id: "base", node_type: "solid_block", params: { width: w, depth: d, height: 10 }, inputs: {} },
                { node_id: "back", node_type: "solid_block", params: { width: w, depth: 5, height: h }, inputs: {} },
                { node_id: "backpos", node_type: "transform", params: { translation: [0, d/2 - 5, h/2 + 5] }, inputs: { child: "back" } }
            ];
            const unionId = "stand";
            nodes.push({ node_id: unionId, node_type: "boolean_union", params: {}, inputs: { children: ["base", "backpos"] } });
            return { nodes, output: unionId };
        }
    },
    // 5. Support mural pour TV
    {
        category: "tv_mount",
        patterns: [
            "support mural TV largeur {w}mm hauteur {h}mm",
            "fixation murale pour écran {w}x{h}mm"
        ],
        generator: (w, d, h) => {
            const nodes = [
                { node_id: "plate", node_type: "solid_block", params: { width: w, depth: 10, height: h }, inputs: {} }
            ];
            return { nodes, output: "plate" };
        }
    },
    // 6. Support tablette (rectangulaire avec rainure)
    {
        category: "tablet_stand",
        patterns: [
            "support tablette largeur {w}mm hauteur {h}mm",
            "socle pour tablette {w}x{d}x{h}mm"
        ],
        generator: (w, d, h) => {
            const nodes = [
                { node_id: "base", node_type: "solid_block", params: { width: w, depth: d, height: 15 }, inputs: {} },
                { node_id: "groove", node_type: "solid_block", params: { width: w-20, depth: 5, height: 10 }, inputs: {} },
                { node_id: "groovepos", node_type: "transform", params: { translation: [0, d/2 - 10, 5] }, inputs: { child: "groove" } },
                { node_id: "stand", node_type: "boolean_difference", params: {}, inputs: { children: ["base", "groovepos"] } }
            ];
            return { nodes, output: "stand" };
        }
    },

    // ----- COQUES ET BOÎTIERS -----
    // 7. Coque iPhone (rectangle arrondi)
    {
        category: "iphone_case",
        patterns: [
            "coque iPhone largeur {w}mm hauteur {h}mm épaisseur {t}mm",
            "étui téléphone {w}x{h}mm"
        ],
        generator: (w, h, t) => {
            const nodes = [
                { node_id: "outer", node_type: "solid_block", params: { width: w, depth: t, height: h }, inputs: {} },
                { node_id: "inner", node_type: "solid_block", params: { width: w-4, depth: t-1, height: h-4 }, inputs: {} },
                { node_id: "innerpos", node_type: "transform", params: { translation: [0, 0, 0] }, inputs: { child: "inner" } },
                { node_id: "case", node_type: "boolean_difference", params: {}, inputs: { children: ["outer", "innerpos"] } }
            ];
            return { nodes, output: "case" };
        }
    },
    // 8. Coque ordinateur portable (base + écran simplifié)
    {
        category: "laptop_case",
        patterns: [
            "coque ordinateur portable largeur {w}mm profondeur {d}mm",
            "étui PC {w}x{d}mm"
        ],
        generator: (w, d, h) => {
            const nodes = [
                { node_id: "base", node_type: "solid_block", params: { width: w, depth: d, height: 10 }, inputs: {} }
            ];
            return { nodes, output: "base" };
        }
    },
    // 9. Boîtier électronique (avec couvercle)
    {
        category: "electronic_box",
        patterns: [
            "boîtier électronique {w}x{d}x{h}mm",
            "enclosure {w}x{d}x{h}mm"
        ],
        generator: (w, d, h) => {
            const wall = 3;
            const nodes = [
                { node_id: "outer", node_type: "solid_block", params: { width: w, depth: d, height: h }, inputs: {} },
                { node_id: "inner", node_type: "solid_block", params: { width: w-2*wall, depth: d-2*wall, height: h-wall }, inputs: {} },
                { node_id: "innerpos", node_type: "transform", params: { translation: [0, 0, wall] }, inputs: { child: "inner" } },
                { node_id: "box", node_type: "boolean_difference", params: {}, inputs: { children: ["outer", "innerpos"] } }
            ];
            return { nodes, output: "box" };
        }
    },

    // ----- OBJETS DIVERS -----
    // 10. Bloc parallélépipédique (fallback)
    {
        category: "block",
        patterns: [
            "bloc parallélépipédique {w}x{d}x{h}mm",
            "cube de {size}mm",
            "prisme rectangulaire {w}x{d}x{h}mm"
        ],
        generator: (w, d, h) => {
            const nodes = [
                { node_id: "block", node_type: "solid_block", params: { width: w, depth: d, height: h }, inputs: {} }
            ];
            return { nodes, output: "block" };
        }
    }
];

// ============================================================
// UTILITAIRES
// ============================================================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateExample() {
    const template = templates[Math.floor(Math.random() * templates.length)];
    const pattern = template.patterns[Math.floor(Math.random() * template.patterns.length)];
    
    // Génération aléatoire des dimensions selon les placeholders
    let w, d, h, t;
    if (pattern.includes('{w}') && pattern.includes('{d}') && pattern.includes('{h}')) {
        w = randomInt(50, 2000);
        d = randomInt(30, 1200);
        h = randomInt(10, 900);
        t = randomInt(2, 10);
    } else if (pattern.includes('{w}') && pattern.includes('{h}')) {
        w = randomInt(50, 400);
        h = randomInt(100, 300);
        d = randomInt(5, 20);
    } else if (pattern.includes('{size}')) {
        const size = randomInt(20, 500);
        w = d = h = size;
    } else {
        w = randomInt(100, 800);
        d = randomInt(50, 500);
        h = randomInt(20, 200);
    }
    
    let text = pattern
        .replace('{w}', w)
        .replace('{d}', d)
        .replace('{h}', h)
        .replace('{t}', t);
    
    const { nodes, output } = template.generator(w, d, h, t);
    const plan = { mode: "CAD", nodes, outputs: { node: output } };
    return { text, plan };
}

// ============================================================
// GÉNÉRATION EN STREAM
// ============================================================

async function generateToFile(total, outputPath) {
    console.log(`🚀 Génération de ${total} exemples CAD variés...`);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stream = fs.createWriteStream(outputPath);
    for (let i = 0; i < total; i++) {
        const ex = generateExample();
        stream.write(JSON.stringify(ex) + '\n');
        if ((i + 1) % 50000 === 0) console.log(`   ${i+1} exemples générés`);
    }
    stream.end();
    console.log(`\n✅ Dataset sauvegardé : ${outputPath}`);
    console.log(`   📊 ${total} exemples`);
}

// ============================================================
// EXÉCUTION
// ============================================================

if (require.main === module) {
    const projectRoot = path.join(__dirname, '..', '..');
    const outputPath = path.join(projectRoot, 'datasets', 'text2cad_500k.jsonl');
    const total = 500000;
    generateToFile(total, outputPath).catch(console.error);
}

module.exports = { generateToFile };
