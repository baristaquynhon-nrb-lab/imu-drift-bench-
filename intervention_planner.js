"use strict";

/**
 * Intervention Planning Algorithm (IPA)
 * - Input: conflict laws + disambiguation conditions produced by LDP
 * - Output: minimal set of interventions (conditions) that separates all competing law pairs
 *
 * Determinism:
 * - stable keying for conditions
 * - sorted enumeration
 * - exact minimal solver (subset enumeration) with fail-fast size guard
 */

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

function condKey(cond) {
  // Deterministic key for deduplication and sorting (includes pair)
  return stableStringify(cond);
}

function actionKey(cond) {
  // Key for the physical intervention to execute (excludes pair metadata).
  // Conditions with the same actionKey represent the same measurement/action
  // that can disambiguate multiple pairs simultaneously.
  const clone = {};
  for (const k of Object.keys(cond).sort()) {
    if (k !== "pair" && cond[k] !== undefined) clone[k] = cond[k];
  }
  return stableStringify(clone);
}

function uniqConditions(conds) {
  const map = new Map();
  for (const c of conds) map.set(condKey(c), c);
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([_, v]) => v);
}

/**
 * Group conditions by physical action (actionKey).
 * Each action group covers the union of all pairs from its member conditions.
 * Returns sorted array of { ak, representative, coversPairs: Set }.
 */
function groupByAction(conditions, coverage) {
  const map = new Map(); // actionKey -> { representative, coversPairs }
  for (const c of conditions) {
    const ak = actionKey(c);
    const ck = condKey(c);
    if (!map.has(ak)) {
      map.set(ak, { representative: c, coversPairs: new Set() });
    }
    const group = map.get(ak);
    const pairSet = coverage.get(ck);
    if (pairSet) {
      for (const p of pairSet) group.coversPairs.add(p);
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ak, g]) => g);
}

/**
 * Build required "pair constraints" that must be hit.
 * Pair constraint ID is deterministic.
 */
function buildPairs(conflictSet) {
  const laws = conflictSet.map(l => l.law_id);
  assert(laws.every(Boolean), "INVALID_CONFLICTSET: missing law_id");
  const sorted = [...laws].sort();
  // Ensure uniqueness of law_id
  const uniq = new Set(sorted);
  assert(uniq.size === sorted.length, "INVALID_CONFLICTSET: duplicate law_id");
  const pairs = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push(`${sorted[i]}::${sorted[j]}`);
    }
  }
  return pairs;
}

/**
 * Map each condition to which pairs it can disambiguate ("hits").
 *
 * Expected condition format (from LDP):
 * {
 *   type: "MEASURE",
 *   variable: "temp",
 *   pair: ["LAW_A","LAW_B"]   // OPTIONAL but recommended
 * }
 *
 * If condition lacks 'pair', IPA must REFUSE because coverage cannot be proven.
 */
function buildCoverage(pairs, conditions) {
  const coverage = new Map(); // condKey -> Set(pairId)
  for (const cond of conditions) {
    const k = condKey(cond);
    coverage.set(k, new Set());
    if (!cond.pair) {
      // Without explicit pair attribution, we cannot prove pair coverage.
      return { ok: false, reason: "MISSING_PAIR_BINDING" };
    }
    if (!Array.isArray(cond.pair) || cond.pair.length !== 2) {
      return { ok: false, reason: "INVALID_PAIR_BINDING" };
    }
    const a = String(cond.pair[0]);
    const b = String(cond.pair[1]);
    const id = [a, b].sort().join("::");
    if (pairs.includes(id)) coverage.get(k).add(id);
  }
  return { ok: true, coverage };
}

function allCovered(pairs, chosenCoverage) {
  for (const p of pairs) if (!chosenCoverage.has(p)) return false;
  return true;
}

function unionInto(targetSet, addSet) {
  for (const x of addSet) targetSet.add(x);
}

