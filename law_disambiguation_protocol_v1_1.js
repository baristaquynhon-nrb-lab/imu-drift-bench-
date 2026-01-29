"use strict";

/**
 * LDP v1.1 — Law Disambiguation Protocol (pair-witness)
 *
 * Purpose:
 * - Given a conflictSet (>=2 laws), generate pair-witness disambiguation conditions.
 * - Each condition is bound to exactly one competing pair: cond.pair = [A, B]
 * - Conditions are drawn from law-declared "distinguishers" (evidence-backed), not guessed.
 *
 * Requirements:
 * - Deterministic ordering
 * - Fail-fast on inseparable pairs (no declared distinguishers)
 *
 * Law object minimum contract:
 * {
 *   law_id: "LAW_X",
 *   signature: { variables: ["temp","pressure", ...] },
 *   disambiguation: {
 *     distinguishers: [
 *       { type:"MEASURE", variable:"humidity", domain:"ENV", cost:1 },
 *       { type:"ASK", question_id:"Q1", cost:2 },
 *       ...
 *     ]
 *   }
 * }
 *
 * Protocol:
 * - For each pair (A,B), compute candidate distinguishers = symmetric difference of declared distinguishers.
 * - If empty => inseparable under declared evidence -> REFUSE.
 * - Pick minimal-cost candidate; tie-break by stable key.
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

function normId(x) {
  return String(x || "");
}

function condKey(cond) {
  return stableStringify(cond);
}

function isValidDist(d) {
  if (!d || typeof d !== "object") return false;
  if (typeof d.type !== "string") return false;
  if (d.type === "MEASURE") return typeof d.variable === "string" && d.variable.length > 0;
  if (d.type === "ASK") return typeof d.question_id === "string" && d.question_id.length > 0;
  // extendable: OBSERVE, PROBE, etc.
  return false;
}

function getDistinguishers(law) {
  const list = law && law.disambiguation && Array.isArray(law.disambiguation.distinguishers)
    ? law.disambiguation.distinguishers
    : [];

  // Normalize + filter invalid entries (fail-fast if malformed)
  const out = [];
  for (const d of list) {
    if (!isValidDist(d)) return { ok: false, reason: "INVALID_DISTINGUISHER_SCHEMA" };
    out.push({
      type: d.type,
      variable: d.variable,
      question_id: d.question_id,
      domain: d.domain,
      cost: Number.isFinite(d.cost) ? d.cost : 1
    });
  }
  // deterministic sort
  out.sort((a, b) => condKey(a).localeCompare(condKey(b)));
  return { ok: true, list: out };
}

function buildPairs(conflictSet) {
  const ids = conflictSet.map(l => normId(l.law_id)).filter(Boolean);
  assert(ids.length === conflictSet.length, "INVALID_CONFLICTSET: missing law_id");
  const sorted = ids.slice().sort();
  assert(new Set(sorted).size === sorted.length, "INVALID_CONFLICTSET: duplicate law_id");
  const pairs = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) pairs.push([sorted[i], sorted[j]]);
  }
  return pairs; // deterministic
}

function setFromConds(conds) {
  const s = new Set();
  for (const c of conds) s.add(condKey(c));
  return s;
}

function symmetricDifference(listA, listB) {
  const setA = setFromConds(listA);
  const setB = setFromConds(listB);
  const diffKeys = [];

  for (const k of setA) if (!setB.has(k)) diffKeys.push(k);
  for (const k of setB) if (!setA.has(k)) diffKeys.push(k);

  diffKeys.sort((a, b) => a.localeCompare(b)); // deterministic
  return diffKeys;
}

function pickMinCostCandidate(keys, lawAList, lawBList) {
  // Build key->cond lookup
  const map = new Map();
  for (const c of lawAList) map.set(condKey(c), c);
  for (const c of lawBList) map.set(condKey(c), c);

  // Candidates are diff keys; pick minimal cost, tie-break by key
  let best = null;
  for (const k of keys) {
    const c = map.get(k);
    if (!c) continue;
    const cost = Number.isFinite(c.cost) ? c.cost : 1;
    const candidate = { cond: c, cost, key: k };
    if (!best) best = candidate;
    else if (candidate.cost < best.cost) best = candidate;
    else if (candidate.cost === best.cost && candidate.key.localeCompare(best.key) < 0) best = candidate;
  }
  return best ? best.cond : null;
}

/**
 * Main protocol
 */
function lawDisambiguationProtocolV1_1(conflictSet) {
  try {
    if (!Array.isArray(conflictSet) || conflictSet.length < 2) {
      return { verdict: "REFUSE", reason: "NO_CONFLICT" };
    }

    // Preload distinguishers per law (fail-fast if malformed)
    const distByLaw = new Map();
    for (const law of conflictSet) {
      const id = normId(law.law_id);
      const got = getDistinguishers(law);
      if (!got.ok) return { verdict: "REFUSE", reason: got.reason, meta: { law_id: id } };
      distByLaw.set(id, got.list);
    }

    const pairs = buildPairs(conflictSet);
    const conditions = [];

    for (const [a, b] of pairs) {
      const listA = distByLaw.get(a) || [];
      const listB = distByLaw.get(b) || [];

      // Evidence-backed candidates = symmetric difference
      const diffKeys = symmetricDifference(listA, listB);

      if (diffKeys.length === 0) {
        // No declared distinguisher separating this pair under current evidence.
        return { verdict: "REFUSE", reason: "LAWS_INSEPARABLE", meta: { pair: [a, b] } };
      }

      const chosen = pickMinCostCandidate(diffKeys, listA, listB);
      if (!chosen) {
        return { verdict: "REFUSE", reason: "CANNOT_SELECT_DISTINGUISHER", meta: { pair: [a, b] } };
      }

      // Bind pair-witness
      const cond = {
        type: chosen.type,
        variable: chosen.variable,
        question_id: chosen.question_id,
        domain: chosen.domain,
        cost: Number.isFinite(chosen.cost) ? chosen.cost : 1,
        pair: [a, b]
      };

      conditions.push(cond);
    }

    // Deterministic sort + dedup by key
    const map = new Map();
    for (const c of conditions) map.set(condKey(c), c);
    const out = [...map.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([_, v]) => v);

    return { verdict: "PASS", disambiguation_conditions: out };
  } catch (e) {
    return { verdict: "REFUSE", reason: "LDP_INTERNAL_ERROR", meta: { message: String(e.message || e) } };
  }
}

module.exports = { lawDisambiguationProtocolV1_1, _internals: { stableStringify, condKey } };
