#!/usr/bin/env node
// tools/closure/closure_graph_check.js
"use strict";

const fs = require("fs");

function fail(msg, extra) {
  console.error("FAIL:", msg);
  if (extra) console.error(extra);
  process.exit(2);
}
function refuse(msg) {
  console.error("REFUSE:", msg);
  process.exit(3);
}

function edgeKey(a, b) { return `${a}=>${b}`; }

function run() {
  const p = process.argv[2];
  if (!p) refuse("Usage: node tools/closure/closure_graph_check.js <arch_graph.json>");

  if (!fs.existsSync(p)) refuse(`missing ${p}`);

  let g;
  try { g = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { refuse("arch_graph.json parse error"); }

  const nodes = new Set(g.nodes || []);
  const edges = new Set((g.edges || []).map(([a, b]) => edgeKey(a, b)));

  const requiredNodes = [
    "COG", "LAW", "CG", "FCEE", "CLP", "LEAE", "LSTI", "LDTM", "LDBC", "LGO", "LUEIP"
  ];
  for (const n of requiredNodes) {
    if (!nodes.has(n)) fail(`missing required node: ${n}`);
  }

  const requiredEdges = [
    ["COG", "CG"],
    ["LAW", "CG"],
    ["CG", "FCEE"],
    ["FCEE", "CLP"],
    ["LAW", "LEAE"],
    ["LEAE", "LSTI"],
    ["LSTI", "LDTM"],
    ["LDTM", "LDBC"],
    ["LDBC", "LGO"],
    ["LGO", "LUEIP"],
    ["LUEIP", "LAW"]
  ];
  for (const [a, b] of requiredEdges) {
    if (!edges.has(edgeKey(a, b))) fail(`missing required edge: ${a} -> ${b}`);
  }

  // Forbidden bypass edges (minimal mandatory set)
  const forbidden = [
    ["CG", "CLP"],      // bypass FCEE
    ["LDBC", "LAW"],    // bypass LGO+LUEIP
    ["CG", "LUEIP"],    // bypass topology/governance stack
    ["LAW", "LAW"]      // self-update bypass
  ];

  const foundForbidden = forbidden.filter(([a, b]) => edges.has(edgeKey(a, b)));
  if (foundForbidden.length) {
    fail("forbidden bypass edges present", foundForbidden);
  }

  console.log("PASS: Architectural Loop Integrity (ALI) graph constraints satisfied.");
  process.exit(0);
}

run();
