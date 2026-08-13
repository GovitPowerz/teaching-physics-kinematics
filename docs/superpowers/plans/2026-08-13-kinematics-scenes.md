# Kinematics Scenes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four-scene kinematics teaching site (Projectile, Deflection, Charges, Orbits) per `docs/superpowers/specs/2026-08-13-kinematics-scenes-design.md`.

**Architecture:** One shared physics core (RK4 integrator + pluggable force laws + trajectory simulator with stop conditions) feeds four canvas-2D scene renderers. Ghost trajectory and playback share the same precomputed samples. One Store with subscribe(); only the active scene renders.

**Tech Stack:** Vite, TypeScript strict, vitest, canvas 2D. No runtime dependencies, no UI framework, no three.js.

## Global Constraints

- Work on branch `feature/kinematics-scene-design` (already exists). Never commit to main. Never push.
- Every commit message ends with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (blank line before the trailer).
- TypeScript strict; `npm run build` = `tsc --noEmit && vite build` must stay green.
- ASCII-only source files. Unicode appears only in display strings and always via `\uXXXX` escapes (e.g. `²` for superscript 2, `·` for middle dot, `μ` for mu, `ε` for epsilon).
- Tests cover pure modules only (physics, store, formatters, viewport). Rendering is verified visually via `npm run dev`.
- The pure core never throws: clamps and stop conditions, not exceptions.
- Vite `base: './'`, dev port 5173 `strictPort`.
- Normalized units everywhere except the Projectile scene (real SI, g = 9.81).
- Reference project for style and idiom: `../complex-visualization`.

---

### Task 1: Project scaffold + vec2

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/style.css`, `.gitignore`
- Create: `src/physics/vec2.ts`
- Test: `tests/vec2.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  ```ts
  export interface Vec2 { x: number; y: number }
  export const v: (x: number, y: number) => Vec2
  export const add: (a: Vec2, b: Vec2) => Vec2
  export const sub: (a: Vec2, b: Vec2) => Vec2
  export const scale: (a: Vec2, s: number) => Vec2
  export const dot: (a: Vec2, b: Vec2) => number
  export const cross: (a: Vec2, b: Vec2) => number   // scalar z-component
  export const len: (a: Vec2) => number
  export const norm: (a: Vec2) => Vec2               // (0,0) input -> (0,0), never NaN
  ```

- [ ] **Step 1: Verify branch, scaffold config files**

Run: `git branch --show-current` -> must print `feature/kinematics-scene-design`.

`package.json`:
```json
{
  "name": "kinematics",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vite": "^8.2.1",
    "vitest": "^4.1.10"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
})
```

`index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Motion in Force Fields</title>
</head>
<body>
  <div id="app">
    <nav id="topbar"></nav>
    <div id="scene"></div>
    <div id="panel"></div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/style.css` (minimal shell; scenes extend it later):
```css
:root {
  --bg: #12141a; --fg: #e6e6e6; --dim: #8a8f9a; --accent: #5ab0f0;
  --ghost: #7fd07f; --ghost-ref: #5a5f6a; --danger: #f07f7f;
}
* { box-sizing: border-box; margin: 0; }
body { background: var(--bg); color: var(--fg); font: 14px/1.4 system-ui, sans-serif; }
#app { display: flex; flex-direction: column; height: 100vh; }
#topbar { display: flex; gap: 4px; padding: 8px; border-bottom: 1px solid #2a2e38; }
#topbar button { background: none; border: 1px solid #2a2e38; color: var(--dim);
  padding: 6px 14px; border-radius: 6px; cursor: pointer; font: inherit; }
#topbar button.active { color: var(--fg); border-color: var(--accent); }
#scene { flex: 1; display: flex; min-height: 0; }
#scene canvas { flex: 1; min-width: 0; }
.controls { width: 240px; padding: 12px; border-left: 1px solid #2a2e38;
  display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.controls label { color: var(--dim); font-size: 12px; }
.controls .row { display: flex; align-items: center; gap: 6px; }
.controls input[type="range"] { flex: 1; }
.controls input[type="text"] { width: 56px; background: #1a1e28; color: var(--fg);
  border: 1px solid #2a2e38; border-radius: 4px; padding: 2px 4px; font: inherit; }
#panel { padding: 8px 14px; border-top: 1px solid #2a2e38; min-height: 76px; }
#panel .formula { font-family: ui-monospace, monospace; color: var(--fg); }
#panel .caption { color: var(--dim); font-size: 12px; margin-top: 4px; }
.hidden { display: none; }
```

`.gitignore`:
```
node_modules
dist
.DS_Store
```

Run: `npm install`

- [ ] **Step 2: Write the failing vec2 test**

`tests/vec2.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { add, cross, dot, len, norm, scale, sub, v } from '../src/physics/vec2'

describe('vec2', () => {
  it('add/sub/scale', () => {
    expect(add(v(1, 2), v(3, 4))).toEqual(v(4, 6))
    expect(sub(v(1, 2), v(3, 4))).toEqual(v(-2, -2))
    expect(scale(v(1, -2), 3)).toEqual(v(3, -6))
  })
  it('dot/cross/len', () => {
    expect(dot(v(1, 2), v(3, 4))).toBe(11)
    expect(cross(v(1, 0), v(0, 1))).toBe(1)
    expect(len(v(3, 4))).toBe(5)
  })
  it('norm is zero-safe', () => {
    expect(norm(v(3, 4))).toEqual(v(0.6, 0.8))
    expect(norm(v(0, 0))).toEqual(v(0, 0))
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (cannot resolve `../src/physics/vec2`).

- [ ] **Step 4: Implement vec2**

`src/physics/vec2.ts`:
```ts
export interface Vec2 { x: number; y: number }

