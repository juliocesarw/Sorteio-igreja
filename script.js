"use strict";

// Esta é a fonte imutável do estado. Todas as interações usam cópias em memória.
const ORIGINAL_PARTICIPANTS = Object.freeze([
  "Washington", "Lislane", "Naiara", "Aparecida", "Júlio César", "Anne Tonon", "Keilane", "Sthéfany", "Anderson Cesário"
]);

let availableParticipants = [...ORIGINAL_PARTICIPANTS];
let drawnParticipants = [];
let lastWinner = null;
let isDrawing = false; // true enquanto a animação de um sorteio está em andamento

const elements = {
  availableCount: document.querySelector("#available-count"),
  drawnCount: document.querySelector("#drawn-count"),
  availablePill: document.querySelector("#available-pill"),
  availableList: document.querySelector("#available-list"),
  historyList: document.querySelector("#history-list"),
  emptyHistory: document.querySelector("#empty-history"),
  resetButton: document.querySelector("#reset-button"),
  resultName: document.querySelector("#result-name"),
  resultSupport: document.querySelector("#result-support"),
  status: document.querySelector("#status-message"),
  addForm: document.querySelector("#add-form"),
  nameInput: document.querySelector("#participant-name"),
  formMessage: document.querySelector("#form-message")
};

const normalizeName = (name) => name.trim().replace(/\s+/g, " ");
const isSameName = (one, other) => normalizeName(one).localeCompare(normalizeName(other), "pt-BR", { sensitivity: "accent" }) === 0;

function setMessage(target, message, kind = "") {
  target.textContent = message;
  target.className = target.id === "status-message" ? `status-message ${kind}` : `form-message ${kind}`;
}

function render() {
  const available = availableParticipants.length;
  const drawn = drawnParticipants.length;
  elements.availableCount.textContent = available;
  elements.drawnCount.textContent = drawn;
  elements.availablePill.textContent = `${available} ${available === 1 ? "pessoa" : "pessoas"}`;

  elements.availableList.replaceChildren();
  if (available === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state list-empty";
    empty.textContent = drawn > 0 ? "Todos os participantes já foram sorteados." : "Adicione participantes para iniciar o sorteio.";
    elements.availableList.append(empty);
  } else {
    availableParticipants.forEach((name) => {
      const item = document.createElement("li");
      item.className = "name-item";
      const label = document.createElement("span");
      label.textContent = name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-button";
      remove.textContent = "Remover";
      remove.setAttribute("aria-label", `Remover ${name}`);
      remove.addEventListener("click", () => removeParticipant(name));
      item.append(label, remove);
      elements.availableList.append(item);
    });
  }

  elements.historyList.replaceChildren();
  elements.emptyHistory.hidden = drawn > 0;
  drawnParticipants.forEach((name, index) => {
    const item = document.createElement("li");
    item.className = "history-item";
    if (index === drawn - 1) item.classList.add("latest");
    const order = document.createElement("span");
    order.className = "history-order";
    order.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.textContent = name;
    item.append(order, label);
    elements.historyList.append(item);
  });
  renderDrawScreen();
}

function removeParticipant(name) {
  availableParticipants = availableParticipants.filter((participant) => participant !== name);
  setMessage(elements.formMessage, `“${name}” foi removido da lista.`, "success");
  setMessage(elements.status, "");
  render();
}

function addParticipant(event) {
  event.preventDefault();
  const name = normalizeName(elements.nameInput.value);
  if (!name) {
    setMessage(elements.formMessage, "Digite um nome para adicionar.", "error");
    elements.nameInput.focus();
    return;
  }
  if ([...availableParticipants, ...drawnParticipants].some((participant) => isSameName(participant, name))) {
    setMessage(elements.formMessage, "Este participante já está nesta sessão.", "error");
    elements.nameInput.focus();
    return;
  }
  availableParticipants.push(name);
  elements.nameInput.value = "";
  setMessage(elements.formMessage, `“${name}” foi adicionado à lista.`, "success");
  setMessage(elements.status, "");
  render();
}

function resetDraw() {
  if (isDrawing) return;
  const hasChanges = drawnParticipants.length > 0 || availableParticipants.length !== ORIGINAL_PARTICIPANTS.length || availableParticipants.some((name, index) => name !== ORIGINAL_PARTICIPANTS[index]);
  if (hasChanges && !window.confirm("Reiniciar o sorteio? A lista original será restaurada e o histórico será apagado.")) return;
  availableParticipants = [...ORIGINAL_PARTICIPANTS];
  drawnParticipants = [];
  lastWinner = null;
  elements.resultName.textContent = "Pronto para começar";
  elements.resultSupport.textContent = "Entre na tela do sorteio para revelar o premiado deste sábado.";
  resetDrawView();
  setMessage(elements.status, "Sorteio reiniciado. A lista original foi restaurada.", "success");
  setMessage(elements.formMessage, "");
  render();
}

