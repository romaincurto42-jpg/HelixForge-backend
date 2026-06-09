// HelixForge — Gestionnaire de cache simple

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

function get(key) {
  return cache.get(key);
}

function set(key, value, ttl = 3600) {
  cache.set(key, value, ttl);
}

function has(key) {
  return cache.has(key);
}

function del(key) {
  cache.del(key);
}

function flush() {
  cache.flushAll();
}

module.exports = { get, set, has, del, flush };
