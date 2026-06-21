"use strict";

/* Body Explorer Mission: dependency-free game controller */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const PARTS = {
  head: { label: "Head", emoji: "🧠", fact: "Your head helps you think, see, hear, smell, and taste!", hint: "Find the part at the very top of the body." },
  neck: { label: "Neck", emoji: "🦒", fact: "Your neck connects your head to your body and helps your head turn.", hint: "Find the small part that connects the head and body." },
  chest: { label: "Chest", emoji: "🫁", fact: "Your chest protects your heart and lungs.", hint: "Look at the upper front part of the body." },
  tummy: { label: "Tummy", emoji: "🍎", fact: "Your abdomen, or tummy, helps digest food.", hint: "Look below the chest, where food goes after you eat." },
  arms: { label: "Arms", emoji: "💪", fact: "Your arms help you lift, throw, hug, and play.", hint: "Find the two long parts beside the chest." },
  hands: { label: "Hands", emoji: "👐", fact: "Your hands help you hold, write, and make things.", hint: "Find the parts at the ends of the arms." },
  legs: { label: "Legs", emoji: "🦵", fact: "Your legs help you walk, run, jump, and kick.", hint: "Find the two long parts below the tummy." },
  feet: { label: "Feet", emoji: "👣", fact: "Your feet help you stand, balance, and walk.", hint: "Find the parts at the very bottom of the legs." }
};

const LEVELS = [
  { title: "Build the Body", icon: "🧩", blurb: "Drag body-part labels" },
  { title: "Tap the Part", icon: "👆", blurb: "Find what Buddy asks" },
  { title: "What Does It Do?", icon: "💡", blurb: "Match parts and jobs" },
  { title: "Inside My Body", icon: "🔍", blurb: "Discover body layers" },
  { title: "Action Challenge", icon: "🏃", blurb: "Move your own body" },
  { title: "Fix the Robot", icon: "🤖", blurb: "Final repair mission", boss: true }
];

const state = { level: 0, stars: 0, lives: 3, unlocked: 0, completed: [], sound: true, name: "Explorer", levelCorrect: 0, levelTotal: 1, timer: null };
const screens = $$(".screen");
let lastSpoken = "";
let audioContext = null;
let musicTimer = null;

