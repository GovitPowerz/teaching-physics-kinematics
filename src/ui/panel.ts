import { fieldAt } from '../physics/fields'
import { conicType, eccentricity, escapeVelocity, specificEnergy } from '../physics/orbital'
import { duration } from '../physics/trajectory'
import { dot, len } from '../physics/vec2'
import { INCLINE, MU, PLATES } from '../scenes'
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
    'Field exists only between the plates. Normalized units.',
  charges:
    'Superposition: every charge pushes on the test charge at once. ' +
    'Field shape drives motion. Normalized units.',
  orbits:
    'One heavy body, one satellite. The sign of the energy decides: ellipse or ' +
    'escape. Normalized units, \u03bc = 1.',
  incline:
    'Weight splits along and across the plane; friction opposes sliding. ' +
    'SI units, m = 1 kg.',
}

export const formulasFor = (s: AppState): string[] => {
  switch (s.tab) {
    case 'projectile': {
      const p = s.projectile
      const T = (p.v0.y + Math.sqrt(p.v0.y * p.v0.y + 2 * p.g * p.launch.y)) / p.g
      const ref = p.dragK > 0 ? ' (k = 0 reference)' : ''
      return [
        `x(t) = ${fmt(p.launch.x)} + ${fmt(p.v0.x)}\u00b7t${ref}`,
        `y(t) = ${fmt(p.launch.y)} + ${fmt(p.v0.y)}\u00b7t \u2212 \u00bd\u00b7${fmt(p.g)}\u00b7t\u00b2${ref}`,
        `ideal flight T = ${fmt(T)} s, range = ${fmt(p.v0.x * T)} m`,
      ]
    }
    case 'deflection': {
      const d = s.deflection
      const last = s.sim.samples[s.sim.samples.length - 1]
      const dy = s.sim.stopReason === 'screen' ? fmt(last.pos.y)
        : s.sim.stopReason === 'custom' ? 'n/a (hit a plate)' : 'n/a'
      // t0: time the beam reaches the field-entry plane at x = PLATES.x0
      // (the field is windowed to the plate span; y(t) is flat before this)
      const t0 = (PLATES.x0 - PLATES.entryX) / d.v0
      return [
        `x(t) = ${fmt(PLATES.entryX)} + ${fmt(d.v0)}\u00b7t`,
        `y = \u00bd\u00b7a\u00b7(t \u2212 ${fmt(t0)})\u00b2 between the plates, ` +
          `a = ${fmt(d.sign * d.a)}`,
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
    case 'incline': {
      const i = s.incline
      const th = i.theta
      const mu = i.mu
      const N = INCLINE.g * Math.cos(th)
      const stuck = s.sim.stopReason === 'custom' && duration(s.sim) < 0.1
      const aVal = -INCLINE.g * (Math.sin(th) + mu * Math.cos(th) * Math.sign(i.v0))
      const lines = [
        `N = mg\u00b7cos\u03b8 = ${fmt(N)} N`,
        stuck
          ? `a = 0 (static friction)`
          : `a = g\u00b7(sin\u03b8 \u2212 \u03bc\u00b7cos\u03b8) = ${fmt(aVal)} m/s\u00b2`,
      ]
      if (i.v0 > 0) {
        const d = (i.v0 * i.v0) / (2 * INCLINE.g * (Math.sin(th) + mu * Math.cos(th)))
        lines.push(
          `stops after d = v0\u00b2/(2g(sin\u03b8 + \u03bc\u00b7cos\u03b8)) = ${fmt(d)} m`)
      }
      return lines
    }
  }
}

export const createPanel = (store: Store) => {
  const el = document.createElement('div')
  let lastKey: string | null = null
  const render = () => {
    const s = store.get()
    const lines = formulasFor(s)
    const key = s.tab + '|' + lines.join('\n')
    if (key === lastKey) return
    lastKey = key
    el.innerHTML = ''
    for (const line of lines) {
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
