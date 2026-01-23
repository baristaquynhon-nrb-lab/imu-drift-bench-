#!/usr/bin/env node
/**
 * tools/freeze_l1_baseline.js — NRBPL L1 Baseline Freeze+Seal Runner v0.1
 *
 * Purpose:
 *   Freeze NRBPL Level-L1 Governance baseline as portable, auditable evidence pack.
 *
 * Outputs (deterministic artifacts):
 *   _audit/NRBPL_AUDIT_REPORT_L1.json
 *   _audit/NRBPL_AUDIT_REPORT_L1.sha256
 *   _audit/NRBPL_AUDIT_WITNESS_L1.json
 *
 * Properties:
 *   - minimal / no deps
 *   - deterministic
 *   - fail-fast
 *   - canonical report (no timestamp inside report if possible)
 *   - timestamp placed ONLY in witness
 *
 * Assumptions:
 *   - There is an existing audit runner accessible via:
 *       npm run audit --silent
 *     which prints JSON to stdout OR prints logs including a JSON block.
 *
 * Override:
 *   - NRBPL_AUDIT_CMD: custom command
 *     e.g. NRBPL_AUDIT_CMD="node tools/repo_audit.js"
 *
 * Usage:
 *   node tools/freeze_l1_baseline.js
 *   node tools/freeze_l1_baseline.js --tag
 *
 * Exit codes:
 *   0: PASS / sealed
 *   2: INSUFFICIENT / FAIL
 *   3: REFUSE / hard fail
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIT_DIR = path.join(ROOT, "_audit");

const REPORT_FILE = path.join(AUDIT_DIR, "NRBPL_AUDIT_REPORT_L1.json");
const REPORT_SHA_FILE = path.join(AUDIT_DIR, "NRBPL_AUDIT_REPORT_L1.sha256");
const WITNESS_FILE = path.join(AUDIT_DIR, "NRBPL_AUDIT_WITNESS_L1.json");

const DEFAULT_AUDIT_CMD = "npm run audit --silent";
const AUDIT_CMD = (process.env.NRBPL_AUDIT_CMD || DEFAULT_AUDIT_CMD).trim();

const TAG_NAME = "NRBPL_L1_BASELINE_RC1";
const WANT_TAG = process.argv.includes("--tag");

const EXIT_OK = 0;
const EXIT_FAIL = 2;
const EXIT_REFUSE = 3;

function die(msg, code = EXIT_REFUSE) {
  process.stderr.write(msg.trimEnd() + "\n");
  process.exit(code);
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function nowUtcIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); // normalize ms
}

/**
 * Deterministically stringify JSON:
 * - recursively sort keys
 * - no trailing spaces
 * - 2-space indentation
 */
function stableStringify(obj) {
  return JSON.stringify(sortKeysDeep(obj), null, 2) + "\n";
}

function sortKeysDeep(x) {
  if (Array.isArray(x)) return x.map(sortKeysDeep);
  if (x && typeof x === "object") {
    const out = {};
    Object.keys(x).sort().forEach(k => {
      out[k] = sortKeysDeep(x[k]);
    });
    return out;
  }
  return x;
}

/**
 * Attempt to extract JSON object from stdout.
 * Supports:
 *   - pure JSON output
 *   - logs + embedded JSON block
 */
function extractJson(stdout) {
  const s = stdout.trim();
  if (!s) die("AUDIT_CMD produced empty stdout", EXIT_REFUSE);

  // Case 1: stdout is JSON itself
  try {
    return JSON.parse(s);
  } catch (_) {}

  // Case 2: try find first JSON object block by braces scanning (simple deterministic)
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    die("Failed to locate JSON object in audit stdout", EXIT_REFUSE);
  }

  const candidate = s.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    die("Failed to parse JSON extracted from audit stdout: " + e.message, EXIT_REFUSE);
  }
}

/**
 * Ensure report is canonical and safe:
 * - remove volatile fields like timestamps if present
 * - enforce minimal envelope
 */
function canonicalizeReport(report) {
  if (!report || typeof report !== "object") {
    die("Audit report is not a JSON object", EXIT_REFUSE);
  }

  // Normalize verdict fields if present
  // expected: { verdict: "SUPPORTED" | "INSUFFICIENT" | "REFUSE" ... }
  const verdict = report.verdict || report.audit?.verdict || report.status || null;

  // remove volatile timestamps (canonical report should be stable)
  const cleaned = JSON.parse(JSON.stringify(report));

  // common volatile keys
  stripVolatile(cleaned, [
    "timestamp",
    "timestamp_utc",
    "generated_at",
    "generated_at_utc",
    "time",
    "date",
    "dt",
    "now"
  ]);

  // wrap into canonical envelope (deterministic)
  const envelope = {
    spec: "NRBPL_AUDIT_REPORT_SCHEMA_v0.1",
    level: "L1",
    governance: "MINIMAL_VIABLE_GOVERNANCE",
    audit_cmd: AUDIT_CMD,
    verdict: verdict || "UNKNOWN",
    report: cleaned
  };

  return envelope;
}

