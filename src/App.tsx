/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Trophy, RotateCcw, Play, Gamepad2 } from 'lucide-react';

// Web Audio API Sound Synthesizer (No external assets required)
class ArcadeAudio {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  public init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playFlap() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // AudioContext fallback
    }
  }

  public playScore() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Note 1
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.1);

      // Note 2
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.08);
      gain2.gain.setValueAtTime(0.2, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.26);
    } catch {
      // AudioContext fallback
    }
  }

  public playHit() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    } catch {
      // AudioContext fallback
    }
  }
}

const audio = new ArcadeAudio();

interface Pipe {
  x: number;
  topHeight: number;
  bottomY: number;
  bottomHeight: number;
  scored: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // UI state
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [currentScore, setCurrentScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('flappy_best_score') || '0', 10);
    }
    return 0;
  });
  const [isNewHigh, setIsNewHigh] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Internal mutable engine state (avoiding React re-renders during 60 FPS loop)
  const engineRef = useRef({
    state: 'START' as 'START' | 'PLAYING' | 'GAME_OVER',
    score: 0,
    highScore: 0,
    frameCount: 0,
    groundScroll: 0,
    screenShake: 0,
    bird: {
      x: 95,
      y: 260,
      radius: 15,
      velocity: 0,
      angle: 0,
      wingTimer: 0,
    },
    pipes: [] as Pipe[],
    particles: [] as Particle[],
    clouds: [
      { x: 30, y: 50, scale: 0.9, speed: 0.3 },
      { x: 220, y: 80, scale: 0.7, speed: 0.2 },
      { x: 340, y: 40, scale: 1.1, speed: 0.35 },
    ] as Cloud[],
  });

  // Keep engine ref synced with high score
  useEffect(() => {
    engineRef.current.highScore = highScore;
  }, [highScore]);

  // Handle Flap Action
  const triggerFlap = () => {
    audio.init();
    const eng = engineRef.current;

    if (eng.state === 'START') {
      startGame();
      return;
    }

    if (eng.state === 'PLAYING') {
      eng.bird.velocity = -6.8;
      eng.bird.angle = -0.42;

      // Add puff particles
      for (let i = 0; i < 4; i++) {
        eng.particles.push({
          x: eng.bird.x - 12 + Math.random() * 4,
          y: eng.bird.y + 4 + Math.random() * 4,
          vx: -1.5 - Math.random() * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          radius: 3 + Math.random() * 2,
          alpha: 0.8,
        });
      }

      audio.playFlap();
    }
  };

  const startGame = () => {
    audio.init();
    const eng = engineRef.current;
    eng.state = 'PLAYING';
    eng.score = 0;
    eng.pipes = [];
    eng.particles = [];
    eng.frameCount = 0;
    eng.bird.x = 95;
    eng.bird.y = 260;
    eng.bird.velocity = -6.8;
    eng.bird.angle = -0.42;
    eng.bird.wingTimer = 0;
    eng.screenShake = 0;

    setCurrentScore(0);
    setIsNewHigh(false);
    setGameState('PLAYING');
    audio.playFlap();
  };

  // Toggle Sound
  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    audio.init();
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  // Keyboard & Touch events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        triggerFlap();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main 60 FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const CANVAS_WIDTH = 400;
    const CANVAS_HEIGHT = 600;
    const GROUND_HEIGHT = 80;
    const PLAY_HEIGHT = CANVAS_HEIGHT - GROUND_HEIGHT;
    const PIPE_GAP = 142;
    const PIPE_WIDTH = 64;
    const PIPE_SPEED = 2.4;
    const PIPE_INTERVAL = 110;

    const render = () => {
      const eng = engineRef.current;
      eng.frameCount++;

      ctx.save();

      // Screen shake on hit
      if (eng.screenShake > 0) {
        const sx = (Math.random() - 0.5) * eng.screenShake;
        const sy = (Math.random() - 0.5) * eng.screenShake;
        ctx.translate(sx, sy);
        eng.screenShake *= 0.85;
        if (eng.screenShake < 0.5) eng.screenShake = 0;
      }

      // 1. Sky & Background
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, PLAY_HEIGHT);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.7, '#7dd3fc');
      skyGrad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      eng.clouds.forEach((c) => {
        if (eng.state === 'PLAYING') {
          c.x -= c.speed;
          if (c.x < -60) c.x = CANVAS_WIDTH + 40;
        }
        ctx.beginPath();
        ctx.arc(c.x, c.y, 18 * c.scale, 0, Math.PI * 2);
        ctx.arc(c.x + 18 * c.scale, c.y - 6 * c.scale, 22 * c.scale, 0, Math.PI * 2);
        ctx.arc(c.x + 40 * c.scale, c.y, 16 * c.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // City Skyline Silhouette
      ctx.save();
      ctx.fillStyle = '#93c5fd';
      ctx.globalAlpha = 0.45;
      const buildings = [
        { x: 0, w: 40, h: 60 },
        { x: 45, w: 35, h: 85 },
        { x: 85, w: 50, h: 45 },
        { x: 140, w: 30, h: 95 },
        { x: 175, w: 45, h: 70 },
        { x: 225, w: 55, h: 55 },
        { x: 285, w: 40, h: 80 },
        { x: 330, w: 40, h: 105 },
        { x: 375, w: 35, h: 50 },
      ];
      buildings.forEach((b) => {
        ctx.fillRect(b.x, PLAY_HEIGHT - b.h, b.w, b.h);
      });
      ctx.restore();

      // Distant Hills
      ctx.save();
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.arc(80, PLAY_HEIGHT + 60, 110, Math.PI, 0);
      ctx.arc(260, PLAY_HEIGHT + 80, 140, Math.PI, 0);
      ctx.arc(390, PLAY_HEIGHT + 70, 100, Math.PI, 0);
      ctx.fill();
      ctx.restore();

      // 2. Pipes Logic & Drawing
      if (eng.state === 'PLAYING') {
        if (eng.frameCount % PIPE_INTERVAL === 0) {
          const minTop = 50;
          const maxTop = PLAY_HEIGHT - PIPE_GAP - 60;
          const topH = Math.floor(Math.random() * (maxTop - minTop)) + minTop;
          const botY = topH + PIPE_GAP;
          eng.pipes.push({
            x: CANVAS_WIDTH + 10,
            topHeight: topH,
            bottomY: botY,
            bottomHeight: PLAY_HEIGHT - botY,
            scored: false,
          });
        }

        for (let i = eng.pipes.length - 1; i >= 0; i--) {
          const p = eng.pipes[i];
          p.x -= PIPE_SPEED;

          if (!p.scored && p.x + PIPE_WIDTH < eng.bird.x) {
            p.scored = true;
            eng.score += 1;
            setCurrentScore(eng.score);
            audio.playScore();
          }

          if (p.x + PIPE_WIDTH < -20) {
            eng.pipes.splice(i, 1);
          }
        }
      }

      // Draw Pipes
      eng.pipes.forEach((p) => {
        const drawPipeSegment = (x: number, y: number, w: number, h: number, isTop: boolean) => {
          const grad = ctx.createLinearGradient(x, 0, x + w, 0);
          grad.addColorStop(0, '#4ade80');
          grad.addColorStop(0.3, '#22c55e');
          grad.addColorStop(0.7, '#16a34a');
          grad.addColorStop(1, '#14532d');

          ctx.fillStyle = grad;
          ctx.strokeStyle = '#052e16';
          ctx.lineWidth = 2.5;
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);

          // Collar
          const capW = w + 8;
          const capH = 24;
          const capX = x - 4;
          const capY = isTop ? y + h - capH : y;

          const capGrad = ctx.createLinearGradient(capX, 0, capX + capW, 0);
          capGrad.addColorStop(0, '#86efac');
          capGrad.addColorStop(0.3, '#22c55e');
          capGrad.addColorStop(0.7, '#15803d');
          capGrad.addColorStop(1, '#052e16');

          ctx.fillStyle = capGrad;
          ctx.fillRect(capX, capY, capW, capH);
          ctx.strokeRect(capX, capY, capW, capH);

          // Specular shine
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(x + 6, y, 4, h);
        };

        drawPipeSegment(p.x, 0, PIPE_WIDTH, p.topHeight, true);
        drawPipeSegment(p.x, p.bottomY, PIPE_WIDTH, p.bottomHeight, false);
      });

      // 3. Particles
      for (let i = eng.particles.length - 1; i >= 0; i--) {
        const pt = eng.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= 0.035;
        pt.radius = Math.max(0, pt.radius - 0.05);

        if (pt.alpha <= 0) {
          eng.particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Bird Update & Render
      const b = eng.bird;
      if (eng.state === 'START') {
        b.wingTimer += 0.08;
        b.y = 260 + Math.sin(b.wingTimer) * 10;
        b.angle = 0;
      } else if (eng.state === 'PLAYING') {
        b.velocity += 0.38;
        b.y += b.velocity;
        if (b.velocity < 0) {
          b.angle = Math.max(-0.48, b.angle - 0.08);
        } else {
          b.angle = Math.min(Math.PI / 2.2, b.angle + 0.05);
        }
        b.wingTimer += 0.2;
      }

      // Draw Bird
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);

      const wingOffset = Math.sin(b.wingTimer) * 5;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 17, 13, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      const bodyGrad = ctx.createLinearGradient(-15, -15, 15, 15);
      bodyGrad.addColorStop(0, '#fde047');
      bodyGrad.addColorStop(1, '#ea580c');
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Belly
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-3, 4, 9, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Wing
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-6, wingOffset, 8, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(6, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pupil
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(8, -4, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(7, -6, 1, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(13, -1);
      ctx.lineTo(21, 2);
      ctx.lineTo(13, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // 5. Ground
      const gy = PLAY_HEIGHT;
      if (eng.state === 'PLAYING') {
        eng.groundScroll = (eng.groundScroll + PIPE_SPEED) % 24;
      }

      ctx.fillStyle = '#ded895';
      ctx.fillRect(0, gy, CANVAS_WIDTH, GROUND_HEIGHT);

      ctx.fillStyle = '#73bf2e';
      ctx.fillRect(0, gy, CANVAS_WIDTH, 14);
      ctx.fillStyle = '#9ce659';
      ctx.fillRect(0, gy, CANVAS_WIDTH, 4);

      ctx.fillStyle = '#558022';
      ctx.fillRect(0, gy + 14, CANVAS_WIDTH, 3);

      ctx.save();
      ctx.strokeStyle = '#cbb86b';
      ctx.lineWidth = 3;
      for (let x = -24; x < CANVAS_WIDTH + 24; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x - eng.groundScroll, gy + 17);
        ctx.lineTo(x - eng.groundScroll - 10, CANVAS_HEIGHT);
        ctx.stroke();
      }
      ctx.restore();

      // 6. Collision Checking
      if (eng.state === 'PLAYING') {
        let collided = false;

        // Ceiling
        if (b.y - b.radius <= 0) {
          collided = true;
        }

        // Ground
        if (b.y + b.radius >= PLAY_HEIGHT) {
          b.y = PLAY_HEIGHT - b.radius;
          collided = true;
        }

        // Pipes
        const hitPad = 3;
        for (let i = 0; i < eng.pipes.length; i++) {
          const p = eng.pipes[i];
          if (b.x + b.radius - hitPad > p.x && b.x - b.radius + hitPad < p.x + PIPE_WIDTH) {
            if (b.y - b.radius + hitPad < p.topHeight || b.y + b.radius - hitPad > p.bottomY) {
              collided = true;
              break;
            }
          }
        }

        if (collided) {
          eng.state = 'GAME_OVER';
          eng.screenShake = 12;
          audio.playHit();

          let newBest = false;
          if (eng.score > eng.highScore) {
            eng.highScore = eng.score;
            setHighScore(eng.score);
            localStorage.setItem('flappy_best_score', eng.score.toString());
            newBest = true;
          }
          setIsNewHigh(newBest);
          setGameState('GAME_OVER');
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <main
      id="flappy-bird-app"
      className="min-h-screen w-full flex flex-col items-center justify-center bg-radial from-slate-800 to-slate-950 p-2 select-none overflow-hidden"
    >
      {/* Game Cabinet Container */}
      <div
        id="game-viewport"
        className="relative w-full max-w-[420px] aspect-[400/600] max-h-[92vh] rounded-3xl overflow-hidden shadow-2xl shadow-black border-2 border-slate-700/60 bg-black cursor-pointer"
        onClick={triggerFlap}
      >
        {/* Canvas Display */}
        <canvas
          id="game-canvas"
          ref={canvasRef}
          width={400}
          height={600}
          className="w-full h-full block"
        />

        {/* Live HUD Header */}
        <header
          id="game-hud"
          className="absolute top-0 inset-x-0 p-4 flex items-center justify-between pointer-events-none z-10"
        >
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 text-xs font-semibold text-amber-300">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{highScore}</span>
          </div>

          <span
            id="hud-score-counter"
            className="text-4xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-wide"
          >
            {currentScore}
          </span>

          <button
            id="audio-toggle-button"
            type="button"
            onClick={toggleSound}
            aria-label="Toggle Sound"
            className="pointer-events-auto w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-800/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-transform active:scale-95"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </header>

        {/* START SCREEN OVERLAY */}
        {gameState === 'START' && (
          <section
            id="start-screen-overlay"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/40 backdrop-blur-[2px]"
          >
            <div className="w-full max-w-[320px] bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-7 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="inline-flex p-3 bg-amber-500/20 border border-amber-400/30 rounded-2xl mb-3 text-amber-400">
                <Gamepad2 className="w-8 h-8" />
              </div>

              <h1 className="text-3xl font-black tracking-tight uppercase text-amber-400 drop-shadow-[0_2px_10px_rgba(250,204,21,0.4)]">
                Flappy Bird
              </h1>
              <p className="text-xs font-medium text-slate-400 mt-1 mb-6">
                Classic Arcade Web Edition
              </p>

              <button
                id="start-game-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startGame();
                }}
                className="w-full py-3.5 px-6 font-black text-sm uppercase tracking-wider text-slate-950 bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 rounded-xl shadow-[0_5px_0_#b45309] active:translate-y-1 active:shadow-[0_1px_0_#b45309] transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Play Game
              </button>

              <div className="mt-5 text-[11px] text-slate-400 flex flex-col gap-1.5 leading-relaxed">
                <span>Tap screen, click mouse, or</span>
                <div className="flex items-center justify-center gap-1 font-mono text-[10px] text-slate-200">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 shadow-sm">SPACE</kbd>
                  <span>or</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 shadow-sm">▲ ARROW</kbd>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* GAME OVER SCREEN OVERLAY */}
        {gameState === 'GAME_OVER' && (
          <section
            id="game-over-overlay"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/60 backdrop-blur-[4px]"
          >
            <div className="w-full max-w-[320px] bg-slate-900/90 backdrop-blur-xl border border-white/15 rounded-2xl p-7 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <h2 className="text-3xl font-black tracking-tight uppercase text-rose-500 drop-shadow-[0_2px_12px_rgba(244,63,94,0.4)] mb-4">
                Game Over
              </h2>

              <div className="grid grid-cols-2 gap-3 bg-slate-800/80 border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex flex-col items-center border-r border-slate-700/60 pr-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Score</span>
                  <span id="final-score-display" className="text-3xl font-black text-white mt-1">
                    {currentScore}
                  </span>
                </div>
                <div className="flex flex-col items-center pl-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Best</span>
                  <span id="best-score-display" className="text-3xl font-black text-amber-400 mt-1">
                    {highScore}
                  </span>
                  {isNewHigh && (
                    <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white px-1.5 py-0.5 rounded animate-pulse">
                      New Best!
                    </span>
                  )}
                </div>
              </div>

              <button
                id="play-again-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startGame();
                }}
                className="w-full py-3.5 px-6 font-black text-sm uppercase tracking-wider text-slate-950 bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 rounded-xl shadow-[0_5px_0_#b45309] active:translate-y-1 active:shadow-[0_1px_0_#b45309] transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Footer link to standalone HTML file */}
      <footer className="mt-3 text-center text-xs text-slate-400">
        <span>Save as standalone file: </span>
        <a
          href="/flappy-bird.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 hover:underline font-medium"
        >
          flappy-bird.html
        </a>
      </footer>
    </main>
  );
}
