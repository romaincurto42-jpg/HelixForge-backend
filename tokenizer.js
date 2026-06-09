// strict_translator_fr/tokenizer.js
// Tokenizer FR sans aucune regex complexe

function isWhitespace(ch) {
    return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isLetter(ch) {
    const code = ch.charCodeAt(0);
    // a-z
    if (code >= 97 && code <= 122) return true;
    // A-Z
    if (code >= 65 && code <= 90) return true;
    // chiffres
    if (code >= 48 && code <= 57) return true;
    // underscore
    if (ch === "_") return true;
    return false;
}

function isPunct(ch) {
    return ch === "(" || ch === ")" ||
           ch === "{" || ch === "}" ||
           ch === "[" || ch === "]" ||
           ch === "," || ch === "+" ||
           ch === "-" || ch === "*" ||
           ch === "/" || ch === ".";
}

function tokenize(text) {
    if (!text || typeof text !== "string") return [];

    // normalisation minimale
    let s = text.toLowerCase();
    s = s.replace(/\s+/g, " ").trim();

    const tokens = [];
    let current = "";

    for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (isWhitespace(ch)) {
            if (current.length > 0) {
                tokens.push(current);
                current = "";
            }
            continue;
        }

        if (isPunct(ch)) {
            if (current.length > 0) {
                tokens.push(current);
                current = "";
            }
            tokens.push(ch);
            continue;
        }

        if (isLetter(ch)) {
            current += ch;
            continue;
        }

        // tout le reste : on le jette ou on le coupe
        if (current.length > 0) {
            tokens.push(current);
            current = "";
        }
    }

    if (current.length > 0) {
        tokens.push(current);
    }

    return tokens;
}

module.exports = tokenize;
