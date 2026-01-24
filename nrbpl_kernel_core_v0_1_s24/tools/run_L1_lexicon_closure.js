#!/usr/bin/env node
/**
 * tools/run_L1_lexicon_closure.js
 * NRBPL Roadmap Patch v0.1.2 — L1 Closure Runner (Deterministic)
 *
 * One-command closure:
 *  - Generate L1 lemmas 2K
 *  - Generate L1 senses 2K
 *  - Run gate --all
 *  - Collect audit logs
 *  - SHA-256 bind evidence chain
 *  - Emit closure certificate (ΔC→ΔS→ΔP)
 *
 * UGTS Discipline:
 *  - evidence-first
 *  - fail-fast
 *  - deterministic
 *  - scope-locked (n=2000)
 *
 * Exit codes:
 *  0 = SUPPORTED (closure success)
 *  3 = REFUSE (any invariant / precondition violated)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

// -------------------------------
// Config (scope-locked)
// -------------------------------
const LEVEL = "L1";
const N_LEMMAS = 2000;
const MAX_SENSES_PER_LEMMA = 3; // policy: deterministic cap

const ROOT = process.cwd();

const PATHS = {
  locks: {
    scope: path.join(ROOT, "locks", "PATCH_SCOPE_LOCK_v0_1.json"),
    abi: path.join(ROOT, "locks", "KERNEL_ABI_LOCK.json"),
  },
  sources: {
    oxford_seed: path.join(ROOT, "sources", "oxford3000_seed.jsonl"),
    wordnet_top: path.join(ROOT, "sources", "wordnet_top.jsonl"),
    oxford_senses: path.join(ROOT, "sources", "oxford3000_senses.jsonl"),
    wordnet_senses: path.join(ROOT, "sources", "wordnet_senses.jsonl"),
  },
  lexicon: {
    dir: path.join(ROOT, "lexicon"),
    lemmas_2k: path.join(ROOT, "lexicon", "en_vi_lemmas_2k.jsonl"),
    senses_2k: path.join(ROOT, "lexicon", "en_vi_senses_2k.jsonl"),
  },
  audit: {
    dir: path.join(ROOT, "_audit", "l1_lexicon_2k"),
    gen_lemmas_log: path.join(ROOT, "_audit", "l1_lexicon_2k", "01_gen2000_lemmas.log"),
    gen_senses_log: path.join(ROOT, "_audit", "l1_lexicon_2k", "02_gen2000_senses.log"),
    gate_log: path.join(ROOT, "_audit", "l1_lexicon_2k", "03_gate_all.log"),
    replay_cmds: path.join(ROOT, "_audit", "l1_lexicon_2k", "REPLAY_COMMANDS.txt"),
    sha_sums: path.join(ROOT, "_audit", "l1_lexicon_2k", "EVIDENCE_SHA256SUMS.txt"),
    cert: path.join(ROOT, "_audit", "l1_lexicon_2k", "L1_CLOSURE_CERTIFICATE.md"),
  },
  tools: {
    gen_lex: path.join(ROOT, "tools", "gen_lexicon_2k.js"),
    gen_senses: path.join(ROOT, "tools", "gen_senses_2k.js"),
  },
  validators: {
    gate: path.join(ROOT, "validators", "lexicon_gate.js"),
  },
  pkg: path.join(ROOT, "package.json"),
};

// -------------------------------
// Utilities
// -------------------------------
function nowUTC() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function dieRefuse(reasonCode, msg, extra = null) {
  const out = {
    verdict: "REFUSE",
    exit_code: 3,
    level: LEVEL,
    reason_code: reasonCode,
    message: msg,
    extra,
    time_utc: nowUTC(),
  };
  console.error(JSON.stringify(out, null, 2));
  process.exit(3);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function writeText(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

function appendText(p, s) {
  fs.appendFileSync(p, s, "utf8");
}

function sha256File(p) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(p));
  return h.digest("hex");
}

function sha256Bytes(buf) {
  const h = crypto.createHash("sha256");
  h.update(buf);
  return h.digest("hex");
}

function runCmdOrRefuse(cmd, args, opts) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    ...opts,
  });

  if (res.error) {
    dieRefuse("EXEC_ERROR", `Failed to execute ${cmd}`, { error: String(res.error) });
  }
  return res;
}

function runCmdLoggedOrRefuse(cmd, args, logPath) {
  const header = [
    "================================================================================",
    `CMD: ${cmd} ${args.join(" ")}`,
    `TIME_UTC: ${nowUTC()}`,
    "================================================================================",
    "",
  ].join("\n");

  writeText(logPath, header);

  const res = runCmdOrRefuse(cmd, args, {});
  if (res.stdout) appendText(logPath, res.stdout);
  if (res.stderr) appendText(logPath, res.stderr);

  return res;
}

function gitInfoOrRefuse() {
  // branch
  const b = runCmdOrRefuse("git", ["rev-parse", "--abbrev-ref", "HEAD"], {});
  if (b.status !== 0) dieRefuse("GIT_UNAVAILABLE", "git rev-parse branch failed", { stderr: b.stderr });
  const branch = (b.stdout || "").trim();

  // head
  const h = runCmdOrRefuse("git", ["rev-parse", "HEAD"], {});
  if (h.status !== 0) dieRefuse("GIT_UNAVAILABLE", "git rev-parse HEAD failed", { stderr: h.stderr });
  const head = (h.stdout || "").trim();

  // status porcelain must be empty
  const st = runCmdOrRefuse("git", ["status", "--porcelain"], {});
  if (st.status !== 0) dieRefuse("GIT_UNAVAILABLE", "git status failed", { stderr: st.stderr });
  const porcelain = (st.stdout || "").trim();
  if (porcelain.length > 0) {
    dieRefuse("WORKTREE_DIRTY", "Working tree must be CLEAN for deterministic closure", { porcelain });
  }

  return { branch, head };
}

function jsonParseOrRefuse(fp, label) {
  try {
    return JSON.parse(readText(fp));
  } catch (e) {
    dieRefuse("LOCK_PARSE_FAIL", `Invalid JSON in ${label}`, { path: fp, error: String(e) });
  }
}

function countJsonlLinesOrRefuse(fp, label) {
  try {
    const raw = fs.readFileSync(fp, "utf8");
    // strict: each non-empty line counts
    const lines = raw.split("\n").filter((x) => x.trim().length > 0);
    return lines.length;
  } catch (e) {
    dieRefuse("READ_FAIL", `Cannot read ${label}`, { path: fp, error: String(e) });
  }
}

function ensurePreconditionsOrRefuse() {
  // locks
  if (!fileExists(PATHS.locks.scope)) dieRefuse("MISSING_LOCK", "Missing PATCH_SCOPE_LOCK_v0_1.json", { path: PATHS.locks.scope });
  if (!fileExists(PATHS.locks.abi)) dieRefuse("MISSING_LOCK", "Missing KERNEL_ABI_LOCK.json", { path: PATHS.locks.abi });

  // parse locks (schema validation is done by gate; here we ensure parseable)
  jsonParseOrRefuse(PATHS.locks.scope, "PATCH_SCOPE_LOCK_v0_1.json");
  jsonParseOrRefuse(PATHS.locks.abi, "KERNEL_ABI_LOCK.json");

  // sources
  for (const [k, fp] of Object.entries(PATHS.sources)) {
    if (!fileExists(fp)) {
      dieRefuse("MISSING_SOURCE", `Missing source file: ${k}`, { path: fp });
    }
  }

  // tools
  if (!fileExists(PATHS.tools.gen_lex)) dieRefuse("MISSING_TOOL", "Missing tools/gen_lexicon_2k.js", { path: PATHS.tools.gen_lex });
  if (!fileExists(PATHS.tools.gen_senses)) dieRefuse("MISSING_TOOL", "Missing tools/gen_senses_2k.js", { path: PATHS.tools.gen_senses });

  // validator
  if (!fileExists(PATHS.validators.gate)) dieRefuse("MISSING_VALIDATOR", "Missing validators/lexicon_gate.js", { path: PATHS.validators.gate });

  // package.json
  if (!fileExists(PATHS.pkg)) dieRefuse("MISSING_PACKAGE_JSON", "Missing package.json", { path: PATHS.pkg });

  // lexicon dir
  ensureDir(PATHS.lexicon.dir);

  // audit dir
  ensureDir(PATHS.audit.dir);
}

function buildReplayCommands() {
  const cmds = [
    "# NRBPL L1 Closure Replay Commands (deterministic)",
    `# Generated: ${nowUTC()}`,
    "",
    "git status --porcelain",
    "git rev-parse --abbrev-ref HEAD",
    "git rev-parse HEAD",
    "",
    `node tools/gen_lexicon_2k.js --n ${N_LEMMAS} --out ${PATHS.lexicon.lemmas_2k}`,
    `node tools/gen_senses_2k.js --max ${MAX_SENSES_PER_LEMMA} --lemmas ${PATHS.lexicon.lemmas_2k} --out ${PATHS.lexicon.senses_2k}`,
    `node validators/lexicon_gate.js --all --lemmas ${PATHS.lexicon.lemmas_2k} --senses ${PATHS.lexicon.senses_2k}`,
    "",
    "# Evidence binding",
    `sha256sum ${PATHS.lexicon.lemmas_2k} ${PATHS.lexicon.senses_2k} ${PATHS.validators.gate} ${PATHS.tools.gen_lex} ${PATHS.tools.gen_senses} ${PATHS.pkg} ${PATHS.locks.scope} ${PATHS.locks.abi} > ${PATHS.audit.sha_sums}`,
    `sha256sum -c ${PATHS.audit.sha_sums}`,
    "",
  ].join("\n");

  writeText(PATHS.audit.replay_cmds, cmds);
}

function buildEvidenceShaSumsOrRefuse() {
  const paths = [
    // outputs
    PATHS.lexicon.lemmas_2k,
    PATHS.lexicon.senses_2k,
    // audit logs
    PATHS.audit.gen_lemmas_log,
    PATHS.audit.gen_senses_log,
    PATHS.audit.gate_log,
    PATHS.audit.replay_cmds,
    // implementation artifacts
    PATHS.validators.gate,
    PATHS.tools.gen_lex,
    PATHS.tools.gen_senses,
    PATHS.pkg,
    // locks
    PATHS.locks.scope,
    PATHS.locks.abi,
    // sources (L1 must bind sources)
    PATHS.sources.oxford_seed,
    PATHS.sources.wordnet_top,
    PATHS.sources.oxford_senses,
    PATHS.sources.wordnet_senses,
  ];

  const lines = [];
  for (const fp of paths) {
    if (!fileExists(fp)) dieRefuse("EVIDENCE_MISSING", "Missing evidence artifact to hash", { path: fp });
    const sha = sha256File(fp);
    // sha256sum format: "<sha>  <file>"
    const rel = path.relative(ROOT, fp);
    lines.push(`${sha}  ${rel}`);
  }

  const content = lines.join("\n") + "\n";
  writeText(PATHS.audit.sha_sums, content);

  // Verify checksum file deterministically (internal)
  for (const line of lines) {
    const [sha, rel] = line.split(/\s+/);
    const abs = path.join(ROOT, rel);
    const got = sha256File(abs);
    if (got !== sha) {
      dieRefuse("SHA256_MISMATCH", "Checksum verification failed", { file: rel, expected: sha, got });
    }
  }
}

function parseLastJsonObjectFromTextOrNull(text) {
  // heuristic: find last '{' and attempt parse until end
  // deterministic enough for gate/build reports that output JSON
  const idx = text.lastIndexOf("{");
  if (idx < 0) return null;
  const tail = text.slice(idx).trim();
  try {
    return JSON.parse(tail);
  } catch {
    return null;
  }
}

function extractGenReportFromLogOrRefuse(logPath, label) {
  const txt = readText(logPath);
  const obj = parseLastJsonObjectFromTextOrNull(txt);
  if (!obj) dieRefuse("REPORT_PARSE_FAIL", `Cannot parse JSON report from ${label}`, { logPath });
  return obj;
}

function writeClosureCertificate(params) {
  const {
    git,
    time_utc,
    lemmasSha,
    sensesSha,
    genLemmaReport,
    genSenseReport,
    gateReport,
    evidenceSetSha,
    evidenceCanonicalSha,
  } = params;

  const md = [
    "# NRBPL L1 Lexicon 2K — UGTS Closure Certificate (v0.1.2)",
    "",
    `**Status**: CLOSURE-CERTIFIED (L1)`,
    `**Level**: ${LEVEL}`,
    `**Generated**: ${time_utc}`,
    "",
    "---",
    "",
    "## Section ΔC — Condition (Evidence Anchors)",
    "",
    "- Repository anchor:",
    `  - branch: \`${git.branch}\``,
    `  - HEAD: \`${git.head}\``,
    `  - worktree: \`CLEAN\` (mandatory precondition)`,
    "",
    "- Mandatory locks (SHA256-bound):",
    `  - \`locks/PATCH_SCOPE_LOCK_v0_1.json\` = \`${sha256File(PATHS.locks.scope)}\``,
    `  - \`locks/KERNEL_ABI_LOCK.json\` = \`${sha256File(PATHS.locks.abi)}\``,
    "",
    "- Mandatory sources (SHA256-bound):",
    `  - \`sources/oxford3000_seed.jsonl\` = \`${sha256File(PATHS.sources.oxford_seed)}\``,
    `  - \`sources/wordnet_top.jsonl\` = \`${sha256File(PATHS.sources.wordnet_top)}\``,
    `  - \`sources/oxford3000_senses.jsonl\` = \`${sha256File(PATHS.sources.oxford_senses)}\``,
    `  - \`sources/wordnet_senses.jsonl\` = \`${sha256File(PATHS.sources.wordnet_senses)}\``,
    "",
    "## Section ΔS — Stability (Determinism + Replay)",
    "",
    "- Output artifacts:",
    `  - \`lexicon/en_vi_lemmas_2k.jsonl\` sha256 = \`${lemmasSha}\``,
    `  - \`lexicon/en_vi_senses_2k.jsonl\` sha256 = \`${sensesSha}\``,
    "",
    "- Evidence chain binding:",
    `  - artifact_hashes.set_sha256 = \`${evidenceSetSha || "N/A"}\``,
    `  - report_hashes.canonical_sha256 = \`${evidenceCanonicalSha || "N/A"}\``,
    "",
    "- Replay commands:",
    `  - \`${path.relative(ROOT, PATHS.audit.replay_cmds)}\``,
    "",
    "## Section ΔP — Phenomenon (Gate Verdict)",
    "",
    "- Gate execution:",
    `  - tool: \`validators/lexicon_gate.js\``,
    `  - mode: \`${LEVEL}\``,
    `  - verdict: **${gateReport?.verdict || "UNKNOWN"}**`,
    `  - exit_code: \`${gateReport?.exit_code ?? "UNKNOWN"}\``,
    "",
    "- Gate checks (summary):",
    "```json",
    JSON.stringify(gateReport?.checks || {}, null, 2),
    "```",
    "",
    "## Closure Verdict",
    "",
    gateReport?.verdict === "SUPPORTED"
      ? "**CLOSURE PASS (L1)** — Lexicon 2K toolchain reached deterministic scale-up with evidence chain verified."
      : "**CLOSURE FAIL** — Gate verdict is not SUPPORTED; closure MUST NOT be claimed.",
    "",
    "---",
    "",
    "## Appendix A — Generator Reports (verbatim JSON)",
    "",
    "### A1) Lemma build report",
    "```json",
    JSON.stringify(genLemmaReport, null, 2),
    "```",
    "",
    "### A2) Sense build report",
    "```json",
    JSON.stringify(genSenseReport, null, 2),
    "```",
    "",
    "### A3) Gate report (verbatim JSON)",
    "```json",
    JSON.stringify(gateReport, null, 2),
    "```",
    "",
    "## Appendix B — Evidence checksum list",
    "",
    `See: \`${path.relative(ROOT, PATHS.audit.sha_sums)}\``,
    "",
  ].join("\n");

  writeText(PATHS.audit.cert, md);
}

// -------------------------------
// Main closure procedure
// -------------------------------
(function main() {
  // 0) Preconditions
  ensurePreconditionsOrRefuse();

  // 1) Git anchors (ΔC)
  const git = gitInfoOrRefuse();

  // 2) Build replay commands file
  buildReplayCommands();

  // 3) Generate lemmas 2000
  const genLemmaArgs = [
    PATHS.tools.gen_lex,
    "--n",
    String(N_LEMMAS),
    "--out",
    PATHS.lexicon.lemmas_2k,
    "--mode",
    LEVEL,
  ];

  const genLemmaRes = runCmdLoggedOrRefuse("node", genLemmaArgs, PATHS.audit.gen_lemmas_log);
  if (genLemmaRes.status !== 0) {
    dieRefuse("GEN_LEMMAS_FAIL", "Lemma generator did not exit 0", {
      exit: genLemmaRes.status,
      log: path.relative(ROOT, PATHS.audit.gen_lemmas_log),
    });
  }

  // Verify lemma count exactly 2000
  const lemmaCount = countJsonlLinesOrRefuse(PATHS.lexicon.lemmas_2k, "lemmas_2k.jsonl");
  if (lemmaCount !== N_LEMMAS) {
    dieRefuse("COUNT_NOT_2000", "Lemma output must have exactly 2000 lines", {
      got: lemmaCount,
      expected: N_LEMMAS,
      out: path.relative(ROOT, PATHS.lexicon.lemmas_2k),
    });
  }

  // 4) Generate senses 2K
  const genSenseArgs = [
    PATHS.tools.gen_senses,
    "--max",
    String(MAX_SENSES_PER_LEMMA),
    "--lemmas",
    PATHS.lexicon.lemmas_2k,
    "--out",
    PATHS.lexicon.senses_2k,
    "--mode",
    LEVEL,
  ];

  const genSenseRes = runCmdLoggedOrRefuse("node", genSenseArgs, PATHS.audit.gen_senses_log);
  if (genSenseRes.status !== 0) {
    dieRefuse("GEN_SENSES_FAIL", "Sense generator did not exit 0", {
      exit: genSenseRes.status,
      log: path.relative(ROOT, PATHS.audit.gen_senses_log),
    });
  }

  // 5) Run gate --all
  const gateArgs = [
    PATHS.validators.gate,
    "--all",
    "--lemmas",
    PATHS.lexicon.lemmas_2k,
    "--senses",
    PATHS.lexicon.senses_2k,
    "--level",
    LEVEL,
  ];

  const gateRes = runCmdLoggedOrRefuse("node", gateArgs, PATHS.audit.gate_log);

  // Gate MUST produce SUPPORTED exit 0 for closure
  if (gateRes.status !== 0) {
    // NOTE: gate uses 2 for INSUFFICIENT/CONTRADICTORY and 3 for REFUSE (per UGTS)
    dieRefuse("GATE_NOT_SUPPORTED", "Gate did not return SUPPORTED (exit 0); closure denied", {
      exit: gateRes.status,
      log: path.relative(ROOT, PATHS.audit.gate_log),
    });
  }

  // 6) Evidence binding
  buildEvidenceShaSumsOrRefuse();

  // 7) Parse reports from logs (for certificate)
  const genLemmaReport = extractGenReportFromLogOrRefuse(PATHS.audit.gen_lemmas_log, "lemmas generator log");
  const genSenseReport = extractGenReportFromLogOrRefuse(PATHS.audit.gen_senses_log, "senses generator log");
  const gateReport = extractGenReportFromLogOrRefuse(PATHS.audit.gate_log, "gate log");

  // compute hashes
  const lemmasSha = sha256File(PATHS.lexicon.lemmas_2k);
  const sensesSha = sha256File(PATHS.lexicon.senses_2k);

  // evidence hashes from gate report (optional)
  const evidenceSetSha = gateReport?.artifact_hashes?.set_sha256 || gateReport?.artifact_hashes?.setSha256 || null;
  const evidenceCanonicalSha = gateReport?.report_hashes?.canonical_sha256 || gateReport?.report_hashes?.canonicalSha256 || null;

  // 8) Emit closure certificate (ΔC→ΔS→ΔP)
  writeClosureCertificate({
    git,
    time_utc: nowUTC(),
    lemmasSha,
    sensesSha,
    genLemmaReport,
    genSenseReport,
    gateReport,
    evidenceSetSha,
    evidenceCanonicalSha,
  });

  // 9) Final summary stdout (machine-readable)
  const summary = {
    spec: "NRBPL_L1_LEXICON_2K_CLOSURE_RUN_v0_1_2",
    level: LEVEL,
    verdict: "SUPPORTED",
    exit_code: 0,
    repo: { branch: git.branch, head: git.head, worktree: "CLEAN" },
    outputs: {
      lemmas: { path: path.relative(ROOT, PATHS.lexicon.lemmas_2k), lines: lemmaCount, sha256: lemmasSha },
      senses: { path: path.relative(ROOT, PATHS.lexicon.senses_2k), sha256: sensesSha },
    },
    audit: {
      dir: path.relative(ROOT, PATHS.audit.dir),
      certificate: path.relative(ROOT, PATHS.audit.cert),
      sha256sums: path.relative(ROOT, PATHS.audit.sha_sums),
    },
    time_utc: nowUTC(),
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
})();
