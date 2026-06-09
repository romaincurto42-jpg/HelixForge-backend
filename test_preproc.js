const { preprocessSDF } = require('./ai/prompt/semantic_preprocessor.js')

const code = `shape box()
twist(45, "ramp")
inflate(1)
stretch("X", 1.5)
twist(90, "ramp")
noise(1, 0.1, true)
smooth(0.8)
noise(2, 0.3, true)`;

console.log(preprocessSDF(code));
