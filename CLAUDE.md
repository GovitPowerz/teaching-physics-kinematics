# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Motion in Force Fields" - an interactive physics teaching site for lycee-level
students. Four canvas-2D scenes driven by one shared physics core: the same particle,
the same RK4 integrator, four force laws. **Projectile** (uniform gravity, SI units,
air drag, restitution bounce), **Deflection** (charged particle between capacitor
plates - the projectile parabola in disguise, an isomorphism enforced by a unit test),
**Charges** (up to 8 point charges, live field lines and equipotentials, test-charge
trajectory with capture), **Orbits** (Newtonian gravity, conic classification, foci,
apsides, escape-velocity ring, Kepler equal-area sweep). Dragging initial conditions
redraws the full predicted trajectory instantly; a play button animates the particle
along the same samples. Static site, GitHub Pages.

`../complex-visualization` is the sibling project this one mirrors for stack and
conventions.

## Build & Development Commands

```bash
npm run dev       # Vite dev server on :5173 (strict port)
npm test          # vitest, 62 tests over the pure core, store, formatters
npm run build     # tsc --noEmit + vite build -> dist/
npm run preview   # serve the production build
```

## Architecture

```
src/
  physics/          pure core, importable without a DOM, never throws
    vec2.ts         {x, y} ops: v, add, sub, scale, dot, cross, len, norm (zero-safe)
    integrate.ts    PState {pos, vel}, Force = (pos, vel) => acceleration, rk4Step
    forces.ts       uniformGravity, uniformField, linearDrag, combine, coulomb,
                    newtonGravity; both 1/r^2 laws share a softened kernel
                    (r^2 + SOFTENING^2)^(3/2), SOFTENING = 0.05 world units
    trajectory.ts   simulate() with stop conditions (tMax, ground+restitution bounce
                    with settle detection, bounds, capture, screen, custom stopWhen,
                    nonfinite truncation, sample cap); sampleAt (interp, clamped,
                    empty-safe); duration
    orbital.ts      specificEnergy, eccVector, eccentricity, conicType, semiMajorAxis,
                    period, escapeVelocity, periapsisApoapsis, sweptArea
    fields.ts       fieldAt/potentialAt, field lines (RK2 marching, seeds ~ |q|),
                    equipotentials (16-case marching squares, center-value saddle rule)
  scenes.ts         per-scene sim builders: DOMAINS, PLATES (incl. entryX, the beam
                    spawn x), MU, buildSim(state); deflection force is windowed to
                    the plate span and stops on plate contact (stopWhen)
  state.ts          one Store with subscribe(): scene mutations rebuild the sim,
                    reset playback, bump revision, notify exactly once; playback/
                    overlay/selection mutations notify without recompute
  ui/
    panel.ts        fmt, formulasFor (live-number formula lines per scene), CAPTIONS;
                    createPanel memoizes on tab+formula content (skips DOM churn
                    during playback)
    controls.ts     sliderRow/vecRow -> ControlRow {el, refresh} (focus-safe two-way
                    text fields), hitTest, buttonRow; attachDrag distinguishes taps
                    (<= 4 px, onTapHandle/onTapEmpty on pointerup) from drags
                    (rAF-coalesced onDrag), sets hover/grab cursors, guards
                    pointercancel and post-unmount flushes
    topbar.ts       four-tab switcher
    playback.ts     play/pause, reset, scrubber, speed, v/a overlay toggles
  render/
    viewport.ts     uniform min-fit world<->screen transform, y up
    draw.ts         shared by all four scenes: COLORS (CSS custom props resolved
                    once at module load), arrow, drawTrail (Path2D line+ticks cached
                    on revision + canvas size), drawCurrentMarker (playback dot +
                    v/a overlay arrows)
    projectile.ts   grid+ground, ghost, dashed ideal (cached on revision), apex/range
    deflection.ts   plates colored by polarity, field arrows, screen + impact dot
    charges.ts      field lines + equipotentials cached on charge CONTENT (not
                    revision - test-charge drags must not invalidate), seed budget
                    capped at high total |q|, drag/tap edit
    orbits.ts       conic label, foci, apsides, escape ring, equal-area sweep wedge
                    + live swept-area readout (Kepler II shown as a constant number)
  main.ts           SceneRenderer registry, tab mount/unmount, rAF playback loop
tests/              vitest suites for physics, scenes, store, formatters, viewport
```

