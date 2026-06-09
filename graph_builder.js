// strict_translator_fr/graph_builder.js
// AST strict → Graph SDF HF3
// Version simple, deterministe, sans regex

let idCounter = 1;
function newId() {
    return "n" + (idCounter++);
}

function buildPrimitiveNode(primitive) {
    const id = newId();
    return {
        id: id,
        type: primitive,
        // valeurs par defaut (on les remplacera plus tard)
        r: 20,
        size: 40,
        h: 40
    };
}

function buildFeatureNode(feature) {
    const id = newId();

    // On mappe les features vers des primitives SDF simples
    // (tu pourras remplacer par des SDF complexes plus tard)
    let node = { id: id };

    if (feature === "hole") {
        node.type = "cylinder";
        node.h = 60;
        node.r = 5;
    }

    else if (feature === "conical_hole") {
        node.type = "cone";
        node.h = 60;
        node.r1 = 5;
        node.r2 = 0;
    }

    else if (feature === "oblong_hole") {
        node.type = "ellipsoid";
        node.rx = 5;
        node.ry = 2;
        node.rz = 40;
    }

    else if (feature === "boss") {
        node.type = "cylinder";
        node.h = 5;
        node.r = 10;
    }

    else if (feature === "engrave") {
        node.type = "cylinder";
        node.h = 5;
        node.r = 10;
    }

    else if (feature === "shell") {
        node.type = "shell";
        node.thickness = 2;
    }

    else if (feature === "chamfer") {
        node.type = "chamfer";
        node.radius = 3;
    }

    else if (feature === "fillet") {
        node.type = "fillet";
        node.radius = 3;
    }

    return node;
}

function buildOperationNode(op, leftId, rightId) {
    const id = newId();
    return {
        id: id,
        type: "op",
        op: op,
        left: leftId,
        right: rightId
    };
}

function buildGraph(ast) {
    const nodes = [];

    // 1. Primitive principale
    const primNode = buildPrimitiveNode(ast.primitive);
    nodes.push(primNode);

    let rootId = primNode.id;

    // 2. Feature (ex: trou)
    if (ast.feature) {
        const featNode = buildFeatureNode(ast.feature);
        nodes.push(featNode);

        // operation par defaut pour les features
        let op = "subtract";
        if (ast.feature === "boss") op = "union";
        if (ast.feature === "engrave") op = "subtract";

        const opNode = buildOperationNode(op, primNode.id, featNode.id);
        nodes.push(opNode);

        rootId = opNode.id;
    }

    // 3. Operation explicite (ex: union, subtract)
    if (ast.operation && !ast.feature) {
        // si pas de feature, on ne sait pas quoi combiner
        // on laisse juste la primitive
    }

    // 4. Pattern (ex: grille, circulaire)
    if (ast.pattern) {
        const patternNode = {
            id: newId(),
            type: "pattern",
            pattern: ast.pattern,
            target: rootId
        };
        nodes.push(patternNode);
        rootId = patternNode.id;
    }

    // 5. Transformation (ex: translate)
    if (ast.transform) {
        const transformNode = {
            id: newId(),
            type: "transform",
            transform: ast.transform,
            target: rootId
        };
        nodes.push(transformNode);
        rootId = transformNode.id;
    }

    return {
        root: nodes.find(n => n.id === rootId),
        nodes: nodes
    };
}

module.exports = buildGraph;
