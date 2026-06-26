"use strict";

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const screens = {
  start: $("#startScreen"),
  game: $("#gameScreen"),
  map: $("#mapScreen"),
  certificate: $("#certificateScreen")
};

const state = {
  player: "Explorer",
  currentLevel: 0,
  completed: [false, false, false, false, false, false],
  stars: 0,
  gems: 0,
  coins: 0,
  voiceOn: true,
  musicOn: false,
  selectedCard: null,
  popOpen: false,
  questionTimer: null,
  audio: null,
  hatIndex: 0
};

const hats = ["🎩", "🧢", "👑", "🎓", "⛑️", "🧙"];

const levelInfo = [
  { icon: "🧊", title: "Matter Detective", short: "Sort solid, liquid, gas" },
  { icon: "🥛", title: "Fill the Container", short: "Watch water and air" },
  { icon: "👐", title: "Push or Pull", short: "Find the force" },
  { icon: "🙉", title: "Help Momo Move", short: "Use more or less force" },
  { icon: "⚡", title: "Energy Match", short: "Match energy sources" },
  { icon: "🏙️", title: "Save the Town", short: "Power the island town" },
  { icon: "🧪", title: "Science Lab", short: "Free experiment zone", lab: true }
];

const quickQuestions = [
  { q: "What is inside a blown balloon?", options: ["Air", "Stone", "Milk"], answer: 0, fact: "Yes! Air is a gas." },
  { q: "Can water change shape?", options: ["Yes", "No"], answer: 0, fact: "Yes! Water takes the shape of its container." },
  { q: "Is kicking a football a push or a pull?", options: ["Push", "Pull"], answer: 0, fact: "Correct! Your foot pushes the ball." },
  { q: "Where do plants get energy?", options: ["Sunlight", "Shoes", "Plastic"], answer: 0, fact: "Yes! Plants use sunlight." },
  { q: "Which object is a liquid?", options: ["Juice", "Pencil", "Chair"], answer: 0, fact: "Right! Juice flows, so it is a liquid." },
  { q: "What does energy help things do?", options: ["Move and work", "Hide forever", "Become invisible"], answer: 0, fact: "Great! Energy helps things move and work." }
];

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove("active", "show"));
  if (name === "certificate") screens.certificate.classList.add("show");
  else screens[name].classList.add("active");
}

function setGuide(text, speakNow = true) {
  $("#guideText").textContent = text;
  if (speakNow) speak(text);
}

