import { combine, coulomb, linearDrag, newtonGravity, uniformField, uniformGravity }
  from './physics/forces'
import type { Force } from './physics/integrate'
import { conicType, eccentricity, period } from './physics/orbital'
import { simulate, type SimResult } from './physics/trajectory'
import { v } from './physics/vec2'
import type { AppState } from './state'

export const DOMAINS = {
  projectile: { xMin: 0, xMax: 60, yMin: 0, yMax: 30 },
  deflection: { xMin: 0, xMax: 10, yMin: -3, yMax: 3 },
  charges: { xMin: -4, xMax: 4, yMin: -4, yMax: 4 },
  orbits: { xMin: -4, xMax: 4, yMin: -4, yMax: 4 },
  incline: { xMin: 0, xMax: 10, yMin: 0, yMax: 7.5 },
} as const

export const PLATES = { x0: 2, entryX: 0.2, gap: 1.6, screenX: 9 }
export const MU = 1
export const INCLINE = {
  rampLength: 10, // m
  g: 9.81, // m/s^2
  vRest: 0.05, // m/s
  FORCE_SCALE: 0.25, // world units per N, display only
} as const

export const buildSim = (s: AppState): SimResult => {
  switch (s.tab) {
    case 'projectile': {
      const p = s.projectile
      const force: Force = p.dragK > 0
        ? combine(uniformGravity(p.g), linearDrag(p.dragK))
        : uniformGravity(p.g)
      return simulate({ pos: p.launch, vel: p.v0 }, force, {
        dt: 1 / 240, // s (SI)
        tMax: 30, // s (SI)
        groundY: 0,
        restitution: p.restitution, maxBounces: 5,
        bounds: { xMin: -60, xMax: 120, yMin: -1, yMax: 1000 },
      })
    }
    case 'deflection': {
      const d = s.deflection
      const inside = uniformField(v(0, d.sign * d.a))
      const force: Force = (pos, vel) =>
        pos.x >= PLATES.x0 && pos.x <= PLATES.x0 + d.plateLength
          ? inside(pos, vel) : v(0, 0)
      return simulate({ pos: v(PLATES.entryX, 0), vel: v(d.v0, 0) }, force, {
        dt: 1 / 240, // normalized time
        tMax: 30, // normalized time
        screenX: PLATES.screenX, bounds: DOMAINS.deflection,
        stopWhen: (pos) =>
          pos.x >= PLATES.x0 && pos.x <= PLATES.x0 + d.plateLength &&
          Math.abs(pos.y) >= PLATES.gap / 2,
      })
    }
    case 'charges': {
      const c = s.charges
      return simulate({ pos: c.testPos, vel: c.testVel },
        coulomb(c.charges, c.testSign), {
          dt: 0.002, // normalized time
          tMax: 20, // normalized time
          bounds: DOMAINS.charges,
          capturePoints: c.charges.map((ch) => ch.pos),
          captureRadius: 0.12, // > SOFTENING
        })
    }
    case 'orbits': {
      const o = s.orbits
      const st = { pos: o.pos, vel: o.vel }
      const isEllipse = conicType(eccentricity(st, MU)) === 'ellipse'
      const tMax = isEllipse ? Math.min(3 * period(st, MU), 120) : 60
      return simulate(st, newtonGravity(MU), {
        dt: 0.002, // normalized time
        tMax, // normalized time
        maxSamples: 100000,
        bounds: { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
        capturePoints: [v(0, 0)],
        captureRadius: 0.1, // > SOFTENING
      })
    }
    case 'incline': {
      const i = s.incline
      const th = i.theta
      const mu = i.mu
      const force: Force = (_pos, vel) =>
        v(-INCLINE.g * (Math.sin(th) + mu * Math.cos(th) * Math.sign(vel.x)), 0)
      return simulate({ pos: v(i.s0, 0), vel: v(i.v0, 0) }, force, {
        dt: 1 / 240, // s (SI)
        tMax: 30, // s (SI)
        bounds: { xMin: 0, xMax: INCLINE.rampLength, yMin: -1, yMax: 1 },
        stopWhen: (_pos, velv) => Math.abs(velv.x) < INCLINE.vRest && Math.tan(th) <= mu,
      })
    }
  }
}
