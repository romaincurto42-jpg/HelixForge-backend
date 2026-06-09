// HelixForge 2.0 — Router minimal pour Module 2

const { routePrompt } = require("@root/ai/prompt/routePrompt");
const { buildFewShotExamples } = require("@root/ai/prompt/buildFewShotExamples");

module.exports = {
  routePrompt,
  buildFewShotExamples
};