function speak(text) {
  if (!state.voiceOn || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1.15;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function getAudio() {
  if (!state.audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) state.audio = new AudioContext();
  }
  return state.audio;
}

function playTone(type = "good") {
  const audio = getAudio();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.type = "sine";
  oscillator.frequency.value = type === "good" ? 660 : type === "try" ? 220 : 880;
  gain.gain.setValueAtTime(.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.12, audio.currentTime + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .22);
  oscillator.start();
  oscillator.stop(audio.currentTime + .24);
}

function updateRewards() {
  $("#starCount").textContent = state.stars;
  $("#gemCount").textContent = state.gems;
  $("#coinCount").textContent = state.coins;
  $("#mapGemCount").textContent = state.gems;
  const crystals = state.completed.filter(Boolean).length;
  $("#crystalProgressText").textContent = `${crystals} / 6 Crystals`;
  $("#crystalProgressFill").style.width = `${(crystals / 6) * 100}%`;
  $("#momoHat").textContent = hats[state.hatIndex];
}

function rewardSmall(message = "Great job, Explorer!") {
  state.stars += 2;
  state.coins += 1;
  updateRewards();
  playTone("good");
  sparkle();
  toast(message);
}

function toast(message, type = "good") {
  const box = $("#toast");
  box.textContent = message;
  box.className = `toast show ${type === "try" ? "try" : ""}`;
  clearTimeout(box.timer);
  box.timer = setTimeout(() => box.classList.remove("show"), 1800);
}

function sparkle() {
  const emojis = ["⭐", "✨", "💫", "🟡"];
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("span");
    s.className = "sparkle";
    s.textContent = emojis[i % emojis.length];
    s.style.left = `${35 + Math.random() * 30}%`;
    s.style.top = `${32 + Math.random() * 25}%`;
    s.style.setProperty("--x", `${(Math.random() - .5) * 180}px`);
    s.style.setProperty("--y", `${-40 - Math.random() * 100}px`);
    $("#celebrationLayer").appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

function confetti(amount = 50) {
  const colors = ["#ff629b", "#ffd84d", "#49bff2", "#22a66f", "#7360e8", "#ff9645"];
  for (let i = 0; i < amount; i++) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * .45}s`;
    piece.style.setProperty("--drift", `${(Math.random() - .5) * 250}px`);
    $("#celebrationLayer").appendChild(piece);
    setTimeout(() => piece.remove(), 3100);
  }
}

function fireworks(amount = 36) {
  const colors = ["#ff629b", "#ffd84d", "#49bff2", "#22a66f", "#7360e8"];
  for (let i = 0; i < amount; i++) {
    const fire = document.createElement("i");
    fire.className = "firework";
    fire.style.left = `${20 + Math.random() * 60}%`;
    fire.style.top = `${18 + Math.random() * 45}%`;
    fire.style.background = colors[i % colors.length];
    fire.style.setProperty("--x", `${(Math.random() - .5) * 260}px`);
    fire.style.setProperty("--y", `${(Math.random() - .5) * 220}px`);
    $("#celebrationLayer").appendChild(fire);
    setTimeout(() => fire.remove(), 1000);
  }
}

function renderMap() {
  const crystals = state.completed.filter(Boolean).length;
  $("#islandMap").innerHTML = levelInfo.map((level, index) => {
    const unlocked = level.lab || index <= crystals;
    const done = state.completed[index] || false;
    return `
      <button class="map-node ${done ? "done" : ""} ${unlocked ? "" : "locked"} ${level.lab ? "lab-node" : ""}"
        data-level="${index}" ${unlocked ? "" : "disabled"}>
        <span>${level.icon}</span>
        ${level.title}
        <small>${done ? "Crystal collected!" : level.short}</small>
      </button>
    `;
  }).join("");
  $$(".map-node").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.level);
      if (button.disabled) return;
      if (index === 6) renderLab();
      else renderLevel(index);
      showScreen("game");
    });
  });
}

function completeLevel(index) {
  if (!state.completed[index]) {
    state.completed[index] = true;
    state.gems += 1;
    state.stars += 20;
    state.coins += 10;
    state.hatIndex = Math.min(hats.length - 1, state.completed.filter(Boolean).length - 1);
    confetti(70);
    $("#momoGuide").classList.add("happy");
    setTimeout(() => $("#momoGuide").classList.remove("happy"), 1800);
    toast(`💎 Science Crystal found! Momo unlocked a new hat: ${hats[state.hatIndex]}`);
  }
  updateRewards();
  renderMap();
  const crystals = state.completed.filter(Boolean).length;
  if (crystals >= 6) {
    setTimeout(showCertificate, 1400);
  } else {
    setTimeout(() => {
      renderMap();
      showScreen("map");
    }, 1600);
  }
}

function levelShell(title, lesson, body, finishText = "Collect Crystal 💎") {
  $("#stage").innerHTML = `
    <h2 class="level-title">${title}</h2>
    <div class="lesson-strip">${lesson}</div>
    ${body}
    <div class="complete-row">
      <button id="finishLevelButton" class="primary-action finish-level">${finishText}</button>
    </div>
  `;
}

function showFinish(callback) {
  const finish = $("#finishLevelButton");
  finish.classList.add("show");
  finish.addEventListener("click", callback, { once: true });
}

function setupDragCards(onDrop) {
  state.selectedCard = null;
  let dragging = null;
  let source = null;

  $$(".play-card").forEach(card => {
    card.addEventListener("click", () => {
      if (card.classList.contains("done")) return;
      $$(".play-card").forEach(item => item.classList.remove("selected"));
      state.selectedCard = card;
      card.classList.add("selected");
      toast(`Now tap where ${card.textContent.trim()} belongs.`);
    });

    card.addEventListener("pointerdown", event => {
      if (card.classList.contains("done")) return;
      event.preventDefault();
      source = card;
      dragging = card.cloneNode(true);
      dragging.classList.add("dragging");
      document.body.appendChild(dragging);
      moveDrag(event);
      card.setPointerCapture(event.pointerId);
    });

    card.addEventListener("pointermove", event => {
      if (!dragging) return;
      moveDrag(event);
    });

    card.addEventListener("pointerup", event => {
      if (!dragging) return;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const zone = hit && hit.closest("[data-zone]");
      dragging.remove();
      dragging = null;
      if (zone) onDrop(source, zone);
      $$(".drop-zone, .energy-target, .town-spot").forEach(item => item.classList.remove("hover"));
    });
  });

  $$("[data-zone]").forEach(zone => {
    zone.addEventListener("click", () => {
      if (state.selectedCard) onDrop(state.selectedCard, zone);
    });
    zone.addEventListener("pointerenter", () => zone.classList.add("hover"));
    zone.addEventListener("pointerleave", () => zone.classList.remove("hover"));
  });

  function moveDrag(event) {
    dragging.style.left = `${event.clientX}px`;
    dragging.style.top = `${event.clientY}px`;
  }
}

function renderLevel(index) {
  state.currentLevel = index;
  $("#levelName").textContent = levelInfo[index].title;
  showScreen("game");
  const renderers = [renderMatterDetective, renderContainerGame, renderPushPull, renderMomoMove, renderEnergyMatch, renderTownSave];
  renderers[index]();
}

function renderMatterDetective() {
  const items = [
    { name: "🪑 Chair", type: "solid", explain: "A chair keeps its shape. It is a solid." },
    { name: "🥛 Milk", type: "liquid", explain: "Milk flows. It is a liquid." },
    { name: "🎈 Balloon air", type: "gas", explain: "Air fills the balloon. It is a gas." },
    { name: "📘 Book", type: "solid", explain: "A book keeps its shape. It is a solid." },
    { name: "♨️ Steam", type: "gas", explain: "Steam floats in the air. It is a gas." },
    { name: "🧊 Ice cube", type: "solid", explain: "Ice is hard and keeps its shape. It is a solid." },
    { name: "🧃 Juice", type: "liquid", explain: "Juice flows into a cup. It is a liquid." },
    { name: "✏️ Pencil", type: "solid", explain: "A pencil keeps its shape. It is a solid." }
  ];
  let correct = 0;
  levelShell(
    "🧊 Mini Game 1: Matter Detective",
    `<p>Everything around us is made of matter.</p><p>Matter takes up space and has weight.</p><p>Can you sort these things?</p>`,
    `
      <div class="two-column">
        <div class="item-bank">
          ${items.map((item, i) => `<button class="play-card" data-type="${item.type}" data-explain="${item.explain}" data-id="${i}">${item.name}</button>`).join("")}
        </div>
        <div class="drop-grid">
          <section class="drop-zone" data-zone="solid"><h3>🧊 Solid</h3><div class="zone-items"></div></section>
          <section class="drop-zone" data-zone="liquid"><h3>💧 Liquid</h3><div class="zone-items"></div></section>
          <section class="drop-zone" data-zone="gas"><h3>☁ Gas</h3><div class="zone-items"></div></section>
        </div>
      </div>
    `
  );
  setGuide("Matter is all around us. Drag each object to solid, liquid, or gas.");
  setupDragCards((card, zone) => {
    if (card.classList.contains("done")) return;
    const type = card.dataset.type;
    if (zone.dataset.zone === type) {
      card.classList.add("done");
      zone.classList.add("success");
      setTimeout(() => zone.classList.remove("success"), 700);
      zone.querySelector(".zone-items").insertAdjacentHTML("beforeend", `<span class="placed-chip">${card.textContent}</span>`);
      state.selectedCard = null;
      correct++;
      rewardSmall(`Correct! ${card.dataset.explain}`);
      speak(card.dataset.explain);
      if (correct === items.length) showFinish(() => completeLevel(0));
    } else {
      zone.classList.add("try");
      setTimeout(() => zone.classList.remove("try"), 500);
      playTone("try");
      toast(`Oops! ${card.dataset.explain}`, "try");
      speak(`Oops! ${card.dataset.explain}`);
    }
  });
}

function renderContainerGame() {
  let poured = 0;
  let balloonSize = 0;
  let answered = false;
  const containers = [
    ["Glass", "glass"],
    ["Bottle", "bottle"],
    ["Bucket", "bucket"],
    ["Cup", "cup"]
  ];
  levelShell(
    "🥛 Mini Game 2: Fill the Container",
    `<p>Water is a liquid.</p><p>It changes shape to fit the container.</p><p>Air is a gas. It can fill a balloon.</p>`,
    `
      <div class="container-game">
        <div class="container-row">
          ${containers.map(([name, cls], i) => `
            <section class="container-card">
              <div class="container-art">
                <div class="vessel ${cls}"><i class="water-fill" id="fill${i}"></i></div>
              </div>
              <button class="big-button pour-button" data-fill="fill${i}">Pour into ${name}</button>
            </section>
          `).join("")}
        </div>
        <div class="balloon-lab">
          <div>
            <div id="bigBalloon" class="big-balloon"></div>
            <button id="inflateButton" class="big-button">Blow air 💨</button>
          </div>
          <div>
            <h3>What is filling the balloon?</h3>
            <div class="choice-bank">
              <button class="choice-button balloon-answer" data-answer="wrong">Water</button>
              <button class="choice-button balloon-answer" data-answer="right">Air</button>
            </div>
          </div>
        </div>
      </div>
    `
  );
  setGuide("Pour water into each container. What do you think will happen to its shape?");
  $$(".pour-button").forEach(button => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      button.disabled = true;
      $(`#${button.dataset.fill}`).classList.add("full");
      poured++;
      rewardSmall("The water changed shape to fit the container!");
      speak("The water changed shape to fit the container.");
      checkDone();
    });
  });
  $("#inflateButton").addEventListener("click", () => {
    balloonSize = Math.min(3, balloonSize + 1);
    $("#bigBalloon").className = `big-balloon size-${balloonSize}`;
    rewardSmall("Air is filling the balloon!");
    speak("Air is filling the balloon.");
  });
  $$(".balloon-answer").forEach(button => {
    button.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      if (button.dataset.answer === "right") {
        button.classList.add("correct");
        rewardSmall("Yes! Air is filling the balloon.");
        speak("Yes! Air is filling the balloon.");
      } else {
        button.classList.add("wrong");
        toast("Not quite. Air is filling the balloon.", "try");
        speak("Not quite. Air is filling the balloon.");
      }
      checkDone();
    });
  });
  function checkDone() {
    if (poured === 4 && answered && balloonSize > 0) showFinish(() => completeLevel(1));
  }
}

