/**
 * run_all.js — Test Suite for NRBPL Kernel-CORE v0.1
 *
 * Tests:
 * 1. Canonical JSON
 * 2. PR Schema
 * 3. Verdict propagation
 * 4. PR hashing
 * 5. Ledger append/verify/replay
 * 6. Dictionary pack
 * 7. Dictionary index/lookup
 * 8. VM execution
 * 9. End-to-end: evidence → PR → ledger → replay
 */

const assert = require('assert');
const cjson = require('../src/runtime/cjson');
const prSchema = require('../src/runtime/pr_schema');
const verdict = require('../src/runtime/verdict');
const prHash = require('../src/runtime/pr_hash');
const ledger = require('../src/runtime/ledger');
const dictPack = require('../src/pack/dict_pack');
const dictIndex = require('../src/lexicon/dict_index');
const { VM } = require('../src/vm/vm');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    testsFailed++;
  }
}

console.log('=== NRBPL Kernel-CORE v0.1 Test Suite ===\n');

// Test 1: Canonical JSON
test('cjson: canonicalize object', () => {
  const obj = { b: 2, a: 1 };
  const canonical = cjson.canonicalize(obj);
  assert.strictEqual(canonical, '{"a":1,"b":2}');
});

test('cjson: canonicalize array', () => {
  const arr = [3, 1, 2];
  const canonical = cjson.canonicalize(arr);
  assert.strictEqual(canonical, '[3,1,2]');
});

test('cjson: canonicalize nested', () => {
  const obj = { z: [3, 1], a: { y: 2, x: 1 } };
  const canonical = cjson.canonicalize(obj);
  assert.strictEqual(canonical, '{"a":{"x":1,"y":2},"z":[3,1]}');
});

// Test 2: PR Schema
test('prSchema: create PR', () => {
  const pr = prSchema.createPR('TEST_OP', { x: 1 }, { y: 2 }, { z: 3 }, 'PASS');
  assert.strictEqual(pr.pr_version, '0.1');
  assert.strictEqual(pr.op, 'TEST_OP');
  assert.strictEqual(pr.verdict, 'PASS');
  assert.deepStrictEqual(pr.ΔC, { x: 1 });
});

test('prSchema: validate PR', () => {
  const pr = prSchema.createPR('TEST', {}, {}, {}, 'PASS');
  assert.strictEqual(prSchema.validatePR(pr), true);
});

test('prSchema: invalid verdict throws', () => {
  assert.throws(() => {
    prSchema.createPR('TEST', {}, {}, {}, 'INVALID');
  });
});

// Test 3: Verdict propagation
test('verdict: merge PASS verdicts', () => {
  const result = verdict.mergeVerdicts(['PASS', 'PASS']);
  assert.strictEqual(result, 'PASS');
});

test('verdict: merge with FAIL', () => {
  const result = verdict.mergeVerdicts(['PASS', 'FAIL']);
  assert.strictEqual(result, 'FAIL');
});

test('verdict: merge with REFUSE', () => {
  const result = verdict.mergeVerdicts(['PASS', 'FAIL', 'REFUSE']);
  assert.strictEqual(result, 'REFUSE');
});

test('verdict: propagate from PRs', () => {
  const prs = [
    { verdict: 'PASS' },
    { verdict: 'FAIL' }
  ];
  const result = verdict.propagateVerdicts(prs);
  assert.strictEqual(result, 'FAIL');
});

// Test 4: PR hashing
test('prHash: hash PR', () => {
  const pr = prSchema.createPR('TEST', {}, {}, {}, 'PASS');
  const hash = prHash.hashPR(pr);
  assert.strictEqual(typeof hash, 'string');
  assert.strictEqual(hash.length, 64); // SHA-256 hex
});

test('prHash: verify PR hash', () => {
  const pr = prSchema.createPR('TEST', {}, {}, {}, 'PASS');
  prHash.addHashToPR(pr);
  assert.strictEqual(prHash.verifyPRHash(pr), true);
});

test('prHash: hash is deterministic', () => {
  const pr1 = prSchema.createPR('TEST', { a: 1 }, {}, {}, 'PASS');
  const pr2 = prSchema.createPR('TEST', { a: 1 }, {}, {}, 'PASS');
  pr1.ts = '2025-01-01T00:00:00.000Z';
  pr2.ts = '2025-01-01T00:00:00.000Z';
  assert.strictEqual(prHash.hashPR(pr1), prHash.hashPR(pr2));
});

// Test 5: Ledger
test('ledger: create ledger', () => {
  const l = ledger.createLedger();
  assert.strictEqual(l.version, '0.1');
  assert.strictEqual(l.entries.length, 0);
});

test('ledger: append PR', () => {
  const l = ledger.createLedger();
  const pr = prSchema.createPR('TEST', {}, {}, {}, 'PASS');
  prHash.addHashToPR(pr);
  ledger.appendPR(l, pr);
  assert.strictEqual(l.entries.length, 1);
});

test('ledger: verify ledger', () => {
  const l = ledger.createLedger();
  const pr1 = prSchema.createPR('TEST1', {}, {}, {}, 'PASS');
  const pr2 = prSchema.createPR('TEST2', {}, {}, {}, 'PASS');
  prHash.addHashToPR(pr1);
  prHash.addHashToPR(pr2);
  ledger.appendPR(l, pr1);
  ledger.appendPR(l, pr2);
  assert.strictEqual(ledger.verifyLedger(l), true);
});

