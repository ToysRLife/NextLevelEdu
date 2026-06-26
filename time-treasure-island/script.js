"use strict";

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const screens = {
  start: $("#startScreen"),
  game: $("#gameScreen"),
  map: $("#mapScreen"),
  dashboard: $("#dashboardScreen"),
  certificate: $("#certificateScreen")
};

const state = {
  player: "Explorer",
  level: 0,
  completed: Array(15).fill(false),
  stars: 0,
  gems: 0,
  coins: 0,
  attempts: 0,
  correct: 0,
  voice: true,
  startTime: Date.now(),
  levelStart: Date.now(),
  levelTimes: Array(15).fill(0),
  wrongPatterns: {},
  mastered: new Set(),
  needsPractice: new Set(),
  badges: [],
  skin: "Captain Hat",
  audio: null
};

const levels = [
  { icon: "🧩", title: "Clock Builder", concept: "Clock parts", badge: "Clock Builder" },
  { icon: "🕒", title: "O'Clock Cove", concept: "O'clock", badge: "O'Clock Star" },
  { icon: "🕝", title: "Half Past Harbor", concept: "Half past", badge: "Half Past Hero" },
  { icon: "🕞", title: "Quarter Quest", concept: "Quarter past and quarter to", badge: "Quarter Captain" },
  { icon: "🎯", title: "Catch the Correct Time", concept: "Reading clocks", badge: "Clock Catcher" },
  { icon: "🚌", title: "Bus Time", concept: "On time", badge: "Bus Buddy" },
  { icon: "🎂", title: "Birthday Planner", concept: "Daily order", badge: "Planner Pal" },
  { icon: "🌞", title: "AM PM Island", concept: "AM and PM", badge: "Day Night Detective" },
  { icon: "⏳", title: "Time Race", concept: "Elapsed time", badge: "Time Racer" },
  { icon: "🔔", title: "School Bell", concept: "Schedules", badge: "Bell Ringer" },
  { icon: "🪙", title: "Coin Sorting", concept: "Coins and notes", badge: "Money Sorter" },
  { icon: "💰", title: "Treasure Chest", concept: "Make amount", badge: "Amount Maker" },
  { icon: "🛍️", title: "Ruby's Toy Shop", concept: "Shopping and enough money", badge: "Smart Shopper" },
  { icon: "🍦", title: "Ice Cream Change", concept: "Finding change", badge: "Change Champion" },
  { icon: "🗺️", title: "Final Treasure Map", concept: "Time and money revision", badge: "Treasure Master" }
];

const money = [
  { value: 1, kind: "coin" },
  { value: 2, kind: "coin" },
  { value: 5, kind: "coin" },
  { value: 10, kind: "coin" },
  { value: 20, kind: "note" },
  { value: 50, kind: "note" },
  { value: 100, kind: "note" },
  { value: 200, kind: "note" },
  { value: 500, kind: "note" }
];

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove("active", "show"));
  if (name === "certificate") screens.certificate.classList.add("show");
  else screens[name].classList.add("active");
}

function speak(text) {
  if (!state.voice || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const voice = new SpeechSynthesisUtterance(text);
  voice.rate = .92;
  voice.pitch = 1.12;
  voice.volume = 1;
  window.speechSynthesis.speak(voice);
}

function guide(text) {
  $("#guideText").textContent = text;
  speak(text);
}

function audioCtx() {
  if (!state.audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) state.audio = new AudioContext();
  }
  return state.audio;
}

function tone(kind = "good") {
  const ctx = audioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = kind === "good" ? 740 : kind === "win" ? 980 : 230;
  gain.gain.setValueAtTime(.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.13, ctx.currentTime + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .22);
  osc.start();
  osc.stop(ctx.currentTime + .25);
}

function updateStats() {
  const done = state.completed.filter(Boolean).length;
  $("#starCount").textContent = state.stars;
  $("#gemCount").textContent = state.gems;
  $("#coinCount").textContent = state.coins;
  $("#progressText").textContent = `${done} / ${levels.length} Levels`;
  $("#progressFill").style.width = `${(done / levels.length) * 100}%`;
  const accuracy = state.attempts ? Math.round((state.correct / state.attempts) * 100) : 100;
  $("#accuracyText").textContent = `${accuracy}%`;
  $("#certificateButton").disabled = done < levels.length;
}

function toast(message, type = "good") {
  const box = $("#toast");
  box.textContent = message;
  box.className = `toast show ${type === "try" ? "try" : ""}`;
  clearTimeout(box.timer);
  box.timer = setTimeout(() => box.classList.remove("show"), 1800);
}

