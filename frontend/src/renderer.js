import { COLS, ROWS } from "./gameLogic.js";

export const CELL = 24;
export const CANVAS_PX = COLS * CELL;

export const SKINS = {
  classic: {
    label: "Classic",
    head: "#22c55e",
    body: "#16a34a",
    apple: "#ef4444",
    bg: "#06110c",
    grid: "#12301e",
  },
  neon: {
    label: "Neon",
    head: "#00fff0",
    body: "#0891b2",
    apple: "#f0abfc",
    bg: "#08081c",
    grid: "#121a34",
  },
  fire: {
    label: "Fire",
    head: "#fbbf24",
    body: "#f97316",
    apple: "#a855f7",
    bg: "#1c0a00",
    grid: "#2b1507",
  },
  ocean: {
    label: "Ocean",
    head: "#38bdf8",
    body: "#2563eb",
    apple: "#facc15",
    bg: "#031525",
    grid: "#0c2a42",
  },
  candy: {
    label: "Candy",
    head: "#fb7185",
    body: "#f472b6",
    apple: "#34d399",
    bg: "#1a1022",
    grid: "#2d1d3d",
  },
};

export function drawBackground(bgCanvas, skinKey) {
  const colors = SKINS[skinKey] ?? SKINS.classic;
  const ctx = bgCanvas.getContext("2d");
  const W = CANVAS_PX;
  const H = CANVAS_PX;

  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, colors.bg);
  gradient.addColorStop(1, "#020617");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let c = 0; c <= COLS; c++) {
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, H);
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(W, r * CELL);
  }
  ctx.stroke();
}

export function drawGame(fgCanvas, gameState) {
  if (!gameState || !fgCanvas) return;

  const { snake, apple, skin } = gameState;
  const colors = SKINS[skin] ?? SKINS.classic;
  const ctx = fgCanvas.getContext("2d");

  ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);

  const pulse = 1 + Math.sin(Date.now() / 140) * 0.08;
  ctx.shadowColor = colors.apple;
  ctx.shadowBlur = 16;
  ctx.fillStyle = colors.apple;
  ctx.beginPath();
  ctx.arc(
    apple[0] * CELL + CELL / 2,
    apple[1] * CELL + CELL / 2,
    (CELL / 2 - 3) * pulse,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = colors.body;
  for (let i = snake.length - 1; i >= 1; i--) {
    const [sx, sy] = snake[i];
    const alpha = Math.max(0.48, 1 - i / (snake.length + 8));
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(sx * CELL + 2, sy * CELL + 2, CELL - 4, CELL - 4, 5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (snake.length > 0) {
    const [hx, hy] = snake[0];
    ctx.shadowColor = colors.head;
    ctx.shadowBlur = 20;
    ctx.fillStyle = colors.head;
    ctx.beginPath();
    ctx.roundRect(hx * CELL + 1, hy * CELL + 1, CELL - 2, CELL - 2, 7);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
    ctx.beginPath();
    ctx.arc(hx * CELL + CELL * 0.68, hy * CELL + CELL * 0.35, 2.2, 0, Math.PI * 2);
    ctx.arc(hx * CELL + CELL * 0.68, hy * CELL + CELL * 0.65, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
