import { fieldAt } from '../physics/fields'
import { conicType, eccentricity, escapeVelocity, specificEnergy } from '../physics/orbital'
import { dot, len } from '../physics/vec2'
import { MU } from '../scenes'
import type { AppState, Store, Tab } from '../state'

export const fmt = (x: number, digits = 2): string => {
  const s = x.toFixed(digits)
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s
}

export const CAPTIONS: Record<Tab, string> = {
  projectile:
    'A uniform gravitational field: velocity changes, acceleration never does.',
  deflection:
    'Same math as the projectile - a uniform field is a uniform field. ' +
    'Field exists only between the plates.',
  charges:
    'Superposition: every charge pushes on the test charge at once. ' +
    'Field shape drives motion. Normalized units.',
  orbits:
    'One heavy body, one satellite. The sign of the energy decides: ellipse or ' +
    'escape. Normalized units, \u03bc = 1.',
}

export const formulasFor = (s: AppState): string[] => {
  switch (s.tab) {
    case 'projectile': {
      const p = s.projectile
      const T = (p.v0.y + Math.sqrt(p.v0.y * p.v0.y + 2 * p.g * p.launch.y)) / p.g
      return [
        `x(t) = ${fmt(p.launch.x)} + ${fmt(p.v0.x)}\u00b7t`,
        `y(t) = ${fmt(p.launch.y)} + ${fmt(p.v0.y)}\u00b7t \u2212 \u00bd\u00b7${fmt(p.g)}\u00b7t\u00b2`,
        `ideal flight T = ${fmt(T)} s, range = ${fmt(p.v0.x * T)} m`,
      ]
    }
    case 'deflection': {
      const d = s.deflection
      const last = s.sim.samples[s.sim.samples.length - 1]
      const dy = s.sim.stopReason === 'screen' ? fmt(last.pos.y)
        : s.sim.stopReason === 'custom' ? 'n/a (hit a plate)' : 'n/a'
      return [
        `x(t) = 0.20 + ${fmt(d.v0)}\u00b7t`,
        `y(t) = \u00bd\u00b7(qE/m)\u00b7t\u00b2 inside the plates, a = ${fmt(d.a)}`,
        `deflection at screen = ${dy}`,
      ]
    }
    case 'charges': {
      const c = s.charges
      const E = fieldAt(c.charges, c.testPos)
      return [
        `E(test) = (${fmt(E.x)}, ${fmt(E.y)}), |E| = ${fmt(len(E))}`,
        `F = q\u00b7E, superposition of ${c.charges.length} charges`,
      ]
    }
    case 'orbits': {
      const st = { pos: s.orbits.pos, vel: s.orbits.vel }
      const eps = specificEnergy(st, MU)
      const kind = conicType(eccentricity(st, MU))
      return [
        `\u03b5 = v\u00b2/2 \u2212 \u03bc/r = ${fmt(eps)} (${kind})`,
        `vis-viva: v\u00b2 = \u03bc\u00b7(2/r \u2212 1/a) = ${fmt(dot(st.vel, st.vel))}`,
        `v_esc = \u221a(2\u03bc/r) = ${fmt(escapeVelocity(len(st.pos), MU))}`,
      ]
    }
  }
}

export const createPanel = (store: Store) => {
  const el = document.createElement('div')
  const render = () => {
    const s = store.get()
    el.innerHTML = ''
    for (const line of formulasFor(s)) {
      const div = document.createElement('div')
      div.className = 'formula'
      div.textContent = line
      el.appendChild(div)
    }
    const cap = document.createElement('div')
    cap.className = 'caption'
    cap.textContent = CAPTIONS[s.tab]
    el.appendChild(cap)
  }
  return { el, render }
}