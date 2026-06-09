// HelixForge 3.0 — Depth Estimator (MiDaS / DPT ONNX Runtime) avec fallback

const ort = require("onnxruntime-node");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

let session = null;
const MODEL_PATH = path.join(process.cwd(), "backend", "ai", "vision", "models", "midas_v21_small_256.onnx");

async function loadModel() {
  if (!session && fs.existsSync(MODEL_PATH)) {
    console.log("🔵 Chargement du modèle MiDaS :", MODEL_PATH);
    session = await ort.InferenceSession.create(MODEL_PATH);
    console.log("🟢 Modèle MiDaS chargé !");
  }
  return session;
}

// Fallback simple : profondeur proportionnelle à la largeur de l’image
function estimateDepthFallback(imagePath) {
  return new Promise((resolve) => {
    sharp(imagePath)
      .metadata()
      .then((metadata) => {
        const width = metadata.width;
        const height = metadata.height;
        const depthMap = new Float32Array(width * height);
        const centerX = width / 2;
        const centerY = height / 2;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const dx = (x - centerX) / width;
            const dy = (y - centerY) / height;
            const dist = Math.sqrt(dx*dx + dy*dy);
            depthMap[y * width + x] = 0.5 + dist * 0.5; // entre 0.5 et 1.0
          }
        }
        resolve(depthMap);
      })
      .catch(() => resolve(null));
  });
}

async function estimateDepth(imagePath) {
  try {
    const sess = await loadModel();
    if (sess) {
      const inputName = sess.inputNames[0];
      console.log("📥 Input attendu par le modèle :", inputName);

      // Redimensionner l'image à 256x256 et obtenir les données brutes RGB
      const imgBuffer = await sharp(imagePath)
        .resize(256, 256)
        .raw()
        .toBuffer({ resolveWithObject: true });
      const { data, info } = imgBuffer; // data est Uint8Array de taille 256*256*3

      // Convertir en Float32Array normalisé [0,1]
      const floatData = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        floatData[i] = data[i] / 255.0;
      }

      // Reformatage en NCHW (1, 3, 256, 256)
      const chwData = new Float32Array(1 * 3 * 256 * 256);
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const pixelIndex = (y * 256 + x) * 3;
          const chwIndex = 0 * 3*256*256 + 0*256*256 + y*256 + x; // channel 0
          chwData[0*3*256*256 + 0*256*256 + y*256 + x] = floatData[pixelIndex];     // R
          chwData[0*3*256*256 + 1*256*256 + y*256 + x] = floatData[pixelIndex + 1]; // G
          chwData[0*3*256*256 + 2*256*256 + y*256 + x] = floatData[pixelIndex + 2]; // B
        }
      }

      const inputTensor = new ort.Tensor("float32", chwData, [1, 3, 256, 256]);
      const feeds = { [inputName]: inputTensor };
      const output = await sess.run(feeds);
      const outputName = sess.outputNames[0];
      return output[outputName].data;
    }
  } catch (err) {
    console.error("Depth estimation error (ONNX):", err.message);
  }
  // Fallback
  console.log("Using fallback depth estimation");
  return estimateDepthFallback(imagePath);
}

module.exports = { estimateDepth };
