const { parseHF3 } = require('./hf3_parser_router');

function buildBiomorphic(prompt) {
    return parseHF3(prompt);
}

module.exports = { buildBiomorphic };
