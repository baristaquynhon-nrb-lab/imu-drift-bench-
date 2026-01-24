# NRBPL Version Control Integration Specification v0.1

**Status**: NORMATIVE
**Level**: L2 (Semantic Infrastructure)
**Discipline**: UGTS (Universal Grounded Truth System)

---

## 1. Purpose

This specification defines how NRBPL integrates with version control systems (git) to achieve:
- **Evidence anchoring**: Repository state binding via commit hashes
- **Deterministic verification**: Clean worktree enforcement
- **Audit trail**: Immutable evidence chain preservation
- **Non-inference**: No guessing, only inspection

---

## 2. Core Principles

### 2.1. ΔC→ΔS→ΔP Framework Integration

Git serves as the anchor for the **ΔC (Condition)** layer:

```
ΔC (Condition)
├─ Repository HEAD commit hash
├─ Lock file states (SHA-256 bound)
└─ Precondition checks (clean worktree, required files)

ΔS (Stability)
├─ Generated artifacts (lexicon, reports)
├─ SHA-256 evidence binding
└─ Audit logs (timestamped, immutable)

ΔP (Phenomenon)
├─ Gate verdicts (SUPPORTED | INSUFFICIENT | REFUSE)
├─ Exit codes (0 | 2 | 3)
└─ Closure certificates
```

### 2.2. Clean Worktree Discipline

**Law**: All closure operations MUST run with a clean git worktree.

**Rationale**: Uncommitted changes introduce non-determinism and evidence ambiguity.

**Enforcement**:
```javascript
const dirty = execSync('git status --porcelain', {encoding: 'utf8'}).trim();
if (dirty) {
  dieRefuse('WORKTREE_DIRTY', { hint: 'git status --porcelain must be empty' });
}
```

**Exit Code**: `3` (REFUSE)

---

## 3. Git Integration Points

### 3.1. Precondition Checks

Before any closure operation:

```bash
# Check 1: Repository exists
if [ ! -d .git ]; then
  echo '{"verdict":"REFUSE","reason_code":"NOT_A_GIT_REPO"}' >&2
  exit 3
fi

# Check 2: HEAD commit exists
HEAD_COMMIT=$(git rev-parse HEAD 2>/dev/null)
if [ -z "$HEAD_COMMIT" ]; then
  echo '{"verdict":"REFUSE","reason_code":"NO_HEAD_COMMIT"}' >&2
  exit 3
fi

# Check 3: Worktree is clean
DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
  echo '{"verdict":"REFUSE","reason_code":"WORKTREE_DIRTY"}' >&2
  exit 3
fi
```

### 3.2. Commit Hash Anchoring

**Purpose**: Bind closure certificates to specific repository states.

**Implementation**:
```javascript
const HEAD = execSync('git rev-parse HEAD', {encoding: 'utf8'}).trim();

const certificate = `
# NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1
Status: CLOSURE-CERTIFIED (L1-B)

## ΔC — Condition (Anchors + Locks)
- HEAD: ${HEAD}
- locks: locks/PATCH_SCOPE_LOCK_v0_1.json, locks/KERNEL_ABI_LOCK.json, ...
`;
```

**Verification**:
```bash
# Extract HEAD from certificate
CERT_HEAD=$(grep "^- HEAD:" certificate.md | awk '{print $3}')

# Verify it matches current repository
CURRENT_HEAD=$(git rev-parse HEAD)

if [ "$CERT_HEAD" != "$CURRENT_HEAD" ]; then
  echo "❌ Certificate HEAD mismatch"
  echo "   Certificate: $CERT_HEAD"
  echo "   Repository:  $CURRENT_HEAD"
  exit 1
fi
```

### 3.3. Branch Discipline

**Production Branches**: `main`, `master`
- NEVER force push
- NEVER run experimental closures
- ONLY merge verified certificates

**Development Branches**: `claude/*`, `dev/*`, `feat/*`
- Closure testing allowed
- Clean worktree still MANDATORY
- Certificate regeneration on HEAD change

**Enforcement**:
```javascript
const branch = execSync('git rev-parse --abbrev-ref HEAD', {encoding: 'utf8'}).trim();
const isProduction = ['main', 'master'].includes(branch);

if (isProduction && !process.env.FORCE_PRODUCTION_CLOSURE) {
  dieRefuse('PRODUCTION_BRANCH_CLOSURE_BLOCKED', {
    hint: 'Set FORCE_PRODUCTION_CLOSURE=1 if this is intentional'
  });
}
```

---

## 4. Evidence Chain Management

### 4.1. Audit Directory Exclusion

**Law**: `_audit/` directories MUST NOT be committed to git.

**Rationale**:
- Audit logs are regenerated on each closure run
- Committing them creates merge conflicts
- Evidence is preserved via SHA-256 checksums in certificates

**Implementation**:
```gitignore
# .gitignore
_audit/
*.log
/tmp/
```

**Verification**:
```bash
# Check no audit logs are tracked
git ls-files _audit/ 2>/dev/null | wc -l
# Must output: 0
```

### 4.2. Lock File Versioning

**Law**: All lock files MUST be committed and version-controlled.

**Rationale**: Lock files define semantic constraints and are part of ΔC anchors.

**Implementation**:
```bash
# Check all lock files are tracked
for lock in locks/*.json; do
  git ls-files --error-unmatch "$lock" >/dev/null 2>&1 || {
    echo "❌ Lock file not tracked: $lock"
    exit 1
  }
done
```

### 4.3. Certificate Versioning

**Law**: Closure certificates MUST be committed after successful verification.

