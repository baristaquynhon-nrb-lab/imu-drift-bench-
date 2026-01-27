#!/usr/bin/env node
/**
 * ASE_PRAGMATIC_VALIDATOR.js
 * Validate ASE Pragmatic Layer events against ASE_PRAGMATIC_FORMULA_REGISTRY_v1_1.json
 *
 * Exit codes:
 * 0 PASS
 * 2 FAIL   (IO / JSON parse / unexpected runtime error)
 * 3 REFUSE (spec/gate violation)
 *
 * Usage:
 *   node ASE_PRAGMATIC_VALIDATOR.js <events.json> [registry.json]
 *
 * Input format:
 *   Either:
 *     - JSON array of events
 *     - or an object: { "events": [ ... ] }
 *
 * Each event must include:
 *   event_id, schema, speaker, addressee, formula
 * Optional:
 *   mode, evidence
 *
 * Determinism:
 *   No timestamps; no randomness; stable ordering in report.
 */

"use strict";

const fs = require("fs");
const path = require("path");

function die(code, msg, obj) {
  if (msg) console.error(msg);
  if (obj) console.error(JSON.stringify(obj, null, 2));
  process.exit(code);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    die(2, `FAIL: cannot read/parse JSON: ${p}`, { error: String(e) });
  }
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

function isAsciiPrintable(s) {
  // ASCII 0x20..0x7E; allow newline/tab not needed here.
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

function normalizeId(x) {
  // Canonical ID normalization for deterministic checks (not rewriting input).
  // Uppercase + underscores, strip non-ascii, collapse spaces/hyphens.
  if (!isNonEmptyString(x)) return "";
  const s = x
    .trim()
    .toUpperCase()
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
  return s;
}

function extractEvents(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray(input.events)) return input.events;
  die(3, "REFUSE: input must be an array or {events:[...]}", { got: typeof input });
}

function validateRegistry(reg) {
  if (!reg || typeof reg !== "object") die(2, "FAIL: registry must be a JSON object");
  if (!reg.schemas || typeof reg.schemas !== "object") die(2, "FAIL: registry missing 'schemas' object");
  if (!reg.formulas || typeof reg.formulas !== "object") die(2, "FAIL: registry missing 'formulas' object");
}

function validateEvent(ev, reg) {
  if (!ev || typeof ev !== "object") return { ok: false, code: 3, reason: "EVENT_NOT_OBJECT" };

  // Required top-level fields
  const required = ["event_id", "schema", "speaker", "addressee", "formula"];
  for (const k of required) {
    if (!(k in ev)) return { ok: false, code: 3, reason: `MISSING_FIELD:${k}` };
    if (!isNonEmptyString(ev[k])) return { ok: false, code: 3, reason: `EMPTY_FIELD:${k}` };
    if (!isAsciiPrintable(String(ev[k]))) return { ok: false, code: 3, reason: `NON_ASCII_FIELD:${k}` };
  }

  const schema = String(ev.schema);
  const schemaEntry = reg.schemas[schema];
  if (!schemaEntry) return { ok: false, code: 3, reason: `UNKNOWN_SCHEMA:${schema}` };

  // Enforce allowed fields: required + optional only
  const allowed = new Set([...(schemaEntry.required_fields || []), ...(schemaEntry.optional_fields || [])]);
  for (const k of Object.keys(ev)) {
    if (!allowed.has(k)) return { ok: false, code: 3, reason: `FORBIDDEN_FIELD:${k}` };
  }

  // Validate formula existence and allowed list for schema
  const formula = String(ev.formula);
  const fEntry = reg.formulas[formula];
  if (!fEntry) return { ok: false, code: 3, reason: `UNKNOWN_FORMULA:${formula}` };

  const allowedFormulas = schemaEntry.allowed_formulas || [];
  if (!allowedFormulas.includes(formula)) {
    return { ok: false, code: 3, reason: `FORMULA_NOT_ALLOWED_FOR_SCHEMA:${schema}:${formula}` };
  }

  // Minimal anti-style guard:
  // mode is optional, but if present must be a registry-like ID (no free prose).
  if ("mode" in ev) {
    if (!isNonEmptyString(ev.mode)) return { ok: false, code: 3, reason: "EMPTY_FIELD:mode" };
    if (!isAsciiPrintable(String(ev.mode))) return { ok: false, code: 3, reason: "NON_ASCII_FIELD:mode" };
    const norm = normalizeId(String(ev.mode));
    if (!norm) return { ok: false, code: 3, reason: "INVALID_MODE" };
    // Hard ban on style amplification tokens
    if (norm.includes("VERY_") || norm.includes("SO_") || norm.includes("EXTREMELY_")) {
      return { ok: false, code: 3, reason: "STYLE_CONTAMINATION:mode" };
    }
  }

  // evidence is optional: if present, must be a small object (no claims asserted here).
  if ("evidence" in ev) {
    if (typeof ev.evidence !== "object" || ev.evidence === null) {
      return { ok: false, code: 3, reason: "INVALID_EVIDENCE_TYPE" };
    }
  }

  return { ok: true, code: 0, reason: "OK" };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    console.error("Usage: node ASE_PRAGMATIC_VALIDATOR.js <events.json> [registry.json]");
    process.exit(2);
  }

  const eventsFile = argv[0];
  const registryFile = argv[1] || path.resolve(process.cwd(), "ASE_PRAGMATIC_FORMULA_REGISTRY_v1_1.json");

  const reg = readJson(registryFile);
  validateRegistry(reg);

  const raw = readJson(eventsFile);
  const events = extractEvents(raw);

  // event_id uniqueness
  const seen = new Set();
  const report = [];
  let refused = false;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const r = validateEvent(ev, reg);

    const eid = ev && typeof ev === "object" && "event_id" in ev ? String(ev.event_id) : `IDX_${i}`;
    if (seen.has(eid)) {
      report.push({ index: i, event_id: eid, verdict: "REFUSE", reason: "DUPLICATE_EVENT_ID" });
      refused = true;
      continue;
    }
    seen.add(eid);

    if (!r.ok) {
      report.push({ index: i, event_id: eid, verdict: "REFUSE", reason: r.reason });
      refused = true;
    } else {
      report.push({ index: i, event_id: eid, verdict: "PASS" });
    }
  }

  // Deterministic output (stable order by index)
  const out = {
    spec: "ASE_PRAGMATIC_VALIDATION_REPORT_v1_1",
    registry: path.basename(registryFile),
    input: path.basename(eventsFile),
    totals: {
      n: report.length,
      pass: report.filter(x => x.verdict === "PASS").length,
      refuse: report.filter(x => x.verdict === "REFUSE").length
    },
    results: report
  };

  if (refused) {
    console.error(JSON.stringify(out, null, 2));
    process.exit(3);
  }

  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

main();
