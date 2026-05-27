// Pure Snake game logic — frontend-only, no backend requests.

export const COLS = 24;
export const ROWS = 24;

export const DIRECTIONS = { UP: "UP", DOWN: "DOWN", LEFT: "LEFT", RIGHT: "RIGHT" };
export const STATUS = { RUNNING: "RUNNING", GAME_OVER: "GAME_OVER", LEVEL_UP: "LEVEL_UP" };

export const DIFFICULTIES = {
  easy: {
    label: "Easy",
    description: "Relaxed pace for practice",
    baseSpeed: 180,
    speedReduction: 7,
    minSpeed: 85,
    pointsPerLevel: 6,
  },
  normal: {
    label: "Normal",
    description: "Balanced classic gameplay",
    baseSpeed: 140,
    speedReduction: 9,
    minSpeed: 65,
    pointsPerLevel: 5,
  },
  hard: {
    label: "Hard",
    description: "Fast reactions required",
    baseSpeed: 105,
    speedReduction: 8,
    minSpeed: 50,
    pointsPerLevel: 5,
  },
  insane: {
    label: "Insane",
    description: "Only for brave players",
    baseSpeed: 78,
    speedReduction: 6,
    minSpeed: 42,
    pointsPerLevel: 4,
  },
};

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
    case "UP": return [x, y - 1];
    case "DOWN": return [x, y + 1];
    case "LEFT": return [x - 1, y];
    case "RIGHT": return [x + 1, y];
    default: return [x, y];
  }
}

export function newGame({ skin = "classic", difficulty = "normal" } = {}) {
  const settings = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
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
    speed: settings.baseSpeed,
    skin,
    difficulty,
    lastAteApple: false,
  };
}

export function tick(state, requestedDir) {
  if (!state || state.status === STATUS.GAME_OVER) return state;

  const settings = DIFFICULTIES[state.difficulty] ?? DIFFICULTIES.normal;
  const dir = resolveDirection(state.direction, requestedDir);
  const newHead = moveHead(state.snake[0], dir);

  if (newHead[0] < 0 || newHead[0] >= COLS || newHead[1] < 0 || newHead[1] >= ROWS) {
    return { ...state, direction: dir, status: STATUS.GAME_OVER, lastAteApple: false };
  }

  const body = state.snake.slice(0, state.snake.length - 1);
  if (body.some(([x, y]) => x === newHead[0] && y === newHead[1])) {
    return { ...state, direction: dir, status: STATUS.GAME_OVER, lastAteApple: false };
  }

  const ateApple = newHead[0] === state.apple[0] && newHead[1] === state.apple[1];
  const newSnake = [newHead, ...state.snake];
  if (!ateApple) newSnake.pop();

  if (!ateApple) {
    return {
      ...state,
      snake: newSnake,
      direction: dir,
      status: state.status === STATUS.LEVEL_UP ? STATUS.RUNNING : state.status,
      lastAteApple: false,
    };
  }

  const newScore = state.score + 1;
  const newLevel = Math.floor(newScore / settings.pointsPerLevel) + 1;
  const leveledUp = newLevel !== state.level;
  const newSpeed = leveledUp
    ? Math.max(settings.minSpeed, settings.baseSpeed - (newLevel - 1) * settings.speedReduction)
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
    lastAteApple: true,
  };
}
