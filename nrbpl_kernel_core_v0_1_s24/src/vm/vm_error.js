/**
 * vm_error.js — VM Error Types
 *
 * Error types for NRBPL VM execution.
 */

class VMError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'VMError';
    this.code = code;
    this.details = details;
  }
}

class OpcodeError extends VMError {
  constructor(message, opcode, details = {}) {
    super(message, 'OPCODE_ERROR', { opcode, ...details });
    this.name = 'OpcodeError';
    this.opcode = opcode;
  }
}

class StackError extends VMError {
  constructor(message, details = {}) {
    super(message, 'STACK_ERROR', details);
    this.name = 'StackError';
  }
}

class VerdictError extends VMError {
  constructor(message, verdict, details = {}) {
    super(message, 'VERDICT_ERROR', { verdict, ...details });
    this.name = 'VerdictError';
    this.verdict = verdict;
  }
}

class PackError extends VMError {
  constructor(message, pack_id, details = {}) {
    super(message, 'PACK_ERROR', { pack_id, ...details });
    this.name = 'PackError';
    this.pack_id = pack_id;
  }
}

class LedgerError extends VMError {
  constructor(message, details = {}) {
    super(message, 'LEDGER_ERROR', details);
    this.name = 'LedgerError';
  }
}

module.exports = {
  VMError,
  OpcodeError,
  StackError,
  VerdictError,
  PackError,
  LedgerError
};
