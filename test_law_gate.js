const { lawGovernanceGate } = require("./law_governance_gate");

const lawVault = [
  {
    law_id: "LAW_A",
    status: "ACTIVE",
    domain: { constraints: ["mode1"] },
    anchors: { violations: [] },
    evidence: { intervention_support: 0.9 },
    metrics: { simplicity_score: 0.7, risk_score: 0.1 }
  },
  {
    law_id: "LAW_B",
    status: "ACTIVE",
    domain: { constraints: ["mode1", "mode3"] },
    anchors: { violations: [] },
    evidence: { intervention_support: 0.9 },
    metrics: { simplicity_score: 0.7, risk_score: 0.1 }
  }
];

function runTest(name, context, obs, expect) {
  const res = lawGovernanceGate(context, obs, lawVault);
  console.log(name, res.verdict === expect ? "PASS" : "FAIL", res);
}

runTest("T1_No_Law", ["mode2"], "LAW_A", "REFUSE");
runTest("T2_Conflict", ["mode1", "mode3"], "something", "REFUSE");
runTest("T3_Runtime_Mismatch", ["mode1"], "wrong", "REFUSE");
runTest("T4_Valid", ["mode1"], "LAW_A", "PASS");
