function detectDomain(prompt) {
  const p = prompt.toLowerCase();

  if (p.includes("blob") || p.includes("organique") || p.includes("capsule") || p.includes("cluster"))
    return "organic";

  if (p.includes("plaque") || p.includes("boitier") || p.includes("support") || p.includes("charniere"))
    return "mechanical";

  if (p.includes("table") || p.includes("chaise") || p.includes("meuble") || p.includes("étagère"))
    return "furniture";

  if (
    (p.includes("organique") || p.includes("blob")) &&
    (p.includes("plaque") || p.includes("boitier") || p.includes("table"))
  )
    return "hybrid";

  return "cad";
}

module.exports = { detectDomain };
