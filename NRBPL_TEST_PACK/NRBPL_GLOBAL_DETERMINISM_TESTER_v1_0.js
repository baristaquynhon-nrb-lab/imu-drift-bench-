#!/usr/bin/env node
/**
 * NRBPL_GLOBAL_DETERMINISM_TESTER_v1_0.js
 * Status: NORMATIVE harness (deterministic, fail-fast)
 *
 * Usage:
 *   node NRBPL_GLOBAL_DETERMINISM_TESTER_v1_0.js path/to/testpack.json
 *
 * Exit codes:
 *   0 => all tests PASS + oracle hashes match
 *   2 => firewall/domain contamination OR oracle mismatch OR test expectation mismatch (non-binding)
 *   3 => context binding failure (missing/ambiguous required bindings)
 */

"use strict";

const fs = require("fs");
const crypto = require("crypto");

// ------------------------------
// Utilities: hashing + canonical JSON
// ------------------------------

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/**
 * Deterministic deep canonicalizer:
 * - sorts object keys lexicographically
 * - removes timestamp-ish keys
 * - sorts arrays by canonical string of each element
 */
function canonicalizeValue(v) {
  if (v === null) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return v;

  if (Array.isArray(v)) {
    const canonElems = v.map(canonicalizeValue);
    // Sort arrays deterministically by JSON string (set-like semantics)
    const withKey = canonElems.map((e) => [JSON.stringify(e), e]);
    withKey.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return withKey.map((x) => x[1]);
  }

  if (isPlainObject(v)) {
    const out = {};
    const keys = Object.keys(v)
      .filter((k) => !isTimestampKey(k))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const k of keys) out[k] = canonicalizeValue(v[k]);
    return out;
  }

  // Fallback: stringify unknown types deterministically
  return String(v);
}

function isTimestampKey(k) {
  const key = String(k).toLowerCase();
  return (
    key === "timestamp" ||
    key === "time_ms" ||
    key === "time_ns" ||
    key === "created_at" ||
    key === "updated_at" ||
    key === "ts" ||
    key === "date_created" ||
    key === "date_updated"
  );
}

function canonicalJSONStringify(obj) {
  const canon = canonicalizeValue(obj);
  return JSON.stringify(canon);
}

// ------------------------------
// Domain model (minimal, append-only)
// ------------------------------

const DOMAINS = ["descriptive", "pragmatic", "modal", "normative", "affective"];

function makeEmptyState() {
  return {
    descriptive: { facts: [], classes: [], props: [], rels: [] },
    pragmatic: { events: [] },
    modal: { operators: [] },
    normative: { norms: [] },
    affective: { affects: [] },
  };
}

function normalizeInitialState(initial_state) {
  const s = makeEmptyState();
  if (!initial_state || !isPlainObject(initial_state)) return s;
  for (const d of DOMAINS) {
    if (initial_state[d] !== undefined) s[d] = initial_state[d];
  }
  return s;
}

// ------------------------------
// Context binding (Γ) — deterministic extraction
// ------------------------------

function bindContext(context_pack) {
  // Minimal schema enforcement (fail-fast)
  if (!context_pack || !isPlainObject(context_pack)) {
    return {
      ok: false,
      reason_code: "BINDING_MISSING_CONTEXT_PACK",
      bindings: null,
    };
  }

  const time = context_pack.time || null;
  const active_event = context_pack.active_event || null;
  const agents = context_pack.agents || null;
  const jurisdiction = context_pack.jurisdiction || null;

  // We do not infer; we only bind by fixed paths.
  const Γ = {
    Γ_t: time, // object
    Γ_e: active_event, // object
    Γ_a: agents, // object
    Γ_j: jurisdiction, // object
  };

  // Canonical context hash
  const context_hash = "sha256:" + sha256Hex(canonicalJSONStringify(context_pack));
  return { ok: true, reason_code: null, bindings: Γ, context_hash };
}

// ------------------------------
// Scope language Σ and satisfaction ⊨_Γ
// Σ supported forms (JSON):
//  - { "type": "TRUE" }
//  - { "type": "LOCATION", "value": "SCHOOL" }
//  - { "type": "TEMPORAL", "interval": {"start":"...", "end":"..."} }
//  - { "type": "EVENT_CONTEXT", "event_id": "E1" }
//  - { "type": "ROLE", "role_id": "STUDENT" }
//  - { "type": "OBJECT_PROPERTY", "entity_id": "A", "property_id": "ARRIVED" }
//  - { "type": "NOT", "scope": <Scope> }
//  - { "type": "AND", "left": <Scope>, "right": <Scope> }
// If scope is omitted/null => treated as TRUE.
// ------------------------------

