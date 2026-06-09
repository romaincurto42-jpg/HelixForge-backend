async function generateShapeFromIA(description) {
    // Ici tu appelles Groq, OpenAI, Mistral, DeepSeek, ton modèle local…
    const prompt = `Génère une forme SDF décrite ainsi : ${description}`;
    const response = await someLLM(prompt);
    return parseFormal(response);
}

async function optimizeShapeWithIA(shape, metric) {
    const prompt = `Optimise cette forme pour réduire ${metric} : ${JSON.stringify(shape)}`;
    const response = await someLLM(prompt);
    return parseFormal(response);
}

module.exports = { generateShapeFromIA, optimizeShapeWithIA };
