// strict_translator_fr/transformations.js
// Dictionnaire FR → transformations SDF strictes (HF3)

module.exports = {
    // Translation / déplacement
    translate: [
        "deplace", "deplacer", "deplacee",
        "positionne", "positionner",
        "translate", "translation",
        "a", "au", "aux"
    ],

    // Rotation
    rotate: [
        "tourne", "tourner", "rotation",
        "pivote", "pivoter",
        "rotate"
    ],

    // Mise à l'échelle
    scale: [
        "echelle", "agrandi", "agrandir",
        "reduire", "reduit", "scale"
    ],

    // Miroir / symétrie
    mirror: [
        "miroir", "symetrique", "symetrie",
        "inverser", "inverse"
    ],

    // Effilement (utile pour cônes, taper)
    taper: [
        "effile", "effiler", "effilement",
        "conicite", "conique", "taper"
    ],

    // Twist (torsion stricte)
    twist: [
        "torsion", "tordre", "tordu",
        "vrille", "vriller", "twist"
    ],

    // Courbure / bend
    bend: [
        "courbe", "courber", "courbure",
        "plier", "plie", "bend"
    ]
};