function confetti(amount = 45) {
  const colors = ["#ff5d93", "#ffd84d", "#3eb8f3", "#26b979", "#6b56e8", "#ff9148"];
  for (let i = 0; i < amount; i++) {
    const bit = document.createElement("i");
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = `${Math.random() * .45}s`;
    bit.style.setProperty("--drift", `${(Math.random() - .5) * 260}px`);
    $("#confetti").appendChild(bit);
    setTimeout(() => bit.remove(), 3100);
  }
}

function record(isCorrect, concept) {
  state.attempts++;
  if (isCorrect) {
    state.correct++;
    state.mastered.add(concept);
    state.needsPractice.delete(concept);
  } else {
    state.needsPractice.add(concept);
    state.wrongPatterns[concept] = (state.wrongPatterns[concept] || 0) + 1;
  }
  updateStats();
}

function reward(message = "Great job!") {
  state.stars += 2;
  state.coins += 1;
  updateStats();
  tone("good");
  toast(message);
}

function wrong(message = "Try again!") {
  tone("try");
  toast(message, "try");
  speak(message);
}

function finishLevel() {
  const index = state.level;
  if (!state.completed[index]) {
    state.completed[index] = true;
    state.gems += 1;
    state.stars += 15;
    state.coins += 8;
    state.levelTimes[index] += Math.round((Date.now() - state.levelStart) / 1000);
    if (!state.badges.includes(levels[index].badge)) state.badges.push(levels[index].badge);
    confetti(70);
    tone("win");
    toast(`🏆 Badge unlocked: ${levels[index].badge}!`);
  }
  updateStats();
  renderMap();
  if (state.completed.every(Boolean)) {
    setTimeout(showCertificate, 1200);
  } else {
    setTimeout(() => showScreen("map"), 1300);
  }
}

function levelShell(title, lesson, body) {
  $("#levelLabel").textContent = title;
  $("#stage").innerHTML = `
    <h2 class="level-title">${title}</h2>
    <div class="lesson">${lesson}</div>
    ${body}
    <div class="tool-row"><button id="finishButton" class="main-button finish-button">Collect Reward 💎</button></div>
  `;
}

function showFinish() {
  $("#finishButton").classList.add("show");
  $("#finishButton").addEventListener("click", finishLevel, { once: true });
}

function clockNumbers() {
  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    return `<span class="clock-number" style="--angle:${n * 30}deg">${n}</span>`;
  }).join("");
}

function clockHtml(id, hour = 3, minute = 0, small = false) {
  const hourDeg = ((hour % 12) * 30) + (minute * .5);
  const minDeg = minute * 6;
  return `
    <div id="${id}" class="${small ? "small-clock" : "interactive-clock"}" data-hour="${hour}" data-minute="${minute}">
      ${clockNumbers()}
      <i class="clock-hand hour-hand" style="transform:rotate(${hourDeg}deg)"></i>
      <i class="clock-hand minute-hand" style="transform:rotate(${minDeg}deg)"></i>
      <b class="clock-center"></b>
    </div>
  `;
}

function setClock(id, hour, minute) {
  const clock = $(`#${id}`);
  clock.dataset.hour = hour;
  clock.dataset.minute = minute;
  const hourDeg = ((hour % 12) * 30) + (minute * .5);
  const minDeg = minute * 6;
  clock.querySelector(".hour-hand").style.transform = `rotate(${hourDeg}deg)`;
  clock.querySelector(".minute-hand").style.transform = `rotate(${minDeg}deg)`;
}

function makeClockDraggable(id, onChange) {
  const clock = $(`#${id}`);
  if (!clock) return;
  clock.querySelectorAll(".clock-hand").forEach(hand => {
    hand.addEventListener("pointerdown", event => {
      event.preventDefault();
      hand.setPointerCapture(event.pointerId);
      moveHand(event, hand.classList.contains("hour-hand") ? "hour" : "minute");
    });
    hand.addEventListener("pointermove", event => {
      if (event.buttons !== 1) return;
      moveHand(event, hand.classList.contains("hour-hand") ? "hour" : "minute");
    });
  });

  function moveHand(event, type) {
    const box = clock.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    let hour = Number(clock.dataset.hour);
    let minute = Number(clock.dataset.minute);
    if (type === "hour") {
      hour = Math.round(angle / 30);
      if (hour === 0) hour = 12;
    } else {
      minute = Math.round((angle / 6) / 15) * 15;
      if (minute === 60) minute = 0;
    }
    setClock(id, hour, minute);
    onChange(hour, minute);
  }
}

function timeLabel(hour, minute) {
  const mm = String(minute).padStart(2, "0");
  return `${hour}:${mm}`;
}

