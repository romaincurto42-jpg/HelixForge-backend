// HelixForge 3.0 — Exécution de scripts Python
const { execFile } = require('child_process');
const path = require('path');

// IMPORTANT : pas de guillemets autour du chemin Python
const PYTHON = process.env.PYTHON_PATH || 'python';

console.log("[HelixForge] Python utilisé :", PYTHON);

function runPythonScript(scriptPath, args = [], stdinData = null) {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      PYTHON,
      [scriptPath, ...args],
      {
        maxBuffer: 50 * 1024 * 1024,
        env: process.env,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`[Python] Erreur d'exécution: ${error.message}`);
          console.error(stderr);
          return reject(error);
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`Sortie Python non JSON: ${stdout}\n${stderr}`));
        }
      }
    );

    if (stdinData) {
      proc.stdin.write(JSON.stringify(stdinData));
      proc.stdin.end();
    }
  });
}

module.exports = { runPythonScript };
