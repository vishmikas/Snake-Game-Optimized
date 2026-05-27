# 🐍 Snake Game — Optimized Edition

A fast, frontend-only Snake game built with React + Vite. No backend required.

## What Changed (Performance Optimizations)

### 1. Game logic moved to the frontend (`src/gameLogic.js`)
The original game sent the entire game state to a Spring Boot backend on every tick
(every 60–150ms), waited for a network round-trip, then rendered. On Render/Vercel
free tiers this added 50–300ms of latency per tick — making the game feel sluggish.

All game logic is now pure JavaScript running in the browser. `tick()` completes in
under 0.1ms instead of 50–300ms. The backend is no longer needed at all.

### 2. Dual-canvas rendering (`src/renderer.js`)
- **`bgCanvas`** — draws the background + grid **once** when the game starts (or skin changes).
  The grid never moves, so there's no reason to redraw all 98 lines every tick.
- **`fgCanvas`** — only the snake + apple are cleared and redrawn each tick.

### 3. Shadow blur reduced from per-segment to per-element
The original applied `shadowBlur` to every snake segment on every frame — a GPU blur
pass per segment. Now only the head and apple get a glow. Body segments use a flat fill.

### 4. Fixed `setInterval` drift
The original called `clearInterval` + `setInterval` after every single tick, causing
jitter. The interval is now only reset when the speed actually changes (on level-up).

### 5. Removed console.logs from hot path
`console.log` calls that ran ~10 times per second in production are removed.

---

## Project Structure

```
frontend/
├── src/
│   ├── gameLogic.js   ← Pure game engine (ported from GameService.java)
│   ├── renderer.js    ← Dual-canvas drawing (bg + fg layers)
│   ├── App.jsx        ← React UI + game loop
│   └── App.css        ← Styles
├── index.html
├── package.json
└── vite.config.js
```

## Deploy to Vercel

```bash
cd frontend
npm install
npm run build
# push to GitHub → connect to Vercel → done
```

No environment variables needed. No backend. No cold-start delays.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173