function renderMap() {
  const unlocked = state.completed.filter(Boolean).length;
  $("#levelMap").innerHTML = levels.map((level, index) => {
    const open = index <= unlocked;
    return `
      <button class="map-node ${state.completed[index] ? "done" : ""} ${open ? "" : "locked"}" data-level="${index}" ${open ? "" : "disabled"}>
        <span>${level.icon}</span>
        ${index + 1}. ${level.title}
        <small>${state.completed[index] ? "Badge won!" : level.concept}</small>
      </button>
    `;
  }).join("");
  $$(".map-node").forEach(node => {
    node.addEventListener("click", () => {
      const index = Number(node.dataset.level);
      if (!node.disabled) renderLevel(index);
    });
  });
  updateStats();
}

function renderLevel(index) {
  state.level = index;
  state.levelStart = Date.now();
  showScreen("game");
  [
    gameClockBuilder,
    gameOClock,
    gameHalfPast,
    gameQuarter,
    gameCatchClock,
    gameBusTime,
    gameBirthdayPlanner,
    gameAmPm,
    gameElapsedTime,
    gameSchoolBell,
    gameCoinSorting,
    gameTreasureChest,
    gameToyShop,
    gameIceCreamChange,
    gameFinalMap
  ][index]();
}

function setupChoiceButtons(selector, correctValue, concept, success, fail = "Oops! Try again.") {
  $$(selector).forEach(button => {
    button.addEventListener("click", () => {
      const ok = button.dataset.value === String(correctValue);
      record(ok, concept);
      if (ok) {
        button.classList.add("correct");
        reward(success);
        speak(success);
      } else {
        button.classList.add("wrong", "shake");
        wrong(fail);
      }
    });
  });
}

function gameClockBuilder() {
  levelShell(
    "🧩 Clock Builder",
    `<p>A clock has numbers from 1 to 12.</p><p>The small hand shows the hour. The big hand shows the minutes.</p>`,
    `
      <div class="game-layout">
        <div class="play-zone">${clockHtml("builderClock", 3, 0)}</div>
        <div class="answer-zone">
          <button class="choice part-choice" data-value="hour">Small hand</button>
          <button class="choice part-choice" data-value="minute">Big hand</button>
          <button class="choice part-choice" data-value="numbers">Numbers</button>
          <p id="partQuestion" class="feedback">Tap the part that shows the hour.</p>
        </div>
      </div>
    `
  );
  guide("Let us build clock power. Tap the small hand. It shows the hour.");
  const tasks = [
    { ask: "Tap the part that shows the hour.", answer: "hour", say: "Yes! The small hand shows the hour." },
    { ask: "Tap the part that shows minutes.", answer: "minute", say: "Yes! The big hand shows minutes." },
    { ask: "Tap what helps us count time on a clock.", answer: "numbers", say: "Correct! Clock numbers help us read time." }
  ];
  let step = 0;
  $$(".part-choice").forEach(button => button.addEventListener("click", () => {
    const task = tasks[step];
    const ok = button.dataset.value === task.answer;
    record(ok, "Clock parts");
    if (ok) {
      reward(task.say);
      speak(task.say);
      step++;
      if (step === tasks.length) showFinish();
      else $("#partQuestion").textContent = tasks[step].ask;
    } else {
      wrong("Look again. Small means short. Big means long.");
    }
  }));
}

function handGame(title, lesson, targets, concept) {
  let step = 0;
  let hour = 1;
  let minute = 0;
  levelShell(
    title,
    lesson,
    `
      <div class="game-layout">
        <div class="play-zone">
          ${clockHtml("mainClock", hour, minute)}
          <div class="clock-controls">
            <button data-move="hourBack">Hour −</button>
            <button data-move="hourForward">Hour +</button>
            <button data-move="minBack">Minute −</button>
            <button data-move="minForward">Minute +</button>
          </div>
        </div>
        <div class="answer-zone">
          <span class="big-emoji">🕰️</span>
          <h3 id="targetTime">Show ${targets[0].label}</h3>
          <p class="feedback" id="clockFeedback">Move the hands, then press Check.</p>
          <button id="checkClock" class="main-button">Check Clock</button>
        </div>
      </div>
    `
  );
  guide(`Move the clock hands. Can you show ${targets[0].label}?`);
  makeClockDraggable("mainClock", (newHour, newMinute) => {
    hour = newHour;
    minute = newMinute;
  });
  $$(".clock-controls button").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.move === "hourForward") hour = hour === 12 ? 1 : hour + 1;
      if (button.dataset.move === "hourBack") hour = hour === 1 ? 12 : hour - 1;
      if (button.dataset.move === "minForward") minute = (minute + 15) % 60;
      if (button.dataset.move === "minBack") minute = (minute + 45) % 60;
      setClock("mainClock", hour, minute);
    });
  });
  $("#checkClock").addEventListener("click", () => {
    const target = targets[step];
    const ok = hour === target.h && minute === target.m;
    record(ok, concept);
    if (ok) {
      reward(`Great! That is ${target.label}.`);
      speak(`Great! That is ${target.label}.`);
      step++;
      if (step === targets.length) showFinish();
      else {
        $("#targetTime").textContent = `Show ${targets[step].label}`;
        guide(`Now show ${targets[step].label}.`);
      }
    } else {
      wrong(target.hint);
    }
  });
}

