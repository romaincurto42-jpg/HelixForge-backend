// backend/scripts/generate_sdf_500k.js
const fs = require('fs');
const path = require('path');

// ============================================================
// TEMPLATES SDF (copie intégrale de votre script original)
// ============================================================

const templates = [
    // 1) Primitives simples
    {
        patterns: [
            "blob sphérique de {size}mm",
            "sphère lisse de {size}mm",
            "bille organique de {size}mm",
            "goutte sphérique de {size}mm"
        ],
        generator: (size) => ({
            nodes: [
                { node_id: "sphere", node_type: "sdf_primitive", params: { shape: "sphere", radius: size/2 } },
                { node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: "sphere" } }
            ]
        })
    },
    // 2) Box arrondie
    {
        patterns: [
            "bloc organique {w}x{d}x{h}mm arrondi",
            "pavé lisse {w}x{d}x{h}mm",
            "caisse arrondie {w}x{d}x{h}mm"
        ],
        generator: (w, d, h) => ({
            nodes: [
                { node_id: "box", node_type: "sdf_primitive", params: { shape: "box", sx: w, sy: h, sz: d } },
                { node_id: "round", node_type: "sdf_op", params: { op: "smooth_union", k: 15 }, inputs: { a: "box", b: "box" } },
                { node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: "round" } }
            ]
        })
    },
    // 3) Deux sphères fusionnées
    {
        patterns: [
            "deux blobs fusionnés de {s1}mm et {s2}mm",
            "sphères organiques lisses de {s1}mm et {s2}mm reliées",
            "double goutte {s1}mm {s2}mm"
        ],
        generator: (s1, s2) => ({
            nodes: [
                { node_id: "s1", node_type: "sdf_primitive", params: { shape: "sphere", radius: s1/2 } },
                { node_id: "s2", node_type: "sdf_primitive", params: { shape: "sphere", radius: s2/2 } },
                { node_id: "s2pos", node_type: "sdf_deform", params: { translate: [s1/2 + s2/4, 0, 0] }, inputs: { child: "s2" } },
                { node_id: "fusion", node_type: "sdf_op", params: { op: "smooth_union", k: 20 }, inputs: { a: "s1", b: "s2pos" } },
                { node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: "fusion" } }
            ]
        })
    },
    // 4) Cylindre organique
    {
        patterns: [
            "cylindre lisse de {d}mm sur {h}mm",
            "tube organique diamètre {d}mm hauteur {h}mm",
            "colonne arrondie {d}mm x {h}mm"
        ],
        generator: (d, h) => ({
            nodes: [
                { node_id: "cyl", node_type: "sdf_primitive", params: { shape: "cylinder", radius: d/2, height: h } },
                { node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: "cyl" } }
            ]
        })
    },
    // 5) Torus organique
    {
        patterns: [
            "anneau organique de {R}mm avec tube de {r}mm",
            "tore lisse R={R}mm r={r}mm",
            "couronne arrondie {R}mm"
        ],
        generator: (R, r) => ({
            nodes: [
                { node_id: "torus", node_type: "sdf_primitive", params: { shape: "torus", R: R, r: r } },
                { node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: "torus" } }
            ]
        })
    },
    // 6) Soustraction (trou)
    {
        patterns: [
            "blob avec cavité de {s1}mm creusée de {s2}mm",
            "sphère organique avec trou de {s2}mm",
            "goutte creuse extérieur {s1}mm intérieur {s2}mm"
        ],
        generator: (s1, s2) => ({
            nodes: [
                { node_id: "outer", node_type: "sdf_primitive", params: { shape: "sphere", radius: s1/2 } },
                { node_id: "inner", node_type: "sdf_primitive", params: { shape: "sphere", radius: s2/2 } },
                { node_id: "hole", node_type: "sdf_op", params: { op: "subtract" }, inputs: { a: "outer", b: "inner" } },
                { node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: "hole" } }
            ]
        })
    },
    // 7) Twist (torsade)
    {
        patterns: [
            "colonne torsadée de {h}mm avec twist de {deg}°",
            "cylindre vrillé hauteur {h}mm angle {deg}°",
            "forme torsadée organique {h}mm"
        ],
        generator: (h, deg) => ({
            nodes: [
                { node_id: "cyl", node_type: "sdf_primitive", params: { shape: "cylinder", radius: 20, height: h } },
                { node_id: "twisted", node_type: "sdf_deform", params: { twist: deg }, inputs: { child: "cyl" } },
                { node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: "twisted" } }
            ]
        })
    },
    // 8) Capsule
    {
        patterns: [
            "capsule organique de {h}mm sur {d}mm",
            "pilule lisse longueur {h}mm diamètre {d}mm",
            "goutte allongée {h}mm x {d}mm"
        ],
        generator: (h, d) => ({
            nodes: [
                { node_id: "cap", node_type: "sdf_primitive", params: { shape: "capsule", a: { x:0, y:-h/2, z:0 }, b: { x:0, y:h/2, z:0 }, radius: d/2 } },
                { node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: "cap" } }
            ]
        })
    },
    // 9) Cluster de sphères
    {
        patterns: [
            "amas de {n} blobs de {size}mm",
            "grappe organique de {n} sphères de {size}mm",
            "cluster lisse {n} éléments {size}mm"
        ],
        generator: (n, size) => {
            const radius = size / 2;
            const nodes = [];
            for (let i = 0; i < n; i++) {
                const angle = (i / n) * 2 * Math.PI;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                nodes.push({ node_id: `s${i}`, node_type: "sdf_primitive", params: { shape: "sphere", radius: radius * 0.6 } });
                nodes.push({ node_id: `pos${i}`, node_type: "sdf_deform", params: { translate: [x, 0, z] }, inputs: { child: `s${i}` } });
            }
            let last = "pos0";
            for (let i = 1; i < n; i++) {
                const id = `union${i}`;
                nodes.push({ node_id: id, node_type: "sdf_op", params: { op: "smooth_union", k: 15 }, inputs: { a: last, b: `pos${i}` } });
                last = id;
            }
            nodes.push({ node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: last } });
            return { nodes };
        }
    },
    // 10) Intersection sphère-cube
    {
        patterns: [
            "intersection de sphère {s1}mm et cube {s2}mm",
            "forme organique croisement sphère-cube",
            "métaball mixte {s1}mm {s2}mm"
        ],
        generator: (s1, s2) => ({
            nodes: [
                { node_id: "sphere", node_type: "sdf_primitive", params: { shape: "sphere", radius: s1/2 } },
                { node_id: "box", node_type: "sdf_primitive", params: { shape: "box", sx: s2, sy: s2, sz: s2 } },
                { node_id: "inter", node_type: "sdf_op", params: { op: "intersect" }, inputs: { a: "sphere", b: "box" } },
                { node_id: "mesh", node_type: "sdf_mesher", params: { resolution: 64 }, inputs: { child: "inter" } }
            ]
        })
    }
];

