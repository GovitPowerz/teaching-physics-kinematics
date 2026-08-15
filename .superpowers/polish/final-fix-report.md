# Final fix wave report

Branch: feature/post-merge-polish

## Per-item fixes

1. **src/ui/playback.ts:33** - added
   `scrub.addEventListener('pointercancel', () => { scrubbing = false })`
   right after the existing `pointerup` handler. A cancelled touch scrub
   (e.g. browser takes over the gesture) no longer leaves `scrubbing` stuck
   `true`, which was freezing the scrubber's value sync in `render()`.

2. **src/state.ts:83** - `addCharge`'s 8-charge cap branch was
   `if (state.charges.charges.length >= 8) return` (deselects via the
   preceding `state.charges.selected = null` but returns without notifying
   subscribers - a violation of the notify-exactly-once invariant). Changed
   to `if (state.charges.charges.length >= 8) { notify(); return }`.

3. **src/ui/controls.ts:64** - the drag-threshold crossing set
   `canvas.style.cursor = 'grabbing'` unconditionally, including presses
   that started on empty canvas (`pressed === null`). Gated:
   `if (pressed) canvas.style.cursor = 'grabbing'`.

4. **src/ui/controls.ts:36** - `flush()` (the rAF-coalesced drag callback)
   now starts with `if (!canvas.isConnected) return`, before touching
   `pressed`/`pending`. Prevents a pending rAF from firing after scene
   unmount mid-drag, which would otherwise hit a detached canvas
   (`clientWidth === 0`), divide by zero in `toWorld`, and write `NaN` into
   persistent state.

5. **src/physics/orbital.ts:48** - `sweptArea`'s window-skip was a single
   `continue` covering both `samples[i].t <= t0` and
   `samples[i - 1].t >= t1`. Since `samples` is time-ordered, once
   `samples[i - 1].t >= t1` no later sample can re-enter the window, so that
   branch is now a `break`; the `t0` branch stays a `continue`:
   ```
   if (samples[i - 1].t >= t1) break
   if (samples[i].t <= t0) continue
   ```
   Bounds the per-frame cost on long (100k-sample) sims instead of scanning
   to the end every call. Kepler II test
   (`tests/orbital.test.ts` - "equal areas in equal times") still passes;
   ran in isolation to confirm (see test output below).

6. **tests/orbital.test.ts:45** - deleted the redundant
   `expect(a).toBeCloseTo(-0.8065, 4)` line from the hyperbola test. The
   line above it (`expect(a).toBeCloseTo(-1 / (2 * 0.62), 9)`) already pins
   the exact formula to 9 decimal places, making the looser 4-decimal
   literal-value check redundant headroom, not additional coverage.

## Test commands + output

```
$ npm test
> kinematics@0.1.0 test
> vitest run

 Test Files  10 passed (10)
      Tests  62 passed (62)
   Duration  167ms

$ npx vitest run tests/orbital.test.ts --reporter=verbose
 ✓ tests/orbital.test.ts > orbital > circular orbit: e = 0, eps < 0, period = 2 pi
 ✓ tests/orbital.test.ts > orbital > hand-computed eccentricity vector
 ✓ tests/orbital.test.ts > orbital > energy sign classifies the conic
 ✓ tests/orbital.test.ts > orbital > periapsis/apoapsis: rp = a(1-e), ra = a(1+e), ra null on escape
 ✓ tests/orbital.test.ts > orbital > hyperbola: finite negative semi-major axis, vis-viva holds, ra null
 ✓ tests/orbital.test.ts > orbital > numerical ellipse closes after one analytic period
 ✓ tests/orbital.test.ts > orbital > Kepler II: equal areas in equal times
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ npm run build
> kinematics@0.1.0 build
> tsc --noEmit && vite build

vite v8.2.1 building client environment for production...
✓ 23 modules transformed.
dist/index.html                  0.46 kB
dist/assets/index-DYIryuV6.css   1.24 kB
dist/assets/index-C88iyOSL.js   27.46 kB
✓ built in 20ms
```

Test count stayed at 62 (one `expect()` line removed from within an
existing `it()`, not a whole test case, so the suite count is unaffected).

Report path: /Users/govit/Git/Govit/kinematics/.superpowers/polish/final-fix-report.md