export const v = (x: number, y: number): Vec2 => ({ x, y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x
export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const norm = (a: Vec2): Vec2 => {
  const l = len(a)
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}
```

- [ ] **Step 5: Run tests, verify pass, verify build**

Run: `npm test` -> PASS. Run: `npm run build` -> green (main.ts does not exist yet; if tsc complains about the index.html script reference it will not - vite only resolves it at dev/build asset time; create an empty `src/main.ts` with `export {}` if `vite build` fails).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold vite project and vec2 core"
```

---

### Task 2: RK4 integrator

**Files:**
- Create: `src/physics/integrate.ts`
- Test: `tests/integrate.test.ts`

**Interfaces:**
- Consumes: `Vec2, add, scale` from `src/physics/vec2`.
- Produces:
  ```ts
  export interface PState { pos: Vec2; vel: Vec2 }
  export type Force = (pos: Vec2, vel: Vec2) => Vec2   // returns acceleration
  export const rk4Step: (s: PState, force: Force, dt: number) => PState
  ```
  (`Force` lives here; `forces.ts` imports the type from `integrate.ts`.)

- [ ] **Step 1: Write the failing test**

`tests/integrate.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { rk4Step, type PState } from '../src/physics/integrate'
import { scale, v } from '../src/physics/vec2'

const oscillator = (pos: ReturnType<typeof v>) => scale(pos, -1) // a = -x, omega = 1

function integrate(s: PState, dt: number, tEnd: number): PState {
  let cur = s
  for (let t = 0; t < tEnd - dt / 2; t += dt) cur = rk4Step(cur, oscillator, dt)
  return cur
}

describe('rk4Step', () => {
  it('matches cos(t) on the harmonic oscillator', () => {
    const end = integrate({ pos: v(1, 0), vel: v(0, 0) }, 0.01, Math.PI)
    expect(end.pos.x).toBeCloseTo(Math.cos(Math.PI), 8)
    expect(end.vel.x).toBeCloseTo(-Math.sin(Math.PI), 8)
  })
  it('shows 4th-order convergence', () => {
    const exact = Math.cos(1)
    const e1 = Math.abs(integrate({ pos: v(1, 0), vel: v(0, 0) }, 0.1, 1).pos.x - exact)
    const e2 = Math.abs(integrate({ pos: v(1, 0), vel: v(0, 0) }, 0.05, 1).pos.x - exact)
    expect(e1 / e2).toBeGreaterThan(12) // ~16 for order 4
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` -> FAIL (module not found).

- [ ] **Step 3: Implement**

`src/physics/integrate.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test` -> PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/integrate.test.ts src/physics/integrate.ts
git commit -m "feat: fixed-step RK4 integrator"
```

---

### Task 3: Force laws

**Files:**
- Create: `src/physics/forces.ts`
- Test: `tests/forces.test.ts`

**Interfaces:**
- Consumes: `Vec2` ops; `Force` type from `integrate.ts`.
- Produces:
  ```ts
  export interface Charge { pos: Vec2; q: number }
  export const SOFTENING = 0.05
  export const uniformGravity: (g: number) => Force            // a = (0, -g)
  export const uniformField: (a: Vec2) => Force                // constant a
  export const linearDrag: (k: number) => Force                // a = -k * vel
  export const combine: (...fs: Force[]) => Force              // sum of accelerations
  export const coulomb: (charges: Charge[], qOverM: number) => Force
  export const newtonGravity: (mu: number) => Force            // central body at origin
  ```
  Softened kernel used by both 1/r^2 laws: `r_vec * K / (|r|^2 + SOFTENING^2)^(3/2)`.

- [ ] **Step 1: Write the failing test**

`tests/forces.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  SOFTENING, combine, coulomb, linearDrag, newtonGravity, uniformField, uniformGravity,
} from '../src/physics/forces'
import { add, len, v } from '../src/physics/vec2'

describe('forces', () => {
  it('uniformGravity and uniformField', () => {
    expect(uniformGravity(9.81)(v(3, 7), v(1, 1))).toEqual(v(0, -9.81))
    expect(uniformField(v(0, -9.81))(v(0, 0), v(0, 0))).toEqual(v(0, -9.81))
  })
  it('linearDrag opposes velocity', () => {
    expect(linearDrag(0.5)(v(0, 0), v(2, -4))).toEqual(v(-1, 2))
  })
  it('combine sums accelerations', () => {
    const f = combine(uniformGravity(10), linearDrag(1))
    expect(f(v(0, 0), v(3, 0))).toEqual(v(-3, -10))
  })
  it('coulomb single charge, hand-computed with softening', () => {
    const E = coulomb([{ pos: v(0, 0), q: 1 }], 1)(v(1, 0), v(0, 0))
    const expected = 1 / Math.pow(1 + SOFTENING * SOFTENING, 1.5)
    expect(E.x).toBeCloseTo(expected, 12)
    expect(E.y).toBeCloseTo(0, 12)
  })
  it('coulomb superposition is exact', () => {
    const c1 = { pos: v(1, 0), q: 1 }
    const c2 = { pos: v(-1, 1), q: -2 }
    const p = v(0.3, -0.4)
    const both = coulomb([c1, c2], 1.5)(p, v(0, 0))
    const sum = add(coulomb([c1], 1.5)(p, v(0, 0)), coulomb([c2], 1.5)(p, v(0, 0)))
    expect(both.x).toBeCloseTo(sum.x, 12)
    expect(both.y).toBeCloseTo(sum.y, 12)
  })
  it('softening keeps acceleration finite at the singularity', () => {
    const a = coulomb([{ pos: v(0, 0), q: 5 }], 1)(v(0, 0), v(0, 0))
    expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true)
    const near = newtonGravity(1)(v(1e-9, 0), v(0, 0))
    expect(len(near)).toBeLessThan(1 / (SOFTENING * SOFTENING))
  })
  it('newtonGravity attracts toward origin', () => {
    const a = newtonGravity(1)(v(2, 0), v(0, 0))
    expect(a.x).toBeLessThan(0)
    expect(a.y).toBeCloseTo(0, 12)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` -> FAIL (module not found).

- [ ] **Step 3: Implement**

`src/physics/forces.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test` -> PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/forces.test.ts src/physics/forces.ts
git commit -m "feat: force laws with softened 1/r^2 kernel"
```

---

### Task 4: Trajectory simulator + isomorphism test

**Files:**
- Create: `src/physics/trajectory.ts`
- Test: `tests/trajectory.test.ts`

**Interfaces:**
- Consumes: `rk4Step, PState, Force` from `integrate.ts`; force constructors from `forces.ts`.
- Produces:
  ```ts
  export interface Sample { t: number; pos: Vec2; vel: Vec2; acc: Vec2 }
  export type StopReason =
    'tMax' | 'ground' | 'bounds' | 'capture' | 'screen' | 'nonfinite' | 'samples'
  export interface SimOptions {
    dt: number
    tMax: number
    maxSamples?: number                    // default 20000
    groundY?: number                       // reflect/stop surface
    restitution?: number                   // e, default 0
    maxBounces?: number                    // default 5
    bounds?: { xMin: number; xMax: number; yMin: number; yMax: number }
    capturePoints?: Vec2[]
    captureRadius?: number                 // default 0.12
    screenX?: number                       // stop when pos.x >= screenX
  }
  export interface SimResult { samples: Sample[]; stopReason: StopReason }
  export const simulate: (s0: PState, force: Force, opts: SimOptions) => SimResult
  export const sampleAt: (samples: Sample[], t: number) => Sample  // linear interp, clamped
  export const duration: (r: SimResult) => number                 // last sample t, 0 if empty
  ```
  Ground rule (from spec): a downward crossing of `groundY` reflects with `vy -> -e*vy`
  at the linearly interpolated crossing point; stops there instead when `e === 0` or the
  bounce count is exhausted. A non-finite step truncates at the last good sample.

- [ ] **Step 1: Write the failing test**

`tests/trajectory.test.ts`:
```ts
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` -> FAIL (module not found).

- [ ] **Step 3: Implement**

`src/physics/trajectory.ts`:
```ts
import { rk4Step, type Force, type PState } from './integrate'
import { add, scale, sub, type Vec2 } from './vec2'

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
      const f = (cur.pos.y - opts.groundY) / (cur.pos.y - next.pos.y) // linear fraction
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
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test` -> PASS. If the bounce test's post-bounce speed misses tolerance, tighten the test's dt (1/480 is chosen so linear interpolation error stays under 1e-2 relative).

- [ ] **Step 5: Commit**

```bash
git add tests/trajectory.test.ts src/physics/trajectory.ts
git commit -m "feat: trajectory simulator with stop conditions and bounce"
```

---

### Task 5: Orbital math

**Files:**
- Create: `src/physics/orbital.ts`
- Test: `tests/orbital.test.ts`

**Interfaces:**
- Consumes: `Vec2` ops; `PState`; `newtonGravity`, `simulate` (tests only).
- Produces:
  ```ts
  export type ConicType = 'ellipse' | 'parabola' | 'hyperbola'
  export const specificEnergy: (s: PState, mu: number) => number      // v^2/2 - mu/r
  export const eccVector: (s: PState, mu: number) => Vec2
  export const eccentricity: (s: PState, mu: number) => number
  export const conicType: (e: number, tol?: number) => ConicType      // tol default 1e-3
  export const semiMajorAxis: (s: PState, mu: number) => number       // Infinity if eps >= 0
  export const period: (s: PState, mu: number) => number              // Infinity if not ellipse
  export const escapeVelocity: (r: number, mu: number) => number
  export const periapsisApoapsis: (s: PState, mu: number) => { rp: number; ra: number | null }
  export const sweptArea: (samples: Sample[], t0: number, t1: number) => number
  ```

- [ ] **Step 1: Write the failing test**

`tests/orbital.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { newtonGravity } from '../src/physics/forces'
import {
  conicType, eccVector, eccentricity, escapeVelocity, periapsisApoapsis, period,
  semiMajorAxis, specificEnergy, sweptArea,
} from '../src/physics/orbital'
import { simulate } from '../src/physics/trajectory'
import { v } from '../src/physics/vec2'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` -> FAIL (module not found).

- [ ] **Step 3: Implement**

`src/physics/orbital.ts`:
```ts
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
  return eps >= 0 ? Infinity : -mu / (2 * eps)
}

export const period = (s: PState, mu: number): number => {
  const a = semiMajorAxis(s, mu)
  return Number.isFinite(a) ? 2 * Math.PI * Math.sqrt((a * a * a) / mu) : Infinity
}

export const escapeVelocity = (r: number, mu: number): number => Math.sqrt(2 * mu / r)

export const periapsisApoapsis = (s: PState, mu: number): { rp: number; ra: number | null } => {
  const e = eccentricity(s, mu)
  const a = semiMajorAxis(s, mu)
  if (!Number.isFinite(a)) {
    const h = cross(s.pos, s.vel) // angular momentum, rp = h^2/mu / (1+e)
    return { rp: (h * h) / mu / (1 + e), ra: null }
  }
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
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test` -> PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/orbital.test.ts src/physics/orbital.ts
git commit -m "feat: analytic orbital quantities and swept-area helper"
```

---

### Task 6: Fields toolkit (field lines + equipotentials)

**Files:**
- Create: `src/physics/fields.ts`
- Test: `tests/fields.test.ts`

**Interfaces:**
- Consumes: `Charge, SOFTENING` from `forces.ts`; `Vec2` ops.
- Produces:
  ```ts
  export const fieldAt: (charges: Charge[], p: Vec2) => Vec2       // E, unit test charge
  export const potentialAt: (charges: Charge[], p: Vec2) => number // softened 1/r
  export interface FieldLineOpts {
    step?: number          // default 0.02
    maxSteps?: number      // default 1500
    bounds: { xMin: number; xMax: number; yMin: number; yMax: number }
    seedsPerUnitCharge?: number // default 8
    seedRadius?: number    // default 0.15
  }
  export const fieldLines: (charges: Charge[], opts: FieldLineOpts) => Vec2[][]
  export type Segment = [Vec2, Vec2]
  export const equipotentials: (
    charges: Charge[], levels: number[],
    grid: { xMin: number; xMax: number; yMin: number; yMax: number; nx: number; ny: number },
  ) => Segment[]
  ```
  Field lines: for each charge, `seedsPerUnitCharge * round(|q|)` seeds on a circle of
  `seedRadius`; march along `sign(q) * norm(E)` with fixed `step` (midpoint/RK2); a line
  ends on leaving bounds, entering any charge's seed radius, or `maxSteps`.
  Equipotentials: standard 16-case marching squares over the sampled grid, linear
  interpolation on cell edges, ambiguous saddle cases resolved by center-value test.

- [ ] **Step 1: Write the failing test**

`tests/fields.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { equipotentials, fieldAt, fieldLines, potentialAt } from '../src/physics/fields'
import { SOFTENING } from '../src/physics/forces'
import { len, v } from '../src/physics/vec2'

const BOUNDS = { xMin: -4, xMax: 4, yMin: -4, yMax: 4 }

describe('fields', () => {
  it('fieldAt matches softened Coulomb for one charge', () => {
    const E = fieldAt([{ pos: v(0, 0), q: 2 }], v(1, 0))
    expect(E.x).toBeCloseTo(2 / Math.pow(1 + SOFTENING * SOFTENING, 1.5), 12)
    expect(E.y).toBeCloseTo(0, 12)
  })
  it('potentialAt is softened 1/r', () => {
    expect(potentialAt([{ pos: v(0, 0), q: 1 }], v(1, 0)))
      .toBeCloseTo(1 / Math.sqrt(1 + SOFTENING * SOFTENING), 12)
  })
  it('seed count scales with |q|', () => {
    const one = fieldLines([{ pos: v(0, 0), q: 1 }], { bounds: BOUNDS })
    const three = fieldLines([{ pos: v(0, 0), q: 3 }], { bounds: BOUNDS })
    expect(one.length).toBe(8)
    expect(three.length).toBe(24)
  })
  it('field lines of a lone positive charge march outward to the bounds', () => {
    const lines = fieldLines([{ pos: v(0, 0), q: 1 }], { bounds: BOUNDS })
    for (const line of lines) {
      const end = line[line.length - 1]
      expect(len(end)).toBeGreaterThan(3.5)
    }
  })
  it('equipotential of a single charge is a circle', () => {
    const charges = [{ pos: v(0, 0), q: 1 }]
    const level = potentialAt(charges, v(1, 0))
    const segs = equipotentials(charges, [level],
      { xMin: -2, xMax: 2, yMin: -2, yMax: 2, nx: 120, ny: 120 })
    expect(segs.length).toBeGreaterThan(40)
    const radii = segs.flat().map((p) => len(p))
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length
    for (const r of radii) expect(Math.abs(r - mean) / mean).toBeLessThan(0.02)
    expect(mean).toBeCloseTo(1, 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` -> FAIL (module not found).

- [ ] **Step 3: Implement**

`src/physics/fields.ts`:
```ts
import { SOFTENING, type Charge } from './forces'
import { add, len, norm, scale, sub, v, type Vec2 } from './vec2'

export const fieldAt = (charges: Charge[], p: Vec2): Vec2 =>
  charges.reduce((acc, c) => {
    const r = sub(p, c.pos)
    const d2 = r.x * r.x + r.y * r.y + SOFTENING * SOFTENING
    return add(acc, scale(r, c.q / Math.pow(d2, 1.5)))
  }, v(0, 0))

export const potentialAt = (charges: Charge[], p: Vec2): number =>
  charges.reduce((acc, c) => {
    const r = sub(p, c.pos)
    return acc + c.q / Math.sqrt(r.x * r.x + r.y * r.y + SOFTENING * SOFTENING)
  }, 0)

export interface FieldLineOpts {
  step?: number
  maxSteps?: number
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number }
  seedsPerUnitCharge?: number
  seedRadius?: number
}

export const fieldLines = (charges: Charge[], opts: FieldLineOpts): Vec2[][] => {
  const step = opts.step ?? 0.02
  const maxSteps = opts.maxSteps ?? 1500
  const perUnit = opts.seedsPerUnitCharge ?? 8
  const seedR = opts.seedRadius ?? 0.15
  const b = opts.bounds
  const inBounds = (p: Vec2) =>
    p.x >= b.xMin && p.x <= b.xMax && p.y >= b.yMin && p.y <= b.yMax
  const nearCharge = (p: Vec2, exclude: Charge) =>
    charges.some((c) => c !== exclude && len(sub(p, c.pos)) < seedR)
  const lines: Vec2[][] = []

  for (const c of charges) {
    const n = perUnit * Math.max(1, Math.round(Math.abs(c.q)))
    const dir = Math.sign(c.q) || 1
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * i) / n
      let p = add(c.pos, v(seedR * Math.cos(ang), seedR * Math.sin(ang)))
      const line: Vec2[] = [p]
      for (let k = 0; k < maxSteps; k++) {
        const e1 = norm(fieldAt(charges, p))
        if (e1.x === 0 && e1.y === 0) break
        const mid = add(p, scale(e1, dir * step * 0.5))
        const e2 = norm(fieldAt(charges, mid))
        p = add(p, scale(e2, dir * step))
        line.push(p)
        if (!inBounds(p) || nearCharge(p, c)) break
      }
      lines.push(line)
    }
  }
  return lines
}

export type Segment = [Vec2, Vec2]

export const equipotentials = (
  charges: Charge[],
  levels: number[],
  grid: { xMin: number; xMax: number; yMin: number; yMax: number; nx: number; ny: number },
): Segment[] => {
  const { xMin, xMax, yMin, yMax, nx, ny } = grid
  const dx = (xMax - xMin) / nx
  const dy = (yMax - yMin) / ny
  const val: number[][] = []
  for (let j = 0; j <= ny; j++) {
    const row: number[] = []
    for (let i = 0; i <= nx; i++)
      row.push(potentialAt(charges, v(xMin + i * dx, yMin + j * dy)))
    val.push(row)
  }
  const segs: Segment[] = []
  const lerp = (pa: Vec2, pb: Vec2, va: number, vb: number, lv: number): Vec2 => {
    const f = (lv - va) / (vb - va)
    return v(pa.x + f * (pb.x - pa.x), pa.y + f * (pb.y - pa.y))
  }
  for (const lv of levels) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x0 = xMin + i * dx, y0 = yMin + j * dy
        const p = [v(x0, y0), v(x0 + dx, y0), v(x0 + dx, y0 + dy), v(x0, y0 + dy)]
        const c = [val[j][i], val[j][i + 1], val[j + 1][i + 1], val[j + 1][i]]
        let idx = 0
        for (let k = 0; k < 4; k++) if (c[k] > lv) idx |= 1 << k
        if (idx === 0 || idx === 15) continue
        const edge = (k: number): Vec2 =>
          lerp(p[k], p[(k + 1) % 4], c[k], c[(k + 1) % 4], lv)
        const table: Record<number, [number, number][]> = {
          1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]],
          7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 11: [[2, 1]], 12: [[1, 3]],
          13: [[1, 0]], 14: [[0, 3]],
        }
        if (idx === 5 || idx === 10) {
          const center = (c[0] + c[1] + c[2] + c[3]) / 4
          const pairs: [number, number][] =
            (idx === 5) === (center > lv) ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]]
          for (const [a, bb] of pairs) segs.push([edge(a), edge(bb)])
        } else {
          for (const [a, bb] of table[idx]) segs.push([edge(a), edge(bb)])
        }
      }
    }
  }
  return segs
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test` -> PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/fields.test.ts src/physics/fields.ts
git commit -m "feat: field lines and marching-squares equipotentials"
```

