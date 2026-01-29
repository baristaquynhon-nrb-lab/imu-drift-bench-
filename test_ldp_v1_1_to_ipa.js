"use strict";

const { lawDisambiguationProtocolV1_1 } = require("./law_disambiguation_protocol_v1_1");
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

// Conflict laws with evidence-backed distinguishers
const LAW_A = {
  law_id: "LAW_A",
  disambiguation: {
    distinguishers: [
      { type: "MEASURE", variable: "humidity", domain: "ENV", cost: 1 },
      { type: "MEASURE", variable: "pressure", domain: "ENV", cost: 2 }
    ]
  }
};

const LAW_B = {
  law_id: "LAW_B",
  disambiguation: {
    distinguishers: [
      { type: "MEASURE", variable: "pressure", domain: "ENV", cost: 2 },   // shared with A
      { type: "ASK", question_id: "Q_WINDOW_OPEN", domain: "CTX", cost: 1 }
    ]
  }
};

const LAW_C = {
  law_id: "LAW_C",
  disambiguation: {
    distinguishers: [
      { type: "MEASURE", variable: "humidity", domain: "ENV", cost: 1 },   // shared with A
      { type: "MEASURE", variable: "wind", domain: "ENV", cost: 1 }
    ]
  }
};

// T1: LDP PASS and all conds have pair
{
  const conflict = [LAW_A, LAW_B, LAW_C];
  const ldp = lawDisambiguationProtocolV1_1(conflict);
  assertEq("T1_LDP_VERDICT", ldp.verdict, "PASS");
  assert("T1_AllHavePair", ldp.disambiguation_conditions.every(c => Array.isArray(c.pair) && c.pair.length === 2), ldp);
}

// T2: IPA PASS and returns minimal plan (size <= number of pairs)
{
  const conflict = [LAW_A, LAW_B, LAW_C];
  const ldp = lawDisambiguationProtocolV1_1(conflict);
  const ipa = interventionPlanner(conflict, ldp, { maxConditions: 18 });
  assertEq("T2_IPA_VERDICT", ipa.verdict, "PASS");
  assert("T2_InterventionsNonEmpty", Array.isArray(ipa.interventions) && ipa.interventions.length >= 1, ipa);
  assert("T2_InterventionsBounded", ipa.interventions.length <= 3, ipa);
}

// T3: Inseparable pair => LDP REFUSE LAWS_INSEPARABLE
{
  const X = { law_id: "LAW_X", disambiguation: { distinguishers: [{ type: "MEASURE", variable: "temp", cost: 1 }] } };
  const Y = { law_id: "LAW_Y", disambiguation: { distinguishers: [{ type: "MEASURE", variable: "temp", cost: 1 }] } }; // identical set
  const ldp = lawDisambiguationProtocolV1_1([X, Y]);
  assertEq("T3_Inseparable_VERDICT", ldp.verdict, "REFUSE");
  assertEq("T3_Inseparable_REASON", ldp.reason, "LAWS_INSEPARABLE");
}

// T4: Determinism (same input => same output)
{
  const conflict = [LAW_A, LAW_B, LAW_C];
  const l1 = lawDisambiguationProtocolV1_1(conflict);
  const l2 = lawDisambiguationProtocolV1_1(conflict);
  assertEq("T4_Determinism", JSON.stringify(l1), JSON.stringify(l2));
}

if (!process.exitCode) {
  console.log("ALL_TESTS PASS");
  process.exitCode = 0;
}