function renderPushPull() {
  const tasks = [
    { emoji: "🚪", name: "Door", answer: "pull", text: "Open the door toward you." },
    { emoji: "🗄️", name: "Drawer", answer: "pull", text: "Open the drawer." },
    { emoji: "🧸", name: "Toy wagon", answer: "pull", text: "Bring the toy wagon closer." },
    { emoji: "⚽", name: "Football", answer: "push", text: "Kick the football." },
    { emoji: "🛒", name: "Shopping cart", answer: "push", text: "Move the cart forward." },
    { emoji: "🚪", name: "Cabinet", answer: "push", text: "Close the cabinet door." }
  ];
  let step = 0;
  levelShell(
    "👐 Mini Game 3: Push or Pull",
    `<p>A force is simply a push or a pull.</p><p>Push means move away. Pull means bring closer.</p>`,
    `
      <div class="force-grid">
        <div class="object-stage">
          <div>
            <div id="forceObject" class="moving-object">🚪</div>
            <p id="forceTask" class="object-name">Open the door toward you.</p>
          </div>
        </div>
        <div class="force-actions">
          <button class="choice-button force-choice" data-choice="push">Push 👉</button>
          <button class="choice-button force-choice" data-choice="pull">Pull 👈</button>
        </div>
      </div>
    `
  );
  setGuide("Look at the action. Is it a push or a pull?");
  showTask();
  $$(".force-choice").forEach(button => {
    button.addEventListener("click", () => {
      const task = tasks[step];
      const object = $("#forceObject");
      object.classList.remove("push", "pull");
      void object.offsetWidth;
      if (button.dataset.choice === task.answer) {
        object.classList.add(task.answer);
        rewardSmall(`Yes! ${task.name}: ${task.answer}.`);
        speak(`Yes! That is a ${task.answer}.`);
        step++;
        if (step === tasks.length) {
          setTimeout(() => showFinish(() => completeLevel(2)), 600);
        } else {
          setTimeout(showTask, 850);
        }
      } else {
        button.classList.add("wrong");
        playTone("try");
        toast(`Try again. ${task.text}`, "try");
        speak(`Try again. ${task.text}`);
        setTimeout(() => button.classList.remove("wrong"), 550);
      }
    });
  });
  function showTask() {
    const task = tasks[step];
    $("#forceObject").className = "moving-object";
    $("#forceObject").textContent = task.emoji;
    $("#forceTask").textContent = task.text;
  }
}

