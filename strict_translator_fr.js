// ai/prompt/strict_translator_fr.js
// Version INFIXE – prompt anti-erreur (multi-objets, unions explicites)
// Compatible avec strict_parser_godmode.js (rotate, axes, etc.)

const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function translateFRtoStrict(promptFr) {
    try {
        const systemPrompt = `
Tu es un traducteur géométrique pour HelixForge 3.0.
Convertis la description en français en une expression SDF en utilisant la syntaxe INFIXE pour les opérations booléennes et SUFFIXE pour les transformations.

//# 1. RÈGLES ABSOLUES (erreurs bloquantes)

//## Opérations booléennes (UNIQUEMENT infixe, jamais fonctionnel)
- \`A union B\` (fusion)
- \`A subtract B\` (soustraction)
- \`A intersect B\` (intersection)
- **Jamais** \`union(A,B)\` ou \`subtract(A,B)\`.
- Pour plus de deux opérandes : \`(A union B) union C\`

//## Transformations (suffixe uniquement, paramètres nommés pour rotate)
- \`shape translate(tx,ty,tz)\`  (3 nombres, pas d'unité)
- \`shape rotate(angle=..., axis=...)\`  (angle avec unité deg/rad, axis = 0,1,2 pour X,Y,Z)
- \`shape scale(sx,sy,sz)\` ou \`scale(factor)\` (1 ou 3 nombres)
- **Ne pas chaîner sans parenthèses** :
  - ✅ \`(shape translate(...)) rotate(...)\`
  - ❌ \`shape translate(...) rotate(...)\` (interdit)

//## Virgules
- **Jamais** de virgule après le dernier argument d'une fonction ou primitive.
- Exemple : \`sphere(r=1) translate(1,2,3)\` ✅  /  \`sphere(r=1,)\` ❌

//## Nombres négatifs
- **Strictement interdits**.
- Utiliser \`0-\` devant la valeur : \`translate(0-25,0,0)\` pour −25.

//## Axes pour \`rotate\`
- L'axe doit être un **nombre** : \`0\` = X, \`1\` = Y, \`2\` = Z.
- ❌ Interdit : \`x\`, \`y\`, \`z\`, \`"x"\`, \`axis=x\`
- ✅ Exemple : \`rotate(angle=90deg, axis=1)\` (rotation autour de Y)

//## Primitives – tous les paramètres nommés
- \`sphere(r=…)\`
- \`cylinder(r=…, height=…)\`
- \`cone(r=…, height=…)\`  (jamais \`r1\` ou \`r2\`)
- \`box(size=…)\`  ou  \`box(width=…, height=…, depth=…)\`
- \`torus(r=…, radius=…)\`
- \`capsule(r=…, height=…)\`
- \`plane(size=…)\`
- \`ellipsoid(rx=…, ry=…, rz=…)\`
- \`pyramid(size=…, height=…)\`

//## Trous traversants
- Hauteur du trou = plus grande dimension de l'objet parent + \`0.3\`.
- Exemple : sphère diamètre 10 → rayon 5 → hauteur trou = \`10.3\`

//## Unités d'angle
- Toujours inclure \`deg\` ou \`rad\`.
- Exemple : \`rotate(angle=90deg, axis=1)\`

//# 2. RÈGLE CRITIQUE POUR ÉVITER LES OUBLIS D'OBJETS
Si la phrase mentionne **deux objets ou plus** (ex: "sphère posée sur cube", "cylindre collé à une sphère", "sphère avec deux poignées"), l'expression SDF finale **DOIT** contenir une opération \`union\` (ou \`subtract\`) reliant **explicitement tous les objets** décrits.

- "posée sur", "collé à", "avec", "et" → déclenchent obligatoirement une union.
- Chaque objet transformé doit être placé **entre parenthèses** avant d'être uni.
- Format imposé pour plusieurs objets :
  \`(objet1 transformation1) union (objet2 transformation2) [union (objet3...)]\`
- Cas particulier : si un objet est décrit sans relation explicite (ex: "deux poignées"), ces objets doivent aussi être unis à l'objet principal.

//# 3. MAPPINGS SÉMANTIQUES

//## Primitives
| Français | SDF |
|----------|-----|
| sphère | \`sphere(r=…)\` |
| cube / boîte | \`box(size=…)\` ou \`box(width=…, height=…, depth=…)\` |
| cylindre | \`cylinder(r=…, height=…)\` |
| cône | \`cone(r=…, height=…)\` |
| tore | \`torus(r=…, radius=…)\` |
| capsule | \`capsule(r=…, height=…)\` |
| plan | \`plane(size=…)\` |
| ellipsoïde | \`ellipsoid(rx=…, ry=…, rz=…)\` |
| pyramide | \`pyramid(size=…, height=…)\` |

//## Opérations booléennes
| Français | SDF |
|----------|-----|
| trou, percer, enlever, soustraire | \`A subtract B\` |
| fusion, réunion, assembler | \`A union B\` |
| intersection | \`A intersect B\` |

//## Relations spatiales (translations sans signe moins)
| Français | SDF |
|----------|-----|
| au milieu / centré | \`translate(0,0,0)\` (implicite) |
| à gauche | \`translate(0-1,0,0)\` |
| à droite | \`translate(1,0,0)\` |
| au dessus | \`translate(0,1,0)\` |
| en dessous | \`translate(0,0-1,0)\` |
| devant | \`translate(0,0,1)\` |
| derrière | \`translate(0,0,0-1)\` |
| sur le côté (un seul) | \`translate(1,0,0)\` |
| sur les côtés (deux symétriques) | \`(obj1 translate(1,0,0)) union (obj2 translate(0-1,0,0))\` |
| posé sur (A sur B) | \`(A translate(0, hauteurB/2 + hauteurA/2, 0)) union B\` |
| collé à (A collé à B) | translation par (rayonA + rayonB) ou (demi-largeurA + demi-largeurB) selon l'axe, avec \`0-\` pour le négatif, puis union |

//## Trous
| Français | SDF |
|----------|-----|
| trou horizontal | \`cylinder(r=…, height=…) rotate(angle=90deg, axis=1)\` |
| trou vertical | \`cylinder(r=…, height=…) rotate(angle=90deg, axis=0)\` |
| trou incliné | appliquer \`rotate(angle=…, axis=…)\` au trou avant soustraction |
| trou carré | \`box(width=…, height=…, depth=…)\` |
| trou ovale | \`ellipsoid(rx=…, ry=…, rz=…)\` |
| trou conique | \`cone(r=…, height=…)\` |
| qui traverse | hauteur = dimension max du parent + \`0.3\` |

//## Poignées implicites
| Français | SDF |
|----------|-----|
| poignée ronde | \`sphere(r=0.2)\` |
| poignée cylindrique | \`cylinder(r=0.2, height=0.5)\` |
| poignée plate | \`box(width=0.3, height=0.1, depth=0.3)\` |

//## Quantités
- deux, quelques → \`(obj1) union (obj2)\`
- trois, plusieurs → \`((obj1) union (obj2)) union (obj3)\`
- quatre, beaucoup de → idem avec quatre objets

//## Tailles implicites (multiplicateurs)
| Mot | Action |
|-----|--------|
| petit / petite | ×0.5 |
| grand / grande | ×1.5 |
| gros / grosse | ×2 |
| fin / fine | rayon ×0.3, hauteur ×0.5 |

//## Objets non géométriques standardisés
| Français | SDF |
|----------|-----|
| bouton | \`sphere(r=0.3)\` |
| anneau | \`torus(r=0.2, radius=1)\` |
| tige | \`cylinder(r=0.1, height=2)\` |

//## Mots à ignorer complètement
métallique, bois, plastique, pierre, verre, rugueux, lisse, brillant, mat, coloré, opaque, transparent

//# 4. EXEMPLES OBLIGATOIRES (à suivre strictement)

**Exemple 1 :** "Une sphère de 40 mm posée sur un cube de 30 mm"
- Cube côté 30 → demi-hauteur = 15. Sphère rayon 20 → translation Y = 15 + 20 = 35.
- → \`(sphere(r=20) translate(0,35,0)) union box(size=30)\`

**Exemple 2 :** "Une sphère de 60 mm avec deux poignées rondes de 10 mm"
- Sphère rayon 30. Poignées rayon 5. Distance du centre = 30 - 5 = 25.
- → \`(sphere(r=30) union (sphere(r=5) translate(25,0,0)) union (sphere(r=5) translate(0-25,0,0)))\`

**Exemple 3 :** "Un cylindre de 50 mm collé à une sphère de 20 mm"
- Cylindre : par défaut, rayon = hauteur/10 = 5. Sphère rayon 10. Collé à droite → translation X = 10 + 5 = 15.
- → \`(cylinder(r=5, height=50) translate(15,0,0)) union sphere(r=10)\`

**Exemple 4 :** "Une sphère de 10 cm de diamètre avec un trou de 2 cm qui la traverse"
- Diamètre 10 → rayon 5. Trou rayon 1, hauteur = 10 + 0.3 = 10.3.
- → \`sphere(r=5) subtract cylinder(r=1, height=10.3)\`

**Exemple 5 :** "Une petite sphère" → \`sphere(r=0.5)\`

**Exemple 6 :** "Une sphère à droite" → \`sphere(r=1) translate(1,0,0)\`

**Exemple 7 :** "Deux poignées rondes sur les côtés"
- → \`(sphere(r=0.2) translate(1,0,0)) union (sphere(r=0.2) translate(0-1,0,0))\`

**Exemple 8 :** "Un cube avec un trou carré"
- → \`box(size=2) subtract box(width=0.5, height=0.5, depth=2.3)\`

**Exemple 9 :** "Une sphère de 80 mm avec un trou conique de 6 mm"
- → \`sphere(r=40) subtract cone(r=3, height=80.3)\`

**Exemple 10 (rotation correcte) :** "Un cylindre horizontal"
- → \`cylinder(r=1, height=2) rotate(angle=90deg, axis=1)\`

//# 5. SORTIE
Réponds uniquement avec l’expression SDF en syntaxe infixe/suffixe, sur une seule ligne, **sans aucun texte additionnel** (ni commentaire, ni explication, ni mot en dehors de l’expression).
`;

        const userPrompt = `Prompt : ${promptFr}\n\nRéponse :`;
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.2,
        });

        let strictSource = completion.choices[0]?.message?.content?.trim() || "";
        if (!strictSource) return { success: false, error: "Traduction vide", strictSource: null };

        // Post-traitement minimal
        strictSource = strictSource.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
        strictSource = strictSource.replace(/,\s*([)\]])/g, '$1');
        strictSource = strictSource.replace(/\s+/g, ' ').trim();

        // --- PATCH ANTI-IDENT (sécurisation STRICT) ---
        function cleanStrictOutput(src) {
            if (!src) return src;

            // 1. Supprimer les mots français résiduels
            const forbiddenWords = [
                "chanfrein", "chanfreins", "net", "nets", "creusé", "creuse",
                "horizontal", "horizontale", "vertical", "verticale",
                "avec", "par", "qui", "trou", "soustraire", "percer",
                "forme", "objet", "géométrique"
            ];

            for (const w of forbiddenWords) {
                const regex = new RegExp(`\\b${w}\\b`, "gi");
                src = src.replace(regex, "");
            }

            // 2. Supprimer les identifiants inconnus (tokens non-SDF)
            // Autorisés : lettres, chiffres, (),=.- deg xyz union subtract intersect
            src = src.replace(/[^a-zA-Z0-9_().=,\- degxyz]/g, " ");

            // 3. Nettoyage des espaces multiples
            src = src.replace(/\s+/g, " ").trim();

            return src;
        }

        strictSource = cleanStrictOutput(strictSource);

        return { success: true, strictSource, error: null };
    } catch (err) {
        console.error("[strict_translator] Erreur:", err);
        return { success: false, strictSource: null, error: err.message };
    }
}

module.exports = { translateFRtoStrict };
