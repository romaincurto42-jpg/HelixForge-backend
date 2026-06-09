// strict_translator_fr/parser.js
// Analyse FR → AST strict (HF3)
// Sans regex, compatible tokenizer minimal

const primitives = require("./primitives");
const operations = require("./operations");
const transformations = require("./transformations");
const features = require("./features");
const patterns = require("./patterns");

function findMatch(tokens, dict) {
    for (const token of tokens) {
        for (const [key, words] of Object.entries(dict)) {
            if (words.includes(token)) {
                return key;
            }
        }
    }
    return null;
}

function parse(tokens) {
    if (!tokens || tokens.length === 0) {
        throw new Error("parser: no tokens");
    }

    // 1. Primitive principale
    const primitive = findMatch(tokens, primitives);
    if (!primitive) {
        throw new Error("parser: no primitive detected");
    }

    // 2. Feature (trou, relief, gravure…)
    const feature = findMatch(tokens, features);

    // 3. Operation (union, subtract…)
    const operation = findMatch(tokens, operations);

    // 4. Pattern (grille, circulaire…)
    const pattern = findMatch(tokens, patterns);

    // 5. Transformation (translate, rotate…)
    const transform = findMatch(tokens, transformations);

    // 6. Construction de l’AST strict
    const ast = {
        type: "shape",
        primitive: primitive,
        feature: feature || null,
        operation: operation || null,
        pattern: pattern || null,
        transform: transform || null,
        // On pourra ajouter les dimensions plus tard
        params: {}
    };

    return ast;
}

module.exports = parse;