/**
 * Exact minimum hitting set via subset enumeration (deterministic).
 * Operates on action groups (not individual conditions) so that a single
 * physical intervention covering multiple pairs counts as one item.
 * Guarded by maxActions to avoid combinatorial blow-up.
 */
function solveExactMinHittingSet(pairs, actionGroups, maxActions = 18) {
  if (actionGroups.length === 0) return null;
  if (actionGroups.length > maxActions) return { verdict: "REFUSE", reason: "TOO_MANY_CONDITIONS_FOR_EXACT", meta: { n: actionGroups.length, max: maxActions } };

  const hits = actionGroups.map(g => g.coversPairs);

  // Deterministic enumeration by subset size increasing, lex order within size.
  const n = actionGroups.length;

  function* subsetsOfSize(k) {
    const idx = [];
    function* rec(start, left) {
      if (left === 0) {
        let mask = 0;
        for (const i of idx) mask |= (1 << i);
        yield mask;
        return;
      }
      for (let i = start; i <= n - left; i++) {
        idx.push(i);
        yield* rec(i + 1, left - 1);
        idx.pop();
      }
    }
    yield* rec(0, k);
  }

  for (let k = 1; k <= n; k++) {
    for (const mask of subsetsOfSize(k)) {
      const covered = new Set();
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) unionInto(covered, hits[i]);
      }
      if (allCovered(pairs, covered)) {
        const chosen = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) chosen.push(actionGroups[i].representative);
        return { verdict: "PASS", interventions: chosen, meta: { strategy: "EXACT_MIN_HITTING_SET", k } };
      }
    }
  }
  return null;
}

/**
 * Main IPA entry.
 *
 * Input:
 * - conflictSet: [{law_id,...}, ...]
 * - ldpResult: {verdict, disambiguation_conditions:[...]} from LDP
 *
 * Output:
 * - PASS with minimal interventions
 * - REFUSE with reason if cannot guarantee progress
 */
function interventionPlanner(conflictSet, ldpResult, opts = {}) {
  try {
    if (!Array.isArray(conflictSet) || conflictSet.length < 2) {
      return { verdict: "REFUSE", reason: "NO_CONFLICT" };
    }
    if (!ldpResult || ldpResult.verdict !== "PASS") {
      return { verdict: "REFUSE", reason: "LDP_NOT_PASS" };
    }
    const rawConds = Array.isArray(ldpResult.disambiguation_conditions) ? ldpResult.disambiguation_conditions : [];
    if (rawConds.length === 0) {
      return { verdict: "REFUSE", reason: "NO_DISAMBIGUATION_CONDITIONS" };
    }

    const pairs = buildPairs(conflictSet);
    const conditions = uniqConditions(rawConds);

    const cov = buildCoverage(pairs, conditions);
    if (!cov.ok) {
      return { verdict: "REFUSE", reason: cov.reason };
    }

    // quick check: is every pair hit by at least one condition?
    const pairHit = new Map(pairs.map(p => [p, 0]));
    for (const c of conditions) {
      const k = condKey(c);
      for (const p of cov.coverage.get(k)) pairHit.set(p, pairHit.get(p) + 1);
    }
    const uncovered = pairs.filter(p => (pairHit.get(p) || 0) === 0);
    if (uncovered.length > 0) {
      return { verdict: "REFUSE", reason: "UNHIT_PAIRS", meta: { uncovered_pairs: uncovered } };
    }

    // Group conditions by physical action (same measurement = one intervention)
    const actionGroups = groupByAction(conditions, cov.coverage);

    const maxConditions = Number.isFinite(opts.maxConditions) ? opts.maxConditions : 18;
    const sol = solveExactMinHittingSet(pairs, actionGroups, maxConditions);

    if (!sol) {
      return { verdict: "REFUSE", reason: "NO_PROGRESS_PLAN_FOUND" };
    }
    return sol;
  } catch (e) {
    return { verdict: "REFUSE", reason: "IPA_INTERNAL_ERROR", meta: { message: String(e.message || e) } };
  }
}

module.exports = { interventionPlanner, _internals: { stableStringify, condKey, uniqConditions } };