function scopeIsUsed(scope) {
  if (!scope) return false;
  if (!isPlainObject(scope)) return false;
  const t = scope.type;
  return Boolean(t);
}

function canonicalizeScope(scope) {
  if (!scope || !isPlainObject(scope)) return { type: "TRUE" };

  const t = scope.type;
  if (!t) return { type: "TRUE" };

  if (t === "TRUE") return { type: "TRUE" };

  if (t === "NOT") {
    const inner = canonicalizeScope(scope.scope);
    // We do NOT apply De Morgan to preserve closed form without OR.
    return { type: "NOT", scope: inner };
  }

  if (t === "AND") {
    const left = canonicalizeScope(scope.left);
    const right = canonicalizeScope(scope.right);
    if (left.type === "TRUE") return right;
    if (right.type === "TRUE") return left;
    const a = canonicalJSONStringify(left);
    const b = canonicalJSONStringify(right);
    return a <= b
      ? { type: "AND", left, right }
      : { type: "AND", left: right, right: left };
  }

  // Atom types
  if (t === "LOCATION") return { type: "LOCATION", value: String(scope.value || "") };
  if (t === "EVENT_CONTEXT") return { type: "EVENT_CONTEXT", event_id: String(scope.event_id || "") };
  if (t === "ROLE") return { type: "ROLE", role_id: String(scope.role_id || "") };
  if (t === "OBJECT_PROPERTY")
    return {
      type: "OBJECT_PROPERTY",
      entity_id: String(scope.entity_id || ""),
      property_id: String(scope.property_id || ""),
    };

  if (t === "TEMPORAL") {
    // interval can be inline or referenced by id; we support inline only in v1.0 harness
    const interval = scope.interval || null;
    if (!interval || !isPlainObject(interval)) {
      return { type: "TEMPORAL", interval: { start: "", end: "" } };
    }
    return {
      type: "TEMPORAL",
      interval: { start: String(interval.start || ""), end: String(interval.end || "") },
    };
  }

  // Unknown scope atom => REFUSE at validation time; here we keep it literal
  return canonicalizeValue(scope);
}

function isoToMillis(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

function satTemporal(Γ, interval) {
  if (!Γ || !Γ.Γ_t || !isPlainObject(Γ.Γ_t)) return { ok: false, reason: "BINDING_MISSING_TIME" };
  const iso = String(Γ.Γ_t.iso8601 || "");
  const now = isoToMillis(iso);
  const start = isoToMillis(String(interval.start || ""));
  const end = isoToMillis(String(interval.end || ""));
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, reason: "BINDING_INVALID_TIME_FORMAT" };
  }
  return { ok: true, value: now >= start && now < end };
}

function satEventContext(Γ, event_id) {
  if (!Γ || !Γ.Γ_e || !isPlainObject(Γ.Γ_e)) return { ok: false, reason: "BINDING_MISSING_ACTIVE_EVENT" };
  const eid = String(Γ.Γ_e.event_id || "");
  if (!eid) return { ok: false, reason: "BINDING_MISSING_ACTIVE_EVENT_ID" };
  return { ok: true, value: eid === String(event_id || "") };
}

function satRole(Sw, role_id) {
  // Minimal role satisfaction:
  // Sw.classes may include entries like {entity:"A", class:"STUDENT"} or ["A","STUDENT"]
  const classes = (Sw && Sw.classes) || [];
  const target = String(role_id || "");
  for (const c of classes) {
    if (Array.isArray(c) && String(c[1] || "") === target) return true;
    if (isPlainObject(c) && String(c.class || "") === target) return true;
  }
  return false;
}

function satLocation(Sw, loc) {
  // Minimal location satisfaction:
  // Sw.props may include {entity:"A", prop:"LOCATED_IN", value:"SCHOOL"} or ["A","LOCATED_IN","SCHOOL"]
  const props = (Sw && Sw.props) || [];
  const target = String(loc || "");
  for (const p of props) {
    if (Array.isArray(p) && String(p[1] || "") === "LOCATED_IN" && String(p[2] || "") === target) return true;
    if (
      isPlainObject(p) &&
      String(p.prop || "") === "LOCATED_IN" &&
      String(p.value || "") === target
    )
      return true;
  }
  return false;
}

