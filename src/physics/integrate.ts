import { add, scale, type Vec2 } from './vec2'

export interface PState { pos: Vec2; vel: Vec2 }
export type Force = (pos: Vec2, vel: Vec2) => Vec2

export const rk4Step = (s: PState, force: Force, dt: number): PState => {
  const k1v = force(s.pos, s.vel)
  const k1p = s.vel
  const k2v = force(add(s.pos, scale(k1p, dt / 2)), add(s.vel, scale(k1v, dt / 2)))
  const k2p = add(s.vel, scale(k1v, dt / 2))
  const k3v = force(add(s.pos, scale(k2p, dt / 2)), add(s.vel, scale(k2v, dt / 2)))
  const k3p = add(s.vel, scale(k2v, dt / 2))
  const k4v = force(add(s.pos, scale(k3p, dt)), add(s.vel, scale(k3v, dt)))
  const k4p = add(s.vel, scale(k3v, dt))
  return {
    pos: add(s.pos, scale(add(add(k1p, scale(add(k2p, k3p), 2)), k4p), dt / 6)),
    vel: add(s.vel, scale(add(add(k1v, scale(add(k2v, k3v), 2)), k4v), dt / 6)),
  }
}
