# 🐍 Snake Game — Optimized Edition

A fast, responsive, frontend-only Snake game built with **React + Vite**.  
The game is deployed on **Vercel** and does not require a backend server.

🔗 **Live Demo:**  
https://snake-game-optimized-8x1157dks-vishmikas-projects.vercel.app

---

## 📌 Project Overview

This project is an optimized version of a classic Snake game.  
The original version used a backend API for game movement, but this optimized version runs the full game engine directly in the browser for better speed, smoother gameplay, and easier deployment.

---

## ✨ Features

- Classic Snake gameplay
- Smooth frontend-only game loop
- No backend required
- Faster response time
- Keyboard controls
- Mobile-friendly controls
- Score tracking
- High score support
- Clean responsive UI
- Optimized canvas rendering
- Easy deployment with Vercel

---

## 🚀 Performance Improvements

### 1. Frontend-only game logic

The original version sent requests to a backend on every game tick.  
That caused unnecessary network delay and made the game feel slower, especially on free hosting platforms.

Now, all game logic runs inside the browser using JavaScript.

This includes:

- Snake movement
- Apple spawning
- Collision detection
- Score calculation
- Level/speed changes
- Game over detection

Because of this, the game is much faster and more reliable.

---

### 2. No backend cold starts

Since the game no longer depends on a Render backend, there are no backend cold-start delays.

The game loads directly from Vercel and starts immediately.

---

### 3. Optimized canvas rendering

The project uses optimized rendering logic to reduce unnecessary drawing work.

Main rendering files:

```txt
src/gameLogic.js
src/renderer.js