function renderMomoMove() {
  const tasks = [
    { emoji: "🪨", name: "Big rock", answer: "hard", fact: "A big rock is heavy. It needs more force." },
    { emoji: "📦", name: "Small box", answer: "soft", fact: "A small box can move with a soft push." },
    { emoji: "🚗", name: "Toy car", answer: "soft", fact: "A toy car is light. A soft push can move it." },
    { emoji: "🧳", name: "Heavy suitcase", answer: "pull", fact: "A suitcase can be pulled by its handle." }
  ];
  let step = 0;
  levelShell(
    "🙉 Mini Game 4: Help Momo Move Objects",
    `<p>Some things are light. Some things are heavy.</p><p>Heavy things need more force.</p>`,
    `
      <div class="momo-workshop">
        <div id="workObject" class="work-object">
          <div>
            <span class="emoji">🪨</span>
            <strong>Big rock</strong>
          </div>
        </div>
        <div class="work-options">
          <button class="choice-button move-choice" data-choice="hard">Push harder 💪</button>
          <button class="choice-button move-choice" data-choice="soft">Push softly 👉</button>
          <button class="choice-button move-choice" data-choice="pull">Pull 👈</button>
          <button class="choice-button move-choice" data-choice="none">No force 💤</button>
        </div>
      </div>
    `
  );
  setGuide("Momo needs help. Choose the best force for each object.");
  showObject();
  $$(".move-choice").forEach(button => {
    button.addEventListener("click", () => {
      const task = tasks[step];
      const work = $("#workObject");
      work.classList.remove("move-hard", "move-soft", "no-move");
      void work.offsetWidth;
      if (button.dataset.choice === task.answer) {
        work.classList.add(task.answer === "hard" ? "move-hard" : "move-soft");
        rewardSmall(task.fact);
        speak(task.fact);
        step++;
        if (step === tasks.length) {
          setTimeout(() => showFinish(() => completeLevel(3)), 650);
        } else {
          setTimeout(showObject, 900);
        }
      } else {
        work.classList.add("no-move");
        playTone("try");
        toast(`Momo says: Hmm, try a better force! ${task.fact}`, "try");
        speak(`Try a better force. ${task.fact}`);
      }
    });
  });
  function showObject() {
    const task = tasks[step];
    $("#workObject").innerHTML = `<div><span class="emoji">${task.emoji}</span><strong>${task.name}</strong></div>`;
    $("#workObject").className = "work-object";
  }
}

