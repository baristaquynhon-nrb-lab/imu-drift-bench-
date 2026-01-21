# Dependency Audit Report
**Project:** imu-drift-bench
**Date:** 2026-01-21
**Auditor:** Claude Code

## Executive Summary

This audit analyzed all external dependencies used across the HTML-based project. The repository contains 12 HTML files implementing IMU drift detection and reflex simulation using browser APIs and external CDN libraries.

**Key Findings:**
- 3 external CDN dependencies identified
- 1 dependency with upstream vulnerabilities (indirect)
- 1 dependency is unmaintained (but no vulnerabilities)
- 2 broken local module imports
- Use of `@latest` version specifier (stability risk)

---

## Dependencies Inventory

### 1. MediaPipe Tasks Vision
- **Source:** `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js`
- **Used in:** `index.html`
- **Purpose:** Face landmark detection for head motion tracking
- **Version:** `@latest` (floating, currently ~0.10.22-rc)
- **Status:** ⚠️ INDIRECT VULNERABILITIES

**Issues:**
1. **Version Pinning:** Uses `@latest` which can lead to unexpected breaking changes
2. **Indirect Vulnerabilities:** The Java/Android version has dependencies with known CVEs:
   - CVE-2023-2976 (Google Guava): Information disclosure vulnerability
   - CVE-2020-8908 (Google Guava): Security restriction bypass

   **Note:** These affect the Java/Maven distribution, not the JavaScript CDN version directly

3. **WASM Loading:** Loads additional resources from `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/`
4. **Model Files:** Downloads ML models from Google Storage: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`

**Size Impact:**
- vision_bundle.js: ~500KB (minified)
- WASM files: ~2-3MB
- Model file: ~12MB

---

### 2. QRCodeJS
- **Source:** `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`
- **Used in:** `QR Cham Cong.html`
- **Purpose:** QR code generation for attendance tracking
- **Version:** 1.0.0 (from 2012)
- **Status:** ✅ NO KNOWN VULNERABILITIES

**Issues:**
1. **Age:** Package is 13+ years old with no updates
2. **Limited Features:** Basic QR generation only
3. **Maintenance:** Project appears abandoned

**Size Impact:** ~15KB (minified)

---

### 3. jsQR
- **Source:** `https://unpkg.com/jsqr@1.4.0/dist/jsQR.js`
- **Used in:** `QR Cham Cong.html`
- **Purpose:** QR code reading/decoding from camera
- **Version:** 1.4.0 (last updated ~4 years ago)
- **Status:** ⚠️ UNMAINTAINED (but no vulnerabilities)

**Issues:**
1. **Maintenance Status:** Package is inactive, no updates in 4+ years
2. **Fallback Use:** Only used when BarcodeDetector API unavailable
3. **Version Pinned:** Good - uses specific version 1.4.0

**Size Impact:** ~45KB (unminified)

---

### 4. Missing Local Modules (BROKEN IMPORTS)
- **File:** `mobile_reflex_v2_5.html`
- **Status:** 🔴 CRITICAL - BROKEN

**Missing imports:**
```javascript
import { CREReflexLoop25 } from '../src/cre_reflex_loop_v2_5.js';  // NOT FOUND
import { addLog, getAllLogs, clearLogs, exportCSV } from './db.js';  // NOT FOUND
```

**Impact:** `mobile_reflex_v2_5.html` is completely non-functional

---

## Security Vulnerabilities

### High Priority Issues

None directly affecting this project's runtime JavaScript dependencies.

### Medium Priority Issues

1. **MediaPipe Upstream Vulnerabilities (Java/Android only)**
   - CVE-2023-2976: Guava temp directory vulnerability
   - CVE-2020-8908: Guava security bypass
   - **Mitigation:** These affect server-side/Android implementations, not browser JS
   - **Action:** Monitor for JS-specific issues

---

## Outdated Packages Analysis

| Package | Current Version | Latest Stable | Age | Recommendation |
|---------|----------------|---------------|-----|----------------|
| MediaPipe | `@latest` (floating) | 0.10.22-rc | Active | Pin to specific version |
| QRCodeJS | 1.0.0 | 1.0.0 | 13+ years | Consider replacement |
| jsQR | 1.4.0 | 1.4.0 | 4 years | Keep (fallback only) |

---

## Bloat Analysis

### Current CDN Dependencies Total Size
- **MediaPipe:** ~15MB (bundle + WASM + model)
- **QRCodeJS:** ~15KB
- **jsQR:** ~45KB
- **Total:** ~15MB per page load (with caching)

