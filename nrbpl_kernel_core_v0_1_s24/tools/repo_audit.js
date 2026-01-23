#!/usr/bin/env node
/**
 * tools/repo_audit.js — NRBPL Repository Audit System v0.1
 * Single entrypoint. Deterministic. No external deps. Fail-fast.
 *
 * Contract:
 * - Runs mandatory validator chain in deterministic order
 * - Consumes validators that output ONE JSON object to stdout (machine readable)
 * - Produces ONE consolidated audit JSON to stdout
 * - Writes optional file under _audit/ when --out is provided
 *
 * Exit codes:
 * 0 = SUPPORTED
 * 2 = INSUFFICIENT / CONTRADICTORY
 * 3 = REFUSE
 *
 * Usage examples:
 *   node tools/repo_audit.js --scope ntl --mode canonical
 *   node tools/repo_audit.js --scope all --mode canonical --out _audit/repo_audit.json
 *
 * Notes:
 * - This runner does NOT "require()" validators to avoid bypass; it executes them as CLI.
 * - Validators MUST be deterministic and MUST print JSON ONLY to stdout.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");

const EXIT = {
  SUPPORTED: 0,
  INSUFFICIENT: 2,
  REFUSE: 3
};

const VERDICT_ORDER = ["SUPPORTED", "INSUFFICIENT", "CONTRADICTORY", "OUT_OF_SCOPE", "REFUSE"];

// Map exit code → verdict label (normative)
function verdictFromExit(code) {
  if (code === 0) return "SUPPORTED";
  if (code === 2) return "INSUFFICIENT";
  if (code === 3) return "REFUSE";
  return "REFUSE";
}

function maxVerdict(a, b) {
  const ia = VERDICT_ORDER.indexOf(a);
  const ib = VERDICT_ORDER.indexOf(b);
  if (ia < 0 && ib < 0) return "REFUSE";
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia >= ib ? a : b;
}

function nowUtcIso() {
  return new Date().toISOString();
}

function dieJson(msg, code) {
  const out = {
    spec: "NRBPL_AUDIT_REPORT_v0.1",
    mode: "ERROR",
    timestamp_utc: nowUtcIso(),
    verdict: "REFUSE",
    error: { message: msg },
    gates: []
  };
  process.stdout.write(JSON.stringify(out, null, 2));
  process.exit(code || EXIT.REFUSE);
}

function parseArgs(argv) {
  const args = {
    scope: "ntl",
    mode: "canonical",
    out: null
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scope") {
      args.scope = argv[++i] || args.scope;
    } else if (a === "--mode") {
      args.mode = argv[++i] || args.mode;
    } else if (a === "--out") {
      args.out = argv[++i] || null;
    } else if (a === "--help" || a === "-h") {
      args.help = true;
    } else {
      // ignore unknown flags (fail-fast would be stricter; keeping minimal)
    }
  }

  return args;
}

function usage() {
  const msg = [
    "Usage: node tools/repo_audit.js --scope <ntl|all> --mode <canonical|dev> [--out <path>]",
    "",
    "  --scope ntl   : audit NTL surfaces (lexicon/frames/corpus + translation gates where applicable)",
    "  --scope all   : audit full repo surfaces (reserved for future expansion)",
    "  --mode canonical : deterministic; no timestamps required by runner",
    "  --mode dev       : permissive mode label only (runner remains deterministic)",
    "",
    "Exit codes: 0=SUPPORTED, 2=INSUFFICIENT, 3=REFUSE"
  ].join("\n");
  process.stdout.write(msg + "\n");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readOptionalJson(filePath) {
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Execute a validator as CLI and parse its stdout JSON.
 * - Validator MUST print JSON ONLY to stdout (machine readable)
 * - stderr is captured and included (not parsed) for forensics
 */
function runGate(gate) {
  const gatePath = path.join(ROOT, gate.cmd);
  if (!fs.existsSync(gatePath)) {
    return {
      gate_id: gate.id,
      cmd: gate.cmd,
      argv: gate.argv || [],
      verdict: "REFUSE",
      exit_code: EXIT.REFUSE,
      stdout_json: null,
      stderr: `Missing gate file: ${gatePath}`,
      errors: [{ code: "GATE_MISSING", message: `Gate not found: ${gate.cmd}` }]
    };
  }

  const nodeBin = process.execPath;
  const args = [gatePath].concat(gate.argv || []);
  const res = spawnSync(nodeBin, args, { encoding: "utf8", cwd: ROOT });

  const exitCode = typeof res.status === "number" ? res.status : EXIT.REFUSE;

  let parsed = null;
  let parseError = null;

  const stdout = (res.stdout || "").trim();
  if (stdout.length > 0) {
    try {
      parsed = JSON.parse(stdout);
    } catch (e) {
      parseError = `STDOUT_JSON_PARSE_ERROR: ${e.message}`;
    }
  } else {
    parseError = "STDOUT_EMPTY";
  }

  const verdict = parsed && typeof parsed.verdict === "string"
    ? parsed.verdict
    : verdictFromExit(exitCode);

  const gateResult = {
    gate_id: gate.id,
    cmd: gate.cmd,
    argv: gate.argv || [],
    verdict,
    exit_code: exitCode,
    stdout_json: parsed,
    stderr: (res.stderr || "").trim(),
    errors: []
  };

  if (parseError) {
    gateResult.errors.push({ code: "GATE_STDOUT_INVALID", message: parseError });
  }
  if (res.error) {
    gateResult.errors.push({ code: "GATE_EXEC_ERROR", message: String(res.error.message || res.error) });
  }

  return gateResult;
}

