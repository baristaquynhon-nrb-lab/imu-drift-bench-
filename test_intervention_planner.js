"use strict";

const { interventionPlanner } = require("./intervention_planner");

function assertEq(name, got, expect) {
  const ok = got === expect;
  console.log(name, ok ? "PASS" : "FAIL", { got, expect });
  if (!ok) process.exitCode = 2;
}

function assert(name, cond, meta) {
  console.log(name, cond ? "PASS" : "FAIL", meta || "");
  if (!cond) process.exitCode = 2;
}

// Laws
const LAW_A = { law_id: "LAW_A", signature: { variables: ["temp", "pressure"] } };
const LAW_B = { law_id: "LAW_B", signature: { variables: ["temp", "humidity"] } };
const LAW_C = { law_id: "LAW_C", signature: { variables: ["temp", "pressure"] } };

// T1: NO_CONFLICT => REFUSE
{
  const res = interventionPlanner([LAW_A], { verdict: "REFUSE" });
  assertEq("T1_NoConflict", res.verdict, "REFUSE");
}

// T2: LDP not PASS => REFUSE
{
  const res = interventionPlanner([LAW_A, LAW_B], { verdict: "REFUSE", reason: "X" });
  assertEq("T2_LDPNotPass", res.verdict, "REFUSE");
  assertEq("T2_Reason", res.reason, "LDP_NOT_PASS");
}

// T3: Pair-binding missing => REFUSE (prevents evidence-free coverage)
{
  const ldpBad = { verdict: "PASS", disambiguation_conditions: [{ type: "MEASURE", variable: "temp" }] };
  const res = interventionPlanner([LAW_A, LAW_B], ldpBad);
  assertEq("T3_MissingPairBinding", res.verdict, "REFUSE");
  assertEq("T3_Reason", res.reason, "MISSING_PAIR_BINDING");
}

// T4: Exact minimal hitting set works
// Construct a conflict of 3 laws -> pairs: AB, AC, BC.
// Provide conditions where one condition hits two pairs so minimal size = 2, not 3.
{
  const conflict = [{ law_id: "A" }, { law_id: "B" }, { law_id: "C" }];

  const ldp = {
    verdict: "PASS",
    disambiguation_conditions: [
      { type: "MEASURE", variable: "x", pair: ["A", "B"] },
      { type: "MEASURE", variable: "x", pair: ["A", "C"] },
      { type: "MEASURE", variable: "y", pair: ["B", "C"] }
    ]
  };

  const res = interventionPlanner(conflict, ldp, { maxConditions: 18 });
  assertEq("T4_MinHittingSet_VERDICT", res.verdict, "PASS");
  assert("T4_MinSizeIs2", Array.isArray(res.interventions) && res.interventions.length === 2, res);
}

// T5: UNHIT_PAIRS must REFUSE
{
  const conflict = [{ law_id: "A" }, { law_id: "B" }, { law_id: "C" }];
  const ldp = {
    verdict: "PASS",
    disambiguation_conditions: [
      { type: "MEASURE", variable: "x", pair: ["A", "B"] } // missing AC, BC
    ]
  };
  const res = interventionPlanner(conflict, ldp);
  assertEq("T5_UnhitPairs_VERDICT", res.verdict, "REFUSE");
  assertEq("T5_Reason", res.reason, "UNHIT_PAIRS");
}

// T6: Determinism: same input => same chosen interventions (keys sorted)
{
  const conflict = [{ law_id: "A" }, { law_id: "B" }, { law_id: "C" }];
  const ldp = {
    verdict: "PASS",
    disambiguation_conditions: [
      // intentionally shuffled order
      { type: "MEASURE", variable: "y", pair: ["B", "C"] },
      { type: "MEASURE", variable: "x", pair: ["A", "C"] },
      { type: "MEASURE", variable: "x", pair: ["A", "B"] }
    ]
  };
  const r1 = interventionPlanner(conflict, ldp);
  const r2 = interventionPlanner(conflict, ldp);
  const k1 = JSON.stringify(r1.interventions);
  const k2 = JSON.stringify(r2.interventions);
  assertEq("T6_Determinism", k1, k2);
}

if (!process.exitCode) {
  console.log("ALL_TESTS PASS");
  process.exitCode = 0;
}
