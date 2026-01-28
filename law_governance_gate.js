// Simplified Law Governance Gate Runtime

function domainMatch(domain, context) {
  return domain.constraints.every(c => context.includes(c));
}

function violatesAnchor(law, context) {
  return law.anchors.violations.some(v => context.includes(v));
}

function lawPredicts(law, context, observation) {
  // Mock: law predicts correctly if observation includes its law_id
  return observation.includes(law.law_id);
}

function resolveConflict(set) {
  // C1: intervention support
  let max = Math.max(...set.map(l => l.evidence.intervention_support));
  set = set.filter(l => l.evidence.intervention_support === max);
  if (set.length === 1) return set[0];

  // C4: simplicity
  max = Math.max(...set.map(l => l.metrics.simplicity_score));
  set = set.filter(l => l.metrics.simplicity_score === max);
  if (set.length === 1) return set[0];

  return null;
}

function lawGovernanceGate(context, observation, lawVault) {
  let candidates = lawVault.filter(l =>
    l.status === "ACTIVE" &&
    domainMatch(l.domain, context) &&
    !violatesAnchor(l, context)
  );

  if (candidates.length === 0) {
    return { verdict: "REFUSE", reason: "NO_APPLICABLE_LAW" };
  }

  candidates.forEach(l => {
    l.total_score =
      l.evidence.intervention_support +
      l.metrics.simplicity_score -
      l.metrics.risk_score;
  });

  candidates.sort((a, b) => b.total_score - a.total_score);

  let top = candidates[0];
  let tied = candidates.filter(l => Math.abs(l.total_score - top.total_score) < 0.01);

  let selected = tied.length === 1 ? top : resolveConflict(tied);

  if (!selected) {
    return { verdict: "REFUSE", reason: "LAW_CONFLICT_UNRESOLVED" };
  }

  if (!lawPredicts(selected, context, observation)) {
    return { verdict: "REFUSE", reason: "LAW_MISMATCH_RUNTIME" };
  }

  return {
    verdict: "PASS",
    selected_law: selected.law_id,
    log: true
  };
}

module.exports = { lawGovernanceGate };
