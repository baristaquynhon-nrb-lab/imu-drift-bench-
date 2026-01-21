#!/usr/bin/env node

/**
 * nrbcore.js — CLI Entry Point for NRBPL Kernel-CORE v0.1
 *
 * Usage:
 *   nrbcore run <program.json> <dict.json>
 *   nrbcore verify <ledger.json>
 *   nrbcore replay <ledger.json>
 *   nrbcore nl "<NL_TEXT>" [--lang=vi|en]
 */

const fs = require('fs');
const path = require('path');
const { VM } = require('../src/vm/vm');
const ledger = require('../src/runtime/ledger');
const nlPipeline = require('../src/nl/nl_pipeline');

const USAGE = `
NRBPL Kernel-CORE v0.1 — CLI

Usage:
  nrbcore run <program.json> <dict.json>     Execute program with dictionary
  nrbcore verify <ledger.json>               Verify ledger integrity
  nrbcore replay <ledger.json>               Replay ledger and verify
  nrbcore nl "<NL_TEXT>" [--lang=vi|en]      Process NL input (default: vi)
  nrbcore help                               Show this help

Examples:
  nrbcore run examples/prog_lookup_pr_ledger.json examples/en_en_lex_min.nrbp-dict.json
  nrbcore verify trial_ledger.json
  nrbcore nl "Tra từ 'hello' trong từ điển examples/en_en_lex_min.nrbp-dict.json"
  nrbcore nl "lookup 'hello' in dictionary examples/en_en_lex_min.nrbp-dict.json" --lang=en
`;

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help') {
    console.log(USAGE);
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'run':
        cmdRun(args.slice(1));
        break;
      case 'verify':
        cmdVerify(args.slice(1));
        break;
      case 'replay':
        cmdReplay(args.slice(1));
        break;
      case 'nl':
        cmdNL(args.slice(1));
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log(USAGE);
        process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

function cmdRun(args) {
  if (args.length < 2) {
    console.error('Usage: nrbcore run <program.json> <dict.json>');
    process.exit(1);
  }

  const programPath = args[0];
  const dictPath = args[1];

  console.log(`Loading program: ${programPath}`);
  const program = JSON.parse(fs.readFileSync(programPath, 'utf8'));

  console.log(`Loading dictionary: ${dictPath}`);
  const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));

  console.log('Initializing VM...');
  const vm = new VM();

  console.log('Loading dictionary into VM...');
  vm.loadDictionary(dict);

  console.log('Executing program...');
  const result = vm.execute(program);

  console.log('\n=== Execution Result ===');
  console.log('Halted:', result.halted);
  console.log('Halt Reason:', result.halt_reason);
  console.log('Stack:', JSON.stringify(result.stack, null, 2));
  console.log('Ledger Entries:', result.ledger.entries.length);

  console.log('\n=== Verifying Ledger ===');
  const verified = ledger.verifyLedger(result.ledger);
  console.log('Ledger Verified:', verified);

  console.log('\n=== Ledger Chain ===');
  console.log('Genesis Hash:', result.ledger.genesis_hash);
  console.log('Latest Chain Hash:', ledger.getLatestChainHash(result.ledger));

  // Write ledger to file
  const ledgerPath = 'trial_ledger.json';
  fs.writeFileSync(ledgerPath, JSON.stringify(result.ledger, null, 2));
  console.log(`\nLedger written to: ${ledgerPath}`);
}

function cmdVerify(args) {
  if (args.length < 1) {
    console.error('Usage: nrbcore verify <ledger.json>');
    process.exit(1);
  }

  const ledgerPath = args[0];

  console.log(`Loading ledger: ${ledgerPath}`);
  const ledgerObj = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

  console.log('Verifying ledger...');
  const verified = ledger.verifyLedger(ledgerObj);

  console.log('\n=== Verification Result ===');
  console.log('Verified:', verified);
  console.log('Entries:', ledgerObj.entries.length);
  console.log('Genesis Hash:', ledgerObj.genesis_hash);
  console.log('Latest Chain Hash:', ledger.getLatestChainHash(ledgerObj));

  if (verified) {
    console.log('\n✓ Ledger integrity verified');
  } else {
    console.log('\n✗ Ledger verification failed');
    process.exit(1);
  }
}

function cmdReplay(args) {
  if (args.length < 1) {
    console.error('Usage: nrbcore replay <ledger.json>');
    process.exit(1);
  }

  const ledgerPath = args[0];

  console.log(`Loading ledger: ${ledgerPath}`);
  const ledgerObj = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

  console.log('Replaying ledger...');
  const prs = ledger.replayLedger(ledgerObj);

  console.log('\n=== Replay Result ===');
  console.log('Total PRs:', prs.length);

  console.log('\n=== PR Summary ===');
  prs.forEach((pr, i) => {
    console.log(`[${i}] ${pr.op} → ${pr.verdict} (${pr.hash.substring(0, 8)}...)`);
  });

  console.log('\n✓ Replay completed successfully');
}

function cmdNL(args) {
  if (args.length < 1) {
    console.error('Usage: nrbcore nl "<NL_TEXT>" [--lang=vi|en]');
    process.exit(1);
  }

  const nlInput = args[0];

  // Parse language flag
  let lang = 'vi'; // default
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--lang=')) {
      lang = args[i].substring('--lang='.length);
    }
  }

  console.log('=== NRBPL NL Programming v0.1 ===\n');
  console.log('Input Language:', lang);
  console.log('NL Input:', nlInput);
  console.log('');

  // Process NL through pipeline
  const result = nlPipeline.processNL(nlInput, lang);

  console.log('=== Processing Result ===');
  console.log('Verdict:', result.verdict);

  if (result.verdict !== 'PASS') {
    console.log('Reason:', result.reason);
    process.exit(1);
  }

  // Show CNL
  console.log('\n=== CNL Program ===');
  console.log(result.stages.cnl.text);

  // Show IR
  console.log('\n=== IR (Intermediate Representation) ===');
  console.log(JSON.stringify(result.stages.ir, null, 2));

  // Show Opcodes
  console.log('\n=== Opcodes Program ===');
  console.log(JSON.stringify(result.stages.opcodes, null, 2));

  console.log('\n✓ NL processing completed successfully');
}

if (require.main === module) {
  main();
}

module.exports = { main };
