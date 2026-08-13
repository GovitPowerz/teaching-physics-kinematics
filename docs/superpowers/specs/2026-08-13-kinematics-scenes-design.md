# Kinematics Scenes - Design

Date: 2026-08-13
Status: approved (brainstorming session)

## Goal

An interactive teaching site for lycee / high-school physics, hosted on GitHub Pages.
Thesis: **motion in force fields** - the same particle and the same integrator under
different force laws. Kinematic quantities (position, velocity, acceleration) are shown
as the output of dynamics. English UI. Explanation is carried by live formula lines
(numbers update as you drag) plus one- or two-sentence captions per scene, in the style
of ../complex-visualization.

## Site Structure

Four flat tabs over one shared physics core. Tab order is the pedagogy:

1. **Projectile** - uniform gravity (ball on Earth)
2. **Deflection** - uniform electric field (same parabola, different force)
3. **Charges** - non-uniform electrostatic field (superposition, field shape)
4. **Orbits** - Newtonian gravity (same 1/r^2 as Coulomb, attractive, periodic)

## Architecture

```
src/
  physics/
    vec2.ts        {x, y} vector ops
    forces.ts      force laws, each (state) -> acceleration:
                   uniformGravity(g), uniformField(a), coulomb(charges, qOverM),
                   newtonGravity(mu); linearDrag(k) as a composable add-on
    integrate.ts   fixed-step RK4 stepping {pos, vel} under a force law
    trajectory.ts  simulate(state0, force, dt, tMax, stopConditions) ->
                   samples [{t, pos, vel, acc}]; stops on screen hit, bounds exit,
                   charge capture, or tMax; ground contact reflects with
                   restitution e and stops when e = 0 or after the bounce cap;
                   dt is a per-scene constant
    fields.ts      E-field sampling on a grid; field lines (streamline integration
                   from seeds around charges) and equipotentials (marching squares)
  state.ts         one Store + subscribe(), per-tab state slices + shared playback
                   state {playing, t, speed}; every setter recomputes the affected
                   trajectory and notifies once
  ui/
    topbar.ts      four-tab switcher
    playback.ts    play/pause/reset + time scrubber (shared)
    panel.ts       formula-lines + caption component (shared)
    controls.ts    overlay toggles (v/a/F vectors), sliders, text fields
  render/          one canvas-2D renderer per scene (no three.js anywhere)
    projectile.ts, deflection.ts, charges.ts, orbits.ts
  main.ts          wiring; only the active scene renders
```

### Key decisions

1. **Ghost = playback.** Dragging any control re-runs simulate() and redraws the full
   predicted trajectory with time-tick dots (dot spacing shows speed). Play interpolates
   the particle along those same precomputed samples, so animation can never diverge
   from the ghost. One simulation code path.

2. **One integrator: fixed-step RK4** for all scenes. Not symplectic, but ghosts are a
   few periods/bounces long and playback replays stored samples, so drift cannot
   accumulate. Handles velocity-dependent drag directly. Coulomb and Newtonian force
   laws use softening (r^2 + eps^2) plus stop conditions so close encounters stay finite.

3. **The isomorphism is a testable invariant.** Deflection with qE/m = g must reproduce
   the projectile trajectory to machine-level tolerance - enforced by a unit test, not
   just claimed in a caption.

### Interaction model (all scenes)

- Direct manipulation: the velocity arrow is the control (drag its head); launch points
  and charges are draggable bodies.
- Every draggable value has a paired text field: live-updates while dragging, commits on
  Enter/blur, clamps to range, invalid input reverts (sibling pattern).
- Overlay toggles show v (tangent), a, and F vectors on the playback particle.

## Scene Specs

### Tab 1: Projectile (uniform gravity)

Side view with a ground line. Real SI units (m, m/s, g = 9.81 default).

- Controls: draggable launch point and velocity arrow; g slider with Moon/Mars/Jupiter
  presets; linear drag coefficient (default 0); restitution e in [0, 1] (default 0).
- Ghost: trajectory with time ticks. With drag > 0, the ideal parabola remains as a
  dashed reference. With e > 0, ghost continues over the first few bounces (capped).
- Overlays: v changes, a stays constant straight down - the core lesson; apex and range
  markers with live numbers.
- Formulas: x(t) = x0 + vx*t and y(t) = y0 + vy*t - (1/2)*g*t^2 with live numbers;
  flight time and range lines (ideal case).

