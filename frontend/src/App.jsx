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
    // localStorage can be unavailable in private browsing modes.
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

  const beep = (frequency, duration, type = "sine", volume = 0.04) => {
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
    eat: () => beep(720, 0.07, "triangle", 0.045),
    level: () => {
      beep(520, 0.08, "sine", 0.035);
      setTimeout(() => beep(780, 0.09, "sine", 0.035), 80);
    },
    over: () => beep(130, 0.22, "sawtooth", 0.03),
    click: () => beep(360, 0.04, "triangle", 0.025),
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
  const [showPanel, setShowPanel] = useState(false);

  const colors = SKINS[skin] ?? SKINS.classic;
  const isBoardVisible = ["countdown", "playing", "paused", "gameover"].includes(screen);
  const score = displayState?.score ?? 0;
  const level = displayState?.level ?? 1;
  const isNewRecord = Boolean(score > 0 && score >= highScore);

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
      setTimeout(() => setScorePop(false), 360);
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
      setTimeout(() => setLevelFlash(false), 650);
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
    setShowPanel(false);
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
        countdownRef.current = setTimeout(nextStep, 580);
      } else {
        setCountdown(null);
        beginGame();
      }
    };

    countdownRef.current = setTimeout(nextStep, 580);
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
      <main className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="snake-mark">🐍</span>
            <div>
              <h1>Snake</h1>
              <p>Classic arcade game</p>
            </div>
          </div>

          <div className="scorebar" aria-label="Game stats">
            <div><span>Score</span><strong>{score}</strong></div>
            <div><span>Best</span><strong>{highScore}</strong></div>
            <div><span>Level</span><strong>{level}</strong></div>
          </div>
        </header>

        {screen === "menu" && (
          <section className="start-card" aria-label="Start game">
            <h2>Ready?</h2>
            <p>Eat the food. Avoid the wall. Beat your best score.</p>

            <div className="quick-settings">
              <label>
                Player
                <input
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Player"
                />
              </label>

              <label>
                Difficulty
                <select value={difficulty} onChange={(e) => chooseDifficulty(e.target.value)}>
                  {Object.entries(DIFFICULTIES).map(([key, item]) => (
                    <option key={key} value={key}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <button className="primary-btn" onClick={startCountdown}>Start Game</button>

            <div className="small-actions">
              <button onClick={() => setShowPanel((value) => !value)}>{showPanel ? "Hide" : "Show"} options</button>
              <button onClick={() => setMuted((value) => !value)}>{muted ? "Sound Off" : "Sound On"}</button>
            </div>

            {showPanel && (
              <div className="simple-panel">
                <div>
                  <h3>Theme</h3>
                  <div className="theme-row">
                    {Object.entries(SKINS).map(([key, item]) => (
                      <button
                        key={key}
                        className={`theme-dot ${skin === key ? "active" : ""}`}
                        style={{ background: item.head }}
                        onClick={() => chooseSkin(key)}
                        title={item.label}
                        aria-label={item.label}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3>Top Scores</h3>
                  {leaderboard.length === 0 ? (
                    <p className="muted-text">No scores yet.</p>
                  ) : (
                    <ol className="compact-leaderboard">
                      {leaderboard.slice(0, 3).map((entry, index) => (
                        <li key={`${entry.date}-${entry.score}-${index}`}>
                          <span>{index + 1}. {entry.name}</span>
                          <strong>{entry.score}</strong>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <p className="help-text">Controls: Arrow keys / WASD / swipe / mobile buttons. Space or P pauses.</p>
              </div>
            )}
          </section>
        )}

        {isBoardVisible && (
          <section className={`game-card ${screen === "gameover" ? "shake" : ""}`}>
            <div className="game-toolbar">
              <span>{DIFFICULTIES[displayState?.difficulty || difficulty].label}</span>
              <div>
                {screen === "playing" && <button onClick={pauseGame}>Pause</button>}
                {screen === "paused" && <button onClick={resumeGame}>Resume</button>}
                <button onClick={goMenu}>Menu</button>
              </div>
            </div>

            <div className="canvas-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <canvas ref={bgCanvasRef} width={CANVAS_PX} height={CANVAS_PX} className={`game-canvas bg-layer ${screen !== "playing" ? "dimmed" : ""}`} />
              <canvas ref={fgCanvasRef} width={CANVAS_PX} height={CANVAS_PX} className={`game-canvas fg-layer ${screen !== "playing" ? "dimmed" : ""}`} />

              {scorePop && <div className="score-pop">+1</div>}
              {levelFlash && <div className="level-flash">Level {level}</div>}
              {screen === "countdown" && <div className="center-overlay countdown">{countdown}</div>}

              {screen === "paused" && (
                <div className="center-panel">
                  <h2>Paused</h2>
                  <button className="primary-btn small" onClick={resumeGame}>Resume</button>
                </div>
              )}

              {screen === "gameover" && (
                <div className="center-panel">
                  <p className="result-kicker">{isNewRecord ? "New Best!" : "Game Over"}</p>
                  <h2>{score}</h2>
                  <p>Level {level}</p>
                  <div className="end-actions">
                    <button className="primary-btn small" onClick={startCountdown}>Again</button>
                    <button className="secondary-btn" onClick={goMenu}>Menu</button>
                  </div>
                </div>
              )}
            </div>

            <div className="below-game">
              <p>Use arrow keys or swipe. Press Space to pause.</p>
              <button onClick={() => setMuted((value) => !value)}>{muted ? "🔇" : "🔊"}</button>
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
      </main>
    </div>
  );
}
