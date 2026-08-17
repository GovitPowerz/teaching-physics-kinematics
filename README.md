# Motion in Force Fields

[![Deploy](https://github.com/GovitPowerz/teaching-physics-kinematics/actions/workflows/deploy.yml/badge.svg)](https://github.com/GovitPowerz/teaching-physics-kinematics/actions/workflows/deploy.yml)

**Try it live: <https://govitpowerz.github.io/teaching-physics-kinematics/>**

An interactive physics site for lycee-level students: the same particle, the same
RK4 integrator, five different force laws. Drag the initial conditions and the full
predicted trajectory redraws instantly; press play and the particle rides the exact
same samples, with its velocity and acceleration vectors live.

## The five scenes

- **Projectile** - a ball in uniform gravity (SI units): drag the launch velocity,
  toggle air drag against a dashed ideal reference, let it bounce with restitution.
- **Deflection** - a charged particle between capacitor plates: the same parabola as
  the projectile (a uniform field is a uniform field), then a straight line to the
  screen. Enforced by a unit test, not just claimed.
- **Charges** - an electrostatic playground: place up to 8 charges, watch field lines
  and equipotentials rebuild live, launch a test charge through the mess.
- **Orbits** - one satellite around one heavy body: energy sign decides ellipse or
  escape, Kepler's equal areas swept live during playback - the swept-area readout
  staying constant IS the second law.
- **Incline** - a puck on an inclined plane (SI units): drag the ramp angle, the
  puck, and its launch velocity; static friction holds it below tan(theta) = mu,
  kinetic friction fights the slide; weight, normal reaction, friction, and the
  resultant are drawn live at the puck.

Everything draggable shows a grab cursor; every dragged value has a paired text
field for exact input; the panel under each scene shows the governing formulas with
live numbers that always describe the curve actually drawn.

## Quick start

    npm install
    npm run dev       # dev server on :5173
    npm test          # vitest over the physics core (70 tests)
    npm run build     # production build in dist/

## How it works

One RK4 integrator (`src/physics/integrate.ts`) steps `{pos, vel}` under a pluggable
force law (`src/physics/forces.ts`). `simulate()` produces a sampled trajectory with
stop conditions (ground, screen, bounds, capture, custom predicates); the ghost path
and the playback animation read the same samples, so they can never disagree. Orbit
overlays (conic type, foci, apsides, escape ring) are computed analytically from the
state; the 1/r^2 laws are softened by (r^2 + 0.05^2) so close encounters stay
finite; the incline is 1D dynamics along the slope embedded in the same 2D core.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: vitest, Vite build, then
GitHub Pages deploy to the live URL above. One-time setup: repository Settings ->
Pages -> Source: GitHub Actions.
