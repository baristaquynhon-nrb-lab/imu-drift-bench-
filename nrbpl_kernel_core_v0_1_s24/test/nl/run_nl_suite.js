/**
 * run_nl_suite.js — NL Test Suite Runner
 *
 * Runs all test cases from NL_TEST_SUITE_v0_1.json and validates them.
 * Generates audit logs in _audit/ directory.
 *
 * MUST:
 * - Test all cases deterministically
 * - Validate expected_verdict matches actual verdict
 * - Validate expected_cnl_program matches actual CNL
 * - Validate expected_slots matches actual slots
 * - Generate audit trail for each test
 * - PASS all cases or fail fast
 */

const fs = require('fs');
const path = require('path');
const nlPipeline = require('../../src/nl/nl_pipeline');

// Load test suite
const TEST_SUITE_PATH = path.join(__dirname, 'NL_TEST_SUITE_v0_1.json');
const TEST_SUITE = JSON.parse(fs.readFileSync(TEST_SUITE_PATH, 'utf8'));

// Audit directory
const AUDIT_DIR = path.join(__dirname, '../../_audit');
if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

let testsPassed = 0;
let testsFailed = 0;
const auditRecords = [];

/**
 * Run single test case.
 * @param {Object} testCase - Test case object
 * @returns {boolean} - true if passed
 */
function runTestCase(testCase) {
  const { id, nl_lang, nl_input, expected_verdict, expected_intent, expected_slots, expected_cnl_program, expected_reason_contains } = testCase;

  console.log(`\n[${id}] Testing: "${nl_input.substring(0, 50)}${nl_input.length > 50 ? '...' : ''}"`);

  const result = nlPipeline.processNL(nl_input, nl_lang);

  const audit = {
    test_id: id,
    nl_input,
    nl_lang,
    expected_verdict,
    actual_verdict: result.verdict,
    timestamp: new Date().toISOString(),
    passed: false,
    failures: []
  };

  // Check verdict
  if (result.verdict !== expected_verdict) {
    audit.failures.push(`Verdict mismatch: expected ${expected_verdict}, got ${result.verdict}`);
  }

  // For PASS cases, validate further
  if (expected_verdict === 'PASS' && result.verdict === 'PASS') {
    // Check intent
    if (expected_intent && result.stages && result.stages.parse && result.stages.parse.intent !== expected_intent) {
      audit.failures.push(`Intent mismatch: expected ${expected_intent}, got ${result.stages.parse.intent}`);
    }

    // Check slots
    if (expected_slots && result.stages && result.stages.parse) {
      const actualSlots = result.stages.parse.slots || {};
      for (const slotName in expected_slots) {
        if (actualSlots[slotName] !== expected_slots[slotName]) {
          audit.failures.push(`Slot '${slotName}' mismatch: expected '${expected_slots[slotName]}', got '${actualSlots[slotName]}'`);
        }
      }
    }

    // Check CNL program
    if (expected_cnl_program && result.stages && result.stages.cnl) {
      const actualCNL = result.stages.cnl.lines;
      if (JSON.stringify(actualCNL) !== JSON.stringify(expected_cnl_program)) {
        audit.failures.push(`CNL program mismatch`);
        audit.expected_cnl = expected_cnl_program;
        audit.actual_cnl = actualCNL;
      }
    }

    if (result.stages && result.stages.cnl) {
      audit.cnl = result.stages.cnl.text;
    }
    if (result.stages && result.stages.ir) {
      audit.ir = result.stages.ir;
    }
    if (result.stages && result.stages.opcodes) {
      audit.opcodes = result.stages.opcodes;
    }
  }

  // For REFUSE cases, validate reason
  if (expected_verdict === 'REFUSE') {
    if (expected_reason_contains && result.reason && !result.reason.includes(expected_reason_contains)) {
      audit.failures.push(`Reason should contain '${expected_reason_contains}', got '${result.reason}'`);
    }
    audit.reason = result.reason || 'No reason provided';
  }

  // Determine pass/fail
  audit.passed = audit.failures.length === 0;

  if (audit.passed) {
    console.log(`  ✓ PASS`);
    testsPassed++;
  } else {
    console.log(`  ✗ FAIL`);
    audit.failures.forEach(failure => {
      console.log(`    - ${failure}`);
    });
    testsFailed++;
  }

  auditRecords.push(audit);
  return audit.passed;
}

/**
 * Write audit logs.
 */
function writeAuditLogs() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const auditPath = path.join(AUDIT_DIR, `nl_test_audit_${timestamp}.json`);

  const auditReport = {
    suite: TEST_SUITE.suite,
    spec: TEST_SUITE.spec,
    timestamp: new Date().toISOString(),
    total_tests: testsPassed + testsFailed,
    passed: testsPassed,
    failed: testsFailed,
    records: auditRecords
  };

  fs.writeFileSync(auditPath, JSON.stringify(auditReport, null, 2));
  console.log(`\nAudit log written to: ${auditPath}`);
}

/**
 * Main test runner.
 */
function main() {
  console.log('=== NRBPL NL Test Suite v0.1 ===\n');
  console.log(`Suite: ${TEST_SUITE.suite}`);
  console.log(`Total test cases: ${TEST_SUITE.cases.length}\n`);

  // Run all test cases
  for (const testCase of TEST_SUITE.cases) {
    runTestCase(testCase);
  }

  // Write audit logs
  writeAuditLogs();

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Total:  ${testsPassed + testsFailed}`);

  if (testsFailed > 0) {
    console.log('\n✗ Some tests failed');
    process.exit(1);
  }

  console.log('\n✓ All tests passed');
}

if (require.main === module) {
  main();
}

module.exports = { runTestCase, main };
