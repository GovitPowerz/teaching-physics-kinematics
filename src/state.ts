import type { Charge } from './physics/forces'
import { duration, type SimResult } from './physics/trajectory'
import { v, type Vec2 } from './physics/vec2'
import { buildSim } from './scenes'

export type Tab = 'projectile' | 'deflection' | 'charges' | 'orbits'

export interface AppState {
  tab: Tab
  projectile: { launch: Vec2; v0: Vec2; g: number; dragK: number; restitution: number }
  deflection: { v0: number; a: number; sign: 1 | -1; plateLength: number }
  charges: {
    charges: Charge[]; testPos: Vec2; testVel: Vec2; testSign: 1 | -1
    selected: number | null
  }
  orbits: { pos: Vec2; vel: Vec2 }
  playback: { playing: boolean; t: number; speed: number }
  overlays: { v: boolean; a: boolean }
  sim: SimResult
  revision: number
}

export interface Store {
  get: () => AppState
  subscribe: (fn: () => void) => void
  setTab: (tab: Tab) => void
  patchProjectile: (p: Partial<AppState['projectile']>) => void
  patchDeflection: (p: Partial<AppState['deflection']>) => void
  patchOrbits: (p: Partial<AppState['orbits']>) => void
  setTestCharge: (p: Partial<{ testPos: Vec2; testVel: Vec2; testSign: 1 | -1 }>) => void
  addCharge: (pos: Vec2, q: number) => void
  moveCharge: (i: number, pos: Vec2) => void
  setChargeQ: (i: number, q: number) => void
  deleteCharge: (i: number) => void
  selectCharge: (i: number | null) => void
  setPlaying: (p: boolean) => void
  setT: (t: number) => void
  setSpeed: (s: number) => void
  toggleOverlay: (k: 'v' | 'a') => void
}

export const createStore = (): Store => {
  const state: AppState = {
    tab: 'projectile',
    projectile: { launch: v(2, 0), v0: v(12, 8), g: 9.81, dragK: 0, restitution: 0 },
    deflection: { v0: 2.5, a: 0.5, sign: 1, plateLength: 4 },
    charges: {
      charges: [{ pos: v(-1, 0), q: 1 }, { pos: v(1, 0), q: -1 }],
      testPos: v(-3, 2), testVel: v(1.2, -0.6), testSign: 1, selected: null,
    },
    orbits: { pos: v(1.5, 0), vel: v(0, 0.9) },
    playback: { playing: false, t: 0, speed: 1 },
    overlays: { v: true, a: true },
    sim: { samples: [], stopReason: 'tMax' },
    revision: 0,
  }
  state.sim = buildSim(state)

  const subs: Array<() => void> = []
  const notify = () => subs.forEach((f) => f())
  const recompute = () => {
    state.sim = buildSim(state)
    state.playback.t = 0
    state.playback.playing = false
    state.revision++
    notify()
  }

  return {
    get: () => state,
    subscribe: (fn) => { subs.push(fn) },
    setTab: (tab) => { state.tab = tab; recompute() },
    patchProjectile: (p) => { Object.assign(state.projectile, p); recompute() },
    patchDeflection: (p) => { Object.assign(state.deflection, p); recompute() },
    patchOrbits: (p) => { Object.assign(state.orbits, p); recompute() },
    setTestCharge: (p) => { Object.assign(state.charges, p); recompute() },
    addCharge: (pos, q) => {
      if (state.charges.charges.length >= 8) return
      state.charges.charges.push({ pos, q })
      recompute()
    },
    moveCharge: (i, pos) => { state.charges.charges[i].pos = pos; recompute() },
    setChargeQ: (i, q) => {
      const sign = Math.sign(q) || 1
      state.charges.charges[i].q = sign * Math.min(5, Math.max(1, Math.abs(q)))
      recompute()
    },
    deleteCharge: (i) => {
      state.charges.charges.splice(i, 1)
      state.charges.selected = null
      recompute()
    },
    selectCharge: (i) => { state.charges.selected = i; notify() },
    setPlaying: (p) => { state.playback.playing = p; notify() },
    setT: (t) => {
      state.playback.t = Math.min(duration(state.sim), Math.max(0, t))
      notify()
    },
    setSpeed: (s) => { state.playback.speed = s; notify() },
    toggleOverlay: (k) => { state.overlays[k] = !state.overlays[k]; notify() },
  }
}