// ============================================================
// GÉNÉRATION ALÉATOIRE DE PARAMÈTRES
// ============================================================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateExample(template) {
    const pattern = template.patterns[Math.floor(Math.random() * template.patterns.length)];
    let text = pattern;
    let plan;

    if (pattern.includes('{size}')) {
        const size = randomInt(20, 150);
        text = text.replace('{size}', size);
        plan = template.generator(size);
    }
    else if (pattern.includes('{w}') && pattern.includes('{d}') && pattern.includes('{h}')) {
        const w = randomInt(50, 200);
        const d = randomInt(50, 200);
        const h = randomInt(30, 150);
        text = text.replace('{w}', w).replace('{d}', d).replace('{h}', h);
        plan = template.generator(w, d, h);
    }
    else if (pattern.includes('{s1}') && pattern.includes('{s2}')) {
        let s1 = randomInt(40, 140);
        let s2 = randomInt(20, s1 - 10);
        if (s2 < 10) s2 = 20;
        text = text.replace('{s1}', s1).replace('{s2}', s2);
        plan = template.generator(s1, s2);
    }
    else if (pattern.includes('{d}') && pattern.includes('{h}')) {
        const d = randomInt(20, 120);
        const h = randomInt(50, 250);
        text = text.replace('{d}', d).replace('{h}', h);
        plan = template.generator(d, h);
    }
    else if (pattern.includes('{R}') && pattern.includes('{r}')) {
        const R = randomInt(30, 90);
        const r = randomInt(5, 25);
        text = text.replace('{R}', R).replace('{r}', r);
        plan = template.generator(R, r);
    }
    else if (pattern.includes('{deg}')) {
        const h = randomInt(80, 300);
        const deg = randomInt(45, 360);
        text = text.replace('{h}', h).replace('{deg}', deg);
        plan = template.generator(h, deg);
    }
    else if (pattern.includes('{n}')) {
        const n = randomInt(2, 6);
        const size = randomInt(40, 140);
        text = text.replace('{n}', n).replace('{size}', size);
        plan = template.generator(n, size);
    }
    else {
        const s1 = randomInt(50, 120);
        const s2 = randomInt(30, 80);
        text = pattern.replace('{s1}', s1).replace('{s2}', s2);
        plan = template.generator(s1, s2);
    }

    return { text, plan: plan.nodes };
}

// ============================================================
// GÉNÉRATION EN STREAM (sans mémoire)
// ============================================================

async function generateDatasetToFile(total, outputPath) {
    console.log(`🚀 Génération de ${total} exemples SDF...`);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stream = fs.createWriteStream(outputPath);
    for (let i = 0; i < total; i++) {
        const template = templates[Math.floor(Math.random() * templates.length)];
        const ex = generateExample(template);
        stream.write(JSON.stringify({ text: ex.text, plan: ex.plan }) + '\n');
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
    const outputPath = path.join(projectRoot, 'datasets', 'sdf_synthetic_500k.jsonl');
    const total = 500000;
    generateDatasetToFile(total, outputPath).catch(console.error);
}

module.exports = { generateDatasetToFile };