function satObjectProperty(Sw, entity_id, property_id) {
  // property_id can match Sw.facts entries like {entity:"A", fact:"ARRIVED"} or ["A","ARRIVED"]
  const facts = (Sw && Sw.facts) || [];
  const e = String(entity_id || "");
  const prop = String(property_id || "");
  for (const f of facts) {
    if (Array.isArray(f) && String(f[0] || "") === e && String(f[1] || "") === prop) return true;
    if (isPlainObject(f) && String(f.entity || "") === e && String(f.fact || "") === prop) return true;
  }
  return false;
}

function satisfies(S_global, Γ, scopeRaw) {
  const scope = canonicalizeScope(scopeRaw);

  function evalScope(node) {
    const t = node.type;

    if (t === "TRUE") return { ok: true, value: true };

    if (t === "NOT") {
      const inner = evalScope(node.scope);
      if (!inner.ok) return inner;
      return { ok: true, value: !inner.value };
    }

    if (t === "AND") {
      const a = evalScope(node.left);
      if (!a.ok) return a;
      if (!a.value) return { ok: true, value: false }; // short-circuit
      const b = evalScope(node.right);
      if (!b.ok) return b;
      return { ok: true, value: a.value && b.value };
    }

    // Atoms
    const Sw = S_global.descriptive || {};
    if (t === "TEMPORAL") return satTemporal(Γ, node.interval);
    if (t === "EVENT_CONTEXT") return satEventContext(Γ, node.event_id);
    if (t === "ROLE") return { ok: true, value: satRole(Sw, node.role_id) };
    if (t === "LOCATION") return { ok: true, value: satLocation(Sw, node.value) };
    if (t === "OBJECT_PROPERTY")
      return { ok: true, value: satObjectProperty(Sw, node.entity_id, node.property_id) };

    return { ok: false, reason: "SCOPE_UNKNOWN_ATOM" };
  }

  return evalScope(scope);
}

// ------------------------------
// Operators per domain (minimal, deterministic, append-only)
// Event format:
//   { domain:"descriptive|pragmatic|modal|normative|affective", opcode:"...", args:{...} }
// ------------------------------

function appendUnique(list, item) {
  const key = JSON.stringify(canonicalizeValue(item));
  for (const x of list) {
    if (JSON.stringify(canonicalizeValue(x)) === key) return;
  }
  list.push(item);
}

function applyDescriptive(Sw, opcode, args) {
  const out = isPlainObject(Sw) ? JSON.parse(JSON.stringify(Sw)) : { facts: [], classes: [], props: [], rels: [] };
  if (!out.facts) out.facts = [];
  if (!out.classes) out.classes = [];
  if (!out.props) out.props = [];
  if (!out.rels) out.rels = [];

  if (opcode === "ADD_FACT") {
    // args: { entity, fact }
    appendUnique(out.facts, { entity: String(args.entity || ""), fact: String(args.fact || "") });
    return out;
  }

  if (opcode === "CLASSIFY") {
    // args: { entity, class }
    appendUnique(out.classes, { entity: String(args.entity || ""), class: String(args.class || "") });
    return out;
  }

  if (opcode === "SET_PROP") {
    // args: { entity, prop, value }
    appendUnique(out.props, {
      entity: String(args.entity || ""),
      prop: String(args.prop || ""),
      value: String(args.value || ""),
    });
    return out;
  }

  if (opcode === "ADD_REL") {
    // args: { a, rel, b }
    appendUnique(out.rels, { a: String(args.a || ""), rel: String(args.rel || ""), b: String(args.b || "") });
    return out;
  }

  return { __error__: "UNKNOWN_OPCODE_DESCRIPTIVE" };
}

function applyPragmatic(Ss, opcode, args) {
  const out = isPlainObject(Ss) ? JSON.parse(JSON.stringify(Ss)) : { events: [] };
  if (!out.events) out.events = [];

  // Formula-locked minimal events
  if (opcode === "GREET" || opcode === "THANK" || opcode === "WISH" || opcode === "FAREWELL") {
    const evt = {
      opcode,
      speaker: String(args.speaker || ""),
      addressee: String(args.addressee || ""),
      formula: String(args.formula || ""),
    };
    appendUnique(out.events, evt);
    return out;
  }

  return { __error__: "UNKNOWN_OPCODE_PRAGMATIC" };
}

