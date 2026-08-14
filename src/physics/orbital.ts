import type { PState } from './integrate'
import type { Sample } from './trajectory'
import { cross, dot, len, scale, sub, type Vec2 } from './vec2'

export type ConicType = 'ellipse' | 'parabola' | 'hyperbola'

export const specificEnergy = (s: PState, mu: number): number =>
  dot(s.vel, s.vel) / 2 - mu / len(s.pos)

export const eccVector = (s: PState, mu: number): Vec2 => {
  const r = len(s.pos)
  const v2 = dot(s.vel, s.vel)
  const rv = dot(s.pos, s.vel)
  return scale(sub(scale(s.pos, v2 - mu / r), scale(s.vel, rv)), 1 / mu)
}

export const eccentricity = (s: PState, mu: number): number => len(eccVector(s, mu))

export const conicType = (e: number, tol = 1e-3): ConicType =>
  Math.abs(e - 1) < tol ? 'parabola' : e < 1 ? 'ellipse' : 'hyperbola'

export const semiMajorAxis = (s: PState, mu: number): number => {
  const eps = specificEnergy(s, mu)
  return eps === 0 ? Infinity : -mu / (2 * eps)
}

export const period = (s: PState, mu: number): number => {
  if (specificEnergy(s, mu) >= 0) return Infinity
  const a = semiMajorAxis(s, mu) // positive here (eps < 0), sqrt is safe
  return 2 * Math.PI * Math.sqrt((a * a * a) / mu)
}

export const escapeVelocity = (r: number, mu: number): number => Math.sqrt(2 * mu / r)

export const periapsisApoapsis = (s: PState, mu: number): { rp: number; ra: number | null } => {
  const e = eccentricity(s, mu)
  if (specificEnergy(s, mu) >= 0) {
    const h = cross(s.pos, s.vel) // angular momentum, rp = h^2/mu / (1+e)
    return { rp: (h * h) / mu / (1 + e), ra: null }
  }
  const a = semiMajorAxis(s, mu)
  return { rp: a * (1 - e), ra: a * (1 + e) }
}

export const sweptArea = (samples: Sample[], t0: number, t1: number): number => {
  let area = 0
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].t <= t0 || samples[i - 1].t >= t1) continue
    area += Math.abs(cross(samples[i - 1].pos, samples[i].pos)) / 2
  }
  return area
}