function renderEnergyMatch() {
  const pairs = [
    { source: "🔋 Battery", target: "torch", object: "🔦 Torch", fact: "A torch uses batteries." },
    { source: "☀️ Sun", target: "plant", object: "🌱 Plant", fact: "Plants get energy from sunlight." },
    { source: "🍎 Food", target: "child", object: "🏃 Child", fact: "People get energy from food." },
    { source: "🔌 Electricity", target: "fan", object: "🌀 Fan", fact: "Fans need electricity." },
    { source: "⛽ Fuel", target: "car", object: "🚗 Car", fact: "Cars get energy from fuel." },
    { source: "💨 Wind", target: "windmill", object: "🌬️ Windmill", fact: "Wind can move a windmill." }
  ];
  let correct = 0;
  levelShell(
    "⚡ Mini Game 5: Energy Match",
    `<p>Energy helps things move and work.</p><p>Match each energy source to the thing that needs it.</p>`,
    `
      <div class="match-layout">
        <div class="item-bank">
          ${pairs.map(pair => `<button class="play-card" data-type="${pair.target}" data-explain="${pair.fact}">${pair.source}</button>`).join("")}
        </div>
        <div class="energy-targets">
          ${pairs.map(pair => `<section class="energy-target" data-zone="${pair.target}">${pair.object}<small>Drop energy here</small></section>`).join("")}
        </div>
      </div>
    `
  );
  setGuide("Drag the energy source to the object. What do you think makes it work?");
  setupDragCards((card, zone) => {
    if (card.classList.contains("done")) return;
    if (card.dataset.type === zone.dataset.zone) {
      card.classList.add("done");
      zone.classList.add("done", "success");
      zone.innerHTML = `${zone.textContent.split("Drop")[0]}<strong>${card.textContent}</strong>`;
      correct++;
      rewardSmall(card.dataset.explain);
      speak(card.dataset.explain);
      if (correct === pairs.length) showFinish(() => completeLevel(4));
    } else {
      zone.classList.add("try");
      setTimeout(() => zone.classList.remove("try"), 500);
      playTone("try");
      toast(`Try again. ${card.dataset.explain}`, "try");
      speak(`Try again. ${card.dataset.explain}`);
    }
  });
}