### Issues Identified

1. **MediaPipe is Heavy**
   - 15MB total for face tracking
   - Loads on every page visit initially
   - WASM compilation overhead

2. **Dual QR Libraries**
   - Both QRCodeJS (encoder) and jsQR (decoder) loaded
   - Could consolidate to single library

3. **Multiple Similar HTML Files**
   - 12 HTML files with overlapping functionality
   - Code duplication across files
   - No shared component library

---

## Recommendations

### Critical Actions (Priority 1)

1. **Fix Broken Imports in mobile_reflex_v2_5.html**
   - Create missing `cre_reflex_loop_v2_5.js` module
   - Create missing `db.js` module
   - OR remove file if deprecated

2. **Pin MediaPipe Version**
   ```html
   <!-- Before -->
   <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js"></script>

   <!-- After -->
   <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.js"></script>
   ```

### High Priority (Priority 2)

3. **Replace QRCodeJS with Modern Alternative**
   - Recommended: `qrcode` npm package (actively maintained)
   - Or: Use browser's native capabilities where possible

4. **Add Subresource Integrity (SRI)**
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
           integrity="sha384-..."
           crossorigin="anonymous"></script>
   ```

### Medium Priority (Priority 3)

5. **Consider MediaPipe Lite Version**
   - Use face-detection-only model if full landmarks not needed
   - Could reduce model size by 60-70%

6. **Implement Progressive Loading**
   - Lazy load MediaPipe only when camera activated
   - Reduce initial page load time

7. **Consolidate HTML Files**
   - Extract common code into shared modules
   - Reduce code duplication
   - Easier maintenance

8. **Add Package Lock/Manifest**
   - Create `package.json` for dependency tracking
   - Even for CDN-only projects, document versions

### Low Priority (Priority 4)

9. **Add Content Security Policy (CSP)**
   - Restrict which CDNs can be loaded
   - Prevent XSS attacks

10. **Monitor for Updates**
    - Subscribe to security advisories for MediaPipe
    - Check for QRCodeJS alternatives quarterly

---

## Dependency Migration Plan

### Immediate (This Week)

- [ ] Pin MediaPipe to version 0.10.22
- [ ] Add SRI hashes to all CDN scripts
- [ ] Fix or remove mobile_reflex_v2_5.html

### Short Term (This Month)

- [ ] Replace QRCodeJS with `qrcode` package
- [ ] Implement lazy loading for MediaPipe
- [ ] Add package.json for version tracking

### Long Term (Next Quarter)

- [ ] Refactor common code into modules
- [ ] Evaluate MediaPipe alternatives
- [ ] Consider self-hosting critical dependencies
- [ ] Add automated dependency scanning (Dependabot, Snyk)

---

## Testing Checklist

After implementing changes:

- [ ] Test face tracking in index.html (MediaPipe)
- [ ] Test QR code generation in QR Cham Cong.html
- [ ] Test QR code scanning fallback
- [ ] Verify all CDN resources load correctly
- [ ] Check console for errors
- [ ] Test on mobile devices (Samsung S24 target)
- [ ] Verify offline PWA functionality if applicable

---

## References

- [MediaPipe Tasks Vision NPM](https://www.npmjs.com/package/@mediapipe/tasks-vision)
- [Snyk: qrcodejs 1.0.0 Security](https://security.snyk.io/package/npm/qrcodejs/1.0.0)
- [Snyk: jsqr 1.4.0 Security](https://security.snyk.io/package/npm/jsqr/1.4.0)
- [CVE-2023-2976 Details](https://app.opencve.io/cve/CVE-2023-2976)
- [MediaPipe Security](https://github.com/google/mediapipe/security)

---

## Conclusion

The project has a minimal dependency footprint with only 3 external CDN libraries. The main concerns are:

1. **Stability Risk:** Using `@latest` for MediaPipe could break unexpectedly
2. **Broken Code:** mobile_reflex_v2_5.html has missing imports
3. **Old Dependencies:** QRCodeJS is 13 years old but functional
4. **Heavy Payload:** MediaPipe adds 15MB (though cached after first load)

**Overall Risk Level:** MEDIUM

The JavaScript dependencies themselves have no direct vulnerabilities, but best practices around version pinning, SRI, and dependency management should be implemented.

---

**Next Steps:** Implement Priority 1 recommendations immediately to fix broken imports and pin MediaPipe version.