// ======================================================================
//  Tela dedicada ao sorteio + animação
//  Regra de ouro: a seleção real acontece UMA vez, no clique (startDraw).
//  A animação apenas encena esse resultado; nunca sorteia nem altera listas.
// ======================================================================
const ds = {
  manageView: document.querySelector("#manage-view"),
  screen: document.querySelector("#draw-screen"),
  main: document.querySelector("#ds-main"),
  goButton: document.querySelector("#go-draw-button"),
  backButton: document.querySelector("#back-button"),
  drawButton: document.querySelector("#draw-button"),
  exitButton: document.querySelector("#exit-button"),
  resetButton: document.querySelector("#draw-reset-button"),
  soundToggle: document.querySelector("#sound-toggle"),
  soundIcon: document.querySelector("#sound-icon"),
  soundLabel: document.querySelector("#sound-label"),
  title: document.querySelector("#draw-title"),
  message: document.querySelector("#ds-message"),
  remainingCount: document.querySelector("#remaining-count"),
  remainingLabel: document.querySelector("#remaining-label"),
  live: document.querySelector("#draw-live"),
  stage: document.querySelector("#stage"),
  halo: document.querySelector("#halo"),
  rays: document.querySelector("#rays"),
  shocks: [...document.querySelectorAll(".shock")],
  raffleCard: document.querySelector("#raffle-card"),
  badgeText: document.querySelector("#badge-text"),
  rollerName: document.querySelector("#roller-name"),
  rollerIcon: document.querySelector("#roller-icon"),
  winner: document.querySelector("#winner"),
  winnerName: document.querySelector("#winner-name"),
  flash: document.querySelector("#ds-flash"),
  sweep: document.querySelector("#ds-sweep"),
  canvas: document.querySelector("#fx-canvas")
};

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const particles = new DrawFX.ParticleSystem(ds.canvas);
const sfx = new DrawFX.Sfx();

// Linha do tempo (ms desde o clique). Revelação em ~5,5 s; botões voltam em ~7 s.
const TIMELINE_FULL = { surge: 2000, hold: 4600, reveal: 5400, end: 7000 };
const TIMELINE_REDUCED = { surge: 900, hold: 1700, reveal: 2200, end: 3200 };

let screenOpen = false;
let viewState = "idle"; // idle | drawing | done
let currentDraw = null; // { winner, start, reduced, tl, flags, revealed }
let phase = "idle";
let intensity = 0.12;
let rafId = 0;
let lastFrame = 0;
let finishTimer = 0;
let anim = { rays: 0, pulse: 0 };
let rollerPool = [];
let rollerIndex = 0;
let lastFlipTime = 0;
let soundOn = false;
try { soundOn = localStorage.getItem("bdl-sound") === "on"; } catch (error) { soundOn = false; }

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const plural = (n, one, many) => (n === 1 ? one : many);

/* ---------- textos e estado da interface ---------- */
function setTitle(text) {
  if (ds.title.textContent === text) return;
  ds.title.textContent = text;
  ds.title.classList.remove("swap");
  void ds.title.offsetWidth;
  ds.title.classList.add("swap");
}

function setPhase(next) {
  phase = next;
  ds.screen.dataset.phase = next;
  if (viewState !== "drawing") return;
  if (next === "build") {
    setTitle("Misturando os nomes…");
    ds.message.textContent = "Quem será o premiado do Bom de Lição?";
    if (ds.badgeText) ds.badgeText.textContent = "Misturando…";
    if (ds.rollerIcon) ds.rollerIcon.textContent = "🎲";
  }
  if (next === "surge") {
    setTitle("O premiado do bom de lição é……");
    ds.message.textContent = "A roleta está desacelerando…";
    if (ds.badgeText) ds.badgeText.textContent = "Atenção…";
    if (ds.rollerIcon) ds.rollerIcon.textContent = "✨";
  }
  if (next === "hold") {
    setTitle("O premiado do bom de lição é……");
    ds.message.textContent = "Segure a expectativa… quase lá!";
    if (ds.badgeText) ds.badgeText.textContent = "O premiado é…";
    if (ds.rollerIcon) ds.rollerIcon.textContent = "⏳";
  }
}

