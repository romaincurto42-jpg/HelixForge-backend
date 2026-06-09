// HelixForge — Moniteur de performance

const os = require('os');

let startTime = Date.now();
let requestCount = 0;

function recordRequest() {
  requestCount++;
}

function getStats() {
  const uptime = Date.now() - startTime;
  return {
    uptime_ms: uptime,
    requests_per_second: (requestCount / (uptime / 1000)).toFixed(2),
    memory_usage_mb: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
    cpu_load: os.loadavg()
  };
}

module.exports = { recordRequest, getStats };
