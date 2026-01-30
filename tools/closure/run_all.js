#!/usr/bin/env node
// tools/closure/run_all.js
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (typeof r.status === "number") return r.status;
  return 2;
}

function refuse(msg) {
  console.error("REFUSE:", msg);
  process.exit(3);
}

function main() {
  const archGraph  = process.argv[2];
  const cases      = process.argv[3];
  const sessionDir = process.argv[4];

  if (!archGraph || !cases || !sessionDir) {
    refuse("Usage: node tools/closure/run_all.js <arch_graph.json> <governance_cases.json> <session_dir>");
  }

  const t1 = run("node", [path.join("tools", "closure", "closure_graph_check.js"), archGraph]);
  if (t1 !== 0) process.exit(t1);

  const t2 = run("node", [path.join("tools", "closure", "governance_determinism_test.js"), cases]);
  if (t2 !== 0) process.exit(t2);

  const t3 = run("node", [path.join("tools", "closure", "historical_closure_test.js"), sessionDir]);
  if (t3 !== 0) process.exit(t3);

  console.log("PASS: ACTS v1.0 — Architectural Closure Sealed (ALI + GDT + HCC).");
  process.exit(0);
}

main();
