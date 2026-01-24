#!/usr/bin/env node
"use strict";

/**
 * EN→VI Runtime Demo Closure (v0.1.0)
 * - Enforces Demo Scope v0.1
 * - Uses reason_code enum (locked)
 * - Checks forbidden-claim UI strings (locked)
 * - Requires L2 semantic gate PASS
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const child = require("child_process");

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function readJson(fp) {
  const b = fs.readFileSync(fp);
  return JSON.parse(b.toString("utf8"));
}

function fileSha(fp) {
  const b = fs.readFileSync(fp);
  return sha256Hex(b);
}

function run(cmd, args, opts = {}) {
  const p = child.spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { code: p.status ?? 1, out: p.stdout || "", err: p.stderr || "" };
}

function writeFile(fp, s) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, s, "utf8");
}

function refuse(reason_code, detail) {
  process.stdout.write(JSON.stringify({ verdict: "REFUSE", exit_code: 3, reason_code, detail }, null, 2) + "\n");
  process.exit(3);
}

function supported(detail) {
  process.stdout.write(JSON.stringify({ verdict: "SUPPORTED", exit_code: 0, reason_code: null, detail }, null, 2) + "\n");
  process.exit(0);
}

const L1_LEMMAS = path.join("lexicon", "en_vi_lemmas_2k.jsonl");
const L1_SENSES = path.join("lexicon", "en_vi_senses_2k.jsonl");
const L1_CERT = path.join("docs", "reports", "NRBPL_L1_LEXICON_2K_CLOSURE_CERTIFICATE_v0_1.md");

const LOCK_SEM = path.join("locks", "SEMANTIC_LAW_LOCK_v0_1.json");
const LOCK_REQ = path.join("locks", "L2_REQUIRED_UNITS_LOCK_v0_1.json");

// B5 locks
const DEMO_CLAIM_LOCK = path.join("locks", "DEMO_CLAIM_LOCK_v0_1.json"); // forbidden claim strings + reason_code enum
const AUD = path.join("_audit", "envi_demo");
const LOG_GATE = path.join(AUD, "01_semantic_gate.log");
const LOG_UI = path.join(AUD, "02_ui_claim_scan.log");
const SUMS = path.join(AUD, "EVIDENCE_SHA256SUMS.txt");
const CERT = path.join("docs", "reports", "NRBPL_ENVI_RUNTIME_DEMO_CLOSURE_CERTIFICATE_v0_1.md");

for (const fp of [L1_LEMMAS, L1_SENSES, L1_CERT, LOCK_SEM, LOCK_REQ, DEMO_CLAIM_LOCK]) {
  if (!fs.existsSync(fp)) refuse("DEMO_MISSING_ARTIFACT", { missing: fp });
}

const demoLock = readJson(DEMO_CLAIM_LOCK);
const reasonEnum = demoLock.reason_code_enum;
const forbidden = demoLock.forbidden_claim_texts || [];

if (!Array.isArray(reasonEnum) || reasonEnum.length === 0) {
  refuse("DEMO_MISSING_ARTIFACT", { file: DEMO_CLAIM_LOCK, field: "reason_code_enum" });
}
function assertReasonEnum(code) {
  if (!reasonEnum.includes(code)) {
    refuse("DEMO_MISSING_ARTIFACT", { file: DEMO_CLAIM_LOCK, msg: "reason_code not in enum", code });
  }
}

// 1) Run semantic gate (required for demo scope)
{
  const cmd = ["validators/semantic_gate.js", "--senses", L1_SENSES];
  const r = run("node", cmd, {});
  writeFile(LOG_GATE, r.out + (r.err ? ("\n" + r.err) : ""));
  if (r.code !== 0) {
    assertReasonEnum("DEMO_SEMANTIC_GATE_NOT_PASSED");
    refuse("DEMO_SEMANTIC_GATE_NOT_PASSED", { gate_exit: r.code, log: LOG_GATE });
  }
}

// 2) Claim text scan (forbidden list). Scan demo-related repo files if declared.
{
  const scanFiles = demoLock.ui_string_files || []; // explicit list is required; do not guess.
  if (!Array.isArray(scanFiles) || scanFiles.length === 0) {
    // no guessing: absence => REFUSE because scan cannot be performed deterministically
    assertReasonEnum("DEMO_MISSING_ARTIFACT");
    refuse("DEMO_MISSING_ARTIFACT", { msg: "ui_string_files must be explicit to scan deterministically", file: DEMO_CLAIM_LOCK });
  }
  const hits = [];
  for (const fp of scanFiles) {
    if (!fs.existsSync(fp)) {
      assertReasonEnum("DEMO_MISSING_ARTIFACT");
      refuse("DEMO_MISSING_ARTIFACT", { missing: fp });
    }
    const txt = fs.readFileSync(fp, "utf8");
    for (const s of forbidden) {
      if (s && txt.includes(s)) hits.push({ file: fp, claim: s });
    }
  }
  writeFile(LOG_UI, JSON.stringify({ scanned: scanFiles, hits }, null, 2) + "\n");
  if (hits.length > 0) {
    assertReasonEnum("DEMO_FORBIDDEN_CLAIM_TEXT_DETECTED");
    refuse("DEMO_FORBIDDEN_CLAIM_TEXT_DETECTED", { hits, log: LOG_UI });
  }
}

// 3) Evidence binding
{
  const items = [
    L1_LEMMAS, L1_SENSES, L1_CERT,
    LOCK_SEM, LOCK_REQ, DEMO_CLAIM_LOCK,
    "validators/semantic_gate.js",
    LOG_GATE, LOG_UI
  ];
  const lines = [];
  for (const fp of items) {
    if (!fs.existsSync(fp)) {
      assertReasonEnum("DEMO_MISSING_ARTIFACT");
      refuse("DEMO_MISSING_ARTIFACT", { missing: fp });
    }
    lines.push(`${fileSha(fp)}  ${fp}`);
  }
  writeFile(SUMS, lines.join("\n") + "\n");
}

// 4) Certificate
{
  const head = run("git", ["rev-parse", "HEAD"]);
  if (head.code !== 0) assertReasonEnum("DEMO_MISSING_ARTIFACT"), refuse("DEMO_MISSING_ARTIFACT", { msg: "git rev-parse failed" });
  const cert = [
    "# NRBPL_ENVI_RUNTIME_DEMO_CLOSURE_CERTIFICATE_v0_1",
    "Status: DEMO-CLOSURE-CERTIFIED",
    "",
    "## ΔC — Condition",
    `- HEAD: ${head.out.trim()}`,
    `- Required artifacts: ${L1_CERT}, ${LOCK_SEM}, ${DEMO_CLAIM_LOCK}`,
    "",
    "## ΔS — Stability",
    `- Evidence binding: ${SUMS}`,
    `- Semantic gate log: ${LOG_GATE}`,
    `- UI claim scan log: ${LOG_UI}`,
    "",
    "## ΔP — Phenomenon",
    "- Demo scope is within claim boundary iff semantic gate PASS and forbidden-claim scan PASS",
    ""
  ].join("\n");
  writeFile(CERT, cert + "\n");
}

supported({ evidence: SUMS, certificate: CERT });