function applyModal(Sm, opcode, args) {
  const out = isPlainObject(Sm) ? JSON.parse(JSON.stringify(Sm)) : { operators: [] };
  if (!out.operators) out.operators = [];

  if (opcode === "POSSIBLY" || opcode === "NECESSARILY") {
    appendUnique(out.operators, {
      opcode,
      proposition: String(args.proposition || ""),
    });
    return out;
  }

  return { __error__: "UNKNOWN_OPCODE_MODAL" };
}

function applyNormative(Sn, opcode, args, Γ) {
  const out = isPlainObject(Sn) ? JSON.parse(JSON.stringify(Sn)) : { norms: [] };
  if (!out.norms) out.norms = [];

  if (opcode === "OBLIGATED" || opcode === "PERMITTED" || opcode === "FORBIDDEN" || opcode === "RECOMMENDED") {
    // Jurisdiction required when src_type is LAW (fail-fast; no inference)
    const src_type = String(args.src_type || "");
    if (src_type === "LAW") {
      if (!Γ || !Γ.Γ_j || !isPlainObject(Γ.Γ_j) || !Γ.Γ_j.country) {
        return { __error__: "BINDING_MISSING_JURISDICTION_FOR_LAW" };
      }
    }

    const norm = {
      opcode,
      src_type,
      jurisdiction: src_type === "LAW" ? String(Γ.Γ_j.country || "") : String(args.jurisdiction || ""),
      subject: String(args.subject || ""),
      act: String(args.act || ""),
      scope: args.scope ? canonicalizeScope(args.scope) : { type: "TRUE" },
    };
    appendUnique(out.norms, norm);
    return out;
  }

  return { __error__: "UNKNOWN_OPCODE_NORMATIVE" };
}

function applyAffective(Sa, opcode, args) {
  const out = isPlainObject(Sa) ? JSON.parse(JSON.stringify(Sa)) : { affects: [] };
  if (!out.affects) out.affects = [];

  if (opcode.startsWith("FEEL_") || opcode === "EXCLAIM") {
    appendUnique(out.affects, {
      opcode,
      agent: String(args.agent || ""),
      intensity: args.intensity === undefined ? null : args.intensity,
      label: args.label === undefined ? null : String(args.label),
    });
    return out;
  }

  return { __error__: "UNKNOWN_OPCODE_AFFECTIVE" };
}

function dispatchApply(S_global, eventObj, Γ) {
  // Firewall by construction: only domain slice is passed to operator; only slice updated.
  const domain = String(eventObj.domain || "");
  const opcode = String(eventObj.opcode || "");
  const args = isPlainObject(eventObj.args) ? eventObj.args : {};

  if (!DOMAINS.includes(domain)) {
    return { ok: false, reason_code: "DOMAIN_UNKNOWN", next_state: null };
  }

  const next = JSON.parse(JSON.stringify(S_global));
  let updated;

  if (domain === "descriptive") updated = applyDescriptive(next.descriptive, opcode, args);
  if (domain === "pragmatic") updated = applyPragmatic(next.pragmatic, opcode, args);
  if (domain === "modal") updated = applyModal(next.modal, opcode, args);
  if (domain === "normative") updated = applyNormative(next.normative, opcode, args, Γ);
  if (domain === "affective") updated = applyAffective(next.affective, opcode, args);

  if (updated && isPlainObject(updated) && updated.__error__) {
    const err = String(updated.__error__);
    if (err.startsWith("BINDING_")) {
      return { ok: false, reason_code: err, next_state: null, failure_class: "BINDING" };
    }
    return { ok: false, reason_code: err, next_state: null, failure_class: "OPCODE" };
  }

  next[domain] = updated;
  return { ok: true, reason_code: null, next_state: next };
}

// ------------------------------
// Pre-scan: determine binding requirements (fail-fast, no inference)
// ------------------------------

function requiresTime(event_sequence) {
  for (const step of event_sequence || []) {
    if (scopeIsUsed(step.scope)) {
      const s = canonicalizeScope(step.scope);
      if (scopeContainsTemporal(s)) return true;
    }
  }
  return false;
}

function scopeContainsTemporal(scope) {
  if (!scope || !isPlainObject(scope)) return false;
  const t = scope.type;
  if (t === "TEMPORAL") return true;
  if (t === "NOT") return scopeContainsTemporal(scope.scope);
  if (t === "AND") return scopeContainsTemporal(scope.left) || scopeContainsTemporal(scope.right);
  return false;
}

