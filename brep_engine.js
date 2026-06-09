// backend/cad/brep/brep_engine.js

const path = require("path");
const fs = require("fs");
const { initOpenCASCADE } = require("@root/cad/brep/opencascade_wrapper");

async function helixPlanToBRep(plan) {
  const occ = await initOpenCASCADE();

  // On va utiliser un document XCAF (assemblage, métadonnées)
  const app = new occ.XCAFApp_Application_();
  const docPtr = { value: null };
  app.NewDocument("MDTV-Standard", docPtr);
  const doc = docPtr.value;

  const shapeTool = occ.XCAFDoc_DocumentTool.ShapeTool(doc.Main());

  // Pour l’instant, on va juste accumuler les shapes dans un tableau
  const shapes = [];

  for (const node of plan.nodes || []) {
    const p = node.params || {};
    let shape = null;

    if (node.node_type === "solid_block") {
      const w = p.width  || p.x || 100;
      const d = p.depth  || p.y || 100;
      const h = p.height || p.z || 100;

      const boxMaker = new occ.BRepPrimAPI_MakeBox(w, d, h);
      shape = boxMaker.Shape();
    }

    if (node.node_type === "solid_cylinder") {
      const r = p.radius || 10;
      const h = p.height || 20;

      const cylMaker = new occ.BRepPrimAPI_MakeCylinder(r, h);
      shape = cylMaker.Shape();
    }

    // TODO: sphere, cone, torus, etc.

    if (shape) {
      // Transform simple : translation
      if (node.transform && (node.transform.x || node.transform.y || node.transform.z)) {
        const t = node.transform;
        const trsf = new occ.gp_Trsf_();
        trsf.SetTranslation(
          new occ.gp_Vec_(
            t.x || 0,
            t.y || 0,
            t.z || 0
          )
        );
        const brepTr = new occ.BRepBuilderAPI_Transform_1(shape, trsf, false);
        shape = brepTr.Shape();
      }

      shapes.push(shape);
      shapeTool.AddShape(shape);
    }
  }

  return { occ, doc, shapeTool, shapes };
}

async function exportBRepToStep(brep, outputPath) {
  const { occ, doc } = brep;

  const writer = new occ.STEPCAFControl_Writer_1();
  const mode = occ.IFSelect_RetDone;
  writer.Transfer(doc, occ.STEPControl_AsIs);
  const status = writer.Write(outputPath);

  if (status !== mode) {
    throw new Error("Échec de l’écriture STEP, status=" + status);
  }

  return outputPath;
}

async function helixPlanToStep(plan, outputDir = path.join(process.cwd(), "models", "step")) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outPath = path.join(outputDir, "helix_plan.step");

  const brep = await helixPlanToBRep(plan);
  const stepPath = await exportBRepToStep(brep, outPath);

  console.log("✅ STEP généré :", stepPath);
  return stepPath;
}

module.exports = {
  helixPlanToBRep,
  exportBRepToStep,
  helixPlanToStep
};