function gameOClock() {
  handGame(
    "🕒 O'Clock Cove",
    `<p>O'clock means the big hand points to 12.</p><p>The small hand points to the hour.</p>`,
    [
      { h: 3, m: 0, label: "3:00", hint: "For o'clock, put the big hand on 12." },
      { h: 7, m: 0, label: "7:00", hint: "The small hand should point to 7." },
      { h: 12, m: 0, label: "12:00", hint: "Both hands can point to 12." }
    ],
    "O'clock"
  );
}

function gameHalfPast() {
  handGame(
    "🕝 Half Past Harbor",
    `<p>Half past means 30 minutes after the hour.</p><p>The big hand points to 6.</p>`,
    [
      { h: 2, m: 30, label: "2:30", hint: "Half past means the big hand points to 6." },
      { h: 5, m: 30, label: "5:30", hint: "Put the big hand on 6 and the small hand near 5." }
    ],
    "Half past"
  );
}

function gameQuarter() {
  handGame(
    "🕞 Quarter Quest",
    `<p>Quarter past means 15 minutes after.</p><p>Quarter to means 15 minutes before the next hour.</p>`,
    [
      { h: 3, m: 15, label: "3:15, quarter past 3", hint: "Quarter past means big hand on 3." },
      { h: 5, m: 45, label: "5:45, quarter to 6", hint: "Quarter to means big hand on 9." }
    ],
    "Quarter time"
  );
}

function gameCatchClock() {
  const correct = { h: 4, m: 30, label: "4:30" };
  const options = [
    correct,
    { h: 4, m: 0, label: "4:00" },
    { h: 5, m: 30, label: "5:30" },
    { h: 8, m: 15, label: "8:15" }
  ].sort(() => Math.random() - .5);
  levelShell(
    "🎯 Catch the Correct Time",
    `<p>Clocks are floating by!</p><p>Tap the clock that shows 4:30.</p>`,
    `
      <div class="clock-card-grid">
        ${options.map((o, i) => `<button class="floating-clock" data-value="${o.label}">${clockHtml(`catch${i}`, o.h, o.m, true)}<p>${o.label}</p></button>`).join("")}
      </div>
    `
  );
  guide("Catch the clock that shows four thirty.");
  $$(".floating-clock").forEach(card => card.addEventListener("click", () => {
    const ok = card.dataset.value === correct.label;
    record(ok, "Reading clocks");
    if (ok) {
      card.classList.add("correct");
      reward("You caught the correct clock!");
      speak("You caught the correct clock.");
      showFinish();
    } else {
      card.classList.add("shake");
      wrong("Not this one. Look for the big hand on 6.");
    }
  }));
}

function gameBusTime() {
  levelShell(
    "🚌 Bus Time",
    `<p>Mr. Tock is late again!</p><p>The bus comes at 8:00. Which time reaches before the bus?</p>`,
    `
      <div class="game-layout">
        <div class="play-zone"><span class="big-emoji">🐢🚌</span><h3>Bus comes at 8:00</h3></div>
        <div class="answer-zone choice-grid">
          <button class="choice bus-choice" data-value="early">7:45</button>
          <button class="choice bus-choice" data-value="late">8:15</button>
          <button class="choice bus-choice" data-value="late">9:00</button>
          <button class="choice bus-choice" data-value="late">8:30</button>
        </div>
      </div>
    `
  );
  $("#tockMini").classList.remove("hidden");
  guide("Help Mr. Tock reach before eight o'clock.");
  $$(".bus-choice").forEach(button => button.addEventListener("click", () => {
    const ok = button.dataset.value === "early";
    record(ok, "On time");
    if (ok) {
      button.classList.add("correct");
      reward("Yes! 7:45 is before 8:00. Mr. Tock caught the bus!");
      speak("Yes! Seven forty-five is before eight.");
      showFinish();
    } else {
      button.classList.add("wrong");
      wrong("That is after 8:00. Try an earlier time.");
    }
  }));
}

