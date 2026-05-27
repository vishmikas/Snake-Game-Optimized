// ─── Pure game logic — zero network, zero React deps ──────────────────────────
// Ported 1-to-1 from GameService.java. All functions are pure (state in → state out).

export const COLS = 24;
export const ROWS = 24;

const POINTS_PER_LEVEL = 5;
const BASE_SPEED = 150;
const SPEED_REDUCTION = 10;
const MIN_SPEED = 60;

export const DIRECTIONS = { UP: "UP", DOWN: "DOWN", LEFT: "LEFT", RIGHT: "RIGHT" };
export const STATUS = { RUNNING: "RUNNING", GAME_OVER: "GAME_OVER", LEVEL_UP: "LEVEL_UP" };

// ── Helpers ────────────────────────────────────────────────────────────────────

function spawnApple(snake) {
  let pos;
  do {
    pos = [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)];
  } while (snake.some(([sx, sy]) => sx === pos[0] && sy === pos[1]));
  return pos;
}

function resolveDirection(current, requested) {
  if (!requested) return current;
  const opposites = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
  if (opposites[current] === requested) return current;
  return requested;
}

function moveHead([x, y], dir) {
  switch (dir) {
    case "UP":    return [x, y - 1];
    case "DOWN":  return [x, y + 1];
    case "LEFT":  return [x - 1, y];
    case "RIGHT": return [x + 1, y];
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Creates a fresh game state. Equivalent to GameService.newGame(). */
export function newGame(skin = "classic") {
  const startX = Math.floor(COLS / 2);
  const startY = Math.floor(ROWS / 2);
  const snake = Array.from({ length: 4 }, (_, i) => [startX - i, startY]);
  return {
    snake,
    apple: spawnApple(snake),
    direction: "RIGHT",
    status: STATUS.RUNNING,
    score: 0,
    level: 1,
    speed: BASE_SPEED,
    skin,
  };
}

/**
 * Advances the game by one tick. Returns a NEW state object (immutable update).
 * Equivalent to GameService.tick().
 */
export function tick(state, requestedDir) {
  if (state.status === STATUS.GAME_OVER) return state;

  const dir = resolveDirection(state.direction, requestedDir);
  const newHead = moveHead(state.snake[0], dir);

  // Wall collision
  if (newHead[0] < 0 || newHead[0] >= COLS || newHead[1] < 0 || newHead[1] >= ROWS) {
    return { ...state, direction: dir, status: STATUS.GAME_OVER };
  }

  // Self collision (skip last segment — it will move away)
  const body = state.snake.slice(0, state.snake.length - 1);
  if (body.some(([x, y]) => x === newHead[0] && y === newHead[1])) {
    return { ...state, direction: dir, status: STATUS.GAME_OVER };
  }

  const ateApple =
    newHead[0] === state.apple[0] && newHead[1] === state.apple[1];

  // Build new snake
  const newSnake = [newHead, ...state.snake];
  if (!ateApple) newSnake.pop();

  if (!ateApple) {
    // Normal move — reset LEVEL_UP status back to RUNNING if needed
    return {
      ...state,
      snake: newSnake,
      direction: dir,
      status: state.status === STATUS.LEVEL_UP ? STATUS.RUNNING : state.status,
    };
  }

  // Ate apple
  const newScore = state.score + 1;
  const newLevel = Math.floor(newScore / POINTS_PER_LEVEL) + 1;
  const leveledUp = newLevel !== state.level;
  const newSpeed = leveledUp
    ? Math.max(MIN_SPEED, BASE_SPEED - (newLevel - 1) * SPEED_REDUCTION)
    : state.speed;

  return {
    ...state,
    snake: newSnake,
    apple: spawnApple(newSnake),
    direction: dir,
    score: newScore,
    level: newLevel,
    speed: newSpeed,
    status: leveledUp ? STATUS.LEVEL_UP : STATUS.RUNNING,
  };
}