---

### Task 7: Scene sim builders + Store

**Files:**
- Create: `src/scenes.ts` (pure per-scene sim configuration)
- Create: `src/state.ts`
- Test: `tests/scenes.test.ts`, `tests/state.test.ts`

**Interfaces:**
- Consumes: everything from `physics/`.
- Produces (`src/scenes.ts`):
  ```ts
  export const DOMAINS: {
    projectile: { xMin: 0; xMax: 60; yMin: 0; yMax: 30 }
    deflection: { xMin: 0; xMax: 10; yMin: -3; yMax: 3 }
    charges:    { xMin: -4; xMax: 4; yMin: -4; yMax: 4 }
    orbits:     { xMin: -4; xMax: 4; yMin: -4; yMax: 4 }
  }
  export const PLATES = { x0: 2, length: 4, gap: 1.6, screenX: 9 } // deflection geometry
  export const MU = 1
  export const buildSim: (s: AppState) => SimResult   // switch on s.tab
  ```
  Per-scene sim parameters (fixed constants inside buildSim):
  - projectile: dt 1/240, tMax 30, groundY 0, restitution/maxBounces from state, bounds = domain padded x2 horizontally
  - deflection: dt 1/240, tMax 30, screenX = PLATES.screenX, bounds = domain; force is zero outside `x in [PLATES.x0, PLATES.x0 + plateLength]`, `uniformField(v(0, sign * a))` inside
  - charges: dt 0.002, tMax 20, bounds = domain, capturePoints = charge positions, captureRadius 0.12
  - orbits: dt 0.002, tMax = min(3 * period, 120) for ellipses else 60, bounds = domain padded x2, capturePoints = [origin], captureRadius 0.1
- Produces (`src/state.ts`):
  ```ts
  export type Tab = 'projectile' | 'deflection' | 'charges' | 'orbits'
  export interface AppState {
    tab: Tab
    projectile: { launch: Vec2; v0: Vec2; g: number; dragK: number; restitution: number }
    deflection: { v0: number; a: number; sign: 1 | -1; plateLength: number }
    charges: { charges: Charge[]; testPos: Vec2; testVel: Vec2; testSign: 1 | -1;
               selected: number | null }
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
    addCharge: (pos: Vec2, q: number) => void        // no-op at 8 charges
    moveCharge: (i: number, pos: Vec2) => void
    setChargeQ: (i: number, q: number) => void       // clamped to [-5, 5], never 0 (min |q| = 1)
    deleteCharge: (i: number) => void
    selectCharge: (i: number | null) => void
    setPlaying: (p: boolean) => void
    setT: (t: number) => void                        // clamped to [0, duration(sim)]
    setSpeed: (s: number) => void
    toggleOverlay: (k: 'v' | 'a') => void
  }
  export const createStore: () => Store
  ```
  Rules: every scene mutation recomputes `sim` via `buildSim`, resets playback
  (`t = 0, playing = false`), bumps `revision`, notifies exactly once. `setTab`
  recomputes for the new tab. Playback/overlay mutations notify without recompute.
  Defaults: projectile launch (2, 0), v0 (12, 8), g 9.81, dragK 0, restitution 0;
  deflection v0 2.5, a 1, sign 1, plateLength 4; charges: one +1 at (-1, 0), one -1
  at (1, 0), testPos (-3, 2), testVel (1.2, -0.6), testSign 1; orbits pos (1.5, 0),
  vel (0, 0.9); speed 1, overlays v+a on.

- [ ] **Step 1: Write the failing tests**

`tests/scenes.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildSim, PLATES } from '../src/scenes'
import { createStore } from '../src/state'

describe('buildSim', () => {
  it('projectile sim starts at launch and stops on the ground', () => {
    const st = createStore().get()
    const sim = buildSim({ ...st, tab: 'projectile' })
    expect(sim.samples[0].pos.x).toBe(2)
    expect(sim.stopReason).toBe('ground')
  })
  it('deflection force is zero outside the plates', () => {
    const st = createStore().get()
    const sim = buildSim({ ...st, tab: 'deflection' })
    const before = sim.samples.find((s) => s.pos.x < PLATES.x0)
    const inside = sim.samples.find(
      (s) => s.pos.x > PLATES.x0 + 0.5 && s.pos.x < PLATES.x0 + st.deflection.plateLength - 0.5)
    expect(before && Math.abs(before.acc.y)).toBe(0)
    expect(inside && Math.abs(inside!.acc.y)).toBeCloseTo(st.deflection.a, 9)
    expect(sim.stopReason).toBe('screen')
  })
  it('orbits default is a closed ellipse simulated ~3 periods', () => {
    const st = createStore().get()
    const sim = buildSim({ ...st, tab: 'orbits' })
    expect(sim.stopReason).toBe('tMax')
  })
})
```

`tests/state.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { duration } from '../src/physics/trajectory'
import { createStore } from '../src/state'
import { v } from '../src/physics/vec2'

describe('store', () => {
  it('scene mutation recomputes sim, resets playback, notifies once', () => {
    const s = createStore()
    let n = 0
    s.subscribe(() => n++)
    s.setPlaying(true)
    s.setT(1)
    const before = s.get().sim
    s.patchProjectile({ g: 3.7 })
    expect(n).toBe(3)
    expect(s.get().sim).not.toBe(before)
    expect(s.get().playback.playing).toBe(false)
    expect(s.get().playback.t).toBe(0)
  })
  it('setT clamps to [0, duration]', () => {
    const s = createStore()
    s.setT(1e9)
    expect(s.get().playback.t).toBeCloseTo(duration(s.get().sim), 9)
    s.setT(-5)
    expect(s.get().playback.t).toBe(0)
  })
  it('setTab switches sim to the new scene', () => {
    const s = createStore()
    s.setTab('orbits')
    expect(s.get().tab).toBe('orbits')
    expect(s.get().sim.samples[0].pos.x).toBeCloseTo(1.5, 9)
  })
  it('charge list: cap 8, q clamped, delete clears selection', () => {
    const s = createStore()
    for (let i = 0; i < 10; i++) s.addCharge(v(i * 0.1, 2), 1)
    expect(s.get().charges.charges.length).toBe(8)
    s.setChargeQ(0, 99)
    expect(s.get().charges.charges[0].q).toBe(5)
    s.setChargeQ(0, 0.2)
    expect(Math.abs(s.get().charges.charges[0].q)).toBeGreaterThanOrEqual(1)
    s.selectCharge(1)
    s.deleteCharge(1)
    expect(s.get().charges.selected).toBeNull()
  })
  it('playback mutations do not recompute the sim', () => {
    const s = createStore()
    const sim = s.get().sim
    s.setPlaying(true)
    s.setSpeed(2)
    s.toggleOverlay('v')
    expect(s.get().sim).toBe(sim)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` -> FAIL (modules not found).

- [ ] **Step 3: Implement scenes.ts**

`src/scenes.ts`:
```ts
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
} as const

export const PLATES = { x0: 2, length: 4, gap: 1.6, screenX: 9 }
export const MU = 1

export const buildSim = (s: AppState): SimResult => {
  switch (s.tab) {
    case 'projectile': {
      const p = s.projectile
      const force: Force = p.dragK > 0
        ? combine(uniformGravity(p.g), linearDrag(p.dragK))
        : uniformGravity(p.g)
      return simulate({ pos: p.launch, vel: p.v0 }, force, {
        dt: 1 / 240, tMax: 30, groundY: 0,
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
      return simulate({ pos: v(0.2, 0), vel: v(d.v0, 0) }, force, {
        dt: 1 / 240, tMax: 30, screenX: PLATES.screenX, bounds: DOMAINS.deflection,
      })
    }
    case 'charges': {
      const c = s.charges
      return simulate({ pos: c.testPos, vel: c.testVel },
        coulomb(c.charges, c.testSign), {
          dt: 0.002, tMax: 20, bounds: DOMAINS.charges,
          capturePoints: c.charges.map((ch) => ch.pos), captureRadius: 0.12,
        })
    }
    case 'orbits': {
      const o = s.orbits
      const st = { pos: o.pos, vel: o.vel }
      const isEllipse = conicType(eccentricity(st, MU)) === 'ellipse'
      const tMax = isEllipse ? Math.min(3 * period(st, MU), 120) : 60
      return simulate(st, newtonGravity(MU), {
        dt: 0.002, tMax, maxSamples: 100000,
        bounds: { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
        capturePoints: [v(0, 0)], captureRadius: 0.1,
      })
    }
  }
}
```

- [ ] **Step 4: Implement state.ts**

`src/state.ts`:
```ts
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
    deflection: { v0: 2.5, a: 1, sign: 1, plateLength: 4 },
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
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm test` -> PASS. Note the state test expects `selectCharge` to notify without
recompute (it uses `notify`, not `recompute`) - selection is a UI concern.