function gameBirthdayPlanner() {
  const order = ["Wake up", "Decorate", "Party", "Sleep"];
  const items = ["Party", "Sleep", "Wake up", "Decorate"];
  const chosen = [];
  levelShell(
    "🎂 Birthday Planner",
    `<p>Some things happen first, next, and last.</p><p>Tap the activities in the correct order.</p>`,
    `
      <div class="game-layout">
        <div class="play-zone"><span class="big-emoji">🎂🎈</span><h3>Party starts in the evening!</h3></div>
        <div class="answer-zone">
          <div class="choice-grid">
            ${items.map(item => `<button class="choice plan-choice" data-value="${item}">${item}</button>`).join("")}
          </div>
          <p id="planOrder" class="feedback">Order: —</p>
        </div>
      </div>
    `
  );
  guide("Tap the day in order. Wake up comes first.");
  $$(".plan-choice").forEach(button => button.addEventListener("click", () => {
    const expected = order[chosen.length];
    const ok = button.dataset.value === expected;
    record(ok, "Daily order");
    if (ok) {
      chosen.push(expected);
      button.disabled = true;
      button.classList.add("correct");
      $("#planOrder").textContent = `Order: ${chosen.join(" ➜ ")}`;
      reward(`${expected} is in the right place!`);
      if (chosen.length === order.length) showFinish();
    } else {
      wrong(`Not yet. Think what happens before ${expected}?`);
    }
  }));
}

function gameAmPm() {
  levelShell(
    "🌞 AM PM Island",
    `<p>AM is from midnight to noon.</p><p>PM is from noon to midnight.</p>`,
    `
      <div class="scene-strip">
        ${[
          ["🌅 Wake up", "AM"],
          ["🏫 Go to school", "AM"],
          ["🌇 Play after school", "PM"],
          ["🌙 Sleep at night", "PM"]
        ].map(([name, ans], i) => `
          <div class="scene-card">
            <span>${name.split(" ")[0]}</span>
            <strong>${name.replace(name.split(" ")[0], "")}</strong>
            <div class="tool-row">
              <button class="choice ampm" data-card="${i}" data-value="AM" data-answer="${ans}">AM</button>
              <button class="choice ampm" data-card="${i}" data-value="PM" data-answer="${ans}">PM</button>
            </div>
          </div>
        `).join("")}
      </div>
    `
  );
  let correct = 0;
  guide("Choose AM or PM for each daily activity.");
  $$(".ampm").forEach(button => button.addEventListener("click", () => {
    if ($$(`.ampm[data-card="${button.dataset.card}"]`).some(b => b.disabled)) return;
    const ok = button.dataset.value === button.dataset.answer;
    record(ok, "AM and PM");
    if (ok) {
      button.classList.add("correct");
      $$(`.ampm[data-card="${button.dataset.card}"]`).forEach(b => b.disabled = true);
      correct++;
      reward(`Correct! That happens in the ${button.dataset.value}.`);
      if (correct === 4) showFinish();
    } else {
      button.classList.add("wrong");
      wrong("Try again. Morning is AM. After lunch is PM.");
    }
  }));
}

function gameElapsedTime() {
  const problems = [
    { start: 4, add: 1, answer: "5:00", q: "I started playing at 4:00. I played for 1 hour. When did I finish?" },
    { start: 2, add: 2, answer: "4:00", q: "I started reading at 2:00. I read for 2 hours. When did I finish?" }
  ];
  let step = 0;
  levelShell(
    "⏳ Time Race",
    `<p>Elapsed time means how much time passed.</p><p>Move forward on the clock to find the finish time.</p>`,
    `
      <div class="game-layout">
        <div class="play-zone">${clockHtml("raceClock", problems[0].start, 0)}<p id="raceQ" class="feedback">${problems[0].q}</p></div>
        <div class="answer-zone choice-grid" id="raceChoices"></div>
      </div>
    `
  );
  guide("Move forward in your mind. Four plus one hour is five.");
  renderRace();
  function renderRace() {
    const p = problems[step];
    setClock("raceClock", p.start, 0);
    $("#raceQ").textContent = p.q;
    $("#raceChoices").innerHTML = ["3:00", "4:00", "5:00", "6:00"].map(t => `<button class="choice race-choice" data-value="${t}">${t}</button>`).join("");
    $$(".race-choice").forEach(button => button.addEventListener("click", () => {
      const ok = button.dataset.value === p.answer;
      record(ok, "Elapsed time");
      if (ok) {
        button.classList.add("correct");
        reward(`Yes! The finish time is ${p.answer}.`);
        step++;
        if (step === problems.length) showFinish();
        else setTimeout(renderRace, 800);
      } else {
        button.classList.add("wrong");
        wrong("Count the hours forward.");
      }
    }));
  }
}