function renderTownSave() {
  const pairs = [
    { source: "🔌 Electricity", target: "lights", object: "💡 Street lights", fact: "Street lights need electricity." },
    { source: "💨 Wind", target: "windmill", object: "🌬️ Windmill", fact: "Wind makes the windmill move." },
    { source: "☀️ Sun", target: "solar", object: "🔆 Solar panels", fact: "Solar panels use sunlight." },
    { source: "⚡ Electricity", target: "train", object: "🚆 Electric train", fact: "An electric train needs electricity." },
    { source: "🍎 Food", target: "school", object: "🏫 School children", fact: "Children get energy from food." },
    { source: "🔋 Battery", target: "hospital", object: "🏥 Hospital torch", fact: "A torch can use battery energy." }
  ];
  let correct = 0;
  levelShell(
    "🏙️ Mini Game 6: Save the Town",
    `<p>The town needs energy.</p><p>Give each place the correct energy source. Watch the town light up!</p>`,
    `
      <div class="town-layout">
        <div class="item-bank">
          ${pairs.map(pair => `<button class="play-card" data-type="${pair.target}" data-explain="${pair.fact}">${pair.source}</button>`).join("")}
        </div>
        <div class="town-scene">
          ${pairs.map(pair => `<section class="town-spot" data-zone="${pair.target}">${pair.object}<small>Needs energy</small></section>`).join("")}
        </div>
      </div>
    `
  );
  setGuide("Science Adventure Town is dark. Match the energy and save the town!");
  setupDragCards((card, zone) => {
    if (card.classList.contains("done")) return;
    if (card.dataset.type === zone.dataset.zone) {
      card.classList.add("done");
      zone.classList.add("done", "success");
      zone.innerHTML = `${zone.textContent.split("Needs")[0]}<strong>${card.textContent}</strong>`;
      correct++;
      rewardSmall(card.dataset.explain);
      speak(card.dataset.explain);
      if (correct === pairs.length) {
        fireworks(60);
        showFinish(() => completeLevel(5));
      }
    } else {
      zone.classList.add("try");
      setTimeout(() => zone.classList.remove("try"), 500);
      playTone("try");
      toast(`Try another place. ${card.dataset.explain}`, "try");
      speak(`Try another place. ${card.dataset.explain}`);
    }
  });
}

function renderLab() {
  $("#levelName").textContent = "Bonus Science Lab";
  showScreen("game");
  $("#stage").innerHTML = `
    <h2 class="level-title">🧪 Bonus Mini Game: Science Lab</h2>
    <div class="lesson-strip">
      <p>No right or wrong answers here.</p>
      <p>Try things. Watch what happens. Ask, “What do you think will happen?”</p>
    </div>
    <div class="lab-grid">
      ${labCard("freeze", "💧", "Freeze water", "Water became ice! Cold can freeze water.")}
      ${labCard("heat", "🧊", "Heat ice", "Ice melted into water! Heat can melt ice.")}
      ${labCard("balloon", "🎈", "Blow air into balloon", "Air filled the balloon. Air is a gas.")}
      ${labCard("kick", "⚽", "Kick football", "Your foot pushed the ball. That is force.")}
      ${labCard("fan-on", "🌀", "Switch fan ON", "Electricity helps the fan work.")}
      ${labCard("fan-off", "🌀", "Switch fan OFF", "No electricity, no spinning fan.")}
    </div>
    <div class="complete-row">
      <button id="backToMapFromLab" class="primary-action">Back to Map 🗺️</button>
    </div>
  `;
  setGuide("Welcome to the Science Lab. Try an experiment and watch what happens.");
  $$(".lab-card").forEach(card => {
    card.addEventListener("click", () => runLab(card));
  });
  $("#backToMapFromLab").addEventListener("click", () => {
    renderMap();
    showScreen("map");
  });
}

function labCard(action, emoji, label, result) {
  return `
    <button class="lab-card" data-action="${action}" data-result="${result}">
      <span class="lab-emoji">${emoji}</span>
      <strong>${label}</strong>
      <p>Tap to test!</p>
    </button>
  `;
}

