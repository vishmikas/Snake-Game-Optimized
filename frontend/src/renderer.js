// ─── Renderer — dual-canvas, minimal redraws ──────────────────────────────────
// bgCanvas: grid + background, drawn ONCE and never again (unless skin changes).
// fgCanvas: snake + apple, cleared and redrawn every tick.

import { COLS, ROWS } from "./gameLogic.js";

export const CELL = 24;
export const CANVAS_PX = COLS * CELL; // 576px

export const SKINS = {
  classic: { head: "#22c55e", body: "#16a34a", apple: "#ef4444", bg: "#0a0a0a", grid: "#141414" },
  neon:    { head: "#00fff0", body: "#0891b2", apple: "#f0abfc", bg: "#0d0d1a", grid: "#131827" },
  fire:    { head: "#fbbf24", body: "#f97316", apple: "#a855f7", bg: "#1c0a00", grid: "#1e1005" },
};

/** Draw background + grid onto the bg canvas. Call once per skin change. */
export function drawBackground(bgCanvas, skinKey) {
  const colors = SKINS[skinKey];
  const ctx = bgCanvas.getContext("2d");
  const W = CANVAS_PX;
  const H = CANVAS_PX;

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 0.5;

  // Draw all vertical lines in a single path
  ctx.beginPath();
  for (let c = 0; c <= COLS; c++) {
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, H);
  }
  // Draw all horizontal lines in the same path
  for (let r = 0; r <= ROWS; r++) {
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(W, r * CELL);
  }
  ctx.stroke(); // Single stroke call — was 98 individual calls before
}

/** Draw snake + apple onto the fg canvas. Called every tick. */
export function drawGame(fgCanvas, gameState) {
  if (!gameState || !fgCanvas) return;

  const { snake, apple, skin } = gameState;
  const colors = SKINS[skin] ?? SKINS.classic;
  const ctx = fgCanvas.getContext("2d");

  ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);

  // ── Apple (glow only on apple — 1 shadow pass total) ──────────────────────
  ctx.shadowColor = colors.apple;
  ctx.shadowBlur = 14;
  ctx.fillStyle = colors.apple;
  ctx.beginPath();
  ctx.arc(
    apple[0] * CELL + CELL / 2,
    apple[1] * CELL + CELL / 2,
    CELL / 2 - 2,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.shadowBlur = 0; // Reset ONCE after apple

  // ── Snake body (no shadow — was a per-segment shadow before) ─────────────
  ctx.fillStyle = colors.body;
  for (let i = snake.length - 1; i >= 1; i--) {
    const [sx, sy] = snake[i];
    ctx.beginPath();
    ctx.roundRect(sx * CELL + 2, sy * CELL + 2, CELL - 4, CELL - 4, 3);
    ctx.fill();
  }

  // ── Head (single glow pass for the head only) ─────────────────────────────
  if (snake.length > 0) {
    const [hx, hy] = snake[0];
    ctx.shadowColor = colors.head;
    ctx.shadowBlur = 18;
    ctx.fillStyle = colors.head;
    ctx.beginPath();
    ctx.roundRect(hx * CELL + 1, hy * CELL + 1, CELL - 2, CELL - 2, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