**Workflow**:
```bash
# 1. Run closure (generates certificate)
node tools/run_L1B_colloc_frame_closure.js

# 2. Verify certificate matches current HEAD
grep "HEAD: $(git rev-parse HEAD)" docs/reports/NRBPL_L1B_*.md

# 3. Commit certificate
git add docs/reports/NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1.md
git commit -m "Add NRBPL L1-B Closure Certificate (SUPPORTED)"

# 4. Push to remote
git push
```

**Anti-Pattern** (REFUSE):
```bash
# ❌ NEVER commit certificate with different HEAD
# This creates evidence mismatch
git checkout HEAD~1
node tools/run_L1B_colloc_frame_closure.js  # Generates cert with old HEAD
git checkout main
git add docs/reports/NRBPL_L1B_*.md         # Commits cert with mismatched HEAD
```

---

## 5. Commit Message Discipline

### 5.1. Closure Certificate Commits

**Format**:
```
Add NRBPL <Level> <Scope> Closure Certificate (<VERDICT>)

Complete <Level> <description> closure:
- Semantic gate validation: <checks> checks <VERDICT>
- Evidence chain: <N>/<N> artifacts SHA-256 bound
- ΔC→ΔS→ΔP closure certified

This certificate documents successful verification of:
- <validator/tool list>
- <lock file list>

The <Level> <Law/Infrastructure> is now operational and tested.
```

**Example**:
```
Add NRBPL L1-B Colloc+Frame Closure Certificate (SUPPORTED)

Complete L2 Semantic Validation Infrastructure end-to-end testing:
- L1-B collocation+frame closure: PASS (exit 0)
- Semantic gate validation: 10/10 checks SUPPORTED
- Evidence chain: 16/16 artifacts SHA-256 bound
- ΔC→ΔS→ΔP closure certified

This certificate documents successful verification of:
- validators/semantic_gate.js (L2 semantic firewall)
- tools/run_L1B_colloc_frame_closure.js (closure runner)
- All 5 lock files (SEMANTIC_LAW, L2_REQUIRED_UNITS, L1B_SCOPE, etc.)

The L2 Semantic Validation Law is now operational and tested.
```

### 5.2. Lock File Commits

**Format**:
```
Add <Lock Name> v<Version> (<Purpose>)

Define <constraints/rules> for <scope>.

Key fields:
- <field1>: <description>
- <field2>: <description>

SHA-256: <lock_file_hash>
```

### 5.3. Infrastructure Commits

**Format**:
```
Add <Component Name> (<Purpose>)

Implement <functionality> with <discipline>.

Key features:
- <feature1>
- <feature2>

Validation: <test results>
```

---

## 6. Remote Integration

### 6.1. Push Discipline

**Law**: ALWAYS use `git push -u origin <branch-name>` for first push.

**Rationale**: Explicit branch tracking prevents accidental pushes to wrong remote.

**Implementation**:
```bash
# First push
git push -u origin claude/kernel-core-e2e-testing-Suz0x

# Subsequent pushes
git push
```

### 6.2. Network Resilience

**Law**: Retry network operations up to 4 times with exponential backoff.

**Implementation**:
```bash
retry_push() {
  local delays=(2 4 8 16)
  for i in {0..3}; do
    if git push -u origin "$1" 2>&1; then
      return 0
    fi
    [ $i -lt 3 ] && sleep ${delays[$i]}
  done
  echo "❌ Push failed after 4 retries" >&2
  return 1
}

retry_push "claude/kernel-core-e2e-testing-Suz0x"
```

### 6.3. Hook Integration

**Stop Hook** (`.claude/stop-hook-git-check.sh`):
```bash
#!/bin/bash
# Prevent session termination with uncommitted changes

DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
  echo "There are uncommitted changes in the repository."
  echo "Please commit and push these changes to the remote branch."
  exit 1
fi
```

---

## 7. Verification Checklist

Before committing any closure certificate:

- [ ] `git status --porcelain` returns empty
- [ ] Certificate `HEAD:` matches `git rev-parse HEAD`
- [ ] All lock files are tracked: `git ls-files locks/*.json`
- [ ] No audit logs are tracked: `git ls-files _audit/ | wc -l` = 0
- [ ] Certificate exists: `ls -la docs/reports/NRBPL_*_CERTIFICATE_*.md`
- [ ] SHA-256 evidence verified: `sha256sum -c _audit/*/EVIDENCE_SHA256SUMS.txt`
- [ ] Commit message follows format
- [ ] Push successful: `git push`

---

## 8. Examples

### 8.1. Valid Workflow

```bash
# Start with clean worktree
git status --porcelain
# (empty output)

# Run closure
node tools/run_L1B_colloc_frame_closure.js
# {"verdict":"SUPPORTED","exit_code":0}

# Verify evidence
sha256sum -c _audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt
# 18/18 OK

# Commit certificate
git add docs/reports/NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1.md
git commit -m "Add NRBPL L1-B Closure Certificate (SUPPORTED)"
git push
```

### 8.2. Invalid Workflow (REFUSE)

```bash
# Dirty worktree
echo "test" > temp.txt
git status --porcelain
# ?? temp.txt

# Attempt closure
node tools/run_L1B_colloc_frame_closure.js
# {"verdict":"REFUSE","exit_code":3,"reason_code":"WORKTREE_DIRTY"}
```

---

## 9. Compliance

This specification implements:
- **UGTS Discipline**: Evidence-first, fail-fast, no inference
- **ΔC Anchoring**: Repository state binding via commit hashes
- **Deterministic Verification**: Clean worktree enforcement
- **Audit Trail**: Immutable evidence via SHA-256 binding

All git operations are deterministic and inspectable.

---

**Document Hash**: (computed on commit)
**Effective Date**: 2026-01-24
**Revision**: 0.1