function runLab(card) {
  const icon = card.querySelector(".lab-emoji");
  const result = card.dataset.result;
  card.querySelector("p").textContent = result;
  icon.className = "lab-emoji";
  void icon.offsetWidth;
  if (card.dataset.action === "freeze") {
    icon.textContent = "🧊";
    icon.classList.add("freeze");
  }
  if (card.dataset.action === "heat") {
    icon.textContent = "💧";
    icon.classList.add("heat");
  }
  if (card.dataset.action === "balloon") {
    icon.textContent = "🎈";
    icon.style.transform = "scale(1.25)";
  }
  if (card.dataset.action === "kick") {
    icon.textContent = "⚽";
    icon.style.transform = "translateX(50px) rotate(90deg)";
  }
  if (card.dataset.action === "fan-on") {
    icon.textContent = "🌀";
    icon.classList.add("spin");
  }
  if (card.dataset.action === "fan-off") {
    icon.textContent = "🌀";
    icon.style.filter = "grayscale(1)";
  }
  rewardSmall(result);
  speak(result);
}

function askQuickQuestion() {
  if (!screens.game.classList.contains("active") || state.popOpen) return;
  const item = quickQuestions[Math.floor(Math.random() * quickQuestions.length)];
  state.popOpen = true;
  $("#popQuestion").textContent = item.q;
  $("#popFeedback").textContent = "";
  $("#popAnswers").innerHTML = item.options.map((option, index) =>
    `<button class="choice-button pop-choice" data-index="${index}">${option}</button>`
  ).join("");
  $("#questionPop").classList.add("show");
  speak(`Quick question. ${item.q}`);
  $$(".pop-choice").forEach(button => {
    button.addEventListener("click", () => {
      const isRight = Number(button.dataset.index) === item.answer;
      if (isRight) {
        button.classList.add("correct");
        $("#popFeedback").textContent = `🎉 ${item.fact}`;
        state.stars += 5;
        state.coins += 3;
        updateRewards();
        playTone("good");
        speak(item.fact);
      } else {
        button.classList.add("wrong");
        $("#popFeedback").textContent = `Good try! ${item.fact}`;
        playTone("try");
        speak(`Good try. ${item.fact}`);
      }
      $$(".pop-choice").forEach(choice => choice.disabled = true);
      setTimeout(() => {
        $("#questionPop").classList.remove("show");
        state.popOpen = false;
      }, 1600);
    }, { once: true });
  });
}

function showCertificate() {
  $("#certificateName").textContent = state.player;
  showScreen("certificate");
  confetti(100);
  fireworks(80);
  speak("Fantastic! You helped save Science Adventure Island! You are now an official Junior Science Explorer!");
}

function startGame() {
  state.player = $("#playerName").value.trim() || "Explorer";
  $("#certificateName").textContent = state.player;
  updateRewards();
  renderMap();
  renderLevel(0);
  if (!state.questionTimer) {
    state.questionTimer = setInterval(askQuickQuestion, 150000);
  }
}

function restartGame() {
  state.currentLevel = 0;
  state.completed = [false, false, false, false, false, false];
  state.stars = 0;
  state.gems = 0;
  state.coins = 0;
  state.hatIndex = 0;
  updateRewards();
  renderMap();
  renderLevel(0);
}

function toggleVoice(button) {
  state.voiceOn = !state.voiceOn;
  if (!state.voiceOn && "speechSynthesis" in window) window.speechSynthesis.cancel();
  const text = state.voiceOn ? "🔊 Voice On" : "🔇 Voice Off";
  $("#soundToggle").textContent = state.voiceOn ? "🔊" : "🔇";
  $("#soundToggleStart").textContent = text;
  if (button) button.textContent = button.id === "soundToggleStart" ? text : (state.voiceOn ? "🔊" : "🔇");
}

$("#startButton").addEventListener("click", startGame);
$("#soundToggleStart").addEventListener("click", event => toggleVoice(event.currentTarget));
$("#soundToggle").addEventListener("click", event => toggleVoice(event.currentTarget));
$("#repeatButton").addEventListener("click", () => speak($("#guideText").textContent));
$("#mapButton").addEventListener("click", () => {
  renderMap();
  showScreen("map");
});
$("#closeMapButton").addEventListener("click", () => showScreen("game"));
$("#playAgainButton").addEventListener("click", restartGame);

updateRewards();