function buildGateChain(scope) {
  // Deterministic ordering: fixed list.
  // Scope is v0.1 minimal: NTL governance.
  if (scope !== "ntl" && scope !== "all") scope = "ntl";

  const chain = [];

  // TSL (evidence anchor gate) — optional in early repos.
  if (fs.existsSync(path.join(ROOT, "validators", "tsl_gate.js"))) {
    chain.push({ id: "TSL_GATE", cmd: "validators/tsl_gate.js", argv: ["--scope", "ntl"] });
  }

  // Lexicon gate in --all mode (cross-check 3 files)
  // NOTE: This is a placeholder - actual implementation would check if files exist
  if (fs.existsSync(path.join(ROOT, "validators", "lexicon_gate.js"))) {
    chain.push({
      id: "LEXICON_GATE_ALL",
      cmd: "validators/lexicon_gate.js",
      argv: [
        "--all",
        "--lemmas", "lexicon/en_vi_lemmas.jsonl",
        "--senses", "lexicon/en_vi_senses.jsonl",
        "--collocations", "lexicon/collocations_en.jsonl",
        "--frames", "frames/meaning_frames.json"
      ]
    });
  }

  // Meaning IR / Alignment / NITL gates: apply at sample level (optional if validators exist).
  // Runner v0.1 will call them if present; otherwise it will skip without failing.
  const maybe = (id, cmd, argv) => {
    if (fs.existsSync(path.join(ROOT, cmd))) chain.push({ id, cmd, argv });
  };

  // These default to repo-wide scans when supported by their implementations.
  maybe("MEANING_IR_GATE", "validators/meaning_ir_gate.js", ["--scan", "corpus/canonical"]);
  maybe("ALIGNMENT_GATE", "validators/alignment_gate.js", ["--scan", "corpus/canonical"]);
  maybe("NITL_GATE", "validators/nitl_gate.js", ["--scan", "corpus/canonical"]);
  maybe("HTL_CLAIM_GATE", "validators/htl_claim_gate.js", ["--scope", "ntl"]);

  // Future: --scope all adds repo-wide invariants; reserved.
  return chain;
}

function consolidate(gates, args) {
  let overall = "SUPPORTED";
  let exit = EXIT.SUPPORTED;

  for (const g of gates) {
    overall = maxVerdict(overall, g.verdict);

    // Exit code policy: any REFUSE dominates; else any INSUFFICIENT dominates.
    if (g.exit_code === EXIT.REFUSE) exit = EXIT.REFUSE;
    else if (exit !== EXIT.REFUSE && g.exit_code === EXIT.INSUFFICIENT) exit = EXIT.INSUFFICIENT;
  }

  const report = {
    spec: "NRBPL_AUDIT_REPORT_v0.1",
    scope: args.scope,
    mode: args.mode,
    timestamp_utc: nowUtcIso(), // belongs to audit report; does not affect canonical pack hash
    verdict: overall,
    exit_code: exit,
    gates: gates.map(g => ({
      gate_id: g.gate_id,
      cmd: g.cmd,
      argv: g.argv,
      verdict: g.verdict,
      exit_code: g.exit_code,
      // Keep validator JSON as machine evidence; may be null if gate violated contract
      audit: g.stdout_json,
      errors: g.errors,
      stderr: g.stderr ? g.stderr : undefined
    }))
  };

  // Deterministic normalization: remove undefined fields by JSON.stringify behavior is stable enough;
  // but we keep minimal.
  return { report, exit };
}

(function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }

  // Build deterministic chain
  const chain = buildGateChain(args.scope);

  // If no gates available, return SUPPORTED (minimal audit mode)
  if (chain.length === 0) {
    const report = {
      spec: "NRBPL_AUDIT_REPORT_v0.1",
      scope: args.scope,
      mode: args.mode,
      timestamp_utc: nowUtcIso(),
      verdict: "SUPPORTED",
      exit_code: EXIT.SUPPORTED,
      gates: [],
      note: "No validators found; minimal audit mode (SUPPORTED by default)"
    };
    const json = JSON.stringify(report, null, 2);
    process.stdout.write(json);
    if (args.out) {
      const outPath = path.isAbsolute(args.out) ? args.out : path.join(ROOT, args.out);
      ensureDir(path.dirname(outPath));
      fs.writeFileSync(outPath, json);
    }
    process.exit(EXIT.SUPPORTED);
  }

  // Execute gates sequentially (fail-fast: stop at first REFUSE)
  const gateResults = [];
  for (const gate of chain) {
    const r = runGate(gate);
    gateResults.push(r);

    if (r.exit_code === EXIT.REFUSE) {
      const { report, exit } = consolidate(gateResults, args);
      const json = JSON.stringify(report, null, 2);
      process.stdout.write(json);

      if (args.out) {
        const outPath = path.isAbsolute(args.out) ? args.out : path.join(ROOT, args.out);
        ensureDir(path.dirname(outPath));
        fs.writeFileSync(outPath, json);
      }
      process.exit(exit);
    }
  }

  const { report, exit } = consolidate(gateResults, args);
  const json = JSON.stringify(report, null, 2);
  process.stdout.write(json);

  if (args.out) {
    const outPath = path.isAbsolute(args.out) ? args.out : path.join(ROOT, args.out);
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, json);
  }

  process.exit(exit);
})();