function gameSchoolBell() {
  levelShell(
    "🔔 School Bell",
    `<p>Schools use time tables.</p><p>Ring the bell at the correct time.</p>`,
    `
      <div class="game-layout">
        <div class="play-zone"><span class="big-emoji">🏫🔔</span><h3>Lunch starts at 12:30.</h3></div>
        <div class="answer-zone choice-grid">
          <button class="choice bell-choice" data-value="12:00">12:00</button>
          <button class="choice bell-choice" data-value="12:30">12:30</button>
          <button class="choice bell-choice" data-value="1:30">1:30</button>
          <button class="choice bell-choice" data-value="3:00">3:00</button>
        </div>
      </div>
    `
  );
  guide("Ring the lunch bell at twelve thirty.");
  $$(".bell-choice").forEach(button => button.addEventListener("click", () => {
    const ok = button.dataset.value === "12:30";
    record(ok, "Schedules");
    if (ok) {
      button.classList.add("correct");
      reward("Ding ding! Lunch bell rang on time.");
      speak("Ding ding! Lunch bell rang on time.");
      showFinish();
    } else {
      button.classList.add("wrong");
      wrong("Lunch is at half past twelve.");
    }
  }));
}

function moneyButton(item, extra = "") {
  const shape = item.kind === "coin" ? "coin-shape" : "note-shape";
  return `<button class="money ${extra}" data-value="${item.value}" data-kind="${item.kind}"><span class="${shape}">₹${item.value}</span></button>`;
}

function gameCoinSorting() {
  let sorted = 0;
  levelShell(
    "🪙 Coin Sorting",
    `<p>Coins are round.</p><p>Notes are paper money. Sort them for Penny the Parrot.</p>`,
    `
      <div class="game-layout">
        <div class="money-bank">${money.map(m => moneyButton(m, "sort-money")).join("")}</div>
        <div class="answer-zone">
          <button class="choice drop-money" data-kind="coin">🪙 Coin Basket</button>
          <button class="choice drop-money" data-kind="note">💵 Note Basket</button>
          <p id="sortFeedback" class="feedback">Tap money, then tap the correct basket.</p>
        </div>
      </div>
    `
  );
  $("#pennyMini").classList.remove("hidden");
  guide("Penny says, sort coins and notes.");
  let selected = null;
  $$(".sort-money").forEach(button => button.addEventListener("click", () => {
    selected = button;
    $$(".sort-money").forEach(b => b.classList.remove("correct"));
    button.classList.add("correct");
  }));
  $$(".drop-money").forEach(zone => zone.addEventListener("click", () => {
    if (!selected) return toast("Pick money first.", "try");
    const ok = selected.dataset.kind === zone.dataset.kind;
    record(ok, "Coins and notes");
    if (ok) {
      selected.disabled = true;
      selected.classList.add("correct");
      sorted++;
      reward("Sorted correctly!");
      selected = null;
      if (sorted === money.length) showFinish();
    } else {
      wrong("Look at the shape. Coins are round. Notes are rectangles.");
    }
  }));
}

function amountGame(title, target, coinsAllowed, concept, finishMessage) {
  let total = 0;
  levelShell(
    title,
    `<p>Tap coins and notes to make exactly ₹${target}.</p><p>Different combinations can be correct.</p>`,
    `
      <div class="game-layout">
        <div class="play-zone">
          <span class="big-emoji">💰</span>
          <div class="total-box">Target: ₹${target}<br>Your total: ₹<b id="moneyTotal">0</b></div>
          <div id="basket" class="basket"></div>
        </div>
        <div class="answer-zone">
          <div class="money-bank">${coinsAllowed.map(v => moneyButton({ value: v, kind: v <= 10 ? "coin" : "note" }, "add-money")).join("")}</div>
          <div class="tool-row"><button id="clearMoney" class="small-button">Clear</button></div>
        </div>
      </div>
    `
  );
  guide(`Can you make rupees ${target}? Tap money to add it.`);
  $$(".add-money").forEach(button => button.addEventListener("click", () => {
    const value = Number(button.dataset.value);
    total += value;
    $("#moneyTotal").textContent = total;
    $("#basket").insertAdjacentHTML("beforeend", `<span class="badge">₹${value}</span>`);
    if (total === target) {
      record(true, concept);
      reward(finishMessage);
      speak(finishMessage);
      showFinish();
    } else if (total > target) {
      record(false, concept);
      wrong("Too much money. Clear and try a smaller amount.");
    }
  }));
  $("#clearMoney").addEventListener("click", () => {
    total = 0;
    $("#moneyTotal").textContent = "0";
    $("#basket").innerHTML = "";
  });
}