- [ ] **Step 6: Commit**

```bash
git add tests/scenes.test.ts tests/state.test.ts src/scenes.ts src/state.ts
git commit -m "feat: per-scene sim builders and app store"
```

---

### Task 8: Formula formatters + panel component

**Files:**
- Create: `src/ui/panel.ts`
- Test: `tests/panel.test.ts`

**Interfaces:**
- Consumes: `AppState`; `orbital.ts` quantities; `fieldAt` from `fields.ts`; `sampleAt`.
- Produces:
  ```ts
  export const fmt: (x: number, digits?: number) => string  // toFixed, "-0.00" -> "0.00"
  export const formulasFor: (s: AppState) => string[]       // 2-3 lines, live numbers
  export const CAPTIONS: Record<Tab, string>
  export const createPanel: (store: Store) => { el: HTMLElement; render: () => void }
  ```
  Formula content (exact shapes; numbers via `fmt`, 2 digits):
  - projectile: `x(t) = 2.00 + 12.00·t` / `y(t) = 0.00 + 8.00·t − ½·9.81·t²`
  - deflection: `x(t) = 0.20 + 2.50·t` / `y(t) = ½·(qE/m)·t² inside the plates, a = 1.00`
  - charges: `E(test) = (Ex, Ey), |E| = 1.23` / `F = q·E, superposition of N charges`
  - orbits: `ε = v²/2 − μ/r = -0.23 (ellipse)` / `v_esc = √(2μ/r) = 1.15`
  (Executor: build these strings with template literals and the escaped Unicode; tests
  assert exact strings for projectile and orbits, shape-only `toContain` for the others.)
  Captions, one line each:
  - projectile: "A uniform gravitational field: velocity changes, acceleration never does."
  - deflection: "Same math as the projectile - a uniform field is a uniform field. Field exists only between the plates."
  - charges: "Superposition: every charge pushes on the test charge at once. Field shape drives motion. Normalized units."
  - orbits: "One heavy body, one satellite. The sign of the energy decides: ellipse or escape. Normalized units, μ = 1."

- [ ] **Step 1: Write the failing test**

`tests/panel.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { CAPTIONS, fmt, formulasFor } from '../src/ui/panel'
import { createStore } from '../src/state'

describe('panel formatters', () => {
  it('fmt fixes digits and normalizes negative zero', () => {
    expect(fmt(1.2345)).toBe('1.23')
    expect(fmt(-0.0001)).toBe('0.00')
    expect(fmt(2, 1)).toBe('2.0')
  })
  it('projectile formulas carry live numbers', () => {
    const s = createStore().get()
    const lines = formulasFor(s)
    expect(lines[0]).toBe('x(t) = 2.00 + 12.00·t')
    expect(lines[1]).toBe('y(t) = 0.00 + 8.00·t − ½·9.81·t²')
    expect(lines[2]).toContain('range')
  })
  it('orbit formulas show energy sign and conic label', () => {
    const store = createStore()
    store.setTab('orbits')
    const lines = formulasFor(store.get())
    expect(lines[0]).toContain('ε')
    expect(lines[0]).toContain('ellipse')
    expect(lines[1]).toContain('v²')
    expect(lines[2]).toContain('v_esc')
  })
  it('every tab has a caption', () => {
    for (const tab of ['projectile', 'deflection', 'charges', 'orbits'] as const)
      expect(CAPTIONS[tab].length).toBeGreaterThan(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` -> FAIL.

- [ ] **Step 3: Implement**

`src/ui/panel.ts`:
```ts
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
    'escape. Normalized units, μ = 1.',
}

export const formulasFor = (s: AppState): string[] => {
  switch (s.tab) {
    case 'projectile': {
      const p = s.projectile
      const T = (p.v0.y + Math.sqrt(p.v0.y * p.v0.y + 2 * p.g * p.launch.y)) / p.g
      return [
        `x(t) = ${fmt(p.launch.x)} + ${fmt(p.v0.x)}·t`,
        `y(t) = ${fmt(p.launch.y)} + ${fmt(p.v0.y)}·t − ½·${fmt(p.g)}·t²`,
        `ideal flight T = ${fmt(T)} s, range = ${fmt(p.v0.x * T)} m`,
      ]
    }
    case 'deflection': {
      const d = s.deflection
      const last = s.sim.samples[s.sim.samples.length - 1]
      const dy = s.sim.stopReason === 'screen' ? fmt(last.pos.y) : 'n/a'
      return [
        `x(t) = 0.20 + ${fmt(d.v0)}·t`,
        `y(t) = ½·(qE/m)·t² inside the plates, a = ${fmt(d.a)}`,
        `deflection at screen = ${dy}`,
      ]
    }
    case 'charges': {
      const c = s.charges
      const E = fieldAt(c.charges, c.testPos)
      return [
        `E(test) = (${fmt(E.x)}, ${fmt(E.y)}), |E| = ${fmt(len(E))}`,
        `F = q·E, superposition of ${c.charges.length} charges`,
      ]
    }
    case 'orbits': {
      const st = { pos: s.orbits.pos, vel: s.orbits.vel }
      const eps = specificEnergy(st, MU)
      const kind = conicType(eccentricity(st, MU))
      return [
        `ε = v²/2 − μ/r = ${fmt(eps)} (${kind})`,
        `vis-viva: v² = μ·(2/r − 1/a) = ${fmt(dot(st.vel, st.vel))}`,
        `v_esc = √(2μ/r) = ${fmt(escapeVelocity(len(st.pos), MU))}`,
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
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test` -> PASS (vitest needs a DOM for `createPanel` only; the tests avoid it,
formatters are pure - if vitest complains about `document`, it is a test importing
`createPanel` by accident; formatters tests must not touch the DOM).

- [ ] **Step 5: Commit**

```bash
git add tests/panel.test.ts src/ui/panel.ts
git commit -m "feat: live formula formatters and panel component"
```

---

### Task 9: Viewport + shared UI controls + app shell

**Files:**
- Create: `src/render/viewport.ts`, `src/ui/controls.ts`, `src/ui/topbar.ts`,
  `src/ui/playback.ts`, `src/main.ts` (replace the Task 1 stub if present)
- Test: `tests/viewport.test.ts`

**Interfaces:**
- Consumes: `Store`, `Tab`, `duration`, `sampleAt`.
- Produces (`render/viewport.ts`):
  ```ts
  export interface Viewport { world: { xMin: number; xMax: number; yMin: number; yMax: number }
                              w: number; h: number }
  export const toScreen: (vp: Viewport, p: Vec2) => Vec2   // y flips (world y up)
  export const toWorld: (vp: Viewport, p: Vec2) => Vec2
  export const pxPerUnit: (vp: Viewport) => number         // uniform min-fit scale
  ```
  Uniform scale `s = min(w / worldWidth, h / worldHeight)`, world box centered in canvas.
- Produces (`ui/controls.ts`):
  ```ts
  export interface Handle { id: string; pos: Vec2; radius: number }  // screen px
  export const hitTest: (handles: Handle[], p: Vec2) => string | null // nearest within radius
  export const attachDrag: (
    canvas: HTMLCanvasElement,
    getHandles: () => Handle[],
    onDrag: (id: string, screenPos: Vec2) => void,
    onTapEmpty?: (screenPos: Vec2) => void,
  ) => void
  export interface ControlRow { el: HTMLElement; refresh: () => void }
  export const sliderRow: (
    label: string, min: number, max: number, step: number,
    get: () => number, set: (v: number) => void,
  ) => ControlRow    // range + committed text field (Enter/blur, clamp, revert);
                     // refresh() syncs both inputs from get() unless focused
  export const vecRow: (
    label: string, get: () => Vec2, set: (val: Vec2) => void,
  ) => ControlRow    // paired x/y text fields for draggable vectors, same commit rules
  export const buttonRow: (labels: string[], onClick: (i: number) => void) => HTMLElement
  ```
- Produces (`ui/topbar.ts`): `createTopbar(store): { el, render }` - four buttons
  (Projectile, Deflection, Charges, Orbits), active class follows `store.get().tab`.
- Produces (`ui/playback.ts`): `createPlayback(store): { el, render }` - play/pause
  button, reset button, scrubber (`input type=range`, max = `duration(sim)`, step 0.01),
  speed select (0.25/0.5/1/2), overlay checkboxes v and a. The spec's F toggle is
  deliberately dropped: every scene uses unit mass, so the F arrow would exactly
  duplicate the a arrow.
- Produces (`main.ts`): store creation, topbar/panel/playback mount, scene registry
  `Record<Tab, SceneRenderer>`, mount/unmount on tab change, and the rAF loop:
  ```ts
  let last = performance.now()
  const loop = (now: number) => {
    const dt = (now - last) / 1000
    last = now
    const s = store.get()
    if (s.playback.playing) {
      const tNext = s.playback.t + dt * s.playback.speed
      if (tNext >= duration(s.sim)) { store.setT(duration(s.sim)); store.setPlaying(false) }
      else store.setT(tNext)
    }
    active.render()
    requestAnimationFrame(loop)
  }
  ```
  `SceneRenderer` interface (defined in `main.ts`, imported by all four scene files):
  ```ts
  export interface SceneRenderer { mount: (root: HTMLElement) => void; unmount: () => void;
                                   render: () => void }
  ```
  Until Tasks 10-13 land, register a placeholder for each tab: a renderer that draws
  nothing but mounts an empty canvas (inline object in main.ts, replaced task by task).

- [ ] **Step 1: Write the failing viewport test**

`tests/viewport.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { pxPerUnit, toScreen, toWorld } from '../src/render/viewport'
import { v } from '../src/physics/vec2'

const vp = { world: { xMin: 0, xMax: 60, yMin: 0, yMax: 30 }, w: 800, h: 600 }

describe('viewport', () => {
  it('uniform scale is the min fit', () => {
    expect(pxPerUnit(vp)).toBeCloseTo(800 / 60, 9) // 13.33 < 600/30 = 20
  })
  it('world y up, screen y down, box centered', () => {
    const center = toScreen(vp, v(30, 15))
    expect(center.x).toBeCloseTo(400, 9)
    expect(center.y).toBeCloseTo(300, 9)
    const origin = toScreen(vp, v(0, 0))
    expect(origin.y).toBeGreaterThan(300) // below center on screen
  })
  it('toWorld inverts toScreen', () => {
    const p = v(12.3, 4.56)
    const back = toWorld(vp, toScreen(vp, p))
    expect(back.x).toBeCloseTo(p.x, 9)
    expect(back.y).toBeCloseTo(p.y, 9)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` -> FAIL.

- [ ] **Step 3: Implement viewport**

`src/render/viewport.ts`:
```ts
import { v, type Vec2 } from '../physics/vec2'

export interface Viewport {
  world: { xMin: number; xMax: number; yMin: number; yMax: number }
  w: number
  h: number
}

export const pxPerUnit = (vp: Viewport): number =>
  Math.min(vp.w / (vp.world.xMax - vp.world.xMin), vp.h / (vp.world.yMax - vp.world.yMin))

export const toScreen = (vp: Viewport, p: Vec2): Vec2 => {
  const s = pxPerUnit(vp)
  const cx = (vp.world.xMin + vp.world.xMax) / 2
  const cy = (vp.world.yMin + vp.world.yMax) / 2
  return v(vp.w / 2 + (p.x - cx) * s, vp.h / 2 - (p.y - cy) * s)
}

export const toWorld = (vp: Viewport, p: Vec2): Vec2 => {
  const s = pxPerUnit(vp)
  const cx = (vp.world.xMin + vp.world.xMax) / 2
  const cy = (vp.world.yMin + vp.world.yMax) / 2
  return v(cx + (p.x - vp.w / 2) / s, cy - (p.y - vp.h / 2) / s)
}
```