function renderDrawScreen() {
  const remaining = availableParticipants.length;
  ds.remainingCount.textContent = remaining;
  ds.remainingLabel.textContent = remaining === 0 ? (drawnParticipants.length ? "— todos foram sorteados" : "participantes") : plural(remaining, "participante restante", "participantes restantes");
  ds.drawButton.disabled = isDrawing || remaining === 0;
  ds.resetButton.disabled = isDrawing;
  ds.backButton.disabled = false;
  if (isDrawing) {
    ds.drawButton.textContent = "Sorteando…";
  } else if (viewState === "done") {
    ds.drawButton.textContent = remaining ? "✦ Sortear o próximo" : "Todos sorteados";
  } else {
    ds.drawButton.textContent = "✦ Sortear participante";
  }
  ds.exitButton.hidden = viewState !== "done";
  if (viewState === "drawing") return;
  if (viewState === "done") {
    setTitle("Temos nosso premiado!");
    ds.message.textContent = remaining ? `Ainda ${plural(remaining, "resta 1 participante", `restam ${remaining} participantes`)}. Vamos para o próximo sorteio?` : "Todos os participantes já foram sorteados!";
    return;
  }
  if (remaining === 0) {
    setTitle(drawnParticipants.length ? "Todos foram sorteados!" : "Nenhum participante ainda");
    ds.message.textContent = drawnParticipants.length ? "Reinicie o sorteio para começar uma nova rodada." : "Volte ao gerenciamento e adicione participantes.";
  } else {
    setTitle(drawnParticipants.length ? "Quem será o próximo premiado?" : "Quem será o premiado do bom de lição?");
    ds.message.textContent = lastWinner ? `Último sorteado: ${lastWinner}` : "Toque no botão e acompanhe o sorteio de hoje.";
  }
}

function resetDrawView() {
  viewState = "idle";
  hideWinner();
  setPhase("idle");
  particles.clear();
  if (ds.rollerName) ds.rollerName.textContent = "Pronto para começar";
  if (ds.badgeText) ds.badgeText.textContent = "Sorteio Bom de Lição";
  if (ds.rollerIcon) ds.rollerIcon.textContent = "🎁";
  if (ds.raffleCard) ds.raffleCard.classList.remove("revealed");
}

function hideWinner() {
  ds.winner.classList.remove("show", "instant");
  ds.winnerName.replaceChildren();
  ds.stage.classList.remove("is-revealed");
  if (ds.raffleCard) ds.raffleCard.classList.remove("revealed");
}

function buildWinnerName(name) {
  ds.winnerName.replaceChildren();
  let index = 0;
  name.split(/\s+/).filter(Boolean).forEach((word) => {
    const wordEl = document.createElement("span");
    wordEl.className = "word";
    [...word].forEach((char) => {
      const ch = document.createElement("span");
      ch.className = "ch";
      ch.textContent = char;
      ch.style.setProperty("--d", `${Math.min(index * 45, 550)}ms`);
      wordEl.append(ch);
      index += 1;
    });
    if (ds.winnerName.childNodes.length) ds.winnerName.append(" ");
    ds.winnerName.append(wordEl);
  });
}

