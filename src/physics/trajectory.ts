import { rk4Step, type Force, type PState } from './integrate'
import { add, scale, sub, v, type Vec2 } from './vec2'

export interface Sample { t: number; pos: Vec2; vel: Vec2; acc: Vec2 }
export type StopReason =
  'tMax' | 'ground' | 'bounds' | 'capture' | 'screen' | 'nonfinite' | 'samples'

export interface SimOptions {
  dt: number
  tMax: number
  maxSamples?: number
  groundY?: number
  restitution?: number
  maxBounces?: number
  bounds?: { xMin: number; xMax: number; yMin: number; yMax: number }
  capturePoints?: Vec2[]
  captureRadius?: number
  screenX?: number
}

export interface SimResult { samples: Sample[]; stopReason: StopReason }

const finite = (s: PState): boolean =>
  Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y) &&
  Number.isFinite(s.vel.x) && Number.isFinite(s.vel.y)

export const simulate = (s0: PState, force: Force, opts: SimOptions): SimResult => {
  const maxSamples = opts.maxSamples ?? 20000
  const e = opts.restitution ?? 0
  const maxBounces = opts.maxBounces ?? 5
  const captureR = opts.captureRadius ?? 0.12
  const samples: Sample[] = []
  let cur: PState = { pos: s0.pos, vel: s0.vel }
  let t = 0
  let bounces = 0
  const push = (st: PState, tt: number) =>
    samples.push({ t: tt, pos: st.pos, vel: st.vel, acc: force(st.pos, st.vel) })
  push(cur, 0)

  while (t < opts.tMax - opts.dt / 2) {
    const next = rk4Step(cur, force, opts.dt)
    const tNext = t + opts.dt
    if (!finite(next)) return { samples, stopReason: 'nonfinite' }

    if (opts.groundY !== undefined && next.pos.y < opts.groundY && cur.pos.y >= opts.groundY
        && next.vel.y < 0) {
      const denom = cur.pos.y - next.pos.y
      const f = denom > 0 ? (cur.pos.y - opts.groundY) / denom : 0
      if (f === 0) return { samples, stopReason: 'ground' }
      const tHit = t + f * opts.dt
      const hitPos = { x: cur.pos.x + f * (next.pos.x - cur.pos.x), y: opts.groundY }
      const hitVel = {
        x: cur.vel.x + f * (next.vel.x - cur.vel.x),
        y: cur.vel.y + f * (next.vel.y - cur.vel.y),
      }
      if (e === 0 || bounces >= maxBounces) {
        push({ pos: hitPos, vel: hitVel }, tHit)
        return { samples, stopReason: 'ground' }
      }
      bounces++
      cur = { pos: hitPos, vel: { x: hitVel.x, y: -e * hitVel.y } }
      t = tHit
      push(cur, t)
      if (samples.length >= maxSamples) return { samples, stopReason: 'samples' }
      continue
    }

    cur = next
    t = tNext
    push(cur, t)

    if (opts.screenX !== undefined && cur.pos.x >= opts.screenX)
      return { samples, stopReason: 'screen' }
    if (opts.bounds) {
      const b = opts.bounds
      if (cur.pos.x < b.xMin || cur.pos.x > b.xMax || cur.pos.y < b.yMin || cur.pos.y > b.yMax)
        return { samples, stopReason: 'bounds' }
    }
    if (opts.capturePoints) {
      for (const c of opts.capturePoints) {
        const d = sub(cur.pos, c)
        if (d.x * d.x + d.y * d.y < captureR * captureR)
          return { samples, stopReason: 'capture' }
      }
    }
    if (samples.length >= maxSamples) return { samples, stopReason: 'samples' }
  }
  return { samples, stopReason: 'tMax' }
}

export const duration = (r: SimResult): number =>
  r.samples.length ? r.samples[r.samples.length - 1].t : 0

export const sampleAt = (samples: Sample[], t: number): Sample => {
  if (samples.length === 0) return { t: 0, pos: v(0, 0), vel: v(0, 0), acc: v(0, 0) }
  if (t <= samples[0].t) return samples[0]
  const last = samples[samples.length - 1]
  if (t >= last.t) return last
  let lo = 0
  let hi = samples.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[hi]
  const f = (t - a.t) / (b.t - a.t)
  return {
    t,
    pos: add(a.pos, scale(sub(b.pos, a.pos), f)),
    vel: add(a.vel, scale(sub(b.vel, a.vel), f)),
    acc: add(a.acc, scale(sub(b.acc, a.acc), f)),
  }
}
