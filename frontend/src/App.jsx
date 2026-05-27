import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { DIFFICULTIES, newGame, STATUS, tick } from "./gameLogic.js";
import { CANVAS_PX, SKINS, drawBackground, drawGame } from "./renderer.js";

const DIR_MAP = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  w: "UP",
  W: "UP",
  s: "DOWN",
  S: "DOWN",
  a: "LEFT",
  A: "LEFT",
  d: "RIGHT",
  D: "RIGHT",
};

const STORAGE_KEYS = {
  best: "snake.bestScore.v2",
  leaderboard: "snake.leaderboard.v2",
  settings: "snake.settings.v2",
};

function readNumber(key, fallback = 0) {
  try {
    return Number(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in some private browsing modes.
  }
}

function SoundEngine() {
  const ctxRef = { current: null };
  const getCtx = () => {
    if (!ctxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  };

  const beep = (frequency, duration, type = "sine", volume = 0.045) => {
    const ctx = getCtx();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  };

  return {
    eat: () => beep(720, 0.07, "triangle", 0.05),
    level: () => {
      beep(520, 0.08, "sine", 0.04);
      setTimeout(() => beep(780, 0.09, "sine", 0.04), 80);
    },
    over: () => beep(130, 0.22, "sawtooth", 0.035),
    click: () => beep(360, 0.04, "triangle", 0.03),
  };
}

export default function App() {
  const savedSettings = readJson(STORAGE_KEYS.settings, {});

  const bgCanvasRef = useRef(null);
  const fgCanvasRef = useRef(null);
  const gameStateRef = useRef(null);
  const pendingDirRef = useRef(null);
  const tickRef = useRef(null);
  const countdownRef = useRef(null);
  const skinRef = useRef(savedSettings.skin || "classic");
  const difficultyRef = useRef(savedSettings.difficulty || "normal");
  const screenRef = useRef("menu");
  const lastSpeedRef = useRef(null);
  const touchStart = useRef(null);
  const soundRef = useRef(null);

  const [screen, setScreen] = useState("menu");
  const [skin, setSkin] = useState(savedSettings.skin || "classic");
  const [difficulty, setDifficulty] = useState(savedSettings.difficulty || "normal");
  const [displayState, setDisplayState] = useState(null);
  const [highScore, setHighScore] = useState(() => readNumber(STORAGE_KEYS.best, 0));
  const [leaderboard, setLeaderboard] = useState(() => readJson(STORAGE_KEYS.leaderboard, []));
  const [levelFlash, setLevelFlash] = useState(false);
  const [scorePop, setScorePop] = useState(false);
  const [muted, setMuted] = useState(Boolean(savedSettings.muted));
  const [playerName, setPlayerName] = useState(savedSettings.playerName || "Player");
  const [countdown, setCountdown] = useState(null);

  const colors = SKINS[skin] ?? SKINS.classic;
  const isBoardVisible = ["countdown", "playing", "paused", "gameover"].includes(screen);
  const isNewRecord = Boolean(displayState?.score > 0 && displayState.score >= highScore);

  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { skinRef.current = skin; }, [skin]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.settings, { skin, difficulty, muted, playerName });
  }, [skin, difficulty, muted, playerName]);

  useEffect(() => {
    if (bgCanvasRef.current) drawBackground(bgCanvasRef.current, skin);
  }, [skin, isBoardVisible]);

  useEffect(() => {
    if (fgCanvasRef.current && displayState) drawGame(fgCanvasRef.current, displayState);
  }, [displayState]);

  const playSound = useCallback((name) => {
    if (muted) return;
    if (!soundRef.current) soundRef.current = SoundEngine();
    soundRef.current[name]?.();
  }, [muted]);

  const vibrate = useCallback((pattern) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }, []);

  const saveScore = useCallback((state) => {
    const finalScore = state?.score ?? 0;
    const finalLevel = state?.level ?? 1;
    if (finalScore <= 0) return;

    setHighScore((currentBest) => {
      const nextBest = Math.max(currentBest, finalScore);
      try { localStorage.setItem(STORAGE_KEYS.best, String(nextBest)); } catch { /* noop */ }
      return nextBest;
    });

    setLeaderboard((current) => {
      const entry = {
        name: playerName.trim() || "Player",
        score: finalScore,
        level: finalLevel,
        skin: SKINS[state.skin]?.label || state.skin,
        difficulty: DIFFICULTIES[state.difficulty]?.label || state.difficulty,
        date: new Date().toLocaleDateString(),
      };
      const next = [entry, ...current]
        .sort((a, b) => b.score - a.score || b.level - a.level)
        .slice(0, 5);
      saveJson(STORAGE_KEYS.leaderboard, next);
      return next;
    });
  }, [playerName]);

  const clearTimers = useCallback(() => {
    clearInterval(tickRef.current);
    clearTimeout(countdownRef.current);
  }, []);

  const runTick = useCallback(() => {
    const current = gameStateRef.current;
    if (!current || current.status === STATUS.GAME_OVER || screenRef.current !== "playing") return;

    const dir = pendingDirRef.current ?? current.direction;
    pendingDirRef.current = null;

    const next = tick(current, dir);
    gameStateRef.current = next;
    setDisplayState(next);

    if (next.lastAteApple) {
      setScorePop(true);
      setTimeout(() => setScorePop(false), 420);
      playSound(next.status === STATUS.LEVEL_UP ? "level" : "eat");
      vibrate(next.status === STATUS.LEVEL_UP ? [40, 30, 40] : 18);
    }

    if (next.status === STATUS.GAME_OVER) {
      playSound("over");
      vibrate([80, 40, 100]);
      saveScore(next);
      setScreen("gameover");
      clearInterval(tickRef.current);
      return;
    }

    if (next.status === STATUS.LEVEL_UP) {
      setLevelFlash(true);
      setTimeout(() => setLevelFlash(false), 800);
    }

    if (next.speed !== lastSpeedRef.current) {
      lastSpeedRef.current = next.speed;
      clearInterval(tickRef.current);
      tickRef.current = setInterval(runTick, next.speed);
    }
  }, [playSound, saveScore, vibrate]);

  const beginGame = useCallback(() => {
    clearTimers();
    pendingDirRef.current = null;

    const state = newGame({ skin: skinRef.current, difficulty: difficultyRef.current });
    gameStateRef.current = state;
    lastSpeedRef.current = state.speed;

    setDisplayState(state);
    setLevelFlash(false);
    setScorePop(false);
    setScreen("playing");

    if (bgCanvasRef.current) drawBackground(bgCanvasRef.current, skinRef.current);
    tickRef.current = setInterval(runTick, state.speed);
  }, [clearTimers, runTick]);

  const startCountdown = useCallback(() => {
    playSound("click");
    clearTimers();
    const preview = newGame({ skin: skinRef.current, difficulty: difficultyRef.current });
    gameStateRef.current = preview;
    setDisplayState(preview);
    setScreen("countdown");

    const steps = ["3", "2", "1", "GO!"];
    let index = 0;
    setCountdown(steps[index]);

    const nextStep = () => {
      index += 1;
      if (index < steps.length) {
        setCountdown(steps[index]);
        countdownRef.current = setTimeout(nextStep, 650);
      } else {
        setCountdown(null);
        beginGame();
      }
    };

    countdownRef.current = setTimeout(nextStep, 650);
  }, [beginGame, clearTimers, playSound]);

  const pauseGame = useCallback(() => {
    if (screenRef.current !== "playing") return;
    playSound("click");
    clearInterval(tickRef.current);
    setScreen("paused");
  }, [playSound]);

  const resumeGame = useCallback(() => {
    if (screenRef.current !== "paused") return;
    playSound("click");
    setScreen("playing");
    const speed = gameStateRef.current?.speed ?? DIFFICULTIES[difficultyRef.current].baseSpeed;
    tickRef.current = setInterval(runTick, speed);
  }, [playSound, runTick]);

  const togglePause = useCallback(() => {
    if (screenRef.current === "playing") pauseGame();
    else if (screenRef.current === "paused") resumeGame();
  }, [pauseGame, resumeGame]);

  const goMenu = useCallback(() => {
    clearTimers();
    playSound("click");
    setScreen("menu");
  }, [clearTimers, playSound]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    const handler = (e) => {
      if (DIR_MAP[e.key] && screenRef.current === "playing") {
        e.preventDefault();
        pendingDirRef.current = DIR_MAP[e.key];
      }
      if ((e.code === "Space" || e.key === "p" || e.key === "P") && ["playing", "paused"].includes(screenRef.current)) {
        e.preventDefault();
        togglePause();
      }
      if ((e.key === "r" || e.key === "R") && screenRef.current === "gameover") {
        startCountdown();
      }
      if (e.key === "Enter" && screenRef.current === "menu") {
        startCountdown();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [startCountdown, togglePause]);

  const chooseSkin = (nextSkin) => {
    playSound("click");
    setSkin(nextSkin);
  };

  const chooseDifficulty = (nextDifficulty) => {
    playSound("click");
    setDifficulty(nextDifficulty);
  };

  const setDirection = (dir) => {
    if (screenRef.current !== "playing") return;
    pendingDirRef.current = dir;
    vibrate(8);
  };

  const onTouchStart = (e) => {
    touchStart.current = e.touches[0];
  };

  const onTouchEnd = (e) => {
    if (!touchStart.current || screenRef.current !== "playing") return;
    const dx = e.changedTouches[0].clientX - touchStart.current.clientX;
    const dy = e.changedTouches[0].clientY - touchStart.current.clientY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "RIGHT" : "LEFT") : (dy > 0 ? "DOWN" : "UP"));
  };

  return (
    <div className="app" style={{ "--head": colors.head, "--apple": colors.apple }}>
      <div className="glow-bg" />

      <header className="topbar">
        <div>
          <p className="eyebrow">Optimized Edition</p>
          <h1 className="logo">🐍 SNAKE</h1>
        </div>

        <div className="hud" aria-label="Game stats">
          <span className="hud-item">SCORE <strong>{displayState?.score ?? 0}</strong></span>
          <span className="hud-item">BEST <strong>{highScore}</strong></span>
          <span className={`hud-item level-badge ${levelFlash ? "flash" : ""}`}>LVL <strong>{displayState?.level ?? 1}</strong></span>
        </div>
      </header>

      <main className="layout">
        {screen === "menu" && (
          <section className="menu-card" aria-label="Start menu">
            <div className="hero-copy">
              <p className="tagline">Fast, responsive, browser-powered Snake.</p>
              <h2>Eat, grow, survive, and beat your best score.</h2>
              <p className="subtext">Choose a difficulty and skin, then use arrow keys, WASD, swipe gestures, or the mobile controls.</p>
            </div>

            <label className="name-field">
              Player name
              <input
                maxLength={16}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Player"
              />
            </label>

            <div className="option-block">
              <div className="section-title">
                <span>Difficulty</span>
                <small>{DIFFICULTIES[difficulty].description}</small>
              </div>
              <div className="difficulty-grid">
                {Object.entries(DIFFICULTIES).map(([key, item]) => (
                  <button key={key} className={`choice-btn ${difficulty === key ? "active" : ""}`} onClick={() => chooseDifficulty(key)}>
                    <strong>{item.label}</strong>
                    <span>{item.baseSpeed}ms start</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="option-block">
              <div className="section-title">
                <span>Theme</span>
                <small>Unlock a fresh feeling any time</small>
              </div>
              <div className="skins">
                {Object.entries(SKINS).map(([key, item]) => (
                  <button key={key} className={`skin-btn ${skin === key ? "active" : ""}`} style={{ "--c": item.head }} onClick={() => chooseSkin(key)}>
                    <span className="skin-dot" style={{ background: item.head }} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-actions">
              <button className="play-btn" onClick={startCountdown}>START GAME</button>
              <button className="icon-btn" onClick={() => setMuted((value) => !value)}>{muted ? "🔇" : "🔊"} Sound</button>
            </div>
          </section>
        )}

        {isBoardVisible && (
          <section className={`game-zone ${screen === "gameover" ? "shake" : ""}`}>
            <div className="board-toolbar">
              <span>{DIFFICULTIES[displayState?.difficulty || difficulty].label} Mode</span>
              <div className="toolbar-actions">
                {screen === "playing" && <button className="mini-btn" onClick={pauseGame}>Pause</button>}
                {screen === "paused" && <button className="mini-btn" onClick={resumeGame}>Resume</button>}
                <button className="mini-btn" onClick={goMenu}>Menu</button>
              </div>
            </div>

            <div className="canvas-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <canvas ref={bgCanvasRef} width={CANVAS_PX} height={CANVAS_PX} className={`game-canvas bg-layer ${screen !== "playing" ? "dimmed" : ""}`} />
              <canvas ref={fgCanvasRef} width={CANVAS_PX} height={CANVAS_PX} className={`game-canvas fg-layer ${screen !== "playing" ? "dimmed" : ""}`} />

              {scorePop && <div className="score-pop">+1</div>}
              {levelFlash && <div className="level-flash">LEVEL {displayState?.level}!</div>}

              {screen === "countdown" && <div className="center-overlay countdown">{countdown}</div>}

              {screen === "paused" && (
                <div className="center-panel">
                  <h2>Paused</h2>
                  <p>Press Space or tap resume to continue.</p>
                  <button className="play-btn small" onClick={resumeGame}>RESUME</button>
                </div>
              )}

              {screen === "gameover" && (
                <div className="center-panel gameover-panel">
                  <p className="result-kicker">{isNewRecord ? "New High Score!" : "Game Over"}</p>
                  <h2>{displayState?.score ?? 0} pts</h2>
                  <p>Level {displayState?.level ?? 1} · {DIFFICULTIES[displayState?.difficulty || difficulty].label}</p>
                  <div className="go-buttons">
                    <button className="play-btn small" onClick={startCountdown}>PLAY AGAIN</button>
                    <button className="play-btn small outline" onClick={goMenu}>CHANGE SETUP</button>
                  </div>
                  <p className="hint">Press R to restart</p>
                </div>
              )}
            </div>

            {screen === "playing" && (
              <div className="dpad" aria-label="Mobile controls">
                <button className="dpad-btn" onClick={() => setDirection("UP")}>▲</button>
                <div className="dpad-row">
                  <button className="dpad-btn" onClick={() => setDirection("LEFT")}>◀</button>
                  <button className="dpad-btn pause" onClick={togglePause}>Ⅱ</button>
                  <button className="dpad-btn" onClick={() => setDirection("RIGHT")}>▶</button>
                </div>
                <button className="dpad-btn" onClick={() => setDirection("DOWN")}>▼</button>
              </div>
            )}
          </section>
        )}

        <aside className="side-panel">
          <section className="info-card">
            <div className="section-title"><span>How to Play</span></div>
            <ul className="tips">
              <li>Eat food to grow and increase your score.</li>
              <li>Avoid walls and your own snake body.</li>
              <li>Use Arrow keys, WASD, swipe, or mobile buttons.</li>
              <li>Press Space or P to pause and resume.</li>
            </ul>
          </section>

          <section className="info-card">
            <div className="section-title"><span>Top Scores</span><small>Saved on this device</small></div>
            {leaderboard.length === 0 ? (
              <p className="empty">No scores yet. Start a game and set the first record.</p>
            ) : (
              <ol className="leaderboard">
                {leaderboard.map((entry, index) => (
                  <li key={`${entry.date}-${entry.score}-${index}`}>
                    <span className="rank">#{index + 1}</span>
                    <div>
                      <strong>{entry.name}</strong>
                      <small>{entry.difficulty} · {entry.skin} · {entry.date}</small>
                    </div>
                    <b>{entry.score}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
