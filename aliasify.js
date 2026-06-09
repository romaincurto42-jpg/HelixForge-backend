/**
 * FULL AUTO ALIASIFY
 * -------------------
 * Scanne tout le backend, détecte tous les require/import relatifs,
 * les remplace par les alias définis dans package.json,
 * et crée automatiquement les alias manquants.
 */

const fs = require("fs");
const path = require("path");

// IMPORTANT : remonter 2 niveaux pour atteindre la racine du projet
const ROOT = path.resolve(__dirname, "../..");
const BACKEND = path.join(ROOT, "backend");
const PACKAGE_JSON = path.join(ROOT, "package.json");

// Charger package.json
const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
pkg._moduleAliases = pkg._moduleAliases || {};

console.log("🔍 Aliasify: scan du backend…");

// Extensions à traiter
const EXT = [".js"];

// Récupère tous les fichiers JS
function getAllFiles(dir) {
  let results = [];
  fs.readdirSync(dir).forEach((file) => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(full));
    } else if (EXT.includes(path.extname(full))) {
      results.push(full);
    }
  });
  return results;
}

const files = getAllFiles(BACKEND);

// Convertit un chemin absolu en alias si possible
function resolveAlias(absPath) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, "/");

  for (const alias in pkg._moduleAliases) {
    const aliasPath = pkg._moduleAliases[alias];
    if (rel.startsWith(aliasPath)) {
      const sub = rel.slice(aliasPath.length);
      return alias + sub;
    }
  }

  // Sinon créer un alias automatiquement
  const parts = rel.split("/");
  const top = parts.slice(0, 2).join("/");

  const newAlias = "@" + parts[1];
  pkg._moduleAliases[newAlias] = top;

  console.log(`✨ Alias créé : ${newAlias} → ${top}`);

  const sub = rel.slice(top.length);
  return newAlias + sub;
}

// Remplace les require relatifs
function aliasifyFile(file) {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;

  const regex = /(require|from)\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

  content = content.replace(regex, (match, type, relPath) => {
    const abs = path.resolve(path.dirname(file), relPath);

    if (!fs.existsSync(abs) && !fs.existsSync(abs + ".js")) {
      return match;
    }

    const alias = resolveAlias(abs);
    modified = true;

    return `${type}("${alias}")`;
  });

  if (modified) {
    fs.writeFileSync(file, content, "utf8");
    console.log("✔ Aliasifié :", file.replace(ROOT, ""));
  }
}

// Appliquer à tous les fichiers
files.forEach(aliasifyFile);

// Sauvegarder package.json
fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2), "utf8");

console.log("\n🎉 Aliasify terminé !");
console.log("➡ Tous les imports relatifs ont été convertis.");
console.log("➡ Les alias manquants ont été créés automatiquement.");