/* ---------- Sound, speech, and tiny synthesized music ---------- */
function getAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}
function tone(notes, duration = .13, type = "sine", volume = .07) {
  if (!state.sound) return;
  try {
    const ctx = getAudio();
    notes.forEach((frequency, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, ctx.currentTime + i * duration);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + (i + 1) * duration);
      osc.connect(gain).connect(ctx.destination); osc.start(ctx.currentTime + i * duration); osc.stop(ctx.currentTime + (i + 1) * duration);
    });
  } catch (_) { /* Audio is optional on restricted browsers. */ }
}
function correctSound() { tone([523, 659, 784, 1047], .11, "sine", .09); }
function wrongSound() { tone([260, 210], .16, "triangle", .05); }
function applause() { tone([523, 659, 784, 988, 1175], .09, "sine", .07); }
function speak(text) {
  lastSpoken = text;
  if (!state.sound || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .88; utterance.pitch = 1.2; utterance.volume = .95;
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(v => /female|samantha|zira|google uk english female/i.test(v.name)) || voices.find(v => v.lang.startsWith("en")) || null;
  speechSynthesis.speak(utterance);
}
function startMusic() {
  stopMusic();
  if (!state.sound) return;
  const melody = [262, 330, 392, 330, 294, 349, 440, 349]; let i = 0;
  musicTimer = setInterval(() => tone([melody[i++ % melody.length]], .25, "sine", .018), 650);
}
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

/* ---------- Screens, persistence, and common UI ---------- */
function showScreen(id) { screens.forEach(s => s.classList.toggle("active", s.id === id)); }
function save() {
  localStorage.setItem("bodyExplorerSave", JSON.stringify({ stars: state.stars, unlocked: state.unlocked, completed: state.completed, name: state.name }));
}
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem("bodyExplorerSave"));
    if (!saved) return false;
    state.stars = saved.stars || 0; state.unlocked = saved.unlocked || 0; state.completed = saved.completed || []; state.name = saved.name || "Explorer";
    $("#playerName").value = state.name === "Explorer" ? "" : state.name; return true;
  } catch (_) { return false; }
}
function updateHUD() {
  $("#starCount").textContent = state.stars; $("#mapStars").textContent = state.stars;
  $("#livesDisplay").textContent = "♥ ".repeat(state.lives).trim() + " ♡ ".repeat(3 - state.lives).trim();
  $("#levelLabel").textContent = state.level === 5 ? "Final Mission" : `Level ${state.level + 1}`;
  const levelFraction = state.levelTotal ? state.levelCorrect / state.levelTotal : 0;
  const progress = Math.round(((state.level + levelFraction) / LEVELS.length) * 100);
  $("#progressFill").style.width = `${progress}%`; $("#progressText").textContent = `${progress}%`;
}
function instruct(text, narrate = true) { $("#instructionText").textContent = text; lastSpoken = text; if (narrate) setTimeout(() => speak(text), 220); }
function showToast(text, type = "correct") {
  const toast = $("#toast"); toast.textContent = text; toast.className = `toast show ${type === "wrong" ? "wrong" : ""}`;
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}
function sparklesAt(x, y) {
  for (let i = 0; i < 10; i++) {
    const s = document.createElement("span"); s.className = "sparkle"; s.textContent = i % 2 ? "✨" : "⭐";
    s.style.left = `${x}px`; s.style.top = `${y}px`; s.style.setProperty("--dx", `${(Math.random() - .5) * 180}px`); s.style.setProperty("--dy", `${(Math.random() - .5) * 170}px`);
    document.body.appendChild(s); setTimeout(() => s.remove(), 800);
  }
}
function confetti(count = 70) {
  const layer = $("#confetti"), colors = ["#ff5f91", "#ffd84c", "#4fd6ad", "#6957e8", "#45b8f4"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i"); p.className = "confetti-piece"; p.style.left = `${Math.random() * 100}%`; p.style.background = colors[i % colors.length]; p.style.animationDelay = `${Math.random() * .7}s`; p.style.setProperty("--sway", `${(Math.random() - .5) * 250}px`); layer.appendChild(p); setTimeout(() => p.remove(), 3500);
  }
}
function awardCorrect(event, message = "Great exploring!") {
  state.stars++; state.levelCorrect++; state.lives = Math.min(3, state.lives + (state.levelCorrect % 4 === 0 ? 1 : 0));
  correctSound(); showToast(`⭐ ${message}`); const x = event?.clientX || innerWidth / 2, y = event?.clientY || innerHeight / 2; sparklesAt(x, y); updateHUD(); save();
}
function gentleWrong(hint) {
  state.lives--; wrongSound(); showToast(`Almost! ${hint}`, "wrong"); speak(`Almost! ${hint}`);
  if (state.lives <= 0) { state.lives = 3; showToast("Buddy Bot gave you three fresh hearts. Try again!", "wrong"); }
  updateHUD();
}
function completeLevel(message) {
  clearInterval(state.timer); state.timer = null; applause(); confetti();
  if (!state.completed.includes(state.level)) state.completed.push(state.level);
  state.unlocked = Math.max(state.unlocked, Math.min(5, state.level + 1)); save();
  const final = state.level === 5;
  $("#modalIcon").textContent = final ? "🏆" : LEVELS[state.level].icon;
  $("#modalTitle").textContent = final ? "Body Explorer Champion!" : "Mission Complete!";
  $("#modalMessage").textContent = message;
  $("#earnedStars").textContent = final ? "🏆 ⭐ 🏆" : "★ ★ ★";
  $("#modalButton").textContent = final ? "See Mission Map" : "Next Mission ➜";
  $("#modal").classList.add("show"); speak(final ? `Amazing, ${state.name}! You fixed Buddy Bot and became a Body Explorer Champion!` : `Mission complete! ${message}`);
}

