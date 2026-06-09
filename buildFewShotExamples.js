// HelixForge 2.0 — Few-shots CAD / SDF pour le LLM

function buildFewShotExamples(mode) {
  if (mode === "CAD") {
    return [
      {
        prompt: "un petit boîtier rectangulaire creux",
        assistant: `{
  "nodes":[
    {"node_id":"outer","node_type":"solid_block","params":{"width":100,"depth":80,"height":40},"inputs":{}},
    {"node_id":"inner","node_type":"solid_block","params":{"width":94,"depth":74,"height":36},"inputs":{}},
    {"node_id":"inner_pos","node_type":"transform","params":{"translation":[3,3,2]},"inputs":{"target":"inner"}},
    {"node_id":"case","node_type":"boolean_difference","params":{},"inputs":{"a":"outer","b":"inner_pos"}}
  ],
  "outputs":{"node":"case"}
}`
      }
    ];
  }
  return [
    {
      prompt: "une forme organique lisse",
      assistant: `{
  "nodes":[
    {"node_id":"s1","node_type":"sdf_primitive","params":{"shape":"sphere","radius":50},"inputs":{}},
    {"node_id":"s2","node_type":"sdf_primitive","params":{"shape":"sphere","radius":40},"inputs":{}},
    {"node_id":"s2_pos","node_type":"sdf_deform","params":{"translate":[30,0,0]},"inputs":{"child":"s2"}},
    {"node_id":"blob","node_type":"sdf_op","params":{"op":"smooth_union","k":20},"inputs":{"a":"s1","b":"s2_pos"}},
    {"node_id":"twisted","node_type":"sdf_deform","params":{"twist":45},"inputs":{"child":"blob"}},
    {"node_id":"mesh","node_type":"sdf_mesher","params":{"resolution":80},"inputs":{"child":"twisted"}}
  ],
  "outputs":{"node":"mesh"}
}`
    }
  ];
}

module.exports = { buildFewShotExamples };
