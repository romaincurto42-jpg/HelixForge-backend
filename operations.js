// strict_translator_fr/operations.js
// Dictionnaire FR → opérations booléennes SDF strictes (HF3)

module.exports = {
    // Soustraction / trou / creux
    subtract: [
        "trou", "perce", "percer", "percee",
        "soustraction", "moins", "enlever",
        "creux", "creuse", "creuser"
    ],

    // Union / ajout / relief
    union: [
        "union", "fusion", "fusionne", "fusionner",
        "ajout", "ajoute", "ajouter",
        "relief", "bosse", "bossage",
        "pose", "posee", "pose sur"
    ],

    // Intersection
    intersect: [
        "intersection", "intersecte", "intersecter",
        "croisement", "croise"
    ],

    // Smooth union (utile pour relief doux)
    smooth_union: [
        "lisse", "fusion lisse", "arrondi", "arrondir"
    ],

    // Découpe par plan
    slice: [
        "decoupe", "decouper", "coupe", "couper",
        "trancher", "tranche"
    ],

    // Emboss / deboss (relief / gravure)
    emboss: [
        "embossage", "embosser", "relief"
    ],

    deboss: [
        "gravure", "grave", "graver", "debossage"
    ]
};