function requiresActiveEvent(event_sequence) {
  for (const step of event_sequence || []) {
    if (scopeIsUsed(step.scope)) {
      const s = canonicalizeScope(step.scope);
      if (scopeContainsEventContext(s)) return true;
    }
  }
  return false;
}

function scopeContainsEventContext(scope) {
  if (!scope || !isPlainObject(scope)) return false;
  const t = scope.type;
  if (t === "EVENT_CONTEXT") return true;
  if (t === "NOT") return scopeContainsEventContext(scope.scope);
  if (t === "AND") return scopeContainsEventContext(scope.left) || scopeContainsEventContext(scope.right);
  return false;
}

function requiresJurisdictionForLaw(event_sequence) {
  for (const step of event_sequence || []) {
    const ev = step.event || {};
    if (String(ev.domain || "") === "normative") {
      const args = isPlainObject(ev.args) ? ev.args : {};
      if (String(args.src_type || "") === "LAW") return true;
    }
  }
  return false;
}

// ------------------------------
// Global canonicalizer + hash
// ------------------------------

function canonicalizeGlobalState(S_global) {
  // fixed field order + deep canonicalization
  const payload = {
    affective: S_global.affective,
    descriptive: S_global.descriptive,
    modal: S_global.modal,
    normative: S_global.normative,
    pragmatic: S_global.pragmatic,
  };
  return canonicalJSONStringify(payload);
}

function hashGlobalState(S_global) {
  return "sha256:" + sha256Hex(canonicalizeGlobalState(S_global));
}

// ------------------------------
// Test execution
// ------------------------------

function runOneTest(testCase) {
  const id = String(testCase.id || "UNKNOWN");
  const expected_verdict = String(testCase.expected_verdict || "");
  const oracle_hash = testCase.oracle_hash ? String(testCase.oracle_hash) : null;

  const initial = normalizeInitialState(testCase.initial_state);
  const bind = bindContext(testCase.context_pack);

  if (!bind.ok) {
    return {
      id,
      verdict: "REFUSE",
      reason_code: bind.reason_code,
      failure_class: "BINDING",
      final_state_hash: null,
      step_hashes: [],
      context_hash: null,
      expected_verdict,
      oracle_hash,
      ok: expected_verdict === "REFUSE",
    };
  }

  const Γ = bind.bindings;

  // Binding preconditions (fail-fast)
  const seq = Array.isArray(testCase.event_sequence) ? testCase.event_sequence : [];

  if (requiresTime(seq)) {
    const t = Γ.Γ_t;
    if (!t || !isPlainObject(t) || !t.iso8601) {
      return refuse(id, "BINDING_MISSING_TIME", bind.context_hash, expected_verdict, oracle_hash);
    }
  }

  if (requiresActiveEvent(seq)) {
    const e = Γ.Γ_e;
    if (!e || !isPlainObject(e) || !e.event_id) {
      return refuse(id, "BINDING_MISSING_ACTIVE_EVENT", bind.context_hash, expected_verdict, oracle_hash);
    }
  }

  if (requiresJurisdictionForLaw(seq)) {
    const j = Γ.Γ_j;
    if (!j || !isPlainObject(j) || !j.country) {
      return refuse(id, "BINDING_MISSING_JURISDICTION_FOR_LAW", bind.context_hash, expected_verdict, oracle_hash);
    }
  }

  let S = initial;
  const step_hashes = [];

  for (let i = 0; i < seq.length; i++) {
    const step = seq[i] || {};
    const ev = step.event || {};
    const scope = step.scope || { type: "TRUE" };

    // Scope satisfaction
    const sat = satisfies(S, Γ, scope);
    if (!sat.ok) {
      const reason = sat.reason || sat.reason_code || "SCOPE_EVAL_FAILED";
      // If scope eval fails due to binding, classify as BINDING
      const isBinding = String(reason).startsWith("BINDING_");
      return refuse(
        id,
        reason,
        bind.context_hash,
        expected_verdict,
        oracle_hash,
        isBinding ? "BINDING" : "SCOPE"
      );
    }

    if (sat.value === true) {
      const applied = dispatchApply(S, ev, Γ);
      if (!applied.ok) {
        const cls = applied.failure_class || "OPCODE";
        return refuse(
          id,
          applied.reason_code || "OPERATOR_FAILED",
          bind.context_hash,
          expected_verdict,
          oracle_hash,
          cls === "BINDING" ? "BINDING" : "FIREWALL"
        );
      }
      S = applied.next_state;
    } else {
      // gating false → state unchanged (deterministic)
      S = S;
    }

    step_hashes.push(hashGlobalState(S));
  }

  const final_hash = hashGlobalState(S);

  // If expected PASS, require oracle_hash and match
  if (expected_verdict === "PASS") {
    if (!oracle_hash) {
      return {
        id,
        verdict: "REFUSE",
        reason_code: "ORACLE_MISSING_FOR_PASS_CASE",
        failure_class: "CANONICAL",
        final_state_hash: final_hash,
        step_hashes,
        context_hash: bind.context_hash,
        expected_verdict,
        oracle_hash,
        ok: false,
      };
    }
    const ok = final_hash === oracle_hash;
    return {
      id,
      verdict: "PASS",
      reason_code: ok ? null : "ORACLE_HASH_MISMATCH",
      failure_class: ok ? null : "CANONICAL",
      final_state_hash: final_hash,
      step_hashes,
      context_hash: bind.context_hash,
      expected_verdict,
      oracle_hash,
      ok,
    };
  }

  // If expected REFUSE, then any PASS is a failure
  if (expected_verdict === "REFUSE") {
    return {
      id,
      verdict: "PASS",
      reason_code: "EXPECTED_REFUSE_BUT_PASSED",
      failure_class: "EXPECTATION",
      final_state_hash: final_hash,
      step_hashes,
      context_hash: bind.context_hash,
      expected_verdict,
      oracle_hash,
      ok: false,
    };
  }

  // Unknown expected verdict => fail
  return {
    id,
    verdict: "REFUSE",
    reason_code: "TESTCASE_INVALID_EXPECTED_VERDICT",
    failure_class: "SPEC",
    final_state_hash: null,
    step_hashes: [],
    context_hash: bind.context_hash,
    expected_verdict,
    oracle_hash,
    ok: false,
  };
}