- [ ] **Step 4: Run test to verify pass, then build the untested UI shell**

Run: `npm test` -> PASS.

`src/ui/controls.ts`:
```ts
import { v, type Vec2 } from '../physics/vec2'

export interface Handle { id: string; pos: Vec2; radius: number }

export const hitTest = (handles: Handle[], p: Vec2): string | null => {
  let best: string | null = null
  let bestD = Infinity
  for (const h of handles) {
    const d = Math.hypot(h.pos.x - p.x, h.pos.y - p.y)
    if (d <= h.radius && d < bestD) { best = h.id; bestD = d }
  }
  return best
}

export const attachDrag = (
  canvas: HTMLCanvasElement,
  getHandles: () => Handle[],
  onDrag: (id: string, screenPos: Vec2) => void,
  onTapEmpty?: (screenPos: Vec2) => void,
): void => {
  let dragging: string | null = null
  const local = (ev: PointerEvent): Vec2 => {
    const r = canvas.getBoundingClientRect()
    return v(ev.clientX - r.left, ev.clientY - r.top)
  }
  canvas.addEventListener('pointerdown', (ev) => {
    const p = local(ev)
    dragging = hitTest(getHandles(), p)
    if (dragging) { canvas.setPointerCapture(ev.pointerId); onDrag(dragging, p) }
    else onTapEmpty?.(p)
  })
  canvas.addEventListener('pointermove', (ev) => {
    if (dragging) onDrag(dragging, local(ev))
  })
  canvas.addEventListener('pointerup', () => { dragging = null })
}

export interface ControlRow { el: HTMLElement; refresh: () => void }

export const sliderRow = (
  label: string, min: number, max: number, step: number,
  get: () => number, set: (val: number) => void,
): ControlRow => {
  const wrap = document.createElement('div')
  const lab = document.createElement('label')
  lab.textContent = label
  const row = document.createElement('div')
  row.className = 'row'
  const range = document.createElement('input')
  range.type = 'range'
  range.min = String(min); range.max = String(max); range.step = String(step)
  const text = document.createElement('input')
  text.type = 'text'
  const refresh = () => {
    if (document.activeElement !== range) range.value = String(get())
    if (document.activeElement !== text) text.value = String(get())
  }
  range.addEventListener('input', () => { set(Number(range.value)) })
  const commit = () => {
    const n = Number(text.value)
    if (Number.isFinite(n)) set(Math.min(max, Math.max(min, n)))
    refresh()
  }
  text.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') commit() })
  text.addEventListener('blur', commit)
  refresh()
  wrap.append(lab, row)
  row.append(range, text)
  return { el: wrap, refresh }
}

export const vecRow = (
  label: string, get: () => Vec2, set: (val: Vec2) => void,
): ControlRow => {
  const wrap = document.createElement('div')
  const lab = document.createElement('label')
  lab.textContent = label
  const row = document.createElement('div')
  row.className = 'row'
  const inputs: Array<['x' | 'y', HTMLInputElement]> = []
  const refresh = () => {
    for (const [axis, t] of inputs)
      if (document.activeElement !== t) t.value = get()[axis].toFixed(2)
  }
  for (const axis of ['x', 'y'] as const) {
    const t = document.createElement('input')
    t.type = 'text'
    const commit = () => {
      const n = Number(t.value)
      if (Number.isFinite(n)) set({ ...get(), [axis]: n })
      refresh()
    }
    t.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') commit() })
    t.addEventListener('blur', commit)
    inputs.push([axis, t])
    row.appendChild(t)
  }
  refresh()
  wrap.append(lab, row)
  return { el: wrap, refresh }
}

export const buttonRow = (labels: string[], onClick: (i: number) => void): HTMLElement => {
  const row = document.createElement('div')
  row.className = 'row'
  labels.forEach((l, i) => {
    const b = document.createElement('button')
    b.textContent = l
    b.addEventListener('click', () => onClick(i))
    row.appendChild(b)
  })
  return row
}
```

`src/ui/topbar.ts`:
```ts
import type { Store, Tab } from '../state'

const TABS: Array<[Tab, string]> = [
  ['projectile', 'Projectile'], ['deflection', 'Deflection'],
  ['charges', 'Charges'], ['orbits', 'Orbits'],
]

export const createTopbar = (store: Store) => {
  const el = document.createElement('div')
  el.style.display = 'contents'
  const buttons = new Map<Tab, HTMLButtonElement>()
  for (const [tab, label] of TABS) {
    const b = document.createElement('button')
    b.textContent = label
    b.addEventListener('click', () => store.setTab(tab))
    buttons.set(tab, b)
    el.appendChild(b)
  }
  const render = () => {
    const active = store.get().tab
    for (const [tab, b] of buttons) b.classList.toggle('active', tab === active)
  }
  return { el, render }
}
```

`src/ui/playback.ts`:
```ts
import { duration } from '../physics/trajectory'
import type { Store } from '../state'

export const createPlayback = (store: Store) => {
  const el = document.createElement('div')
  el.className = 'row'
  const play = document.createElement('button')
  const reset = document.createElement('button')
  reset.textContent = 'Reset'
  const scrub = document.createElement('input')
  scrub.type = 'range'
  scrub.min = '0'; scrub.step = '0.01'
  const speed = document.createElement('select')
  for (const s of [0.25, 0.5, 1, 2]) {
    const o = document.createElement('option')
    o.value = String(s); o.textContent = s + 'x'
    speed.appendChild(o)
  }
  speed.value = '1'
  const mkToggle = (key: 'v' | 'a', label: string) => {
    const l = document.createElement('label')
    const c = document.createElement('input')
    c.type = 'checkbox'; c.checked = true
    c.addEventListener('change', () => store.toggleOverlay(key))
    l.append(c, document.createTextNode(' ' + label))
    return l
  }
  play.addEventListener('click', () => store.setPlaying(!store.get().playback.playing))
  reset.addEventListener('click', () => { store.setPlaying(false); store.setT(0) })
  scrub.addEventListener('input', () => { store.setPlaying(false); store.setT(Number(scrub.value)) })
  speed.addEventListener('change', () => store.setSpeed(Number(speed.value)))
  el.append(play, reset, scrub, speed, mkToggle('v', 'v'), mkToggle('a', 'a'))
  const render = () => {
    const s = store.get()
    play.textContent = s.playback.playing ? 'Pause' : 'Play'
    scrub.max = String(duration(s.sim))
    if (document.activeElement !== scrub) scrub.value = String(s.playback.t)
  }
  return { el, render }
}
```

`src/main.ts`:
```ts
import './style.css'
import { duration } from './physics/trajectory'
import { createStore, type Tab } from './state'
import { createPanel } from './ui/panel'
import { createPlayback } from './ui/playback'
import { createTopbar } from './ui/topbar'

export interface SceneRenderer {
  mount: (root: HTMLElement) => void
  unmount: () => void
  render: () => void
}

const store = createStore()
const sceneRoot = document.getElementById('scene')!
const placeholder = (): SceneRenderer => {
  let canvas: HTMLCanvasElement | null = null
  return {
    mount: (root) => { canvas = document.createElement('canvas'); root.appendChild(canvas) },
    unmount: () => { canvas?.remove() },
    render: () => {},
  }
}
const scenes: Record<Tab, SceneRenderer> = {
  projectile: placeholder(), deflection: placeholder(),
  charges: placeholder(), orbits: placeholder(),
}

const topbar = createTopbar(store)
document.getElementById('topbar')!.appendChild(topbar.el)
const panel = createPanel(store)
const playback = createPlayback(store)
const panelRoot = document.getElementById('panel')!
panelRoot.append(playback.el, panel.el)

let activeTab: Tab = store.get().tab
scenes[activeTab].mount(sceneRoot)

store.subscribe(() => {
  const tab = store.get().tab
  if (tab !== activeTab) {
    scenes[activeTab].unmount()
    activeTab = tab
    scenes[activeTab].mount(sceneRoot)
  }
  topbar.render()
  panel.render()
  playback.render()
})
topbar.render(); panel.render(); playback.render()

let last = performance.now()
const loop = (now: number) => {
  const dt = (now - last) / 1000
  last = now
  const s = store.get()
  if (s.playback.playing) {
    const tNext = s.playback.t + dt * s.playback.speed
    if (tNext >= duration(s.sim)) { store.setT(duration(s.sim)); store.setPlaying(false) }
    else store.setT(tNext)
  }
  scenes[activeTab].render()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
```

- [ ] **Step 5: Visual check + full test/build**

