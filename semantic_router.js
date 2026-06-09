const { parseHF3 } = require('./hf3_parser_router');

module.exports = function semanticRouter(prompt) {
    return parseHF3(prompt);
};