function gameTreasureChest() {
  amountGame("💰 Treasure Chest", 18, [1, 2, 5, 10], "Make amount", "Click! The chest opens with exactly ₹18.");
}

function gameToyShop() {
  $("#rubyMini").classList.remove("hidden");
  const toys = [
    { emoji: "🪀", name: "Yo-yo", price: 25 },
    { emoji: "🧸", name: "Teddy", price: 35 },
    { emoji: "🚂", name: "Train", price: 60 },
    { emoji: "🎨", name: "Crayons", price: 20 }
  ];
  levelShell(
    "🛍️ Ruby Rabbit's Toy Shop",
    `<p>Ruby sells toys.</p><p>You have ₹50. Choose what you can buy.</p>`,
    `
      <div class="game-layout">
        <div class="play-zone"><span class="big-emoji">🐰🏪</span><h3>Your money: ₹50</h3></div>
        <div class="shop-grid">
          ${toys.map(t => `<button class="shop-card toy" data-price="${t.price}"><span>${t.emoji}</span>${t.name}<br><b class="price-tag">₹${t.price}</b></button>`).join("")}
        </div>
      </div>
    `
  );
  guide("Ruby says, tap a toy you can buy with fifty rupees.");
  let bought = 0;
  $$(".toy").forEach(card => card.addEventListener("click", () => {
    const price = Number(card.dataset.price);
    const ok = price <= 50;
    record(ok, "Shopping and enough money");
    if (ok) {
      card.disabled = true;
      card.classList.add("correct");
      bought++;
      reward(`Yes! ₹50 is enough for this toy.`);
      if (bought >= 3) showFinish();
    } else {
      card.classList.add("shake");
      wrong("Not enough money. ₹60 is more than ₹50.");
    }
  }));
}

function gameIceCreamChange() {
  levelShell(
    "🍦 Ice Cream Change",
    `<p>If you pay more money, the shopkeeper gives change.</p><p>Change is money you get back.</p>`,
    `
      <div class="game-layout">
        <div class="play-zone"><span class="big-emoji">🍦</span><h3>Ice cream costs ₹38.<br>You pay ₹50.</h3></div>
        <div class="answer-zone choice-grid">
          <button class="choice change-choice" data-value="10">₹10</button>
          <button class="choice change-choice" data-value="12">₹12</button>
          <button class="choice change-choice" data-value="15">₹15</button>
          <button class="choice change-choice" data-value="20">₹20</button>
        </div>
      </div>
    `
  );
  guide("Fifty minus thirty-eight gives the change. Count back to find it.");
  $$(".change-choice").forEach(button => button.addEventListener("click", () => {
    const ok = button.dataset.value === "12";
    record(ok, "Finding change");
    if (ok) {
      button.classList.add("correct");
      reward("Correct! ₹50 minus ₹38 is ₹12.");
      speak("Correct! You get twelve rupees back.");
      showFinish();
    } else {
      button.classList.add("wrong");
      wrong("Count up from 38 to 50. That is 12.");
    }
  }));
}

function gameFinalMap() {
  const tasks = [
    { q: "Which is cheaper?", options: ["Pencil ₹8", "Book ₹30"], answer: "Pencil ₹8", concept: "Compare prices" },
    { q: "Riya bought 2 pencils. Each costs ₹8. Total?", options: ["₹8", "₹16", "₹18", "₹20"], answer: "₹16", concept: "Word problems" },
    { q: "Save or spend? You want a ₹100 cricket bat. You have ₹60.", options: ["Save more", "Spend all now"], answer: "Save more", concept: "Save vs spend" },
    { q: "Which clock time is quarter past 3?", options: ["3:00", "3:15", "3:30", "3:45"], answer: "3:15", concept: "Revision" }
  ];
  let step = 0;
  levelShell(
    "🗺️ Final Treasure Map",
    `<p>Solve the last puzzles to open the Rainbow Coin Chest.</p><p>Use your time and money powers!</p>`,
    `<div class="game-layout"><div class="play-zone"><span class="big-emoji">🗺️💰</span><h3 id="finalQuestion"></h3></div><div id="finalChoices" class="answer-zone choice-grid"></div></div>`
  );
  guide("This is the final treasure map. Solve each puzzle.");
  renderFinal();
  function renderFinal() {
    const task = tasks[step];
    $("#finalQuestion").textContent = task.q;
    $("#finalChoices").innerHTML = task.options.map(option => `<button class="choice final-choice" data-value="${option}">${option}</button>`).join("");
    $$(".final-choice").forEach(button => button.addEventListener("click", () => {
      const ok = button.dataset.value === task.answer;
      record(ok, task.concept);
      if (ok) {
        button.classList.add("correct");
        reward("Treasure clue solved!");
        step++;
        if (step === tasks.length) showFinish();
        else setTimeout(renderFinal, 700);
      } else {
        button.classList.add("wrong");
        wrong("Good try. Think again and choose carefully.");
      }
    }));
  }
}

