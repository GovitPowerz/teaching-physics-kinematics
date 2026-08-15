import { describe, expect, it } from 'vitest'
import { newtonGravity } from '../src/physics/forces'
import {
  conicType, eccVector, eccentricity, escapeVelocity, periapsisApoapsis, period,
  semiMajorAxis, specificEnergy, sweptArea,
} from '../src/physics/orbital'
import { simulate } from '../src/physics/trajectory'
import { dot, v } from '../src/physics/vec2'

const MU = 1

describe('orbital', () => {
  it('circular orbit: e = 0, eps < 0, period = 2 pi', () => {
    const s = { pos: v(1, 0), vel: v(0, 1) }
    expect(eccentricity(s, MU)).toBeCloseTo(0, 9)
    expect(specificEnergy(s, MU)).toBeCloseTo(-0.5, 9)
    expect(period(s, MU)).toBeCloseTo(2 * Math.PI, 9)
    expect(conicType(eccentricity(s, MU))).toBe('ellipse')
  })
  it('hand-computed eccentricity vector', () => {
    const s = { pos: v(1, 0), vel: v(0, 1.2) }
    const ev = eccVector(s, MU)
    expect(ev.x).toBeCloseTo(0.44, 9) // (v^2 - mu/r) r - (r.v) v, over mu
    expect(ev.y).toBeCloseTo(0, 9)
  })
  it('energy sign classifies the conic', () => {
    expect(conicType(eccentricity({ pos: v(1, 0), vel: v(0, Math.SQRT2) }, MU), 1e-6))
      .toBe('parabola')
    expect(conicType(eccentricity({ pos: v(1, 0), vel: v(0, 1.6) }, MU))).toBe('hyperbola')
    expect(escapeVelocity(1, MU)).toBeCloseTo(Math.SQRT2, 12)
  })
  it('periapsis/apoapsis: rp = a(1-e), ra = a(1+e), ra null on escape', () => {
    const s = { pos: v(1, 0), vel: v(0, 1.2) }
    const a = semiMajorAxis(s, MU)
    const e = eccentricity(s, MU)
    const { rp, ra } = periapsisApoapsis(s, MU)
    expect(rp).toBeCloseTo(a * (1 - e), 9)
    expect(ra).toBeCloseTo(a * (1 + e), 9)
    expect(periapsisApoapsis({ pos: v(1, 0), vel: v(0, 2) }, MU).ra).toBeNull()
  })
  it('hyperbola: finite negative semi-major axis, vis-viva holds, ra null', () => {
    const s = { pos: v(1, 0), vel: v(0, 1.8) }
    const a = semiMajorAxis(s, MU)
    expect(a).toBeCloseTo(-1 / (2 * 0.62), 9)
    expect(dot(s.vel, s.vel)).toBeCloseTo(MU * (2 / 1 - 1 / a), 9)
    expect(periapsisApoapsis(s, MU).ra).toBeNull()
  })
  it('numerical ellipse closes after one analytic period', () => {
    const s0 = { pos: v(1.5, 0), vel: v(0, 0.9) }
    const P = period(s0, MU)
    const r = simulate(s0, newtonGravity(MU), { dt: 0.001, tMax: P, maxSamples: 100000 })
    const last = r.samples[r.samples.length - 1]
    // softening (r^2 + 0.05^2) shifts the true period ~0.1% off the analytic Kepler
    // value, so closure against the ANALYTIC period is loose by design
    expect(last.pos.x).toBeCloseTo(1.5, 1)
    expect(last.pos.y).toBeCloseTo(0, 1)
  })
  it('Kepler II: equal areas in equal times', () => {
    const s0 = { pos: v(1.5, 0), vel: v(0, 0.9) }
    const P = period(s0, MU)
    const r = simulate(s0, newtonGravity(MU), { dt: 0.001, tMax: P, maxSamples: 100000 })
    const a1 = sweptArea(r.samples, 0, P / 8)          // near periapsis side
    const a2 = sweptArea(r.samples, P / 2, P / 2 + P / 8) // near apoapsis
    expect(Math.abs(a1 - a2) / a1).toBeLessThan(1e-2)
  })
})
