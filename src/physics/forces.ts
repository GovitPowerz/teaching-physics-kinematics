import type { Force } from './integrate'
import { add, scale, sub, v, type Vec2 } from './vec2'

export interface Charge { pos: Vec2; q: number }
export const SOFTENING = 0.05

const softenedKernel = (rVec: Vec2, K: number): Vec2 => {
  const d2 = rVec.x * rVec.x + rVec.y * rVec.y + SOFTENING * SOFTENING
  return scale(rVec, K / Math.pow(d2, 1.5))
}

export const uniformGravity = (g: number): Force => () => v(0, -g)
export const uniformField = (a: Vec2): Force => () => a
export const linearDrag = (k: number): Force => (_pos, vel) => scale(vel, -k)
export const combine = (...fs: Force[]): Force => (pos, vel) =>
  fs.reduce((acc, f) => add(acc, f(pos, vel)), v(0, 0))

export const coulomb = (charges: Charge[], qOverM: number): Force => (pos) =>
  charges.reduce(
    (acc, c) => add(acc, softenedKernel(sub(pos, c.pos), qOverM * c.q)),
    v(0, 0),
  )

export const newtonGravity = (mu: number): Force => (pos) =>
  softenedKernel(pos, -mu)
