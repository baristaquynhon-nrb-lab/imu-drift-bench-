/**
 * vm.js — NRBPL Virtual Machine (Section E)
 *
 * VM execution model:
 * - Stack-based
 * - Every operation emits a PR
 * - Verdict propagation (REFUSE > FAIL > PASS)
 * - Fail-fast on REFUSE or FAIL
 */

const prSchema = require('../runtime/pr_schema');
const prHash = require('../runtime/pr_hash');
const verdict = require('../runtime/verdict');
const ledger = require('../runtime/ledger');
const dictIndex = require('../lexicon/dict_index');
const dictPack = require('../pack/dict_pack');
const {
  VMError,
  OpcodeError,
  StackError,
  VerdictError,
  PackError
} = require('./vm_error');

/**
 * VM state.
 */
class VMState {
  constructor() {
    this.stack = [];
    this.registers = {};
    this.ledger = ledger.createLedger();
    this.dictionaries = new Map(); // dict_id -> { pack, index }
    this.halted = false;
    this.halt_reason = null;
  }

  push(value) {
    this.stack.push(value);
  }

  pop() {
    if (this.stack.length === 0) {
      throw new StackError('Stack underflow');
    }
    return this.stack.pop();
  }

  peek() {
    if (this.stack.length === 0) {
      throw new StackError('Stack is empty');
    }
    return this.stack[this.stack.length - 1];
  }

  setRegister(name, value) {
    this.registers[name] = value;
  }

  getRegister(name) {
    return this.registers[name];
  }

  halt(reason) {
    this.halted = true;
    this.halt_reason = reason;
  }
}

/**
 * VM executor.
 */
class VM {
  constructor() {
    this.state = new VMState();
  }

  /**
   * Load dictionary pack.
   * @param {Object} pack - Dictionary pack
   */
  loadDictionary(pack) {
    dictPack.validatePack(pack);

    if (!pack.hash) {
      dictPack.addHashToPack(pack);
    }

    if (!dictPack.verifyPackHash(pack)) {
      throw new PackError('Pack hash verification failed', pack.dict_id);
    }

    const index = dictIndex.buildIndex(pack);

    this.state.dictionaries.set(pack.dict_id, { pack, index });
  }

  /**
   * Execute program.
   * @param {Object} program - Program object { instructions: [...] }
   * @returns {Object} - Execution result
   */
  execute(program) {
    if (!program || !Array.isArray(program.instructions)) {
      throw new VMError('Invalid program format', 'INVALID_PROGRAM');
    }

    for (const instruction of program.instructions) {
      if (this.state.halted) {
        break;
      }

      this.executeInstruction(instruction);
    }

    return {
      halted: this.state.halted,
      halt_reason: this.state.halt_reason,
      stack: this.state.stack,
      ledger: this.state.ledger
    };
  }

  /**
   * Execute single instruction.
   * @param {Object} instruction - { op, args }
   */
  executeInstruction(instruction) {
    const { op, args } = instruction;

    switch (op) {
      case 'PUSH':
        this.opPush(args);
        break;
      case 'POP':
        this.opPop(args);
        break;
      case 'DICT_LOOKUP':
        this.opDictLookup(args);
        break;
      case 'ASSERT_FOUND':
        this.opAssertFound(args);
        break;
      case 'HALT':
        this.opHalt(args);
        break;
      default:
        throw new OpcodeError(`Unknown opcode: ${op}`, op);
    }
  }

  /**
   * PUSH operation.
   */
  opPush(args) {
    const { value } = args;

    const pr = prSchema.createPR(
      'PUSH',
      { value },
      { type: typeof value },
      { stack_depth: this.state.stack.length },
      'PASS'
    );

    prHash.addHashToPR(pr);
    ledger.appendPR(this.state.ledger, pr);

    this.state.push(value);
  }

  /**
   * POP operation.
   */
  opPop(args) {
    let popVerdict = 'PASS';
    let poppedValue = null;

    try {
      poppedValue = this.state.pop();
    } catch (err) {
      popVerdict = 'FAIL';
    }

    const pr = prSchema.createPR(
      'POP',
      { stack_depth: this.state.stack.length + 1 },
      { popped_value: poppedValue },
      { success: popVerdict === 'PASS' },
      popVerdict
    );

    prHash.addHashToPR(pr);
    ledger.appendPR(this.state.ledger, pr);

    if (verdict.isTerminal(popVerdict)) {
      this.state.halt(`POP failed: ${popVerdict}`);
      throw new VerdictError('POP failed', popVerdict);
    }
  }

  /**
   * DICT_LOOKUP operation.
   */
  opDictLookup(args) {
    const { dict_id, lemma } = args;

    const dictEntry = this.state.dictionaries.get(dict_id);
    if (!dictEntry) {
      const pr = prSchema.createPR(
        'DICT_LOOKUP',
        { dict_id, lemma },
        {},
        {},
        'REFUSE'
      );
      prHash.addHashToPR(pr);
      ledger.appendPR(this.state.ledger, pr);

      this.state.halt(`Dictionary not loaded: ${dict_id}`);
      throw new PackError('Dictionary not loaded', dict_id);
    }

    const { pack, index } = dictEntry;
    const results = dictIndex.lookup(index, lemma);

    const evidence = dictIndex.createLookupEvidence(
      lemma,
      results,
      pack.dict_id,
      pack.hash
    );

    const lookupVerdict = results.length > 0 ? 'PASS' : 'FAIL';

    const pr = prSchema.createPR(
      'DICT_LOOKUP',
      evidence.ΔC,
      evidence.ΔS,
      evidence.ΔP,
      lookupVerdict
    );

    prHash.addHashToPR(pr);
    ledger.appendPR(this.state.ledger, pr);

    // Push results to stack
    this.state.push({ found: results.length > 0, results });
  }

  /**
   * ASSERT_FOUND operation.
   */
  opAssertFound(args) {
    let assertVerdict = 'PASS';
    let found = false;

    try {
      const top = this.state.peek();
      found = top && top.found === true;

      if (!found) {
        assertVerdict = 'FAIL';
      }
    } catch (err) {
      assertVerdict = 'REFUSE';
    }

    const pr = prSchema.createPR(
      'ASSERT_FOUND',
      { expected: true, actual: found },
      {},
      {},
      assertVerdict
    );

    prHash.addHashToPR(pr);
    ledger.appendPR(this.state.ledger, pr);

    if (verdict.isTerminal(assertVerdict)) {
      this.state.halt(`ASSERT_FOUND failed: ${assertVerdict}`);
      throw new VerdictError('ASSERT_FOUND failed', assertVerdict);
    }
  }

  /**
   * HALT operation.
   */
  opHalt(args) {
    const { reason } = args || {};

    const pr = prSchema.createPR(
      'HALT',
      { reason: reason || 'normal' },
      {},
      {},
      'PASS'
    );

    prHash.addHashToPR(pr);
    ledger.appendPR(this.state.ledger, pr);

    this.state.halt(reason || 'normal');
  }

  /**
   * Get current ledger.
   */
  getLedger() {
    return this.state.ledger;
  }

  /**
   * Verify ledger.
   */
  verifyLedger() {
    return ledger.verifyLedger(this.state.ledger);
  }
}

module.exports = {
  VM,
  VMState
};
