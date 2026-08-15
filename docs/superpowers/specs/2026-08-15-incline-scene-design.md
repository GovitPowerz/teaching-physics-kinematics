# Incline Scene - Design Spec (draft, to be committed on feature/incline-scene)

Approved by user 2026-08-15 ("go" on the one-paragraph design).

## Scene

Fifth tab "Incline" - a puck (palet) on an inclined plane, SI units, unit mass
(m = 1 kg, so forces in N are numerically accelerations in m/s^2; caption says so).

## Model (1D embedded in the 2D core)

The puck is constrained to the plane; dynamics are 1D along the slope. Reuse the
existing 2D machinery by simulating PState pos = (s, 0), vel = (v, 0) where s is the
along-plane coordinate (m, from the ramp base) and v the signed along-plane speed
(uphill positive). Force law (custom closure in scenes.ts, unit mass):

  a(v) = -g sin(theta) - mu g cos(theta) sign(v)     for v != 0
  (theta in radians in state; UI shows degrees)

Rest/stick: stopWhen(pos, vel) => |vel.x| < V_REST && tan(theta) <= mu, with
V_REST = 0.05 m/s (one RK4 step's worth of velocity at g; same order as other
epsilon choices). stopReason 'custom' is interpreted by this scene as "at rest"
(per-scene interpretation, same pattern as deflection's plate hit).
A puck that reaches v ~ 0 with tan(theta) > mu does NOT stop: sign(v) flips and it
slides back down (the classic case).

Ramp geometry: base at world origin, ascending to the right at angle theta.
World mapping: pos_world = (s cos(theta), s sin(theta)). Ramp length L = 10 m.
Stops: s <= 0 (reaches the base) and s >= L (off the top) via bounds on the 1D
embedding {xMin: 0, xMax: L}; tMax 30 s; dt 1/240 s (SI).

## State

incline: { s0: number (m, default 3), v0: number (m/s signed along-plane, default 4
= uphill), theta: number (rad, default 20 * pi/180), mu: number (default 0.3) }
Tab union gains 'incline'; buildSim gains the case; patchIncline mutator.

## Interactions

- Puck draggable along the plane (sets s0; clamp [0.2, L - 0.2]).
- v0 arrowhead draggable, projected onto the plane axis (signed magnitude; clamp [-8, 8]).
- Theta drag handle at the ramp's top edge (drag sets theta, clamp [5, 45] deg).
- Sliders: theta 5..45 deg step 0.5 (stored in rad; slider get/set converts),
  mu 0..1 step 0.01. vecRow not needed (scalars); sliders carry the text fields.

## Overlays (the point of the scene)

At the puck (playback position, or start when not playing): weight W = (0, -g)
(danger), normal N = g cos(theta) perpendicular to the plane (accent), friction
f = mu g cos(theta) opposing velocity - or static -g sin(theta) (balancing) when at
rest/stuck (dim), resultant a along the plane (fg, thicker). v arrow via the
existing v overlay toggle. Angle arc + "theta" label at the ramp base.

## Formulas (panel)

- N = mg cos(theta) = <val> N
- a = g(sin(theta) - mu cos(theta)) = <val> m/s^2 (downhill positive convention
  displayed with sign matching motion; when stuck: a = 0 (static friction))
- caption: "Weight splits along and across the plane; friction opposes sliding.
  SI units, m = 1 kg."

## Tests (pure core / scenes / formatters only)

1. Frictionless closed form: mu = 0, s(t) = s0 + v0 t - (1/2) g sin(theta) t^2
   (RK4 exact on quadratic; tight tolerance).
2. Uphill launch with stick: theta = 15 deg, mu = 0.3 (tan 15 = 0.268 < 0.3):
   final s ~ s0 + v0^2 / (2 g (sin + mu cos)) analytic stopping distance,
   stopReason 'custom'.
3. Uphill launch with slide-back: theta = 25 deg, mu = 0.2 (tan 25 = 0.466 > 0.2):
   velocity crosses zero then goes negative; sim does NOT stop at the crossing;
   eventually exits at s <= 0 with stopReason 'bounds'.
4. Static start: v0 = 0, theta = 10 deg, mu = 0.5: stops immediately ('custom',
   duration ~ 0).
5. Store: patchIncline recomputes/resets/notifies once (mirror existing pattern).
6. Panel: incline formulas carry live numbers (exact-string, escapes).

## Out of scope

Puck leaving the ramp surface (no launch off the top edge into projectile motion),
rolling, air drag on the incline, multiple pucks.