Run: `npm run dev`, open http://localhost:5173. Expected: dark shell, four tab buttons
that switch active state, playback row with Play/Reset/scrubber, projectile formula
lines and caption in the panel. Empty canvas is fine (scenes come next).
Run: `npm test` and `npm run build` -> both green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: viewport, shared controls, topbar, playback, app shell"
```

---

### Task 10: Projectile scene

**Files:**
- Create: `src/render/projectile.ts`
- Modify: `src/main.ts` (replace the projectile placeholder with `createProjectileScene(store)`)

**Interfaces:**
- Consumes: `Store`, `SceneRenderer` (from main.ts), `viewport.ts`, `controls.ts`,
  `sampleAt`, `duration`, `simulate`, `uniformGravity`, `DOMAINS.projectile`.
- Produces: `export const createProjectileScene: (store: Store) => SceneRenderer`.

Drawing spec (canvas, world domain `DOMAINS.projectile`, i.e. x 0..60 m, y 0..30 m):
ground line at y=0; light grid every 10 m; ghost polyline through `sim.samples`
(`--ghost` color); time-tick dots every 0.5 s via `sampleAt`; when `dragK > 0`, a dashed
reference parabola (recompute with dragK 0 - cache keyed on `store.get().revision`);
draggable launch dot (radius 8 px) and velocity arrowhead (radius 10 px) at
`launch + v0` in world units (1 m per m/s); playback particle at `sampleAt(t)` with v
(accent) and a (danger) arrows when the overlays are on, arrow scale 1 world unit per
(m/s | m/s^2); apex marker (topmost sample) and range marker (last sample when
`stopReason === 'ground'`) with `fmt` numbers. Controls sidebar: sliders g 1..25
step 0.01 (plus preset buttons Moon 1.62 / Earth 9.81 / Jupiter 24.79 via `buttonRow`),
drag k 0..2 step 0.01, restitution e 0..0.95 step 0.05, plus vecRow x/y text fields
for launch and v0 (the draggables' paired text inputs).

- [ ] **Step 1: Implement the renderer**

`src/render/projectile.ts`:
```ts
import { uniformGravity, combine, linearDrag } from '../physics/forces'
import { duration, sampleAt, simulate, type SimResult } from '../physics/trajectory'
import { add, sub, v, type Vec2 } from '../physics/vec2'
import { DOMAINS } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { fmt } from '../ui/panel'
import { attachDrag, buttonRow, sliderRow, vecRow, type Handle } from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const createProjectileScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let idealCache: { rev: number; sim: SimResult } | null = null
  let refreshRows: () => void = () => {}

  const vp = (): Viewport =>
    ({ world: DOMAINS.projectile, w: canvas.clientWidth, h: canvas.clientHeight })

  const handles = (): Handle[] => {
    const p = store.get().projectile
    return [
      { id: 'launch', pos: toScreen(vp(), p.launch), radius: 10 },
      { id: 'v0', pos: toScreen(vp(), add(p.launch, p.v0)), radius: 12 },
    ]
  }

  const arrow = (from: Vec2, to: Vec2, color: string) => {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    const ang = Math.atan2(to.y - from.y, to.x - from.x)
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - 9 * Math.cos(ang - 0.4), to.y - 9 * Math.sin(ang - 0.4))
    ctx.lineTo(to.x - 9 * Math.cos(ang + 0.4), to.y - 9 * Math.sin(ang + 0.4))
    ctx.closePath()
    ctx.fill()
  }

  const idealSim = (): SimResult => {
    const s = store.get()
    if (!idealCache || idealCache.rev !== s.revision) {
      const p = s.projectile
      idealCache = {
        rev: s.revision,
        sim: simulate({ pos: p.launch, vel: p.v0 }, uniformGravity(p.g),
          { dt: 1 / 240, tMax: 30, groundY: 0, restitution: p.restitution, maxBounces: 5 }),
      }
    }
    return idealCache.sim
  }

  const drawPath = (sim: SimResult, color: string, dashed: boolean) => {
    ctx.strokeStyle = color
    ctx.lineWidth = dashed ? 1 : 2
    ctx.setLineDash(dashed ? [6, 6] : [])
    ctx.beginPath()
    sim.samples.forEach((s, i) => {
      const p = toScreen(vp(), s.pos)
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.setLineDash([])
  }

  const render = () => {
    refreshRows()
    const s = store.get()
    const p = s.projectile
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = '#2a2e38'
    ctx.lineWidth = 1
    for (let x = 0; x <= 60; x += 10) {
      const a = toScreen(vp(), v(x, 0)); const b = toScreen(vp(), v(x, 30))
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    }
    for (let y = 0; y <= 30; y += 10) {
      const a = toScreen(vp(), v(0, y)); const b = toScreen(vp(), v(60, y))
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    }
    const g0 = toScreen(vp(), v(0, 0)); const g1 = toScreen(vp(), v(60, 0))
    ctx.strokeStyle = css('--dim'); ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.stroke()

    if (p.dragK > 0) drawPath(idealSim(), css('--ghost-ref'), true)
    drawPath(s.sim, css('--ghost'), false)

    ctx.fillStyle = css('--ghost')
    for (let t = 0; t <= duration(s.sim); t += 0.5) {
      const q = toScreen(vp(), sampleAt(s.sim.samples, t).pos)
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, 2 * Math.PI); ctx.fill()
    }

    let apex = s.sim.samples[0]
    for (const smp of s.sim.samples) if (smp.pos.y > apex.pos.y) apex = smp
    const apexPx = toScreen(vp(), apex.pos)
    ctx.fillStyle = css('--dim')
    ctx.fillText(`apex ${fmt(apex.pos.y)} m`, apexPx.x + 6, apexPx.y - 6)
    if (s.sim.stopReason === 'ground') {
      const last = s.sim.samples[s.sim.samples.length - 1]
      const lp = toScreen(vp(), last.pos)
      ctx.fillText(`range ${fmt(last.pos.x - p.launch.x)} m`, lp.x - 30, lp.y - 8)
    }

    const launchPx = toScreen(vp(), p.launch)
    arrow(launchPx, toScreen(vp(), add(p.launch, p.v0)), css('--accent'))
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(launchPx.x, launchPx.y, 5, 0, 2 * Math.PI); ctx.fill()

    const cur = sampleAt(s.sim.samples, s.playback.t)
    const curPx = toScreen(vp(), cur.pos)
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(curPx.x, curPx.y, 6, 0, 2 * Math.PI); ctx.fill()
    if (s.overlays.v) arrow(curPx, toScreen(vp(), add(cur.pos, cur.vel)), css('--accent'))
    if (s.overlays.a) arrow(curPx, toScreen(vp(), add(cur.pos, cur.acc)), css('--danger'))
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      const rows = [
        sliderRow('gravity g (m/s²)', 1, 25, 0.01,
          () => store.get().projectile.g, (g) => store.patchProjectile({ g })),
        sliderRow('drag k (1/s)', 0, 2, 0.01,
          () => store.get().projectile.dragK, (dragK) => store.patchProjectile({ dragK })),
        sliderRow('restitution e', 0, 0.95, 0.05,
          () => store.get().projectile.restitution,
          (restitution) => store.patchProjectile({ restitution })),
        vecRow('launch (x, y)', () => store.get().projectile.launch,
          (launch) => store.patchProjectile({ launch })),
        vecRow('v0 (vx, vy)', () => store.get().projectile.v0,
          (v0) => store.patchProjectile({ v0 })),
      ]
      controls.append(rows[0].el,
        buttonRow(['Moon', 'Earth', 'Jupiter'],
          (i) => store.patchProjectile({ g: [1.62, 9.81, 24.79][i] })),
        ...rows.slice(1).map((r) => r.el))
      refreshRows = () => rows.forEach((r) => r.refresh())
      root.append(canvas, controls)
      attachDrag(canvas, handles, (id, screenPos) => {
        const w = toWorld(vp(), screenPos)
        if (id === 'launch')
          store.patchProjectile({ launch: v(Math.max(0, w.x), Math.max(0, w.y)) })
        else {
          const p = store.get().projectile
          store.patchProjectile({ v0: sub(w, p.launch) })
        }
      })
    },
    unmount: () => { canvas.remove(); controls.remove() },
    render,
  }
}
```

In `src/main.ts`, replace the projectile placeholder:
```ts
import { createProjectileScene } from './render/projectile'
// ...
const scenes: Record<Tab, SceneRenderer> = {
  projectile: createProjectileScene(store), deflection: placeholder(),
  charges: placeholder(), orbits: placeholder(),
}
```

- [ ] **Step 2: Visual check**

Run: `npm run dev`. Verify: parabola with time dots; dragging the arrowhead reshapes it
live; launch point drags; g presets snap the curve; drag k > 0 shows the dashed ideal
reference; e > 0 shows bounces; Play animates the ball with v tangent and a pointing
straight down; apex/range labels show plausible numbers (v0 = (12, 8), g = 9.81:
apex ~3.26 m above launch, range ~19.6 m).

- [ ] **Step 3: Full tests + build**

Run: `npm test` and `npm run build` -> green.

- [ ] **Step 4: Commit**

```bash
git add src/render/projectile.ts src/main.ts
git commit -m "feat: projectile scene"
```

---

### Task 11: Deflection scene

**Files:**
- Create: `src/render/deflection.ts`
- Modify: `src/main.ts` (replace the deflection placeholder)

**Interfaces:**
- Consumes: same shared modules; `PLATES`, `DOMAINS.deflection` from `scenes.ts`.
- Produces: `export const createDeflectionScene: (store: Store) => SceneRenderer`.

Drawing spec (world x 0..10, y -3..3): two plate rectangles at
`y = +-PLATES.gap / 2`, x from `PLATES.x0` to `PLATES.x0 + plateLength`, top plate
colored by sign (`--danger` when it attracts the particle upward is wrong physics - color
the plates by their charge: with `sign = +1` the force is +y, so the BOTTOM plate is
positive (red) and the top negative (blue); swap when sign flips); 5 vertical E-field
arrows between the plates pointing along the force on a positive particle; vertical
screen line at `PLATES.screenX` with an impact dot where the sim ends
(`stopReason === 'screen'`); ghost polyline + time ticks every 0.25 s; draggable v0
arrowhead at `(0.2 + v0, 0)` (horizontal only: ignore the y of the drag); playback
particle with v/a overlay arrows (arrow scale 1). Controls: sliders
field a 0..3 step 0.01, plate length 1..6 step 0.1, v0 1..5 step 0.1 (slider mirrors
the draggable arrow), and a `buttonRow(['flip charge'])` toggling `sign`.

- [ ] **Step 1: Implement the renderer**

`src/render/deflection.ts`:
```ts
import { duration, sampleAt } from '../physics/trajectory'
import { add, v, type Vec2 } from '../physics/vec2'
import { DOMAINS, PLATES } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, buttonRow, sliderRow, type Handle } from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const createDeflectionScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let refreshRows: () => void = () => {}

  const vp = (): Viewport =>
    ({ world: DOMAINS.deflection, w: canvas.clientWidth, h: canvas.clientHeight })

  const handles = (): Handle[] => {
    const d = store.get().deflection
    return [{ id: 'v0', pos: toScreen(vp(), v(0.2 + d.v0, 0)), radius: 12 }]
  }

  const arrow = (from: Vec2, to: Vec2, color: string) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    const ang = Math.atan2(to.y - from.y, to.x - from.x)
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - 9 * Math.cos(ang - 0.4), to.y - 9 * Math.sin(ang - 0.4))
    ctx.lineTo(to.x - 9 * Math.cos(ang + 0.4), to.y - 9 * Math.sin(ang + 0.4))
    ctx.closePath(); ctx.fill()
  }

  const render = () => {
    refreshRows()
    const s = store.get()
    const d = s.deflection
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const x0 = PLATES.x0
    const x1 = PLATES.x0 + d.plateLength
    const yTop = PLATES.gap / 2
    // force on the particle is d.sign * a in +y; field arrows follow it,
    // the plate the force points AWAY from is the positive (red) one
    const topColor = d.sign > 0 ? css('--accent') : css('--danger')
    const botColor = d.sign > 0 ? css('--danger') : css('--accent')
    const plate = (y: number, color: string) => {
      const a = toScreen(vp(), v(x0, y))
      const b = toScreen(vp(), v(x1, y))
      ctx.fillStyle = color
      ctx.fillRect(a.x, a.y - 3, b.x - a.x, 6)
    }
    plate(yTop, topColor)
    plate(-yTop, botColor)

    for (let i = 0; i < 5; i++) {
      const x = x0 + ((i + 0.5) / 5) * d.plateLength
      const from = toScreen(vp(), v(x, -yTop * 0.7 * d.sign))
      const to = toScreen(vp(), v(x, yTop * 0.7 * d.sign))
      arrow(from, to, css('--dim'))
    }

    const sc0 = toScreen(vp(), v(PLATES.screenX, -3))
    const sc1 = toScreen(vp(), v(PLATES.screenX, 3))
    ctx.strokeStyle = css('--fg'); ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(sc0.x, sc0.y); ctx.lineTo(sc1.x, sc1.y); ctx.stroke()

    ctx.strokeStyle = css('--ghost'); ctx.lineWidth = 2
    ctx.beginPath()
    s.sim.samples.forEach((smp, i) => {
      const p = toScreen(vp(), smp.pos)
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.fillStyle = css('--ghost')
    for (let t = 0; t <= duration(s.sim); t += 0.25) {
      const q = toScreen(vp(), sampleAt(s.sim.samples, t).pos)
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, 2 * Math.PI); ctx.fill()
    }
    if (s.sim.stopReason === 'screen') {
      const hit = toScreen(vp(), s.sim.samples[s.sim.samples.length - 1].pos)
      ctx.fillStyle = css('--danger')
      ctx.beginPath(); ctx.arc(hit.x, hit.y, 5, 0, 2 * Math.PI); ctx.fill()
    }

    arrow(toScreen(vp(), v(0.2, 0)), toScreen(vp(), v(0.2 + d.v0, 0)), css('--accent'))

    const cur = sampleAt(s.sim.samples, s.playback.t)
    const curPx = toScreen(vp(), cur.pos)
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(curPx.x, curPx.y, 6, 0, 2 * Math.PI); ctx.fill()
    if (s.overlays.v) arrow(curPx, toScreen(vp(), add(cur.pos, cur.vel)), css('--accent'))
    if (s.overlays.a) arrow(curPx, toScreen(vp(), add(cur.pos, cur.acc)), css('--danger'))
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      const rows = [
        sliderRow('field a = qE/m', 0, 3, 0.01,
          () => store.get().deflection.a, (a) => store.patchDeflection({ a })),
        sliderRow('plate length L', 1, 6, 0.1,
          () => store.get().deflection.plateLength,
          (plateLength) => store.patchDeflection({ plateLength })),
        sliderRow('entry speed v0', 1, 5, 0.1,
          () => store.get().deflection.v0, (v0) => store.patchDeflection({ v0 })),
      ]
      controls.append(...rows.map((r) => r.el),
        buttonRow(['flip charge'], () =>
          store.patchDeflection({ sign: store.get().deflection.sign > 0 ? -1 : 1 })))
      refreshRows = () => rows.forEach((r) => r.refresh())
      root.append(canvas, controls)
      attachDrag(canvas, handles, (_id, screenPos) => {
        const w = toWorld(vp(), screenPos)
        store.patchDeflection({ v0: Math.min(5, Math.max(1, w.x - 0.2)) })
      })
    },
    unmount: () => { canvas.remove(); controls.remove() },
    render,
  }
}
```

Wire into `main.ts`: `deflection: createDeflectionScene(store)`.

- [ ] **Step 2: Visual check**

Run: `npm run dev`, Deflection tab. Verify: straight line before the plates, parabola
between them, straight tangent line after, impact dot on the screen; flip charge
mirrors the curve and swaps plate colors and arrows; longer plates bend more; faster
v0 bends less; playback shows a constant between the plates and zero outside.

- [ ] **Step 3: Full tests + build**

Run: `npm test` and `npm run build` -> green.

- [ ] **Step 4: Commit**

```bash
git add src/render/deflection.ts src/main.ts
git commit -m "feat: uniform-field deflection scene"
```

---

### Task 12: Charges scene

**Files:**
- Create: `src/render/charges.ts`
- Modify: `src/main.ts` (replace the charges placeholder)

**Interfaces:**
- Consumes: shared modules; `fieldLines`, `equipotentials`, `potentialAt` from
  `fields.ts`; charge mutators from the Store.
- Produces: `export const createChargesScene: (store: Store) => SceneRenderer`.

Drawing spec (world -4..4 square): equipotential segments (`--dim`, alpha 0.5, levels
`[-2, -1, -0.5, -0.25, 0.25, 0.5, 1, 2]`, grid 120x120) and field lines (`--dim`,
alpha 0.8) - BOTH cached, recomputed only when `revision` changes; charges as filled
circles radius 12 px, `--danger` for q > 0 and `--accent` for q < 0, with `+`/`-` and
`|q|` label, selected charge ringed; test charge: white dot + velocity arrowhead handle;
ghost trajectory + time ticks every 0.5 s; playback particle with v/a arrows (arrow
scale 1). Interactions: drag a charge to move it; tap empty space to add a charge with
the toolbar's sign; select by tapping a charge (attachDrag's onDrag fires on
pointerdown, so 'select on drag start' is enough - `store.selectCharge` on first drag
event of a charge handle); controls sidebar: `buttonRow(['add +', 'add -'])` sets a
`nextSign` local; when a charge is selected, a `|q|` slider 1..5 step 1 and a delete
button appear (rebuild the sidebar on render when selection changed - cheap DOM);
`buttonRow(['flip test charge'])` toggles `testSign`; vecRow text fields cover the
test charge's start and velocity (its draggables' paired text inputs).

- [ ] **Step 1: Implement the renderer**

`src/render/charges.ts`:
```ts
import { equipotentials, fieldLines, type Segment } from '../physics/fields'
import { duration, sampleAt } from '../physics/trajectory'
import { add, v, type Vec2 } from '../physics/vec2'
import { DOMAINS } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, buttonRow, sliderRow, vecRow, type ControlRow, type Handle }
  from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const LEVELS = [-2, -1, -0.5, -0.25, 0.25, 0.5, 1, 2]