/* ---------- Reusable child figure ---------- */
function bodyFigure({ zones = true } = {}) {
  return `<div class="body-figure" aria-label="Cartoon child">
    <div class="hair"></div><div class="person-part body-head"></div><div class="person-part body-neck"></div><div class="person-part body-torso"></div>
    <div class="person-part body-arm left"></div><div class="person-part body-arm right"></div><div class="person-part body-hand left"></div><div class="person-part body-hand right"></div>
    <div class="person-part body-leg left"></div><div class="person-part body-leg right"></div><div class="person-part body-foot left"></div><div class="person-part body-foot right"></div>
    ${zones ? Object.keys(PARTS).map(k => `<button class="body-zone zone-${k}" data-part="${k}" aria-label="${PARTS[k].label}"></button>`).join("") : ""}
  </div>`;
}

/* Pointer drag with tap-to-select accessibility fallback. */
function makeDraggable(card, onDrop) {
  let dragging = false, startX = 0, startY = 0, offsetX = 0, offsetY = 0, placeholder = null;
  card.addEventListener("pointerdown", e => {
    if (card.classList.contains("placed")) return;
    startX = e.clientX; startY = e.clientY; const rect = card.getBoundingClientRect(); offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener("pointermove", e => {
    if (!card.hasPointerCapture(e.pointerId) || Math.hypot(e.clientX - startX, e.clientY - startY) < 7) return;
    if (!dragging) { dragging = true; placeholder = document.createElement("span"); placeholder.style.cssText = `width:${card.offsetWidth}px;height:${card.offsetHeight}px`; card.parentNode.insertBefore(placeholder, card); card.classList.add("dragging"); document.body.appendChild(card); }
    card.style.left = `${e.clientX - offsetX}px`; card.style.top = `${e.clientY - offsetY}px`;
  });
  card.addEventListener("pointerup", e => {
    if (dragging) {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".body-zone, .function-card");
      card.classList.remove("dragging"); card.style.left = card.style.top = ""; placeholder?.replaceWith(card); dragging = false; onDrop(card, target, e);
    } else {
      const already = card.classList.contains("selected"); $$(".drag-card.selected").forEach(c => c.classList.remove("selected")); if (!already) card.classList.add("selected");
    }
  });
}

/* ---------- Level 1: label the body ---------- */
function levelOne() {
  const keys = Object.keys(PARTS); state.levelTotal = keys.length; state.levelCorrect = 0;
  $("#levelStage").innerHTML = `<h2 class="level-title">🧩 Build the Body</h2><div class="play-grid"><div class="body-board">${bodyFigure()}</div><div class="drag-bank">${keys.sort(() => Math.random() - .5).map(k => `<button class="drag-card" data-part="${k}">${PARTS[k].emoji} ${PARTS[k].label}</button>`).join("")}</div></div>`;
  instruct("Drag each label to the right body part. You can also tap a label, then tap the body!");
  const handle = (card, target, e) => {
    if (!target) return;
    if (target.dataset.part === card.dataset.part) {
      card.classList.add("placed"); target.classList.add("hit"); target.disabled = true;
      const tag = document.createElement("span"); tag.className = "drop-tag"; tag.textContent = PARTS[card.dataset.part].label; tag.style.left = `${target.offsetLeft + target.offsetWidth / 2}px`; tag.style.top = `${target.offsetTop + target.offsetHeight / 2}px`; target.parentNode.appendChild(tag);
      awardCorrect(e, `Yes! That is the ${PARTS[card.dataset.part].label}.`); speak(PARTS[card.dataset.part].fact); if (state.levelCorrect === state.levelTotal) setTimeout(() => completeLevel("You put every body part in the right place!"), 900);
    } else gentleWrong(PARTS[card.dataset.part].hint);
  };
  $$(".drag-card").forEach(c => makeDraggable(c, handle));
  $$(".body-zone").forEach(z => z.addEventListener("click", e => { const selected = $(".drag-card.selected"); if (selected) { selected.classList.remove("selected"); handle(selected, z, e); } }));
  updateHUD();
}

/* ---------- Level 2: tap named body locations ---------- */
function levelTwo() {
  const queue = Object.keys(PARTS).sort(() => Math.random() - .5); let current = 0; state.levelTotal = queue.length; state.levelCorrect = 0;
  $("#levelStage").innerHTML = `<div class="tap-layout"><h2 class="level-title">👆 Tap the Body Part</h2><span class="round-counter">Part <b id="tapRound">1</b> of ${queue.length}</span><div class="body-board">${bodyFigure()}</div></div>`;
  const ask = () => { const key = queue[current]; instruct(`Can you touch the ${PARTS[key].label}?`); $$(".body-zone").forEach(z => z.classList.toggle("active-target", false)); };
  $$(".body-zone").forEach(zone => zone.addEventListener("click", e => {
    const expected = queue[current];
    if (zone.dataset.part === expected) { zone.classList.add("hit"); awardCorrect(e, `You found the ${PARTS[expected].label}!`); speak(PARTS[expected].fact); current++; if (current === queue.length) setTimeout(() => completeLevel("Your super eyes found every body part!"), 900); else { $("#tapRound").textContent = current + 1; setTimeout(ask, 1050); } }
    else gentleWrong(PARTS[expected].hint);
  })); ask(); updateHUD();
}

/* ---------- Level 3: match parts to their functions ---------- */
function levelThree() {
  const pairs = [
    ["head", "🧠 Head", "Helps us think, see, hear, smell, and taste"], ["feet", "👣 Feet", "Help us stand, balance, and walk"],
    ["muscles", "💪 Muscles", "Help body parts move"], ["bones", "🦴 Bones", "Give shape and support to the body"],
    ["skin", "🛡️ Skin", "Covers and protects the whole body"], ["chest", "🫁 Chest", "Protects the heart and lungs"], ["tummy", "🍎 Tummy", "Helps digest food"]
  ];
  state.levelTotal = pairs.length; state.levelCorrect = 0;
  const functions = [...pairs].sort(() => Math.random() - .5);
  $("#levelStage").innerHTML = `<h2 class="level-title">💡 What Does It Do?</h2><div class="match-grid"><div class="match-parts">${pairs.map(p => `<button class="function-card part-match" data-key="${p[0]}">${p[1]}</button>`).join("")}</div><div class="match-functions">${functions.map(p => `<button class="function-card job-match" data-key="${p[0]}">${p[2]}</button>`).join("")}</div></div>`;
  instruct("Match each body part to its job. Tap one card from each side!");
  function choose(card, event) {
    if (card.classList.contains("matched")) return;
    const group = card.classList.contains("part-match") ? ".part-match" : ".job-match"; $$(group).forEach(c => c.classList.remove("selected")); card.classList.add("selected");
    const left = $(".part-match.selected"), right = $(".job-match.selected"); if (!left || !right) return;
    if (left.dataset.key === right.dataset.key) { left.classList.remove("selected"); right.classList.remove("selected"); left.classList.add("matched"); right.classList.add("matched"); awardCorrect(event, "Perfect match!"); if (state.levelCorrect === state.levelTotal) setTimeout(() => completeLevel("You know what the body parts do!"), 850); }
    else { left.classList.remove("selected"); right.classList.remove("selected"); gentleWrong("Think about what that body part helps you do."); }
  }
  $$(".function-card").forEach(c => c.addEventListener("click", e => choose(c, e))); updateHUD();
}

/* ---------- Level 4: discover bones, muscles, and skin ---------- */
function levelFour() {
  const layers = [
    { key: "bones", icon: "🦴", title: "Bones", quote: "I keep your body strong!", fact: "Bones give your body shape and support. Your skull also protects your brain." },
    { key: "muscles", icon: "💪", title: "Muscles", quote: "I help you move!", fact: "Muscles pull on bones so you can smile, run, jump, and play." },
    { key: "skin", icon: "🛡️", title: "Skin", quote: "I protect your body!", fact: "Skin covers your whole body and keeps the inside parts safe." }
  ];
  state.levelTotal = layers.length; state.levelCorrect = 0; const seen = new Set();
  $("#levelStage").innerHTML = `<div class="inside-wrap"><h2 class="level-title">🔍 Inside My Body</h2><div class="layer-tabs">${layers.map(l => `<button class="layer-btn" data-key="${l.key}">${l.icon} ${l.title}</button>`).join("")}</div><div class="xray-card"><div class="anatomy-figure"><div class="anatomy-person">🧍</div><div id="anatomyOverlay" class="anatomy-overlay">❔</div></div><div class="layer-info"><div class="fact-bubble"><h3>Choose a layer!</h3><p>What is hiding inside and around your body?</p></div></div></div></div>`;
  instruct("Tap Bones, Muscles, and Skin to look inside the body!");
  $$(".layer-btn").forEach(btn => btn.addEventListener("click", e => {
    const layer = layers.find(l => l.key === btn.dataset.key); $$(".layer-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active");
    $("#anatomyOverlay").textContent = layer.icon; $(".layer-info").innerHTML = `<div class="fact-bubble"><h3>${layer.icon} ${layer.title}</h3><p>“${layer.quote}”</p><p>${layer.fact}</p></div>`; speak(`${layer.title}. ${layer.quote} ${layer.fact}`);
    if (!seen.has(layer.key)) { seen.add(layer.key); awardCorrect(e, `You discovered ${layer.title}!`); if (seen.size === layers.length) setTimeout(() => completeLevel("You discovered bones, muscles, and skin!"), 1500); }
  })); updateHUD();
}

/* ---------- Level 5: physical action prompts ---------- */
function levelFive() {
  const actions = [
    ["🧠", "Touch your head!", "Your head is your thinking headquarters!"], ["👋", "Wave your hands!", "Hands can wave, hold, draw, and build!"],
    ["👣", "Stomp your feet!", "Feet help you balance, walk, and stomp!"], ["🦒", "Turn your neck gently!", "Your neck helps your head turn. Nice and gentle!"],
    ["💪", "Stretch your arms!", "Arms help you reach, lift, hug, and play!"], ["🦵", "Jump on your legs!", "Legs and muscles work together to jump!"]
  ];
  let current = 0; state.levelTotal = actions.length; state.levelCorrect = 0;
  $("#levelStage").innerHTML = `<div class="action-wrap"><h2 class="level-title">🏃 Body Action Challenge</h2><div class="action-card"><div id="actionEmoji" class="action-emoji"></div><h3 id="actionTitle"></h3><p id="actionFact"></p><button id="didItButton" class="primary-btn did-it-btn">I did it! ⭐</button></div></div>`;
  function showAction() { const a = actions[current]; $("#actionEmoji").textContent = a[0]; $("#actionTitle").textContent = a[1]; $("#actionFact").textContent = a[2]; instruct(a[1]); }
  $("#didItButton").addEventListener("click", e => { awardCorrect(e, "Amazing move!"); current++; if (current === actions.length) setTimeout(() => completeLevel("You moved your whole body like a champion!"), 700); else setTimeout(showAction, 450); });
  showAction(); updateHUD();
}

/* ---------- Final boss: timed robot assembly ---------- */
function levelBoss() {
  const keys = ["head", "neck", "chest", "tummy", "arms", "legs"]; let time = 75; state.levelTotal = keys.length; state.levelCorrect = 0;
  $("#levelStage").innerHTML = `<h2 class="level-title">🤖 Final Mission: Fix the Robot!</h2><div class="boss-layout"><div class="boss-machine"><div id="bossTimer" class="timer">⏱ ${time}s</div>${bodyFigure()}</div><div class="drag-bank boss-bank">${keys.sort(() => Math.random() - .5).map(k => `<button class="drag-card" data-part="${k}">${PARTS[k].emoji}<br>${PARTS[k].label}</button>`).join("")}</div></div>`;
  $$(".body-zone").forEach(z => { if (!keys.includes(z.dataset.part)) z.remove(); });
  instruct("Final mission! Put the robot parts in place before the timer runs out!");
  const handle = (card, target, e) => {
    if (!target) return;
    if (target.dataset.part === card.dataset.part) { card.classList.add("placed"); target.classList.add("hit"); target.disabled = true; awardCorrect(e, `${PARTS[card.dataset.part].label} repaired!`); if (state.levelCorrect === state.levelTotal) setTimeout(() => completeLevel("You repaired Dr. Buddy Bot and earned the golden Body Explorer Badge!"), 700); }
    else gentleWrong(PARTS[card.dataset.part].hint);
  };
  $$(".drag-card").forEach(c => makeDraggable(c, handle));
  $$(".body-zone").forEach(z => z.addEventListener("click", e => { const selected = $(".drag-card.selected"); if (selected) { selected.classList.remove("selected"); handle(selected, z, e); } }));
  state.timer = setInterval(() => { time--; const timer = $("#bossTimer"); if (!timer) return clearInterval(state.timer); timer.textContent = `⏱ ${time}s`; timer.classList.toggle("danger", time <= 15); if (time === 0) { clearInterval(state.timer); state.timer = null; time = 45; timer.textContent = `⏱ ${time}s`; showToast("Buddy added 45 seconds. Keep repairing!", "wrong"); speak("Time boost! Buddy added 45 seconds. Keep repairing!"); state.timer = setInterval(() => { time--; timer.textContent = `⏱ ${time}s`; if (time <= 0) { clearInterval(state.timer); state.timer = null; showToast("No worries—tap a part, then tap its place!", "wrong"); } }, 1000); } }, 1000);
  updateHUD();
}

const renderers = [levelOne, levelTwo, levelThree, levelFour, levelFive, levelBoss];
function beginLevel(index) {
  clearInterval(state.timer); state.timer = null; window.speechSynthesis?.cancel?.(); state.level = index; state.lives = 3; showScreen("gameScreen"); renderers[index]();
}
function renderMap() {
  $("#mapStars").textContent = state.stars;
  $("#levelMap").innerHTML = LEVELS.map((level, i) => {
    const locked = i > state.unlocked, done = state.completed.includes(i);
    return `<button class="map-node ${locked ? "locked" : ""} ${done ? "completed" : ""} ${level.boss ? "boss" : ""}" data-level="${i}" ${locked ? "disabled" : ""}><span class="node-icon">${locked ? "🔒" : level.icon}</span><b>${i === 5 ? "Final Boss" : `Level ${i + 1}`}: ${level.title}</b><small>${level.blurb}</small><div class="node-stars">${done ? "★ ★ ★" : "☆ ☆ ☆"}</div></button>`;
  }).join("");
  $$(".map-node:not(.locked)").forEach(n => n.addEventListener("click", () => beginLevel(+n.dataset.level)));
}
function openMap() { clearInterval(state.timer); state.timer = null; window.speechSynthesis?.cancel?.(); renderMap(); showScreen("mapScreen"); }

/* ---------- Main controls ---------- */
$("#startButton").addEventListener("click", () => { state.name = $("#playerName").value.trim() || "Explorer"; state.stars = 0; state.unlocked = 0; state.completed = []; save(); getAudio(); startMusic(); beginLevel(0); });
$("#continueButton").addEventListener("click", () => { getAudio(); startMusic(); openMap(); });
$("#homeButton").addEventListener("click", openMap);
$("#mapBackButton").addEventListener("click", () => showScreen("welcomeScreen"));
$("#repeatButton").addEventListener("click", () => speak(lastSpoken));
$("#soundButton").addEventListener("click", () => { state.sound = !state.sound; $("#soundButton").textContent = state.sound ? "🔊" : "🔇"; $("#soundButton").setAttribute("aria-label", state.sound ? "Turn sound off" : "Turn sound on"); if (state.sound) { startMusic(); speak("Sound on!"); } else { window.speechSynthesis?.cancel?.(); stopMusic(); } });
$("#modalButton").addEventListener("click", () => { $("#modal").classList.remove("show"); if (state.level === 5) openMap(); else beginLevel(Math.min(5, state.level + 1)); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { stopMusic(); window.speechSynthesis?.cancel?.(); } else if (state.sound && $("#gameScreen").classList.contains("active")) startMusic(); });

if (load()) $("#continueButton").classList.remove("hidden");
updateHUD();
