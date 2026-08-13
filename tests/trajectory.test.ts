import { describe, expect, it } from 'vitest'
import { linearDrag, combine, uniformField, uniformGravity } from '../src/physics/forces'
import { duration, sampleAt, simulate } from '../src/physics/trajectory'
import { v } from '../src/physics/vec2'

const G = 9.81

describe('simulate', () => {
  it('projectile matches the closed-form parabola (RK4 exact on quadratics)', () => {
    const r = simulate({ pos: v(0, 0), vel: v(12, 8) }, uniformGravity(G),
      { dt: 1 / 240, tMax: 1.0 })
    for (const s of r.samples) {
      expect(s.pos.x).toBeCloseTo(12 * s.t, 9)
      expect(s.pos.y).toBeCloseTo(8 * s.t - 0.5 * G * s.t * s.t, 9)
    }
    expect(r.stopReason).toBe('tMax')
  })
  it('isomorphism: uniform E with a = g reproduces the projectile exactly', () => {
    const opts = { dt: 1 / 240, tMax: 1.5 }
    const grav = simulate({ pos: v(0, 0), vel: v(12, 8) }, uniformGravity(G), opts)
    const elec = simulate({ pos: v(0, 0), vel: v(12, 8) }, uniformField(v(0, -G)), opts)
    expect(elec.samples.length).toBe(grav.samples.length)
    for (let i = 0; i < grav.samples.length; i++) {
      expect(elec.samples[i].pos.x).toBeCloseTo(grav.samples[i].pos.x, 12)
      expect(elec.samples[i].pos.y).toBeCloseTo(grav.samples[i].pos.y, 12)
    }
  })
  it('drag: velocity approaches closed form v(t) = (v0 + g/k) e^(-kt) - g/k', () => {
    const k = 0.8
    const r = simulate({ pos: v(0, 10), vel: v(0, 0) },
      combine(uniformGravity(G), linearDrag(k)), { dt: 1 / 240, tMax: 2 })
    const s = sampleAt(r.samples, 2)
    const exact = (G / k) * (Math.exp(-k * 2) - 1)
    expect(s.vel.y).toBeCloseTo(exact, 6)
  })
  it('bounce: speed ratio e at ground crossing, stops after maxBounces', () => {
    const e = 0.7
    const r = simulate({ pos: v(0, 5), vel: v(1, 0) }, uniformGravity(G),
      { dt: 1 / 480, tMax: 30, groundY: 0, restitution: e, maxBounces: 3 })
    const vImpact = Math.sqrt(2 * G * 5)
    let i = 0
    while (r.samples[i].pos.y > 1e-9 || r.samples[i].vel.y < 0) i++ // first post-bounce sample
    expect(r.samples[i].vel.y).toBeCloseTo(e * vImpact, 2)
    expect(r.stopReason).toBe('ground')
  })
  it('e = 0 stops at the ground', () => {
    const r = simulate({ pos: v(0, 5), vel: v(1, 0) }, uniformGravity(G),
      { dt: 1 / 240, tMax: 30, groundY: 0, restitution: 0 })
    expect(r.stopReason).toBe('ground')
    expect(r.samples[r.samples.length - 1].pos.y).toBeCloseTo(0, 9)
  })
  it('bounds, screen, and capture stops', () => {
    const free = uniformField(v(0, 0))
    expect(simulate({ pos: v(0, 0), vel: v(1, 0) }, free,
      { dt: 0.01, tMax: 100, bounds: { xMin: -1, xMax: 2, yMin: -1, yMax: 1 } })
      .stopReason).toBe('bounds')
    expect(simulate({ pos: v(0, 0), vel: v(1, 0) }, free,
      { dt: 0.01, tMax: 100, screenX: 3 }).stopReason).toBe('screen')
    expect(simulate({ pos: v(0, 0), vel: v(1, 0) }, free,
      { dt: 0.01, tMax: 100, capturePoints: [v(2, 0)], captureRadius: 0.12 })
      .stopReason).toBe('capture')
  })
  it('stopWhen: custom predicate stops the sim with overshoot bounded by one step', () => {
    const free = uniformField(v(0, 0))
    const r = simulate({ pos: v(0, 0), vel: v(1, 0) }, free,
      { dt: 0.01, tMax: 100, stopWhen: (pos) => pos.x >= 1 })
    expect(r.stopReason).toBe('custom')
    const last = r.samples[r.samples.length - 1]
    expect(last.pos.x).toBeGreaterThanOrEqual(1)
    expect(last.pos.x).toBeLessThanOrEqual(1.02)
  })
  it('non-finite step truncates at last good sample', () => {
    const explode = () => v(Number.NaN, 0)
    const r = simulate({ pos: v(0, 0), vel: v(0, 0) }, explode, { dt: 0.01, tMax: 1 })
    expect(r.stopReason).toBe('nonfinite')
    expect(r.samples.length).toBe(1)
    expect(Number.isFinite(r.samples[0].pos.x)).toBe(true)
  })
  it('sampleAt interpolates and clamps; duration reads the last t', () => {
    const r = simulate({ pos: v(0, 0), vel: v(2, 0) }, uniformField(v(0, 0)),
      { dt: 0.1, tMax: 1 })
    expect(sampleAt(r.samples, 0.25).pos.x).toBeCloseTo(0.5, 9)
    expect(sampleAt(r.samples, 99).pos.x).toBeCloseTo(2, 9)
    expect(sampleAt(r.samples, -5).pos.x).toBeCloseTo(0, 9)
    expect(duration(r)).toBeCloseTo(1, 9)
  })
  it('sampleAt handles empty array without throwing', () => {
    const s = sampleAt([], 1)
    expect(s.pos).toEqual(v(0, 0))
    expect(s.vel).toEqual(v(0, 0))
    expect(s.acc).toEqual(v(0, 0))
    expect(s.t).toBe(0)
  })
  it('no duplicate t values on settling bounce (phantom double-fire prevention)', () => {
    const r = simulate({ pos: v(0, 0.001), vel: v(0, 0) }, uniformGravity(9.81),
      { dt: 1 / 60, tMax: 10, groundY: 0, restitution: 0.5, maxBounces: 50 })
    expect(r.stopReason).toBe('ground')
    for (let i = 1; i < r.samples.length; i++)
      expect(r.samples[i].t).toBeGreaterThan(r.samples[i - 1].t)
    for (const s of r.samples) expect(Number.isFinite(s.pos.y)).toBe(true)
  })
  it('maxSamples enforced on bounce continue path', () => {
    const r = simulate({ pos: v(0, 10), vel: v(0, 0) }, uniformGravity(9.81),
      { dt: 0.01, tMax: 1000, groundY: 0, restitution: 0.9, maxBounces: 1000, maxSamples: 50 })
    expect(r.stopReason).toBe('samples')
    expect(r.samples.length).toBeLessThanOrEqual(50)
  })
})