export const createChargesScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let nextSign: 1 | -1 = 1
  let lastSelected: number | null | undefined
  let cache: { rev: number; lines: Vec2[][]; equis: Segment[] } | null = null

  const vp = (): Viewport =>
    ({ world: DOMAINS.charges, w: canvas.clientWidth, h: canvas.clientHeight })

  const fieldCache = () => {
    const s = store.get()
    if (!cache || cache.rev !== s.revision) {
      cache = {
        rev: s.revision,
        lines: fieldLines(s.charges.charges, { bounds: DOMAINS.charges }),
        equis: equipotentials(s.charges.charges, LEVELS,
          { ...DOMAINS.charges, nx: 120, ny: 120 }),
      }
    }
    return cache
  }

  const handles = (): Handle[] => {
    const c = store.get().charges
    const hs: Handle[] = c.charges.map((ch, i) =>
      ({ id: `charge:${i}`, pos: toScreen(vp(), ch.pos), radius: 14 }))
    hs.push({ id: 'testPos', pos: toScreen(vp(), c.testPos), radius: 10 })
    hs.push({ id: 'testVel', pos: toScreen(vp(), add(c.testPos, c.testVel)), radius: 12 })
    return hs
  }

  const arrow = (from: Vec2, to: Vec2, color: string) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    const ang = Math.atan2(to.y - from.y, to.x - from.x)
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - 9 * Math.cos(ang - 0.4), to.y - 9 * Math.sin(ang - 0.4))
    ctx.lineTo(to.x - 9 * Math.cos(ang + 0.4), to.y - 9 * Math.sin(ang + 0.4))
    ctx.closePath(); ctx.fill()
  }

  let rows: ControlRow[] = []
  const rebuildControls = () => {
    const c = store.get().charges
    controls.innerHTML = ''
    rows = [
      vecRow('test start (x, y)', () => store.get().charges.testPos,
        (testPos) => store.setTestCharge({ testPos })),
      vecRow('test velocity (vx, vy)', () => store.get().charges.testVel,
        (testVel) => store.setTestCharge({ testVel })),
    ]
    controls.append(
      buttonRow(['add +', 'add -'], (i) => { nextSign = i === 0 ? 1 : -1 }),
      buttonRow(['flip test charge'], () =>
        store.setTestCharge({ testSign: store.get().charges.testSign > 0 ? -1 : 1 })),
      ...rows.map((r) => r.el),
    )
    if (c.selected !== null && c.charges[c.selected]) {
      const i = c.selected
      const qRow = sliderRow('|q| of selected', 1, 5, 1,
        () => Math.abs(store.get().charges.charges[i].q),
        (q) => store.setChargeQ(i, Math.sign(store.get().charges.charges[i].q) * q))
      rows.push(qRow)
      controls.append(qRow.el,
        buttonRow(['delete charge'], () => store.deleteCharge(i)))
    }
    const hint = document.createElement('label')
    hint.textContent = 'tap empty space to add, drag charges to move'
    controls.appendChild(hint)
  }

  const render = () => {
    const s = store.get()
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    if (lastSelected !== s.charges.selected) {
      lastSelected = s.charges.selected
      rebuildControls()
    }
    rows.forEach((r) => r.refresh())
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const fc = fieldCache()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = css('--dim'); ctx.lineWidth = 1
    for (const [a, b] of fc.equis) {
      const pa = toScreen(vp(), a); const pb = toScreen(vp(), b)
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke()
    }
    ctx.globalAlpha = 0.8
    for (const line of fc.lines) {
      ctx.beginPath()
      line.forEach((p, i) => {
        const q = toScreen(vp(), p)
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y)
      })
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    ctx.strokeStyle = css('--ghost'); ctx.lineWidth = 2
    ctx.beginPath()
    s.sim.samples.forEach((smp, i) => {
      const p = toScreen(vp(), smp.pos)
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.fillStyle = css('--ghost')
    for (let t = 0; t <= duration(s.sim); t += 0.5) {
      const q = toScreen(vp(), sampleAt(s.sim.samples, t).pos)
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, 2 * Math.PI); ctx.fill()
    }

    s.charges.charges.forEach((ch, i) => {
      const p = toScreen(vp(), ch.pos)
      ctx.fillStyle = ch.q > 0 ? css('--danger') : css('--accent')
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 2 * Math.PI); ctx.fill()
      ctx.fillStyle = css('--bg')
      ctx.font = 'bold 13px system-ui'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText((ch.q > 0 ? '+' : '−') + Math.abs(ch.q), p.x, p.y)
      if (s.charges.selected === i) {
        ctx.strokeStyle = css('--fg'); ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 2 * Math.PI); ctx.stroke()
      }
    })
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'

    const tp = toScreen(vp(), s.charges.testPos)
    arrow(tp, toScreen(vp(), add(s.charges.testPos, s.charges.testVel)), css('--accent'))
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(tp.x, tp.y, 5, 0, 2 * Math.PI); ctx.fill()

    const cur = sampleAt(s.sim.samples, s.playback.t)
    const curPx = toScreen(vp(), cur.pos)
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(curPx.x, curPx.y, 6, 0, 2 * Math.PI); ctx.fill()
    if (s.overlays.v) arrow(curPx, toScreen(vp(), add(cur.pos, cur.vel)), css('--accent'))
    if (s.overlays.a) arrow(curPx, toScreen(vp(), add(cur.pos, cur.acc)), css('--danger'))
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      rebuildControls()
      root.append(canvas, controls)
      attachDrag(canvas, handles,
        (id, screenPos) => {
          const w = toWorld(vp(), screenPos)
          if (id.startsWith('charge:')) {
            const i = Number(id.slice(7))
            if (store.get().charges.selected !== i) store.selectCharge(i)
            store.moveCharge(i, w)
          } else if (id === 'testPos') store.setTestCharge({ testPos: w })
          else if (id === 'testVel') {
            const c = store.get().charges
            store.setTestCharge({ testVel: v(w.x - c.testPos.x, w.y - c.testPos.y) })
          }
        },
        (screenPos) => {
          const w = toWorld(vp(), screenPos)
          store.selectCharge(null)
          store.addCharge(w, nextSign)
        })
    },
    unmount: () => { canvas.remove(); controls.remove() },
    render,
  }
}
```

Wire into `main.ts`: `charges: createChargesScene(store)`.

- [ ] **Step 2: Visual check**

Run: `npm run dev`, Charges tab. Verify: dipole field lines + concentric-ish
equipotentials for the default +1/-1 pair; dragging a charge updates lines live and
stays responsive (cache means the sim recompute dominates, not the field render);
tapping empty space adds a charge of the toolbar sign; selecting shows the |q| slider
and delete; the test-charge ghost bends around charges and terminates on capture;
playback follows the ghost with force arrow pointing along the local field
(times testSign).

- [ ] **Step 3: Full tests + build**

Run: `npm test` and `npm run build` -> green.

- [ ] **Step 4: Commit**

```bash
git add src/render/charges.ts src/main.ts
git commit -m "feat: electrostatic playground scene"
```

---

### Task 13: Orbits scene

**Files:**
- Create: `src/render/orbits.ts`
- Modify: `src/main.ts` (replace the orbits placeholder)

**Interfaces:**
- Consumes: shared modules; `orbital.ts` (all exports); `MU`, `DOMAINS.orbits`.
- Produces: `export const createOrbitsScene: (store: Store) => SceneRenderer`.

Drawing spec (world -4..4): central body at origin (filled circle radius 10 px,
`--danger`); escape-velocity ring: circle of radius `escapeVelocity(len(pos), MU)`
in arrow units centered on the satellite (the v-arrowhead crossing this ring IS the
escape threshold - `--dim` dashed); ghost trajectory + time ticks every 0.25 s;
conic label (`ellipse` / `parabola` / `hyperbola`) top-left with periapsis `rp` and
apoapsis `ra` (or `escape`) via `fmt`; periapsis/apoapsis markers: hollow dots at the
samples with min/max `len(pos)` (ellipse only); foci: the origin and the empty focus
at `scale(norm(eccVector(st, MU)), -2 * a * e)` (small crosses, ellipse only);
equal-area sweep during playback:
shade the polygon fan from the origin through samples in `[t - 0.8, t]` (fillStyle
`--accent`, alpha 0.25); playback particle + v/a arrows. Interactions: drag satellite
position and velocity arrowhead. Controls: vecRow x/y text fields for satellite
position and velocity (the draggables' paired text inputs) plus a hint label
"drag the satellite and its velocity arrow".

- [ ] **Step 1: Implement the renderer**

`src/render/orbits.ts`:
```ts
import {
  conicType, eccVector, eccentricity, escapeVelocity, periapsisApoapsis, semiMajorAxis,
  specificEnergy,
} from '../physics/orbital'
import { duration, sampleAt } from '../physics/trajectory'
import { add, len, norm, scale, v, type Vec2 } from '../physics/vec2'
import { DOMAINS, MU } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, vecRow, type Handle } from '../ui/controls'
import { fmt } from '../ui/panel'
import { toScreen, toWorld, type Viewport } from './viewport'

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const createOrbitsScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let refreshRows: () => void = () => {}

  const vp = (): Viewport =>
    ({ world: DOMAINS.orbits, w: canvas.clientWidth, h: canvas.clientHeight })

  const handles = (): Handle[] => {
    const o = store.get().orbits
    return [
      { id: 'pos', pos: toScreen(vp(), o.pos), radius: 10 },
      { id: 'vel', pos: toScreen(vp(), add(o.pos, o.vel)), radius: 12 },
    ]
  }

  const arrow = (from: Vec2, to: Vec2, color: string) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    const ang = Math.atan2(to.y - from.y, to.x - from.x)
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - 9 * Math.cos(ang - 0.4), to.y - 9 * Math.sin(ang - 0.4))
    ctx.lineTo(to.x - 9 * Math.cos(ang + 0.4), to.y - 9 * Math.sin(ang + 0.4))
    ctx.closePath(); ctx.fill()
  }

  const render = () => {
    refreshRows()
    const s = store.get()
    const o = s.orbits
    const st = { pos: o.pos, vel: o.vel }
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const origin = toScreen(vp(), v(0, 0))
    ctx.fillStyle = css('--danger')
    ctx.beginPath(); ctx.arc(origin.x, origin.y, 10, 0, 2 * Math.PI); ctx.fill()

    ctx.strokeStyle = css('--ghost'); ctx.lineWidth = 2
    ctx.beginPath()
    s.sim.samples.forEach((smp, i) => {
      const p = toScreen(vp(), smp.pos)
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.fillStyle = css('--ghost')
    for (let t = 0; t <= duration(s.sim); t += 0.25) {
      const q = toScreen(vp(), sampleAt(s.sim.samples, t).pos)
      ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, 2 * Math.PI); ctx.fill()
    }

    if (s.playback.playing || s.playback.t > 0) {
      const t1 = s.playback.t
      const t0 = Math.max(0, t1 - 0.8)
      ctx.fillStyle = css('--accent')
      ctx.globalAlpha = 0.25
      ctx.beginPath()
      ctx.moveTo(origin.x, origin.y)
      for (let t = t0; t <= t1; t += 0.02) {
        const p = toScreen(vp(), sampleAt(s.sim.samples, t).pos)
        ctx.lineTo(p.x, p.y)
      }
      ctx.closePath(); ctx.fill()
      ctx.globalAlpha = 1
    }

    const e = eccentricity(st, MU)
    const kind = conicType(e)
    const { rp, ra } = periapsisApoapsis(st, MU)
    ctx.fillStyle = css('--fg')
    ctx.font = '13px ui-monospace, monospace'
    ctx.fillText(`${kind}  rp = ${fmt(rp)}  ${ra === null ? 'escape' : 'ra = ' + fmt(ra)}`,
      12, 20)
    ctx.fillText(`ε = ${fmt(specificEnergy(st, MU))}`, 12, 38)

    if (kind === 'ellipse') {
      let pMin = s.sim.samples[0]
      let pMax = s.sim.samples[0]
      for (const smp of s.sim.samples) {
        if (len(smp.pos) < len(pMin.pos)) pMin = smp
        if (len(smp.pos) > len(pMax.pos)) pMax = smp
      }
      for (const smp of [pMin, pMax]) {
        const p = toScreen(vp(), smp.pos)
        ctx.strokeStyle = css('--fg'); ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI); ctx.stroke()
      }
      const a = semiMajorAxis(st, MU)
      const emptyFocus = scale(norm(eccVector(st, MU)), -2 * a * e)
      for (const f of [v(0, 0), emptyFocus]) {
        const p = toScreen(vp(), f)
        ctx.strokeStyle = css('--dim'); ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x + 5, p.y)
        ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x, p.y + 5)
        ctx.stroke()
      }
    }

    const posPx = toScreen(vp(), o.pos)
    const vEsc = escapeVelocity(len(o.pos), MU)
    const ringPx = toScreen(vp(), add(o.pos, v(vEsc, 0)))
    ctx.strokeStyle = css('--dim'); ctx.setLineDash([4, 4]); ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(posPx.x, posPx.y, Math.hypot(ringPx.x - posPx.x, ringPx.y - posPx.y),
      0, 2 * Math.PI)
    ctx.stroke()
    ctx.setLineDash([])

    arrow(posPx, toScreen(vp(), add(o.pos, o.vel)), css('--accent'))
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(posPx.x, posPx.y, 5, 0, 2 * Math.PI); ctx.fill()

    const cur = sampleAt(s.sim.samples, s.playback.t)
    const curPx = toScreen(vp(), cur.pos)
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(curPx.x, curPx.y, 6, 0, 2 * Math.PI); ctx.fill()
    if (s.overlays.v) arrow(curPx, toScreen(vp(), add(cur.pos, cur.vel)), css('--accent'))
    if (s.overlays.a) arrow(curPx, toScreen(vp(), add(cur.pos, cur.acc)), css('--danger'))
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      const rows = [
        vecRow('position (x, y)', () => store.get().orbits.pos,
          (pos) => store.patchOrbits({ pos })),
        vecRow('velocity (vx, vy)', () => store.get().orbits.vel,
          (vel) => store.patchOrbits({ vel })),
      ]
      controls.append(...rows.map((r) => r.el))
      refreshRows = () => rows.forEach((r) => r.refresh())
      const hint = document.createElement('label')
      hint.textContent = 'drag the satellite and its velocity arrow'
      controls.appendChild(hint)
      root.append(canvas, controls)
      attachDrag(canvas, handles, (id, screenPos) => {
        const w = toWorld(vp(), screenPos)
        if (id === 'pos') store.patchOrbits({ pos: w })
        else {
          const o = store.get().orbits
          store.patchOrbits({ vel: v(w.x - o.pos.x, w.y - o.pos.y) })
        }
      })
    },
    unmount: () => { canvas.remove(); controls.remove() },
    render,
  }
}
```

Wire into `main.ts`: `orbits: createOrbitsScene(store)`.

- [ ] **Step 2: Visual check**

Run: `npm run dev`, Orbits tab. Verify: default state draws a closed ellipse traced ~3
times (overdraw is invisible - fine); label reads ellipse with rp/ra; two focus crosses,
one on the central body; dragging the v arrowhead across the dashed ring flips the label
to hyperbola and the ghost opens; playback shows the satellite fast at periapsis, slow
at apoapsis, with the shaded swept wedge visibly constant in area; a pointing at the
central body always.

- [ ] **Step 3: Full tests + build**

Run: `npm test` and `npm run build` -> green.

- [ ] **Step 4: Commit**

```bash
git add src/render/orbits.ts src/main.ts
git commit -m "feat: orbits scene with conic overlays and equal-area sweep"
```

---

### Task 14: Deploy workflow + README

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md` (replace the stub)

