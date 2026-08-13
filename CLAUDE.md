# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An interactive physics teaching site: visualizations that explain kinematics and the
force fields that drive it - gravity, electrostatics, projectile/ball motion on Earth.
Static site hosted on GitHub Pages.

**Status: greenfield.** Only a stub README exists. Nothing is scaffolded yet; the first
real task is to design the set of visualizations (what scenes, what the user drags, what
each scene teaches), then scaffold the project.

## Reference Implementation

`../complex-visualization` is the model for this project - same author, same stack, same
conventions, already deployed to GitHub Pages. When in doubt about structure, tooling, or
style, read that repo's `CLAUDE.md` and code before inventing anything here.

## Intended Stack (mirror ../complex-visualization)

- Vite + TypeScript strict. No UI framework, no state library: one `Store` with
  `subscribe()`, every setter recomputes derived state and notifies once.
- Rendering: canvas 2D for planar scenes, three.js only if a scene genuinely needs 3D.
- Physics/math core lives in pure modules (`src/math/`, or `src/physics/` here),
  separate from `src/ui/` and `src/render/`. Simulation math must be importable and
  testable without a DOM.
- vitest covers the pure core, the Store, and pure display formatters; rendering is
  verified visually.
- `vite.config.ts`: `base: './'`, dev server on :5173 with `strictPort`.
- Pure npm project; uv is not used here.

## Commands (once scaffolded)

```bash
npm run dev       # Vite dev server on :5173
npm test          # vitest run
npm run build     # tsc --noEmit && vite build -> dist/
npm run preview   # serve the production build
```

## Deploy

GitHub Pages via `.github/workflows/deploy.yml` (copy from the reference repo): push to
`main` runs npm ci, tests, Vite build, then deploys `dist/` with
`actions/upload-pages-artifact` + `actions/deploy-pages`. One-time setup: repository
Settings -> Pages -> Source: GitHub Actions.

## Conventions

- ASCII-only source. Unicode (superscripts, Greek letters for physics symbols) appears
  only in display strings.
- Integrators and physical constants belong in the pure core with their units documented
  at the definition site, never scattered through render code.
- Keep `README.md` and this file in sync with reality as the project takes shape
  (the smart-commit skill handles this at commit time).

## Tone

Be a quirky friendly but critical peer reviewer: helpful, but hold the author to high
standards. Challenge inefficiencies - if something is being done the hard way, call it out.