function refuse(id, reason_code, context_hash, expected_verdict, oracle_hash, failure_class = "BINDING") {
  return {
    id,
    verdict: "REFUSE",
    reason_code,
    failure_class,
    final_state_hash: null,
    step_hashes: [],
    context_hash,
    expected_verdict,
    oracle_hash,
    ok: expected_verdict === "REFUSE",
  };
}

// ------------------------------
// Main: run pack
// ------------------------------

function loadJSON(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node NRBPL_GLOBAL_DETERMINISM_TESTER_v1_0.js path/to/testpack.json");
    process.exit(3);
  }

  let pack;
  try {
    pack = loadJSON(path);
  } catch (e) {
    console.error("REFUSE: cannot read/parse JSON testpack:", e.message);
    process.exit(3);
  }

  // Accept either: {spec, tests:[...]} or direct array
  const tests = Array.isArray(pack) ? pack : Array.isArray(pack.tests) ? pack.tests : null;
  if (!tests) {
    console.error("REFUSE: testpack must be an array or {tests:[...]}");
    process.exit(3);
  }

  const results = [];
  let anyMismatch = false;
  let anyBindingFailure = false;
  let anyFirewallOrCanonicalFailure = false;

  for (const tc of tests) {
    const r = runOneTest(tc || {});
    results.push(r);

    if (!r.ok) {
      anyMismatch = true;
      if (r.failure_class === "BINDING") anyBindingFailure = true;
      if (r.failure_class === "FIREWALL" || r.failure_class === "CANONICAL" || r.failure_class === "EXPECTATION") {
        anyFirewallOrCanonicalFailure = true;
      }
    }
  }

  const totals = {
    n: results.length,
    ok: results.filter((x) => x.ok).length,
    bad: results.filter((x) => !x.ok).length,
    passed: results.filter((x) => x.verdict === "PASS").length,
    refused: results.filter((x) => x.verdict === "REFUSE").length,
  };

  const report = {
    spec: "NRBPL_GLOBAL_TEST_REPORT_v1_0",
    pack_hash: "sha256:" + sha256Hex(canonicalJSONStringify(pack)),
    totals,
    results,
  };

  // Deterministic JSON output
  console.log(canonicalJSONStringify(report));

  if (!anyMismatch) process.exit(0);

  // Exit code priority:
  // 3 => binding failures (missing/ambiguous context)
  // 2 => everything else (firewall, canonical mismatch, expectation mismatch)
  if (anyBindingFailure && !anyFirewallOrCanonicalFailure) process.exit(3);
  if (anyBindingFailure && anyFirewallOrCanonicalFailure) process.exit(2); // stricter: treat as system-level failure
  process.exit(2);
}

main();
