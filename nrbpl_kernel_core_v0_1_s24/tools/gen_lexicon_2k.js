#!/usr/bin/env node
/**
 * tools/gen_lexicon_2k.js — NTL Lemma 2K Generator v0.1
 *
 * Deterministic, evidence-first:
 * - No lemma mutation (reject invalid)
 * - vi_gloss MUST exist (reject missing)
 * - POS MUST be canonical (n|v|adj|adv|prep|conj|det|pron|num|interj)
 * - Merge: Oxford priority then WordNet, dedupe by lemma|pos
 * - Selection: priority -> lemma -> pos, take exactly N (default 2000)
 * - Output sorted by (lemma,pos)
 *
 * Inputs (JSONL records):
 *   sources/oxford3000_seed.jsonl
 *   sources/wordnet_top.jsonl
 *
 * Required source record schema:
 *   { "lemma": "run", "pos": "v", "vi_gloss": "chạy" , "ref": "..." }
 *
 * Usage:
 *   node tools/gen_lexicon_2k.js --n 2000
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const SOURCES = path.join(ROOT, "sources");
const LEXICON = path.join(ROOT, "lexicon");

const DEFAULT_OXFORD = path.join(SOURCES, "oxford3000_seed.jsonl");
const DEFAULT_WORDNET = path.join(SOURCES, "wordnet_top.jsonl");
const DEFAULT_OUT = path.join(LEXICON, "en_vi_lemmas_2k.jsonl");

const POS_SET = new Set(["n", "v", "adj", "adv", "prep", "conj", "det", "pron", "num", "interj"]);

function sha256Hex(bufOrStr) {
  return crypto.createHash("sha256").update(bufOrStr).digest("hex");
}

function die(msg) {
  console.error(msg);
  process.exit(3);
}

function readText(fp) {
  if (!fs.existsSync(fp)) die(`REFUSE: file not found: ${fp}`);
  const raw = fs.readFileSync(fp, "utf8");
  const t = raw.trim();
  if (!t) die(`REFUSE: empty file: ${fp}`);
  return raw;
}

function loadJsonLines(fp) {
  const raw = readText(fp);
  const lines = raw.split("\n").filter(l => l.trim().length > 0);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1;
    try {
      out.push({ line: ln, obj: JSON.parse(lines[i]) });
    } catch (e) {
      die(`REFUSE: JSON parse error at ${fp}:${ln}: ${e.message}`);
    }
  }
  return out;
}

function isLowerAlpha(s) {
  return /^[a-z]+$/.test(s);
}

function hasInferenceMarkers(s) {
  return /(\?\?|\btbd\b|\bunknown\b|\bmaybe\b|\bprobably\b|\bapprox\b|~)/i.test(s);
}

function hasMultiGlossSeparators(s) {
  return /[;|\/\\]/.test(s) || /\s,\s/.test(s) || /\s-\s/.test(s);
}

function tokenCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function validateSourceRecord(fp, row) {
  const o = row.obj;
  if (!o || typeof o !== "object" || Array.isArray(o)) die(`REFUSE: ${fp}:${row.line}: record must be object`);
  for (const f of ["lemma", "pos", "vi_gloss"]) {
    if (!(f in o)) die(`REFUSE: ${fp}:${row.line}: missing field '${f}'`);
    if (typeof o[f] !== "string" || o[f].trim().length < 1) die(`REFUSE: ${fp}:${row.line}: invalid '${f}'`);
  }
  const lemma = o.lemma.trim();
  if (!isLowerAlpha(lemma)) die(`REFUSE: ${fp}:${row.line}: lemma must be lowercase [a-z]+ only; no mutation allowed: '${lemma}'`);
  const pos = o.pos.trim();
  if (!POS_SET.has(pos)) die(`REFUSE: ${fp}:${row.line}: pos invalid: '${pos}'`);
  const gloss = o.vi_gloss.trim();
  if (hasInferenceMarkers(gloss)) die(`REFUSE: ${fp}:${row.line}: vi_gloss contains inference markers`);
  if (hasMultiGlossSeparators(gloss)) die(`REFUSE: ${fp}:${row.line}: vi_gloss contains multi-gloss separators`);
  const tc = tokenCount(gloss);
  if (tc < 1 || tc > 4) die(`REFUSE: ${fp}:${row.line}: vi_gloss must be 1–4 tokens in v0.1`);
  return { lemma, pos, vi_gloss: gloss, ref: (typeof o.ref === "string" ? o.ref : "") };
}

function main(argv) {
  const args = parseArgs(argv);
  const oxfordFp = args.oxford;
  const wordnetFp = args.wordnet;
  const outFp = args.out;
  const N = args.n;

  const oxRows = loadJsonLines(oxfordFp);
  const wnRows = loadJsonLines(wordnetFp);

  // Priority: Oxford(0), WordNet(1)
  const map = new Map(); // key lemma|pos => {priority, lemma,pos,vi_gloss,ref,source}
  for (const r of oxRows) {
    const v = validateSourceRecord(oxfordFp, r);
    const key = `${v.lemma}|${v.pos}`;
    if (!map.has(key)) map.set(key, { priority: 0, source: "oxford3000", ...v });
  }
  for (const r of wnRows) {
    const v = validateSourceRecord(wordnetFp, r);
    const key = `${v.lemma}|${v.pos}`;
    if (!map.has(key)) map.set(key, { priority: 1, source: "wordnet_top", ...v });
  }

  const all = Array.from(map.values());
  all.sort((a, b) => (a.priority - b.priority) || a.lemma.localeCompare(b.lemma) || a.pos.localeCompare(b.pos));

  if (all.length < N) die(`REFUSE: candidate pool too small: have ${all.length}, need ${N}`);

  const selected = all.slice(0, N);

  // Output must be sorted by lemma,pos only (gate requirement)
  selected.sort((a, b) => a.lemma.localeCompare(b.lemma) || a.pos.localeCompare(b.pos));

  fs.mkdirSync(path.dirname(outFp), { recursive: true });
  const lines = selected.map(e => JSON.stringify({
    lemma: e.lemma,
    pos: e.pos,
    vi_gloss: e.vi_gloss,
    frame: ""
  }));
  fs.writeFileSync(outFp, lines.join("\n") + "\n");

  const outBytes = fs.readFileSync(outFp);
  const outSha = sha256Hex(outBytes);
  const oxSha = sha256Hex(fs.readFileSync(oxfordFp));
  const wnSha = sha256Hex(fs.readFileSync(wordnetFp));

  // Deterministic build report (stdout)
  const report = {
    spec: "NTL_LEXICON_2K_BUILD_REPORT_v0_1",
    tool: "tools/gen_lexicon_2k.js",
    tool_version: "0.1.0",
    inputs: {
      oxford3000_seed: { path: path.relative(ROOT, oxfordFp), sha256: oxSha },
      wordnet_top: { path: path.relative(ROOT, wordnetFp), sha256: wnSha }
    },
    output: { path: path.relative(ROOT, outFp), lines: N, sha256: outSha },
    policy: { merge: "Oxford3000_priority_then_WordNet", lemma_mutation: "FORBIDDEN", missing_gloss: "REFUSE" }
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(0);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { n: 2000, oxford: DEFAULT_OXFORD, wordnet: DEFAULT_WORDNET, out: DEFAULT_OUT };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--n") out.n = parseInt(args[++i], 10);
    else if (a === "--oxford") out.oxford = args[++i];
    else if (a === "--wordnet") out.wordnet = args[++i];
    else if (a === "--out") out.out = args[++i];
  }
  if (!Number.isFinite(out.n) || out.n <= 0) die("REFUSE: --n must be positive integer");
  return out;
}

if (require.main === module) main(process.argv);