Invariants worth keeping:

- Ghost trajectory and playback read the same `SimResult.samples`; there is no second
  simulation path, so they cannot disagree.
- The pure core never throws: stop conditions, clamps, and truncation, not exceptions.
- Units: SI in the projectile scene (g = 9.81 m/s^2), normalized elsewhere (mu = 1,
  k_coulomb = 1, unit mass); captions say so.
- capture radii (0.1-0.12) exceed SOFTENING (0.05), so trajectories stop before
  softening visibly fakes the physics.
- Panel formulas tell the truth about the drawn curve: the deflection y(t) line is
  the shifted signed parabola (t0 = plate-entry time, a carries d.sign), and the
  projectile x/y lines are tagged "(k = 0 reference)" whenever drag is on.
- semiMajorAxis is finite negative for hyperbolas (energy-branch, not
  Number.isFinite, decides escape in periapsisApoapsis/period), keeping the
  vis-viva identity displayed by the orbits panel true for every conic.

## Key Lessons & Pitfalls

### Marching-squares saddles invert easily

For checkerboard cells (cases 5/10), center > level means the high corners connect
through the cell, so the contour must isolate the LOW corners. Getting this backwards
splits the below-saddle equipotential of two like charges into two loops; the covering
test in tests/fields.test.ts uses a saddle-level delta of 1e-4 because the saddle
cell's corner spread is only ~3e-4 - a larger delta never exercises the saddle at all.

### Time grids must divide the endpoint

Integrating to tEnd with a dt that does not divide it exactly measures the endpoint
offset (cos(3.14) vs cos(pi) ~ 1.3e-6), not integrator error. RK4 accuracy tests use
dt = tEnd/N.

### Softening shifts the analytic period

The softened kernel changes the true orbit period ~0.1% off the Kepler value; closure
tests against the ANALYTIC period need loose tolerance (see tests/orbital.test.ts).

### Focus-based UI guards freeze on macOS

Guarding "don't clobber the control the user is using" with document.activeElement
fails on macOS: clicking a button does not move focus off a form control, so a
focused scrubber never updates again during playback. Track interaction explicitly
(pointerdown/up/cancel flags), never via focus.

### Bounces can phantom-fire

After a bounce the position sits exactly on groundY; if the reflected velocity cannot
clear one dt, the crossing check re-fires with interpolation fraction 0. simulate()
treats f === 0 as settled and stops - do not remove that guard (duplicate-t samples
NaN the playback interpolation).

## Conventions

- TypeScript strict, no UI framework, no state library: one Store with subscribe().
- ASCII-only source. Unicode (superscripts, Greek) only in display strings and only
  as \uXXXX escapes; tests compare against the same escapes.
- Physical constants and integrator steps live in the pure core / scenes.ts with
  units at the definition site, never scattered through render code.
- Rendering is verified visually; vitest covers the pure core, the Store, and pure
  display formatters only. No DOM tests.
- Keep README.md and this file in sync with reality (the smart-commit skill handles
  this at commit time).

## Deploy

Push to `main` runs `.github/workflows/deploy.yml`: npm ci, vitest, Vite build, then
GitHub Pages deploy of `dist/`. One-time setup: repository Settings -> Pages ->
Source: GitHub Actions.

## Tone

Be a quirky friendly but critical peer reviewer: helpful, but hold the author to high
standards. Challenge inefficiencies - if something is being done the hard way, call it out.
