#!/usr/bin/env bash
set -e

echo "== L2 STYLISTIC GATE TEST =="

node validators/l2_stylistic_gate.js \
  --meaning tests/fixtures/meaning_ok.json \
  --pattern tests/fixtures/pattern_ok_vi.json \
  --lock tests/fixtures/semantic_lock.json

echo "PASS CASE OK"

echo "== EXPECT REFUSE =="

set +e
node validators/l2_stylistic_gate.js \
  --meaning tests/fixtures/meaning_ok.json \
  --pattern tests/fixtures/pattern_bad_inference.json \
  --lock tests/fixtures/semantic_lock.json

echo "REFUSE CASE OK"