### Tab 2: Deflection (uniform electric field)

Classic CRT/capacitor problem, side view: particle enters from the left with horizontal
v0, passes between two horizontal plates of length L, hits a screen at the right.

- Controls: draggable v0 arrow; field strength slider (visualized as +/- plate coloring
  and E arrows between the plates); charge sign flip; plate length L.
- Field exists only between the plates: parabola inside, straight tangent line outside,
  impact dot on the screen. The inside/outside contrast is the scene.
- Units: normalized; a single a = qE/m acceleration readout (no fake electron masses).
  Caption says so.
- Formulas: the same two kinematic equations as Tab 1 with g replaced by qE/m, typeset
  identically; total deflection at the screen. Caption: same math as the projectile -
  a uniform field is a uniform field.

### Tab 3: Charges (electrostatic playground)

Top-down free plane, normalized units.

- Controls: click empty space to add a charge (toolbar picks +1/-1); selected charge
  gets a magnitude slider (+-1..+-5) and delete; drag to move; hard cap 8 charges.
  One test charge with draggable start + velocity arrow, sign flippable.
- Field rendering: field lines seeded around each charge (streamline integration,
  seed count proportional to |q|) and equipotential contours (marching squares on a
  sampled grid), recomputed live while dragging.
- Ghost: test-charge trajectory through the field; softened Coulomb; stops on charge
  capture (core radius), bounds exit, or tMax.
- Formulas: E at the test-charge position with live magnitude, F = qE, and the
  superposition sum written out for the current charges.

### Tab 4: Orbits (Newtonian gravity)

Central body fixed at the origin, normalized mu = GM = 1. Caption is honest about the
one-body approximation (star much heavier than satellite).

- Controls: draggable satellite position and velocity arrow. Nothing else.
- Ghost: trajectory up to 3 periods (closed orbit) or until bounds exit / tMax
  (escape). Overlays computed analytically from the state
  (specific energy, eccentricity vector): conic type label (ellipse/parabola/hyperbola),
  periapsis/apoapsis markers, both foci, and an escape-velocity ring at the current
  radius - dragging v across the ring flips the ellipse into a hyperbola.
- Playback: Kepler's equal areas made visible - the swept-area wedge per fixed dt is
  shaded as the satellite moves.
- Formulas: vis-viva v^2 = mu*(2/r - 1/a); specific energy eps = v^2/2 - mu/r with live
  sign; v_esc = sqrt(2*mu/r).
- Trajectory is numerical (shared RK4 core); the analytic conic quantities are overlay
  math only, unit-tested against the integrator.

## Units Policy

Projectile: real SI. Deflection, Charges, Orbits: normalized units, dimensionless
readouts, captions state the normalization. No fake precision.

## Testing (vitest, pure core only; rendering verified visually)

- vec2 ops; RK4 shows 4th-order convergence on the harmonic oscillator vs closed form.
- Projectile: numerical vs closed-form parabola (drag off); terminal-velocity approach
  vs 1D closed form (drag on); bounce energy ratio = e^2.
- Isomorphism: deflection with a = 9.81 reproduces projectile samples to machine-level
  tolerance.
- Coulomb: superposition vs hand-computed two-charge field; capture and bounds stop
  conditions; softening keeps accelerations finite.
- Orbits: conic classification from (eps, e); ellipse closes after one period within
  tolerance; swept area per dt constant within tolerance (Kepler II as a unit test).
- Field tools: marching-squares contours of a single charge are circles; field-line
  seed counts scale with |q|.
- Store transition rules; formula formatters.

## Error Handling

Clamps and stop conditions, not exceptions: inputs clamp to ranges, invalid typed
values revert, every simulate() is bounded by tMax plus a sample cap, and a non-finite
step truncates the trajectory at the last good sample. The pure core never throws.

## Deploy

Copy the sibling's .github/workflows/deploy.yml (npm ci, vitest, Vite build, Pages
deploy of dist/). vite base './', dev port 5173 strict. One-time setup: repository
Settings -> Pages -> Source: GitHub Actions.

## Out of Scope (deliberate)

- No 3D / three.js; all scenes are canvas 2D.
- No magnetism (no Lorentz qv x B scenes).
- No multi-body gravity (central body is fixed).
- No French localization yet; no long-form lesson panels.
- No mobile-first work beyond what the sibling's responsive defaults give.