function retrigger(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

/* ---------- o sorteio em si ---------- */
function startDraw() {
  if (isDrawing) return;
  if (availableParticipants.length === 0) { renderDrawScreen(); return; }

  // ÚNICA seleção aleatória do sorteio; estado definitivo já neste instante.
  const index = Math.floor(Math.random() * availableParticipants.length);
  const [winner] = availableParticipants.splice(index, 1);
  drawnParticipants.push(winner);
  lastWinner = winner;
  elements.resultName.textContent = winner;
  elements.resultSupport.textContent = "Foi o participante sorteado deste sábado!";
  setMessage(elements.status, availableParticipants.length ? "Sorteio realizado com sucesso." : "Todos os participantes já participaram deste sorteio.", availableParticipants.length ? "success" : "warning");
  setMessage(elements.formMessage, "");

  // Prepara lista de participantes para passar na roleta
  const pool = [...availableParticipants, ...drawnParticipants];
  rollerPool = pool.length > 1 ? pool.sort(() => Math.random() - 0.5) : [winner, "Bom de Lição", "Escola Sabatina"];
  rollerIndex = 0;
  lastFlipTime = performance.now();

  const reduced = reducedMotionQuery.matches;
  const tl = reduced ? TIMELINE_REDUCED : TIMELINE_FULL;
  isDrawing = true;
  viewState = "drawing";
  currentDraw = { winner, start: performance.now(), reduced, tl, flags: {}, revealed: false };

  hideWinner();
  retrigger(ds.drawButton, "pressed");
  ds.live.textContent = "Sorteio em andamento.";
  if (soundOn && sfx.unlock()) sfx.playDraw({ hold: tl.hold / 1000, reveal: tl.reveal / 1000, reduced });
  measureStage();
  setPhase("build");
  render(); // atualiza contagens e histórico
  ds.drawButton.blur();
  clearTimeout(finishTimer);
  finishTimer = setTimeout(() => settleDraw(false), tl.end + 600); // rede de segurança
  startLoop();
}

function revealWinner(instant) {
  if (!currentDraw || currentDraw.revealed) return;
  currentDraw.revealed = true;
  const fancy = !instant && !currentDraw.reduced;
  buildWinnerName(currentDraw.winner);
  if (ds.raffleCard) ds.raffleCard.classList.add("revealed");
  ds.winner.classList.toggle("instant", instant);
  ds.winner.classList.add("show");
  ds.stage.classList.add("is-revealed");
  ds.live.textContent = `Participante sorteado: ${currentDraw.winner}.`;
  setPhase("climax");
  viewState = "drawing";
  setTitle("🎉 Temos o premiado deste sábado! 🎉");
  ds.message.textContent = `Parabéns, ${currentDraw.winner}! Que alegria ver sua participação no Bom de Lição!`;
  if (!fancy) return;
  ds.flash.classList.remove("soft");
  retrigger(ds.flash, "go");
  retrigger(ds.sweep, "go");
  ds.shocks.forEach((shock) => retrigger(shock, "go"));
  particles.burst(85);
  particles.confetti(75);
  setTimeout(() => { if (screenOpen) { particles.burst(35); particles.confetti(55); } }, 380);
}

function settleDraw(instant) {
  if (!isDrawing || !currentDraw) return;
  clearTimeout(finishTimer);
  if (instant) sfx.stop();
  revealWinner(true); // se ainda não revelou, mostra o nome sem efeitos
  isDrawing = false;
  viewState = "done";
  currentDraw = null;
  setPhase("done");
  renderDrawScreen();
  if (screenOpen) (ds.drawButton.disabled ? ds.exitButton : ds.drawButton).focus({ preventScroll: true });
}

/* ---------- loop de animação ---------- */
function measureStage() {
  particles.resize();
  const rect = ds.stage.getBoundingClientRect();
  particles.setCenter(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width);
}

function startLoop() {
  if (rafId || !screenOpen || document.hidden) return;
  lastFrame = performance.now();
  rafId = requestAnimationFrame(frame);
}

function stopLoop() {
  cancelAnimationFrame(rafId);
  rafId = 0;
}

function drawingIntensity(t, tl) {
  if (t < tl.surge) return 0.15 + 0.3 * (t / tl.surge);
  if (t < tl.hold) return 0.45 + 0.5 * Math.pow((t - tl.surge) / (tl.hold - tl.surge), 1.4);
  if (t < tl.reveal) return 0.55;
  return 1 - 0.78 * clamp01((t - tl.reveal) / 2400);
}

function runTimeline(now) {
  const d = currentDraw;
  const t = now - d.start;
  const { tl, flags } = d;
  if (t >= tl.surge && !flags.surge) { flags.surge = true; setPhase("surge"); }
  if (!d.reduced) {
    if (t >= 1200 && !flags.s1) { flags.s1 = true; retrigger(ds.sweep, "go"); }
    if (t >= 2800 && !flags.s2) { flags.s2 = true; retrigger(ds.sweep, "go"); }
    if (t >= 3800 && !flags.s3) {
      flags.s3 = true;
      ds.flash.classList.add("soft");
      retrigger(ds.flash, "go");
    }
  }
  if (t >= tl.hold && !flags.hold) { flags.hold = true; setPhase("hold"); }
  if (t >= tl.reveal && !flags.reveal) { flags.reveal = true; ds.flash.classList.remove("soft"); revealWinner(false); }
  if (t >= tl.end) { settleDraw(false); return t; }
  return t;
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const reduced = currentDraw ? currentDraw.reduced : reducedMotionQuery.matches;

  if (currentDraw) {
    const t = runTimeline(now);
    intensity = drawingIntensity(t, (currentDraw || { tl: TIMELINE_FULL }).tl);

    // Roleta de nomes animada durante o sorteio
    if (!reduced && currentDraw && !currentDraw.revealed) {
      const { tl } = currentDraw;
      if (t < tl.hold) {
        let interval = 75;
        let progress = 0;
        if (t >= tl.surge) {
          progress = (t - tl.surge) / (tl.hold - tl.surge);
          interval = 75 + Math.pow(progress, 2.6) * 440; // desacelera suavemente de 75ms até ~515ms
        }
        if (now - lastFlipTime >= interval) {
          lastFlipTime = now;
          rollerIndex = (rollerIndex + 1) % rollerPool.length;
          const nextName = rollerPool[rollerIndex];
          if (ds.rollerName) {
            ds.rollerName.textContent = nextName;
            ds.rollerName.classList.remove("flip");
            void ds.rollerName.offsetWidth;
            ds.rollerName.classList.add("flip");
          }
          if (soundOn && sfx.tick) sfx.tick(progress);
        }
      } else if (t < tl.reveal) {
        if (ds.rollerName && ds.rollerName.textContent !== "……") {
          ds.rollerName.textContent = "……";
        }
      }
    }
  } else {
    const target = viewState === "done" ? 0.22 : 0.12;
    intensity += (target - intensity) * Math.min(1, dt * 2.5);
  }

  const calm = reduced ? 0.15 : 1;
  const holding = phase === "hold";
  const revealed = phase === "climax" || phase === "done";

  // Rotação suave dos raios luminosos
  anim.rays += dt * (8 + 140 * intensity) * calm;
  const rayOpacity = revealed ? 0.55 * (0.4 + intensity) : holding ? 0.32 : clamp01(0.18 + 0.75 * intensity);
  if (ds.rays) {
    ds.rays.style.opacity = rayOpacity.toFixed(3);
    ds.rays.style.transform = `rotate(${anim.rays.toFixed(1)}deg) scale(${(1 + intensity * 0.18).toFixed(3)})`;
  }
  if (ds.halo) {
    ds.halo.style.transform = `scale(${(1 + intensity * 0.14).toFixed(3)})`;
  }

  if (!reduced) {
    particles.update(dt, phase, intensity);
    particles.render();
  }
}
const TAU_STEP = Math.PI * 2;

/* ---------- navegação entre telas ---------- */
function showScreen(name, updateHistory = true) {
  const open = name === "draw";
  if (open === screenOpen) return;
  if (!open && isDrawing) settleDraw(true); // sair no meio: o resultado já está salvo; apenas encerramos a cena
  screenOpen = open;
  ds.manageView.classList.toggle("is-away", open);
  ds.manageView.inert = open;
  ds.screen.classList.toggle("is-open", open);
  ds.screen.inert = !open;
  ds.screen.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("no-scroll", open);
  if (open) {
    if (updateHistory && location.hash !== "#sorteio") history.pushState({ draw: true }, "", "#sorteio");
    renderDrawScreen();
    setTimeout(() => { measureStage(); (ds.drawButton.disabled ? ds.backButton : ds.drawButton).focus({ preventScroll: true }); }, 520);
    startLoop();
  } else {
    stopLoop();
    particles.clear();
    if (updateHistory && location.hash === "#sorteio") {
      if (history.state && history.state.draw) history.back();
      else history.replaceState(null, "", location.pathname + location.search);
    }
    setTimeout(() => ds.goButton.focus({ preventScroll: true }), 300);
  }
}

function syncFromLocation() { showScreen(location.hash === "#sorteio" ? "draw" : "manage", false); }

/* ---------- som ---------- */
function renderSoundToggle() {
  ds.soundToggle.setAttribute("aria-pressed", String(soundOn));
  ds.soundIcon.textContent = soundOn ? "🔊" : "🔇";
  ds.soundLabel.textContent = soundOn ? "Som ligado" : "Som desligado";
  ds.soundToggle.hidden = !sfx.supported;
}

function toggleSound() {
  soundOn = !soundOn;
  try { localStorage.setItem("bdl-sound", soundOn ? "on" : "off"); } catch (error) { /* preferência não persistida */ }
  if (soundOn) { if (sfx.unlock()) sfx.blip(); } else sfx.stop();
  renderSoundToggle();
}

/* ---------- eventos ---------- */
elements.resetButton.addEventListener("click", resetDraw);
elements.addForm.addEventListener("submit", addParticipant);
ds.goButton.addEventListener("click", () => showScreen("draw"));
ds.backButton.addEventListener("click", () => showScreen("manage"));
ds.exitButton.addEventListener("click", () => showScreen("manage"));
ds.drawButton.addEventListener("click", startDraw);
ds.resetButton.addEventListener("click", resetDraw);
ds.soundToggle.addEventListener("click", toggleSound);
window.addEventListener("popstate", syncFromLocation);
window.addEventListener("hashchange", syncFromLocation);
window.addEventListener("resize", () => { if (screenOpen) measureStage(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && screenOpen) showScreen("manage"); });
document.addEventListener("visibilitychange", () => { if (document.hidden) stopLoop(); else if (screenOpen) startLoop(); });

renderSoundToggle();
render();
syncFromLocation();