function renderDashboard() {
  const done = state.completed.filter(Boolean).length;
  const seconds = Math.round((Date.now() - state.startTime) / 1000);
  const accuracy = state.attempts ? Math.round((state.correct / state.attempts) * 100) : 100;
  const needs = Array.from(state.needsPractice);
  const mastered = Array.from(state.mastered);
  const wrongList = Object.entries(state.wrongPatterns).sort((a, b) => b[1] - a[1]);
  $("#dashboardContent").innerHTML = `
    <section class="dash-card"><h3>Parent View</h3><p>Levels completed: ${done}/${levels.length}</p><p>Time spent: ${Math.floor(seconds / 60)} min ${seconds % 60} sec</p><p>Coins earned: ${state.coins}</p></section>
    <section class="dash-card"><h3>Accuracy</h3><p>${accuracy}% correct</p><p>Attempts: ${state.attempts}</p><p>Correct: ${state.correct}</p></section>
    <section class="dash-card"><h3>Concepts Mastered</h3><p>${mastered.length ? mastered.join(", ") : "Play levels to collect mastery."}</p></section>
    <section class="dash-card"><h3>Needs Practice</h3><p>${needs.length ? needs.join(", ") : "No weak area yet. Great!"}</p></section>
    <section class="dash-card"><h3>Teacher View</h3><p>Incorrect patterns:</p><ul>${wrongList.length ? wrongList.map(([k, v]) => `<li>${k}: ${v}</li>`).join("") : "<li>No repeated errors yet.</li>"}</ul></section>
    <section class="dash-card"><h3>Suggested Revision</h3><p>${needs.length ? `Revise: ${needs.slice(0, 3).join(", ")}.` : "Try harder levels or replay for practice."}</p><div class="badge-list">${state.badges.map(b => `<span class="badge">${b}</span>`).join("")}</div></section>
  `;
}

function showCertificate() {
  $("#certName").textContent = state.player;
  showScreen("certificate");
  confetti(100);
  speak("Fantastic! You recovered the Golden Clock and Rainbow Coin Chest. You are an official Time and Money Explorer!");
}

function startGame() {
  state.player = $("#playerName").value.trim() || "Explorer";
  state.startTime = Date.now();
  $("#certName").textContent = state.player;
  updateStats();
  renderMap();
  renderLevel(0);
}

function resetGame() {
  state.level = 0;
  state.completed = Array(15).fill(false);
  state.stars = 0;
  state.gems = 0;
  state.coins = 0;
  state.attempts = 0;
  state.correct = 0;
  state.startTime = Date.now();
  state.levelTimes = Array(15).fill(0);
  state.wrongPatterns = {};
  state.mastered = new Set();
  state.needsPractice = new Set();
  state.badges = [];
  updateStats();
  renderMap();
  renderLevel(0);
}

function toggleVoice(button) {
  state.voice = !state.voice;
  if (!state.voice && "speechSynthesis" in window) window.speechSynthesis.cancel();
  $("#voiceButton").textContent = state.voice ? "🔊" : "🔇";
  $("#startVoiceButton").textContent = state.voice ? "🔊 Voice On" : "🔇 Voice Off";
  if (button.id === "startVoiceButton") button.textContent = $("#startVoiceButton").textContent;
}

$("#startButton").addEventListener("click", startGame);
$("#startVoiceButton").addEventListener("click", event => toggleVoice(event.currentTarget));
$("#voiceButton").addEventListener("click", event => toggleVoice(event.currentTarget));
$("#repeatButton").addEventListener("click", () => speak($("#guideText").textContent));
$("#mapButton").addEventListener("click", () => {
  renderMap();
  showScreen("map");
});
$("#closeMapButton").addEventListener("click", () => showScreen("game"));
$("#dashboardButton").addEventListener("click", () => {
  renderDashboard();
  showScreen("dashboard");
});
$("#closeDashboardButton").addEventListener("click", () => showScreen("game"));
$("#certificateButton").addEventListener("click", showCertificate);
$("#playAgainButton").addEventListener("click", resetGame);

updateStats();
