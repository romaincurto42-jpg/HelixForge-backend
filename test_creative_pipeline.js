const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PROMPTS_FILE = path.join(__dirname, "prompts_creative.txt");
const REPORT_FILE = path.join(__dirname, "hf3_creative_report.json");

async function runTest() {
    console.log("=== HF3 CREATIVE PIPELINE TEST ===");

    if (!fs.existsSync(PROMPTS_FILE)) {
        console.error("❌ Fichier introuvable :", PROMPTS_FILE);
        return;
    }

    const prompts = fs.readFileSync(PROMPTS_FILE, "utf8")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith("#"));

    console.log(`→ ${prompts.length} prompts CREATIVE chargés`);
    console.log("→ Test en cours...\n");

    const results = [];
    let success = 0;
    let fail = 0;

    for (const prompt of prompts) {
        const start = performance.now();
        let status = "SUCCESS";
        let error = null;
        let anomaly = null;

        try {
            const res = await axios.post("http://localhost:3000/api/hf3/mesh", {
                mode: "creative",
                prompt: prompt
            });

            const data = res.data;

            // Vérification du mesh
            if (!data || !data.mesh || !data.mesh.vertices || data.mesh.vertices.length === 0) {
                status = "EMPTY_MESH";
                anomaly = "Mesh vide ou invalide";
            }

            // Vérification du graph
            if (!data.graph || !data.graph.nodes || data.graph.nodes.length === 0) {
                anomaly = anomaly ? anomaly + " + NO_GRAPH" : "NO_GRAPH";
            }

        } catch (err) {
            status = "ERROR";

            if (err.response) {
                error = `HTTP ${err.response.status}`;
            } else {
                error = err.message;
            }

            fail++;
        }

        const end = performance.now();

        results.push({
            prompt,
            status,
            error,
            anomaly,
            time_ms: Math.round(end - start)
        });

        if (status === "SUCCESS") success++;

        console.log(
            status === "SUCCESS"
                ? `✔ OK : ${prompt}`
                : `✖ FAIL : ${prompt} → ${error || anomaly}`
        );
    }

    const summary = {
        total: prompts.length,
        success,
        fail,
        success_rate: ((success / prompts.length) * 100).toFixed(1) + "%",
        fail_rate: ((fail / prompts.length) * 100).toFixed(1) + "%"
    };

    const report = { summary, results };

    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");

    console.log("\n=== FIN DU TEST CREATIVE ===");
    console.log("📄 Rapport généré :", REPORT_FILE);
    console.log("Résumé :", summary);
}

runTest();