test('ledger: replay ledger', () => {
  const l = ledger.createLedger();
  const pr1 = prSchema.createPR('TEST1', {}, {}, {}, 'PASS');
  const pr2 = prSchema.createPR('TEST2', {}, {}, {}, 'PASS');
  prHash.addHashToPR(pr1);
  prHash.addHashToPR(pr2);
  ledger.appendPR(l, pr1);
  ledger.appendPR(l, pr2);
  const prs = ledger.replayLedger(l);
  assert.strictEqual(prs.length, 2);
  assert.strictEqual(prs[0].op, 'TEST1');
  assert.strictEqual(prs[1].op, 'TEST2');
});

// Test 6: Dictionary pack
test('dictPack: create pack', () => {
  const pack = dictPack.createPack('test_dict', '1.0.0');
  assert.strictEqual(pack.dict_id, 'test_dict');
  assert.strictEqual(pack.dict_version, '1.0.0');
});

test('dictPack: add entry', () => {
  const pack = dictPack.createPack('test_dict', '1.0.0');
  dictPack.addEntry(pack, {
    lemma: 'test',
    pos: 'NOUN',
    senses: [{ sense_id: 'test.01', definition: 'A test' }]
  });
  assert.strictEqual(pack.entries.length, 1);
});

test('dictPack: validate and hash', () => {
  const pack = dictPack.createPack('test_dict', '1.0.0');
  dictPack.validatePack(pack);
  dictPack.addHashToPack(pack);
  assert.strictEqual(dictPack.verifyPackHash(pack), true);
});

// Test 7: Dictionary index
test('dictIndex: build and lookup', () => {
  const pack = dictPack.createPack('test_dict', '1.0.0');
  dictPack.addEntry(pack, {
    lemma: 'test',
    pos: 'NOUN',
    senses: [{ sense_id: 'test.01', definition: 'A test' }]
  });

  const index = dictIndex.buildIndex(pack);
  const results = dictIndex.lookup(index, 'test');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].lemma, 'test');
});

test('dictIndex: lookup non-existent', () => {
  const pack = dictPack.createPack('test_dict', '1.0.0');
  const index = dictIndex.buildIndex(pack);
  const results = dictIndex.lookup(index, 'nonexistent');
  assert.strictEqual(results.length, 0);
});

// Test 8: VM execution
test('VM: PUSH and POP', () => {
  const vm = new VM();
  const program = {
    instructions: [
      { op: 'PUSH', args: { value: 42 } },
      { op: 'HALT', args: { reason: 'test' } }
    ]
  };
  const result = vm.execute(program);
  assert.strictEqual(result.stack[0], 42);
  assert.strictEqual(result.halted, true);
});

test('VM: DICT_LOOKUP', () => {
  const vm = new VM();
  const pack = dictPack.createPack('test_dict', '1.0.0');
  dictPack.addEntry(pack, {
    lemma: 'hello',
    pos: 'INTJ',
    senses: [{ sense_id: 'hello.01', definition: 'A greeting' }]
  });
  dictPack.addHashToPack(pack);

  vm.loadDictionary(pack);

  const program = {
    instructions: [
      { op: 'DICT_LOOKUP', args: { dict_id: 'test_dict', lemma: 'hello' } },
      { op: 'HALT', args: {} }
    ]
  };

  const result = vm.execute(program);
  assert.strictEqual(result.stack[0].found, true);
  assert.strictEqual(result.stack[0].results.length, 1);
});

// Test 9: End-to-end
test('E2E: evidence → PR → ledger → replay', () => {
  const vm = new VM();

  // Create and load dictionary
  const pack = dictPack.createPack('e2e_dict', '1.0.0');
  dictPack.addEntry(pack, {
    lemma: 'test',
    pos: 'NOUN',
    senses: [{ sense_id: 'test.01', definition: 'A test word' }]
  });
  dictPack.addHashToPack(pack);
  vm.loadDictionary(pack);

  // Execute program
  const program = {
    instructions: [
      { op: 'DICT_LOOKUP', args: { dict_id: 'e2e_dict', lemma: 'test' } },
      { op: 'ASSERT_FOUND', args: {} },
      { op: 'HALT', args: { reason: 'e2e_test' } }
    ]
  };

  const result = vm.execute(program);

  // Verify ledger
  assert.strictEqual(ledger.verifyLedger(result.ledger), true);

  // Replay ledger
  const prs = ledger.replayLedger(result.ledger);
  assert.strictEqual(prs.length, 3);
  assert.strictEqual(prs[0].op, 'DICT_LOOKUP');
  assert.strictEqual(prs[0].verdict, 'PASS');
  assert.strictEqual(prs[1].op, 'ASSERT_FOUND');
  assert.strictEqual(prs[1].verdict, 'PASS');
  assert.strictEqual(prs[2].op, 'HALT');
  assert.strictEqual(prs[2].verdict, 'PASS');
});

console.log(`\n=== Test Summary ===`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total:  ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
}

console.log('\n✓ All tests passed');
