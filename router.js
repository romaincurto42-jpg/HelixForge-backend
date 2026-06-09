const { detectDomain } = require("@root/ai/router/domain_detector");

function routeGeneration(prompt) {
  return detectDomain(prompt);
}

module.exports = { routeGeneration };
