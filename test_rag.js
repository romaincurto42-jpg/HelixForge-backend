// test_rag.js
const path = require('path');
const { getIndexer, resetIndexer } = require("@root/services/rag_indexer");
const { generateWithRAG } = require("@root/services/rag_generator");

async function testIndexer() {
    console.log('\n=== TEST 1 : Indexeur RAG ===');
    try {
        // Reset pour forcer rechargement
        resetIndexer();
        const indexer = getIndexer();
        
        // Stats
        const stats = indexer.getStats();
        console.log(`✅ Index chargé : ${stats.total} exemples`);
        console.log(`   📊 Répartition : ${stats.cad} CAD, ${stats.sdf} SDF`);
        
        // Test recherche CAD
        console.log('\n🔍 Test recherche CAD : "table en bois"');
        const cadExamples = indexer.findSimilar('table en bois', 3);
        console.log(`   Trouvé ${cadExamples.length} exemples`);
        cadExamples.forEach((ex, i) => {
            console.log(`   [${i+1}] ${ex.plan.mode} | "${ex.prompt.substring(0, 40)}..."`);
        });
        
        // Test recherche SDF
        console.log('\n🔍 Test recherche SDF : "blob organique lisse"');
        const sdfExamples = indexer.findSimilar('blob organique lisse', 3);
        console.log(`   Trouvé ${sdfExamples.length} exemples`);
        sdfExamples.forEach((ex, i) => {
            console.log(`   [${i+1}] ${ex.plan.mode} | "${ex.prompt.substring(0, 40)}..."`);
        });
        
        // Vérification cohérence
        const hasSDF = sdfExamples.some(ex => ex.plan.mode === 'SDF');
        const hasCAD = cadExamples.some(ex => ex.plan.mode === 'CAD');
        
        if (!hasSDF) {
            console.warn('⚠️ Pas d\'exemple SDF trouvé pour requête organique');
        }
        if (!hasCAD) {
            console.warn('⚠️ Pas d\'exemple CAD trouvé pour requête meuble');
        }
        
        return hasSDF && hasCAD;
        
    } catch (err) {
        console.error('❌ Échec indexeur :', err.message);
        console.error(err.stack);
        return false;
    }
}

async function testGenerator() {
    console.log('\n=== TEST 2 : Générateur RAG ===');
    
    const tests = [
        { prompt: 'table ronde avec 3 pieds', expectedMode: 'CAD' },
        { prompt: 'blob sphérique organique', expectedMode: 'SDF' }
    ];
    
    let allPassed = true;
    
    for (const test of tests) {
        console.log(`\n📝 Test : "${test.prompt}" (attendu: ${test.expectedMode})`);
        
        try {
            const start = Date.now();
            const plan = await generateWithRAG(test.prompt);
            const duration = Date.now() - start;
            
            console.log(`   ✅ Généré en ${duration}ms`);
            console.log(`   Mode : ${plan.mode} ${plan.mode === test.expectedMode ? '✅' : '⚠️'}`);
            console.log(`   Nœuds : ${plan.nodes?.length}`);
            console.log(`   Sortie : ${plan.outputs?.node}`);
            
            if (plan.mode !== test.expectedMode) {
                console.warn(`   ⚠️ Mode inattendu : ${plan.mode} au lieu de ${test.expectedMode}`);
                allPassed = false;
            }
            
            // Validation structure
            if (!plan.nodes || plan.nodes.length === 0) {
                console.error('   ❌ Pas de nœuds');
                allPassed = false;
            }
            if (!plan.outputs?.node) {
                console.error('   ❌ Pas de nœud de sortie');
                allPassed = false;
            }
            
        } catch (err) {
            console.error(`   ❌ Échec : ${err.message}`);
            allPassed = false;
        }
    }
    
    return allPassed;
}

async function run() {
    console.log('🔍 Démarrage des tests RAG...');
    console.log('CWD:', process.cwd());
    console.log('Datasets attendus :');
    console.log('  -', path.resolve('datasets/text2cad_50k.jsonl'));
    console.log('  -', path.resolve('datasets/sdf_synthetic_10k.jsonl'));
    
    const ok1 = await testIndexer();
    const ok2 = ok1 ? await testGenerator() : false;
    
    console.log('\n' + '='.repeat(50));
    console.log('RÉSUMÉ');
    console.log('='.repeat(50));
    console.log(`Indexeur   : ${ok1 ? '✅' : '❌'}`);
    console.log(`Générateur : ${ok2 ? '✅' : '❌'}`);
    
    if (ok1 && ok2) {
        console.log('\n🎉 RAG opérationnel !');
        console.log('Tu peux intégrer generateWithRAG dans generate_helixplan_v4.js');
    } else {
        console.log('\n⚠️ Problème détecté.');
        if (!ok1) console.log('   → Vérifie les chemins des datasets');
        if (!ok2) console.log('   → Vérifie la connexion Groq et les clés API');
    }
    
    process.exit(ok1 && ok2 ? 0 : 1);
}

run().catch(err => {
    console.error('Crash:', err);
    process.exit(1);
});