**Interfaces:** none (infrastructure + docs).

- [ ] **Step 1: Copy the sibling deploy workflow**

`.github/workflows/deploy.yml` (verbatim from `../complex-visualization`):
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Write the README**

`README.md`:
```markdown
# Motion in Force Fields

Interactive kinematics teaching site: the same particle, the same integrator, four
different force laws. Drag initial conditions, watch the predicted trajectory redraw
instantly, then press play.

## The four scenes

- **Projectile** - a ball in uniform gravity (SI units): drag the launch velocity,
  toggle air drag against a dashed ideal reference, let it bounce with restitution.
- **Deflection** - a charged particle between capacitor plates: the same parabola as
  the projectile (a uniform field is a uniform field), then a straight line to the
  screen. Enforced by a unit test, not just claimed.
- **Charges** - an electrostatic playground: place up to 8 charges, watch field lines
  and equipotentials rebuild live, launch a test charge through the mess.
- **Orbits** - one satellite around one heavy body: energy sign decides ellipse or
  escape, Kepler's equal areas shaded during playback.

## Quick start

    npm install
    npm run dev       # dev server on :5173
    npm test          # vitest over the physics core
    npm run build     # production build in dist/

## How it works

One RK4 integrator (`src/physics/integrate.ts`) steps `{pos, vel}` under a pluggable
force law (`src/physics/forces.ts`). `simulate()` produces a sampled trajectory with
stop conditions (ground, screen, bounds, capture); the ghost path and the playback
animation read the same samples, so they can never disagree. Orbit overlays (conic
type, foci, apsides, escape ring) are computed analytically from the state; the
1/r^2 laws are softened by (r^2 + 0.05^2) so close encounters stay finite.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: vitest, Vite build, GitHub
Pages deploy. One-time setup: repository Settings -> Pages -> Source: GitHub Actions.
```

- [ ] **Step 3: Full tests + build**

Run: `npm test` and `npm run build` -> green.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "feat: GitHub Pages deploy workflow and README"
```

---

### Task 15: Final verification + smart-commit

- [ ] **Step 1: Full verification**

Run: `npm test` -> all suites pass. Run: `npm run build` -> green. Run: `npm run dev`
and click through all four tabs, drag every handle, play every scene once.

- [ ] **Step 2: Invoke the smart-commit skill**

Invoke the `smart-commit` skill and tell it to take the whole git branch
(`feature/kinematics-scene-design`) into account: it syncs CLAUDE.md and README.md
with everything the branch built (the CLAUDE.md "Status: greenfield" section is now
false and must be rewritten to describe the real architecture), then commits.
Do not push.
