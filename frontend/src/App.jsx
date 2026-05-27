import { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";
import { newGame, tick, STATUS, DIRECTIONS } from "./gameLogic.js";
import { drawBackground, drawGame, CANVAS_PX, SKINS } from "./renderer.js";

const DIR_MAP = {
  ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
  w: "UP",       s: "DOWN",        a: "LEFT",          d: "RIGHT",
};

export default function App() {
  const bgCanvasRef  = useRef(null); // static: grid + bg
  const fgCanvasRef  = useRef(null); // dynamic: snake + apple

  const [screen, setScreen]       = useState("menu");
  const [skin, setSkin]           = useState("classic");
  const [displayState, setDisplayState] = useState(null); // for React UI (score, level…)
  const [highScore, setHighScore] = useState(0);
  const [levelFlash, setLevelFlash] = useState(false);

  // Refs for the tight game loop — avoids stale closure captures
  const gameStateRef   = useRef(null);
  const pendingDirRef  = useRef(null);
  const tickRef        = useRef(null);
  const skinRef        = useRef(skin);
  const screenRef      = useRef(screen);
  const lastSpeedRef   = useRef(null);

  useEffect(() => { skinRef.current  = skin;   }, [skin]);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // ── Draw bg once when bg canvas mounts or skin changes ───────────────────
  useEffect(() => {
    if (bgCanvasRef.current) drawBackground(bgCanvasRef.current, skin);
  }, [skin]);

  // ── Draw fg whenever displayState updates ────────────────────────────────
  useEffect(() => {
    if (fgCanvasRef.current && displayState) {
      drawGame(fgCanvasRef.current, displayState);
    }
  }, [displayState]);

  // ── Core tick — runs entirely in JS, zero network ─────────────────────────
  const runTick = useCallback(() => {
    const current = gameStateRef.current;
    if (!current || current.status === STATUS.GAME_OVER) return;

    const dir   = pendingDirRef.current ?? current.direction;
    pendingDirRef.current = null;

    const next  = tick(current, dir);
    gameStateRef.current = next;

    // Batch React state update (score/level display only — canvas drawn separately)
    setDisplayState(next);

    if (next.status === STATUS.GAME_OVER) {
      setHighScore(h => Math.max(h, next.score));
      setScreen("gameover");
      clearInterval(tickRef.current);
      return;
    }

    if (next.status === STATUS.LEVEL_UP) {
      setLevelFlash(true);
      setTimeout(() => setLevelFlash(false), 800);
    }

    // FIX: only reset interval when speed actually changed (prevents drift)
    if (next.speed !== lastSpeedRef.current) {
      lastSpeedRef.current = next.speed;
      clearInterval(tickRef.current);
      tickRef.current = setInterval(runTick, next.speed);
    }
  }, []);

  const startGame = useCallback((selectedSkin) => {
    const activeSkin = selectedSkin ?? skinRef.current;
    clearInterval(tickRef.current);
    pendingDirRef.current = null;

    const state = newGame(activeSkin);
    gameStateRef.current  = state;
    lastSpeedRef.current  = state.speed;

    setDisplayState(state);
    setScreen("playing");

    // Draw bg for new skin immediately
    if (bgCanvasRef.current) drawBackground(bgCanvasRef.current, activeSkin);

    tickRef.current = setInterval(runTick, state.speed);
  }, [runTick]);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(tickRef.current), []);

  // ── Keyboard input ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (DIR_MAP[e.key]) {
        e.preventDefault();
        pendingDirRef.current = DIR_MAP[e.key];
      }
      if ((e.key === "r" || e.key === "R") && screenRef.current === "gameover") {
        startGame();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [startGame]);

  // ── Touch input ───────────────────────────────────────────────────────────
  const touchStart = useRef(null);
  const onTouchStart = (e) => { touchStart.current = e.touches[0]; };
  const onTouchEnd   = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.clientX;
    const dy = e.changedTouches[0].clientY - touchStart.current.clientY;
    pendingDirRef.current =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0 ? "RIGHT" : "LEFT"
        : dy > 0 ? "DOWN"  : "UP";
  };

  const colors = SKINS[skin];
  const isPlaying = screen === "playing" || screen === "gameover";

  return (
    <div className="app" style={{ "--head": colors.head, "--apple": colors.apple }}>
      <div className="glow-bg" />

      <header>
        <h1 className="logo">🐍 SNAKE</h1>
        {displayState && screen === "playing" && (
          <div className="hud">
            <span className="hud-item">SCORE <strong>{displayState.score}</strong></span>
            <span className="hud-item">BEST <strong>{highScore}</strong></span>
            <span className={`hud-item level-badge ${levelFlash ? "flash" : ""}`}>
              LVL <strong>{displayState.level}</strong>
            </span>
          </div>
        )}
      </header>

      <main>
        {/* ── Menu ── */}
        {screen === "menu" && (
          <div className="overlay">
            <p className="tagline">Classic game. Legendary hunger.</p>
            <div className="skin-picker">
              <p>Choose your skin</p>
              <div className="skins">
                {Object.entries(SKINS).map(([key, s]) => (
                  <button
                    key={key}
                    className={`skin-btn ${skin === key ? "active" : ""}`}
                    style={{ "--c": s.head }}
                    onClick={() => setSkin(key)}
                  >
                    <span className="skin-dot" style={{ background: s.head }} />
                    {key}
                  </button>
                ))}
              </div>
            </div>
            <button className="play-btn" onClick={() => startGame(skin)}>PLAY</button>
            <p className="hint">Arrow keys or WASD · Swipe on mobile</p>
          </div>
        )}

        {/* ── Dual-canvas game board (always mounted when playing/gameover) ── */}
        {isPlaying && (
          <div
            className="canvas-wrap"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Layer 1 — static grid, never cleared during gameplay */}
            <canvas
              ref={bgCanvasRef}
              width={CANVAS_PX}
              height={CANVAS_PX}
              className={`game-canvas bg-layer ${screen === "gameover" ? "dimmed" : ""}`}
            />
            {/* Layer 2 — snake + apple, cleared every tick */}
            <canvas
              ref={fgCanvasRef}
              width={CANVAS_PX}
              height={CANVAS_PX}
              className={`game-canvas fg-layer ${screen === "gameover" ? "dimmed" : ""}`}
            />

            {levelFlash && (
              <div className="level-flash">LEVEL {displayState?.level}!</div>
            )}

            {screen === "gameover" && (
              <div className="gameover-overlay">
                <h2>GAME OVER</h2>
                <p className="final-score">{displayState?.score} pts</p>
                {displayState?.score >= highScore && displayState?.score > 0 && (
                  <p className="new-record">🏆 New Record!</p>
                )}
                <div className="go-buttons">
                  <button className="play-btn small" onClick={() => startGame()}>PLAY AGAIN</button>
                  <button className="play-btn small outline" onClick={() => setScreen("menu")}>MENU</button>
                </div>
                <p className="hint">or press R</p>
              </div>
            )}
          </div>
        )}

        {/* ── Mobile D-pad ── */}
        {screen === "playing" && (
          <div className="dpad">
            <button className="dpad-btn" onClick={() => (pendingDirRef.current = "UP")}>▲</button>
            <div className="dpad-row">
              <button className="dpad-btn" onClick={() => (pendingDirRef.current = "LEFT")}>◀</button>
              <span />
              <button className="dpad-btn" onClick={() => (pendingDirRef.current = "RIGHT")}>▶</button>
            </div>
            <button className="dpad-btn" onClick={() => (pendingDirRef.current = "DOWN")}>▼</button>
          </div>
        )}
      </main>
    </div>
  );
}
