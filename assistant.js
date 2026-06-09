// HelixForge 3.0 — Routeur vocal Vexa (compatible avec ancienne API)

const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const PYTHON = process.env.PYTHON_PATH || "python";
const { VexaRouter } = require("@ai/vexa/vexa_router");
const vexaRouter = new VexaRouter(null, {});

function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .audioCodec("pcm_s16le")
      .audioChannels(1)
      .audioFrequency(16000)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

async function transcribeWithGroq(wavPath) {
  const FormData = require("form-data");
  const axios = require("axios");
  const formData = new FormData();
  formData.append("file", fs.createReadStream(wavPath));
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "json");
  formData.append("language", "fr");

  const res = await axios.post(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      maxBodyLength: Infinity
    }
  );
  return res.data.text || "";
}

function synthesizeSpeech(text) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON, [path.join(__dirname, "../../services/tts/tts_piper.py"), text]);
    let output = "";
    py.stdout.on("data", d => (output += d.toString()));
    py.stderr.on("data", d => console.warn(d.toString()));
    py.on("error", reject);
    py.on("close", () => {
      try {
        const json = JSON.parse(output.trim());
        resolve(json.audioBase64 || null);
      } catch (e) {
        reject(e);
      }
    });
  });
}

router.post("/voice", upload.single("audio"), async (req, res) => {
  try {
    let userText = "";
    if (req.body.text) {
      userText = req.body.text;
    } else if (req.file) {
      const wavPath = req.file.path + ".wav";
      await convertToWav(req.file.path, wavPath);
      userText = await transcribeWithGroq(wavPath);
      fs.unlinkSync(req.file.path);
      fs.unlinkSync(wavPath);
      if (!userText) return res.json({ replyText: "Je n’ai rien entendu.", audioBase64: null });
    } else {
      return res.status(400).json({ replyText: "Aucun texte ou audio fourni.", audioBase64: null });
    }

    const context = {
      lastAction: req.body.lastAction,
      currentModel: req.body.currentModel,
      currentMode: req.body.currentMode
    };
    const { reply, action } = await vexaRouter.processText(userText, context);

    let audioBase64 = null;
    try {
      audioBase64 = await synthesizeSpeech(reply);
    } catch (e) { console.error("TTS error:", e); }

    res.json({ replyText: reply, audioBase64, action });
  } catch (err) {
    console.error("Vexa error:", err);
    res.status(500).json({ replyText: "Erreur interne.", audioBase64: null });
  }
});

module.exports = router;