function stripVolatile(obj, volatileKeys) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach(v => stripVolatile(v, volatileKeys));
    return;
  }
  for (const k of Object.keys(obj)) {
    if (volatileKeys.includes(k)) {
      delete obj[k];
      continue;
    }
    stripVolatile(obj[k], volatileKeys);
  }
}

/**
 * Best-effort: ensure report verdict is SUPPORTED
 * else fail-fast
 */
function enforceVerdict(reportEnvelope) {
  const v = String(reportEnvelope.verdict || "").toUpperCase();
  if (v === "SUPPORTED" || v === "PASS" || v === "OK") return;

  if (v === "REFUSE") die("AUDIT verdict REFUSE — cannot freeze baseline", EXIT_REFUSE);
  die("AUDIT verdict not SUPPORTED (" + v + ") — cannot freeze baseline", EXIT_FAIL);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFileAtomic(filePath, contentBufOrStr) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, "." + path.basename(filePath) + ".tmp");
  fs.writeFileSync(tmp, contentBufOrStr);
  fs.renameSync(tmp, filePath);
}

function run(cmd, opts = {}) {
  const res = cp.spawnSync(cmd, {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    ...opts
  });

  if (res.error) die("Command error: " + res.error.message, EXIT_REFUSE);
  if (typeof res.status === "number" && res.status !== 0) {
    const err = (res.stderr || "").trim();
    die(
      "Command failed: " + cmd + "\n" +
      "exit=" + res.status + "\n" +
      (err ? ("stderr:\n" + err + "\n") : ""),
      EXIT_FAIL
    );
  }
  return res;
}

function gitAvailable() {
  try {
    const r = cp.spawnSync("git --version", { cwd: ROOT, shell: true, encoding: "utf8" });
    return r.status === 0;
  } catch (_) {
    return false;
  }
}

function tryCreateTag(tag) {
  if (!gitAvailable()) return { ok: false, reason: "git_not_available" };

  // tag must be deterministic: point to HEAD
  const check = cp.spawnSync(`git rev-parse ${tag}`, { cwd: ROOT, shell: true, encoding: "utf8" });
  if (check.status === 0) {
    return { ok: true, already: true };
  }

  const r = cp.spawnSync(`git tag ${tag}`, { cwd: ROOT, shell: true, encoding: "utf8" });
  if (r.status !== 0) return { ok: false, reason: (r.stderr || "tag_failed").trim() };
  return { ok: true, created: true };
}

function buildWitness(reportSha256, reportRelPath) {
  const witness = {
    spec: "NRBPL_WITNESS_SEAL_SCHEMA_v0.1",
    artifact: {
      id: "NRBPL_AUDIT_REPORT_L1",
      path: reportRelPath,
      kind: "AUDIT_REPORT",
      scope: "NRBPL_GOVERNANCE_L1_BASELINE"
    },
    integrity: {
      algo: "SHA-256",
      sha256: reportSha256
    },
    seal: {
      mode: "CANONICAL_SEALED",
      timestamp_utc: nowUtcIso(),
      issuer: "NRBPL_REPO_AUDIT_SYSTEM",
      tag_hint: WANT_TAG ? TAG_NAME : null
    }
  };

  // remove nulls deterministically
  if (witness.seal.tag_hint === null) delete witness.seal.tag_hint;

  return witness;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function main() {
  ensureDir(AUDIT_DIR);

  // 1) Run audit
  const res = run(AUDIT_CMD);
  const stdout = (res.stdout || "").trim();
  const reportRaw = extractJson(stdout);

  // 2) Canonicalize report
  const reportEnvelope = canonicalizeReport(reportRaw);

  // 3) Enforce verdict
  enforceVerdict(reportEnvelope);

  // 4) Write canonical report
  const reportStr = stableStringify(reportEnvelope);
  writeFileAtomic(REPORT_FILE, reportStr);

  // 5) Hash report
  const reportBuf = Buffer.from(reportStr, "utf8");
  const reportSha = sha256Hex(reportBuf);

  // Write sha file (canonical single-line + newline)
  writeFileAtomic(REPORT_SHA_FILE, reportSha + "\n");

  // 6) Witness binding
  const witness = buildWitness(reportSha, rel(REPORT_FILE));
  const witnessStr = stableStringify(witness);
  writeFileAtomic(WITNESS_FILE, witnessStr);

  // 7) Optional git tag
  let tagInfo = null;
  if (WANT_TAG) {
    tagInfo = tryCreateTag(TAG_NAME);
  }

  // 8) Print machine-readable stdout audit summary
  const out = {
    status: "SEALED",
    level: "L1",
    artifacts: {
      report: rel(REPORT_FILE),
      report_sha256: rel(REPORT_SHA_FILE),
      witness: rel(WITNESS_FILE)
    },
    report_sha256: reportSha,
    tag: WANT_TAG ? { name: TAG_NAME, ...tagInfo } : undefined
  };

  process.stdout.write(stableStringify(out));
  process.exit(EXIT_OK);
}

main();
