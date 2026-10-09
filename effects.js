"use strict";

/*
 * Efeitos do sorteio: partículas (canvas 2D) e sons sintetizados (Web Audio).
 * Nada aqui toca na lógica do sorteio: são apenas camadas visuais/sonoras.
 */
(function () {
  const TAU = Math.PI * 2;
  const rand = (min, max) => min + Math.random() * (max - min);
  const MAX_PARTICLES = 260;

  /* ---------------- Partículas ---------------- */
  class ParticleSystem {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.items = [];
      this.acc = 0;
      this.cx = 0; this.cy = 0; this.size = 300;
      this.dpr = 1; this.w = 0; this.h = 0;
      this.dirty = false;
      // Sprites de brilho pré-renderizados: ouro, branco e azul safira
      this.sprites = [["255,220,120", "245,158,11"], ["255,255,255", "254,240,138"], ["147,197,253", "37,99,235"]].map(([a, b]) => this.makeSprite(a, b));
      this.colors = ["#38bdf8", "#60a5fa", "#2563eb", "#fbbf24", "#f59e0b", "#ffffff", "#f43f5e", "#34d399"];
    }

    makeSprite(core, edge) {
      const c = document.createElement("canvas");
      c.width = c.height = 48;
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      grad.addColorStop(0, `rgba(255,255,255,1)`);
      grad.addColorStop(0.18, `rgba(${core},.95)`);
      grad.addColorStop(0.5, `rgba(${edge},.35)`);
      grad.addColorStop(1, `rgba(${edge},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 48, 48);
      return c;
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.w = this.canvas.clientWidth;
      this.h = this.canvas.clientHeight;
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    setCenter(x, y, size) { this.cx = x; this.cy = y; this.size = size; }

    clear() {
      this.items.length = 0;
      this.ctx.clearRect(0, 0, this.w, this.h);
    }

    get count() { return this.items.length; }

    /* partícula de brilho que espirala em direção ao centro */
    spawnIn() {
      const r0 = this.size * rand(0.7, 1.45);
      this.items.push({ t: "in", ang: rand(0, TAU), r: r0, r0, spd: rand(0.12, 0.3) * this.size, aSpd: rand(0.8, 1.6) * (Math.random() < 0.5 ? 1 : -1), s: rand(0.5, 1.15), k: Math.random() < 0.65 ? 0 : (Math.random() < 0.5 ? 1 : 2) });
    }

    /* brilho flutuante calmo (estado ocioso / celebração) */
    spawnFloat() {
      const ang = rand(0, TAU), r = this.size * rand(0.35, 1.1);
      this.items.push({ t: "float", x: this.cx + Math.cos(ang) * r, y: this.cy + Math.sin(ang) * r, vx: rand(-6, 6), vy: rand(-26, -8), age: 0, life: rand(2.4, 4.2), s: rand(0.35, 0.8), k: Math.random() < 0.7 ? 0 : 1 });
    }

    spawnSpark(speedMin, speedMax, life, drag) {
      const ang = rand(0, TAU), sp = rand(speedMin, speedMax);
      const r = this.size * 0.16;
      this.items.push({ t: "spark", x: this.cx + Math.cos(ang) * r, y: this.cy + Math.sin(ang) * r, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, age: 0, life: rand(life * 0.7, life * 1.2), s: rand(0.35, 1), drag, k: Math.random() < 0.6 ? 0 : 1 });
    }

    /* explosão radial do clímax */
    burst(n) {
      for (let i = 0; i < n; i += 1) this.spawnSpark(280, 1250, 1.3, 1.9);
    }

    confetti(n) {
      for (let i = 0; i < n; i += 1) {
        const ang = -Math.PI / 2 + rand(-1.25, 1.25), sp = rand(420, 1100);
        this.items.push({ t: "conf", x: this.cx + rand(-20, 20), y: this.cy + rand(-10, 20), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: rand(0, TAU), vr: rand(-9, 9), w: rand(6, 12), h: rand(4, 8), age: 0, life: rand(3.2, 4.4), flip: rand(0, TAU), color: this.colors[(Math.random() * this.colors.length) | 0] });
      }
    }

    /* taxa de partículas contínuas por segundo conforme a fase */
    spawnContinuous(dt, mode, intensity) {
      let inRate = 0, floatRate = 0, sparkRate = 0;
      if (mode === "idle") floatRate = 5;
      else if (mode === "build") { inRate = 10 + 34 * intensity; }
      else if (mode === "surge") { inRate = 24 + 60 * intensity; sparkRate = 8 + 22 * intensity; }
      else if (mode === "done" || mode === "climax") floatRate = 3 + 8 * intensity;
      this.acc += dt;
      const step = 1 / 60;
      while (this.acc >= step) {
        this.acc -= step;
        if (this.items.length >= MAX_PARTICLES - 120) continue;
        if (Math.random() < inRate * step) this.spawnIn();
        if (Math.random() < floatRate * step) this.spawnFloat();
        if (Math.random() < sparkRate * step) this.spawnSpark(220, 520, 0.55, 2.2);
      }
    }

    update(dt, mode, intensity) {
      this.spawnContinuous(dt, mode, intensity);
      const pull = mode === "hold" ? 3.4 : 1;
      const items = this.items;
      let w = 0;
      for (let i = 0; i < items.length; i += 1) {
        const p = items[i];
        let alive = true;
        if (p.t === "in") {
          p.r -= p.spd * dt * pull * (0.6 + intensity);
          p.ang += p.aSpd * dt * (1 + (p.r0 - p.r) / p.r0 * 3) * (0.6 + intensity);
          p.x = this.cx + Math.cos(p.ang) * p.r;
          p.y = this.cy + Math.sin(p.ang) * p.r;
          p.a = Math.min(1, 0.15 + (1 - p.r / p.r0) * 1.2);
          alive = p.r > this.size * 0.14;
        } else if (p.t === "float") {
          p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
          const u = p.age / p.life;
          p.a = Math.sin(Math.min(1, u) * Math.PI) * 0.7;
          alive = u < 1;
        } else if (p.t === "spark") {
          p.age += dt;
          const d = Math.max(0, 1 - p.drag * dt);
          p.vx *= d; p.vy *= d;
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.a = Math.max(0, 1 - p.age / p.life);
          alive = p.age < p.life;
        } else {
          p.age += dt;
          p.vx *= Math.max(0, 1 - 0.8 * dt);
          p.vy += 820 * dt; p.vy *= Math.max(0, 1 - 0.9 * dt);
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.rot += p.vr * dt; p.flip += 7 * dt;
          const u = p.age / p.life;
          p.a = u < 0.7 ? 1 : Math.max(0, 1 - (u - 0.7) / 0.3);
          alive = u < 1 && p.y < this.h + 40;
        }
        if (alive) items[w++] = p;
      }
      items.length = w;
    }

    render() {
      const g = this.ctx;
      if (!this.items.length) {
        if (this.dirty) { g.clearRect(0, 0, this.w, this.h); this.dirty = false; }
        return;
      }
      this.dirty = true;
      g.clearRect(0, 0, this.w, this.h);
      g.globalCompositeOperation = "lighter";
      for (const p of this.items) {
        if (p.t === "conf") continue;
        const spr = this.sprites[p.k || 0];
        g.globalAlpha = p.a;
        if (p.t === "spark") {
          // rastro curto na direção contrária ao movimento
          g.strokeStyle = p.k ? "rgba(255,250,225,.9)" : "rgba(255,205,100,.9)";
          g.lineWidth = 1 + p.s * 1.6;
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); g.stroke();
        }
        const d = (p.t === "spark" ? 16 : 22) * p.s * (p.t === "in" ? 0.7 + p.a * 0.6 : 1);
        g.drawImage(spr, p.x - d / 2, p.y - d / 2, d, d);
      }
      g.globalCompositeOperation = "source-over";
      for (const p of this.items) {
        if (p.t !== "conf") continue;
        g.globalAlpha = p.a;
        g.fillStyle = p.color;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(1, Math.cos(p.flip));
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      g.globalAlpha = 1;
    }
  }

  /* ---------------- Efeitos sonoros (sintetizados) ---------------- */
  class Sfx {
    constructor() { this.ctx = null; this.bus = null; this.stopTimer = 0; }

    get supported() { return Boolean(window.AudioContext || window.webkitAudioContext); }

    // Precisa ser chamado a partir de um gesto do usuário (clique) por causa da política de autoplay.
    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          this.ctx = new AC();
        }
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
        return true;
      } catch (error) {
        return false;
      }
    }

    noise(duration) {
      const ctx = this.ctx;
      const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      return src;
    }

    tone(type, f0, f1, start, dur, peak, dest, attack = 0.02) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, start);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain); gain.connect(dest);
      osc.start(start); osc.stop(start + dur + 0.05);
    }

    // Efeito de 'tick' ritmado da roleta ao trocar de nome
    tick(progress = 0) {
      if (!this.ctx || !this.bus) return;
      try {
        const t = this.ctx.currentTime;
        const freq = 840 - progress * 240;
        this.tone("triangle", freq, freq * 0.7, t, 0.038, 0.04, this.bus, 0.003);
      } catch (error) {}
    }

    // Trilha sonora do sorteio: rufar de suspense, pausa dramática e fanfarra alegre
    playDraw({ hold, reveal, reduced }) {
      if (!this.ctx) return;
      try {
        this.stop();
        const ctx = this.ctx;
        const t0 = ctx.currentTime + 0.03;
        const bus = ctx.createGain();
        bus.gain.value = 0.55;
        bus.connect(ctx.destination);
        this.bus = bus;

        if (!reduced) {
          // Rufar suave de tambor / suspense musical
          const drumNoise = this.noise(hold);
          const drumFilter = ctx.createBiquadFilter();
          const drumGain = ctx.createGain();
          drumFilter.type = "bandpass";
          drumFilter.Q.value = 3.5;
          drumFilter.frequency.setValueAtTime(140, t0);
          drumFilter.frequency.exponentialRampToValueAtTime(320, t0 + hold);

          drumGain.gain.setValueAtTime(0.0001, t0);
          drumGain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.4);
          drumGain.gain.exponentialRampToValueAtTime(0.18, t0 + hold * 0.9);
          drumGain.gain.exponentialRampToValueAtTime(0.0001, t0 + hold); // silêncio no momento do suspense

          drumNoise.connect(drumFilter);
          drumFilter.connect(drumGain);
          drumGain.connect(bus);
          drumNoise.start(t0);
          drumNoise.stop(t0 + hold + 0.05);

          // Tom harmônico suave de expectativa
          const chord = [220, 277.18, 329.63]; // A major suave
          chord.forEach((freq) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, t0);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t0 + hold);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(0.025, t0 + hold * 0.8);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + hold);
            osc.connect(g);
            g.connect(bus);
            osc.start(t0);
            osc.stop(t0 + hold + 0.05);
          });
        } else {
          this.tone("sine", 330, 440, t0, reveal * 0.8, 0.03, bus, 0.4);
        }

        // Momento da revelação: fanfarra festiva e arpejo brilhante
        const tr = t0 + reveal;
        this.tone("sine", 130, 65, tr, 0.6, 0.35, bus, 0.01); // base calorosa

        // Arpejo festivo triunfante de comemoração (C maior radiante)
        const fanfareNotes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
        fanfareNotes.forEach((f, i) => {
          const st = tr + 0.04 + i * (reduced ? 0.12 : 0.07);
          this.tone("triangle", f, f, st, 1.4, reduced ? 0.05 : 0.075, bus, 0.01);
          // Sino / brilho agudo
          this.tone("sine", f * 2, f * 2, st, 0.8, 0.02, bus, 0.005);
        });
      } catch (error) {
        /* sem áudio, o sorteio segue normalmente */
      }
    }

    stop() {
      const bus = this.bus;
      if (!bus || !this.ctx) return;
      this.bus = null;
      try {
        bus.gain.cancelScheduledValues(this.ctx.currentTime);
        bus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
        setTimeout(() => { try { bus.disconnect(); } catch (error) { /* nada */ } }, 400);
      } catch (error) { /* nada */ }
    }

    blip() {
      if (!this.ctx) return;
      try {
        const bus = this.ctx.createGain();
        bus.gain.value = 0.5; bus.connect(this.ctx.destination);
        const t = this.ctx.currentTime + 0.01;
        this.tone("sine", 660, 660, t, 0.14, 0.05, bus, 0.01);
        this.tone("sine", 880, 880, t + 0.07, 0.18, 0.04, bus, 0.01);
      } catch (error) {}
    }
  }

  window.DrawFX = { ParticleSystem, Sfx };
})();
