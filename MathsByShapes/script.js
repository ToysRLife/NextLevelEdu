"use strict";

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const state = {
  level: 1,
  score: 0,
  badges: 0,
  questionNumber: 1,
  questionsPerLevel: 7,
  current: null,
  painted: new Set(),
  selectedAnswer: null,
  selectedObject: null,
  groups: [],
  locked: false
};

const fractions = {
  "1/2": { label: "1/2", numerator: 1, denominator: 2, words: "one-half", simple: "half" },
  "1/3": { label: "1/3", numerator: 1, denominator: 3, words: "one-third", simple: "one-third" },
  "1/4": { label: "1/4", numerator: 1, denominator: 4, words: "one-fourth", simple: "one-fourth" },
  "2/4": { label: "2/4", numerator: 2, denominator: 4, words: "two-fourths", simple: "two-fourths, the same as half" },
  "2/3": { label: "2/3", numerator: 2, denominator: 3, words: "two-thirds", simple: "two-thirds" },
  "3/4": { label: "3/4", numerator: 3, denominator: 4, words: "three-fourths", simple: "three-fourths" }
};

const levelConfig = {
  1: {
    name: "Easy",
    fractions: ["1/2", "1/4"],
    shapes: ["circle", "square", "rectangle"],
    modes: ["paint", "paint", "match"]
  },
  2: {
    name: "Medium",
    fractions: ["1/2", "1/3", "1/4"],
    shapes: ["triangle", "rectangle", "cake", "pizza", "square"],
    modes: ["paint", "paint", "match"]
  },
  3: {
    name: "Hard",
    fractions: ["2/3", "2/4", "3/4", "1/3"],
    shapes: ["triangle", "circle", "square", "star", "hexagon", "chocolate"],
    modes: ["paint", "paint", "match"]
  },
  4: {
    name: "Division",
    fractions: ["1/2", "1/3", "1/4", "2/4", "2/3", "3/4"],
    shapes: ["triangle", "circle", "square", "rectangle", "hexagon", "star"],
    modes: ["division", "division", "paint", "match"]
  }
};

const plannedPaintQuestions = {
  2: [
    { fraction: "1/2", shape: "triangle" },
    { fraction: "1/3", shape: "triangle" }
  ],
  3: [
    { fraction: "2/4", shape: "triangle" },
    { fraction: "3/4", shape: "triangle" },
    { fraction: "2/3", shape: "triangle" }
  ]
};

const shapeInfo = {
  circle: { label: "circle", icon: "⚪", color: "#2f7cff" },
  square: { label: "square", icon: "◻️", color: "#8ad842" },
  rectangle: { label: "rectangle", icon: "▭", color: "#5f8ef7" },
  triangle: { label: "triangle", icon: "🔺", color: "#9b62d9" },
  pizza: { label: "pizza", icon: "🍕", color: "#ffcc3f" },
  cake: { label: "cake", icon: "🍰", color: "#ff5f96" },
  chocolate: { label: "chocolate bar", icon: "🍫", color: "#8a4a2b" },
  watermelon: { label: "watermelon", icon: "🍉", color: "#26b979" },
  star: { label: "star", icon: "⭐", color: "#35c9e8" },
  hexagon: { label: "hexagon", icon: "⬡", color: "#ff9b2f" }
};

const divisionQuestions = [
  { count: 8, groups: 2, each: 4, emoji: "🍎", object: "apples", equation: "8 ÷ 2 = 4" },
  { count: 8, groups: 4, each: 2, emoji: "🍎", object: "apples", equation: "8 ÷ 4 = 2" },
  { count: 12, groups: 3, each: 4, emoji: "🧁", object: "cupcakes", equation: "12 ÷ 3 = 4" },
  { count: 12, groups: 4, each: 3, emoji: "✏️", object: "pencils", equation: "12 ÷ 4 = 3" },
  { count: 16, groups: 4, each: 4, emoji: "⭐", object: "stars", equation: "16 ÷ 4 = 4" },
  { count: 10, groups: 2, each: 5, emoji: "⚽", object: "balls", equation: "10 ÷ 2 = 5" }
];

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function updateHud() {
  $("#scoreText").textContent = state.score;
  $("#badgeText").textContent = state.badges;
  $("#levelText").textContent = state.level;
  $("#questionProgress").textContent = `Question ${state.questionNumber} of ${state.questionsPerLevel}`;
  const percent = Math.round(((state.questionNumber - 1) / state.questionsPerLevel) * 100);
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressFill").style.width = `${percent}%`;
  $$(".level-card").forEach(card => card.classList.toggle("active", Number(card.dataset.level) === state.level));
}

function setGuide(text) {
  $("#guideText").textContent = text;
}

function setFeedback(text, type = "") {
  const feedback = $("#feedbackText");
  feedback.textContent = text;
  feedback.className = `feedback ${type}`;
}

function toast(text) {
  const box = $("#toast");
  box.textContent = text;
  box.classList.add("show");
  clearTimeout(box.timer);
  box.timer = setTimeout(() => box.classList.remove("show"), 1800);
}

function confetti(amount = 48) {
  const colors = ["#8954d6", "#45aa49", "#ff9b2f", "#ef5a52", "#3f86ff", "#ffd23f"];
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

function startLevel(level) {
  state.level = level;
  state.questionNumber = 1;
  state.locked = false;
  makeQuestion();
}

function makeQuestion() {
  state.locked = false;
  state.painted = new Set();
  state.selectedAnswer = null;
  state.selectedObject = null;
  state.groups = [];
  $("#checkButton").disabled = false;
  $("#nextButton").disabled = true;

  const planned = plannedPaintQuestions[state.level]?.[state.questionNumber - 1];
  const mode = planned ? "paint" : randomFrom(levelConfig[state.level].modes);
  if (mode === "division") renderDivisionQuestion();
  if (mode === "match") renderMatchQuestion();
  if (mode === "paint") renderPaintQuestion();
  updateHud();
}

function renderPaintQuestion() {
  const config = levelConfig[state.level];
  const planned = plannedPaintQuestions[state.level]?.[state.questionNumber - 1];
  const fraction = planned ? fractions[planned.fraction] : fractions[randomFrom(config.fractions)];
  const shapeKey = planned ? planned.shape : chooseShapeForFraction(config.shapes, fraction);
  const shape = shapeInfo[shapeKey];
  state.current = { mode: "paint", fraction, shapeKey, shape };

  $("#modeLabel").textContent = "Paint the fraction";
  $("#fractionBadge").textContent = fraction.label;
  $("#questionText").textContent = `Color ${fraction.label} of the ${shape.label}.`;
  setGuide(`${fraction.label} means color ${fraction.numerator} out of ${fraction.denominator} equal parts.`);
  setFeedback("Tap parts of the shape to color them.");

  $("#activityArea").innerHTML = `
    <div class="activity-grid">
      <section class="activity-card">
        <span class="big-icon">${shape.icon}</span>
        <div class="shape-wrap">
          ${shapeSvg(shapeKey, fraction.denominator, 0, true)}
        </div>
        <p class="shape-label">${shape.label} divided into ${fraction.denominator} equal parts</p>
      </section>
      <section class="activity-card side-card">
        <h3>${fraction.label} = ${fraction.simple}</h3>
        <p class="hint-line">Color ${fraction.numerator} part${fraction.numerator > 1 ? "s" : ""}.</p>
        <p class="hint-line">Total equal parts: ${fraction.denominator}</p>
        <p class="hint-line">Colored now: <b id="paintCount">0</b></p>
      </section>
    </div>
  `;

  $$(".shape-part").forEach(part => {
    part.addEventListener("click", () => {
      if (state.locked) return;
      const id = Number(part.dataset.part);
      if (state.painted.has(id)) {
        state.painted.delete(id);
        part.classList.remove("painted");
      } else {
        state.painted.add(id);
        part.classList.add("painted");
      }
      $("#paintCount").textContent = state.painted.size;
    });
  });
}

function chooseShapeForFraction(shapes, fraction) {
  const friendly = shapes.filter(shape => {
    if (shape === "hexagon" && fraction.denominator === 4) return false;
    return true;
  });
  return randomFrom(friendly.length ? friendly : shapes);
}

function renderMatchQuestion() {
  const easyFractions = state.level === 3 ? ["1/3", "2/4", "1/2"] : ["1/2", "1/3", "1/4"];
  const fraction = fractions[randomFrom(easyFractions)];
  const shapeKey = chooseShapeForFraction(["circle", "rectangle", "square"], fraction);
  const options = shuffle(["1/2", "1/3", "1/4", "2/4", "2/3", "3/4"])
    .filter((item, index, arr) => item === fraction.label || index < 3)
    .slice(0, 3);
  if (!options.includes(fraction.label)) options[0] = fraction.label;
  const finalOptions = shuffle(options);
  state.current = { mode: "match", fraction, shapeKey };

  $("#modeLabel").textContent = "Match the fraction";
  $("#fractionBadge").textContent = "?";
  $("#questionText").textContent = "Match the shaded shape with the correct fraction.";
  setGuide("Count the equal parts. Then count the colored parts.");
  setFeedback("Tap the matching fraction.");

  $("#activityArea").innerHTML = `
    <div class="match-grid">
      <section class="match-card">
        <h3>Picture</h3>
        ${shapeSvg(shapeKey, fraction.denominator, fraction.numerator, false)}
      </section>
      <section class="match-card">
        <h3>Choose</h3>
        <div class="choices">
          ${finalOptions.map(option => `<button class="choice match-choice" data-value="${option}">${option}</button>`).join("")}
        </div>
      </section>
      <section class="match-card">
        <h3>Think</h3>
        <p class="hint-line">Colored parts go on top.</p>
        <p class="hint-line">Total equal parts go on bottom.</p>
      </section>
    </div>
  `;

  $$(".match-choice").forEach(button => {
    button.addEventListener("click", () => {
      if (state.locked) return;
      $$(".match-choice").forEach(choice => choice.classList.remove("selected"));
      button.classList.add("selected");
      state.selectedAnswer = button.dataset.value;
    });
  });
}

function renderDivisionQuestion() {
  const q = randomFrom(divisionQuestions);
  state.current = { mode: "division", ...q };
  state.groups = Array.from({ length: q.groups }, () => []);

  $("#modeLabel").textContent = "Division connection";
  $("#fractionBadge").textContent = "÷";
  $("#questionText").textContent = `Divide ${q.count} ${q.object} into ${q.groups} equal groups.`;
  setGuide(`Share all ${q.count} ${q.object} equally. Every group should have the same number.`);
  setFeedback("Drag objects into boxes, or tap an object and then tap a group.");

  $("#activityArea").innerHTML = `
    <div class="division-layout">
      <section class="activity-card">
        <h3>${q.count} ${q.object}</h3>
        <div class="object-bank">
          ${Array.from({ length: q.count }, (_, index) => `<button class="object-chip" data-id="${index}" aria-label="${q.object} ${index + 1}">${q.emoji}</button>`).join("")}
        </div>
      </section>
      <section class="activity-card side-card">
        <h3>${q.count} ÷ ${q.groups} = ?</h3>
        <div class="group-grid" style="grid-template-columns:repeat(${Math.min(q.groups, 4)},1fr)">
          ${Array.from({ length: q.groups }, (_, index) => `
            <div class="group-box" data-group="${index}">
              <span class="group-title">Group ${index + 1}</span>
              <div class="group-items"></div>
            </div>
          `).join("")}
        </div>
        <button id="resetGroups" class="choice">Reset Groups</button>
      </section>
    </div>
  `;

  setupDivision();
  $("#resetGroups").addEventListener("click", resetGroups);
}

function shapeSvg(shapeKey, denominator, paintedCount, interactive) {
  const color = shapeInfo[shapeKey]?.color || "#45aa49";
  const id = `clip-${shapeKey}-${Math.random().toString(36).slice(2)}`;
  const parts = shapeParts(shapeKey, denominator, id, color, paintedCount, interactive);
  const defs = gradientDef() + clipDef(shapeKey, id);
  return `
    <svg class="fraction-svg" viewBox="0 0 200 200" role="img" aria-label="${shapeKey} fraction shape">
      <defs>${defs}</defs>
      ${parts}
      ${outlineFor(shapeKey)}
    </svg>
  `;
}

function gradientDef() {
  return `
    <linearGradient id="paintGradient" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#6aa2ff"/>
      <stop offset="55%" stop-color="#8bd943"/>
      <stop offset="100%" stop-color="#ffd23f"/>
    </linearGradient>
  `;
}

function clipDef(shapeKey, id) {
  if (["circle", "pizza", "cake", "watermelon"].includes(shapeKey)) {
    return `<clipPath id="${id}"><circle cx="100" cy="100" r="78"/></clipPath>`;
  }
  if (shapeKey === "triangle") {
    return `<clipPath id="${id}"><polygon points="100,22 178,174 22,174"/></clipPath>`;
  }
  if (shapeKey === "hexagon") {
    return `<clipPath id="${id}"><polygon points="58,30 142,30 184,100 142,170 58,170 16,100"/></clipPath>`;
  }
  if (shapeKey === "star") {
    return `<clipPath id="${id}"><polygon points="100,18 119,74 178,74 130,108 149,166 100,130 51,166 70,108 22,74 81,74"/></clipPath>`;
  }
  return `<clipPath id="${id}"><rect x="24" y="44" width="152" height="${shapeKey === "rectangle" || shapeKey === "chocolate" ? 95 : 132}" rx="0"/></clipPath>`;
}

function shapeParts(shapeKey, denominator, clipId, color, paintedCount, interactive) {
  if (["circle", "pizza", "cake", "watermelon"].includes(shapeKey)) {
    return circleWedges(denominator, paintedCount, interactive);
  }
  if (shapeKey === "triangle") {
    return triangleParts(denominator, paintedCount, interactive);
  }
  if (shapeKey === "square") {
    return gridRects(denominator, 34, 34, 132, 132, paintedCount, interactive);
  }
  if (shapeKey === "rectangle" || shapeKey === "chocolate") {
    return gridRects(denominator, 24, 54, 152, 82, paintedCount, interactive);
  }
  return clippedStrips(denominator, clipId, paintedCount, interactive);
}

function circleWedges(denominator, paintedCount, interactive) {
  const cx = 100;
  const cy = 100;
  const r = 78;
  const startOffset = -90;
  return Array.from({ length: denominator }, (_, index) => {
    const start = startOffset + (360 / denominator) * index;
    const end = startOffset + (360 / denominator) * (index + 1);
    const path = wedgePath(cx, cy, r, start, end);
    return `<path class="shape-part ${index < paintedCount ? "painted" : ""}" data-part="${index}" d="${path}" ${interactive ? "" : "pointer-events='none'"}></path>`;
  }).join("");
}

function wedgePath(cx, cy, r, startAngle, endAngle) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function polar(cx, cy, r, angle) {
  const rad = (angle - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function gridRects(denominator, x, y, width, height, paintedCount, interactive) {
  const cells = denominator === 4
    ? Array.from({ length: 4 }, (_, i) => ({
        x: x + (i % 2) * (width / 2),
        y: y + Math.floor(i / 2) * (height / 2),
        width: width / 2,
        height: height / 2
      }))
    : Array.from({ length: denominator }, (_, i) => ({
        x: x + i * (width / denominator),
        y,
        width: width / denominator,
        height
      }));
  return cells.map((cell, index) =>
    `<rect class="shape-part ${index < paintedCount ? "painted" : ""}" data-part="${index}" x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}" ${interactive ? "" : "pointer-events='none'"}></rect>`
  ).join("");
}

function triangleParts(denominator, paintedCount, interactive) {
  const partsByDenominator = {
    2: [
      "100,24 100,174 22,174",
      "100,24 178,174 100,174"
    ],
    3: [
      "100,24 55,111 145,111",
      "55,111 36,147 164,147 145,111",
      "36,147 22,174 178,174 164,147"
    ],
    4: [
      "100,24 61,99 139,99",
      "61,99 22,174 100,174",
      "61,99 100,174 139,99",
      "139,99 100,174 178,174"
    ]
  };
  const polygons = partsByDenominator[denominator] || partsByDenominator[2];
  return polygons.map((points, index) => `
    <polygon class="shape-part ${index < paintedCount ? "painted" : ""}" data-part="${index}" points="${points}" ${interactive ? "" : "pointer-events='none'"}></polygon>
  `).join("");
}

function clippedStrips(denominator, clipId, paintedCount, interactive) {
  const x = 16;
  const y = 18;
  const width = 168;
  const height = 158;
  return Array.from({ length: denominator }, (_, index) => `
    <rect class="shape-part ${index < paintedCount ? "painted" : ""}" data-part="${index}"
      clip-path="url(#${clipId})"
      x="${x + index * (width / denominator)}" y="${y}"
      width="${width / denominator}" height="${height}"
      ${interactive ? "" : "pointer-events='none'"}></rect>
  `).join("");
}

function outlineFor(shapeKey) {
  if (["circle", "pizza", "cake", "watermelon"].includes(shapeKey)) {
    return `<circle class="shape-outline" cx="100" cy="100" r="78"></circle>`;
  }
  if (shapeKey === "triangle") {
    return `<polygon class="shape-outline" points="100,22 178,174 22,174"></polygon>`;
  }
  if (shapeKey === "hexagon") {
    return `<polygon class="shape-outline" points="58,30 142,30 184,100 142,170 58,170 16,100"></polygon>`;
  }
  if (shapeKey === "star") {
    return `<polygon class="shape-outline" points="100,18 119,74 178,74 130,108 149,166 100,130 51,166 70,108 22,74 81,74"></polygon>`;
  }
  if (shapeKey === "rectangle" || shapeKey === "chocolate") {
    return `<rect class="shape-outline" x="24" y="54" width="152" height="82"></rect>`;
  }
  return `<rect class="shape-outline" x="34" y="34" width="132" height="132"></rect>`;
}

function setupDivision() {
  let dragging = null;
  let source = null;

  $$(".object-chip").forEach(object => {
    object.addEventListener("click", () => {
      if (state.locked || object.classList.contains("used")) return;
      $$(".object-chip").forEach(item => item.classList.remove("selected"));
      object.classList.add("selected");
      state.selectedObject = object;
      setFeedback("Now tap a group box.");
    });

    object.addEventListener("pointerdown", event => {
      if (state.locked || object.classList.contains("used")) return;
      event.preventDefault();
      source = object;
      dragging = object.cloneNode(true);
      dragging.classList.add("dragging");
      document.body.appendChild(dragging);
      moveDrag(event);
      object.setPointerCapture(event.pointerId);
    });
    object.addEventListener("pointermove", event => {
      if (dragging) moveDrag(event);
    });
    object.addEventListener("pointerup", event => {
      if (!dragging) return;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const group = hit && hit.closest(".group-box");
      dragging.remove();
      dragging = null;
      if (group) addToGroup(source, Number(group.dataset.group));
      $$(".group-box").forEach(box => box.classList.remove("hover"));
    });
  });

  $$(".group-box").forEach(box => {
    box.addEventListener("click", () => {
      if (state.selectedObject) addToGroup(state.selectedObject, Number(box.dataset.group));
    });
    box.addEventListener("pointerenter", () => box.classList.add("hover"));
    box.addEventListener("pointerleave", () => box.classList.remove("hover"));
  });

  function moveDrag(event) {
    dragging.style.left = `${event.clientX}px`;
    dragging.style.top = `${event.clientY}px`;
  }
}

function addToGroup(object, groupIndex) {
  if (!object || object.classList.contains("used")) return;
  object.classList.add("used");
  object.classList.remove("selected");
  state.selectedObject = null;
  state.groups[groupIndex].push(object.dataset.id);
  $(`.group-box[data-group="${groupIndex}"] .group-items`).insertAdjacentHTML("beforeend", `<span class="placed">${state.current.emoji}</span>`);
  setFeedback(`Group ${groupIndex + 1} has ${state.groups[groupIndex].length}.`);
}

function resetGroups() {
  if (state.locked || !state.current || state.current.mode !== "division") return;
  state.groups = Array.from({ length: state.current.groups }, () => []);
  $$(".object-chip").forEach(object => object.classList.remove("used", "selected"));
  $$(".group-items").forEach(items => items.innerHTML = "");
  state.selectedObject = null;
  setFeedback("Groups reset. Try sharing equally again.");
}

function checkAnswer() {
  if (state.locked || !state.current) return;
  const q = state.current;

  if (q.mode === "paint") {
    if (state.painted.size === q.fraction.numerator) {
      success(`Great job! You colored ${q.fraction.numerator} out of ${q.fraction.denominator} equal parts. That is ${q.fraction.label}.`);
    } else {
      fail(`Try again. Color exactly ${q.fraction.numerator} part${q.fraction.numerator > 1 ? "s" : ""}.`);
    }
  }

  if (q.mode === "match") {
    if (state.selectedAnswer === q.fraction.label) {
      $$(".match-choice").find(button => button.dataset.value === q.fraction.label)?.classList.add("correct");
      success(`Correct! The shaded picture shows ${q.fraction.label}.`);
    } else {
      if (state.selectedAnswer) {
        $$(".match-choice").find(button => button.dataset.value === state.selectedAnswer)?.classList.add("wrong");
      }
      fail("Try again. Count colored parts, then count all equal parts.");
    }
  }

  if (q.mode === "division") {
    const placed = state.groups.flat().length;
    const equal = state.groups.every(group => group.length === q.each);
    if (placed === q.count && equal) {
      success(`${q.equation}. Each group gets ${q.each} ${q.object}.`);
    } else if (placed < q.count) {
      fail("Keep going. Put every object into a group.");
    } else {
      fail("Try again. Each group must get the same number.");
    }
  }
}

function showHint() {
  if (!state.current) return;
  const q = state.current;
  if (q.mode === "paint") {
    setFeedback(`Hint: ${q.fraction.label} means color ${q.fraction.numerator} out of ${q.fraction.denominator} equal parts.`, "good");
  }
  if (q.mode === "match") {
    setFeedback("Hint: The top number is colored parts. The bottom number is all equal parts.", "good");
  }
  if (q.mode === "division") {
    setFeedback(`Hint: ${q.equation}. Try putting ${q.each} in every group.`, "good");
  }
}

function success(message) {
  state.locked = true;
  state.score += state.level === 4 ? 15 : 10;
  setGuide(message);
  setFeedback(`🎉 ${message}`, "good");
  toast("Correct! Wonderful fraction thinking!");
  confetti();
  $("#checkButton").disabled = true;
  $("#nextButton").disabled = false;
  updateHud();
}

function fail(message) {
  setGuide(message);
  setFeedback(`💡 ${message}`, "try");
}

function nextQuestion() {
  if (state.questionNumber < state.questionsPerLevel) {
    state.questionNumber++;
    makeQuestion();
    return;
  }

  state.badges++;
  state.score += 25;
  confetti(80);
  toast(`🏅 ${levelConfig[state.level].name} badge unlocked!`);

  if (state.level < 4) {
    state.level++;
    state.questionNumber = 1;
    makeQuestion();
  } else {
    finishGame();
  }
  updateHud();
}

function finishGame() {
  $("#modeLabel").textContent = "Skills learned";
  $("#fractionBadge").textContent = "🏆";
  $("#questionText").textContent = "You are a Fraction Paint & Play Champion!";
  $("#activityArea").innerHTML = `
    <section class="activity-card">
      <span class="big-icon">🎨🏆⭐</span>
      <h2>Fantastic work!</h2>
      <p class="hint-line">You learned 1/2, 1/3, 1/4, 2/4, 2/3, and 3/4.</p>
      <p class="hint-line">You also learned that division means sharing into equal groups.</p>
    </section>
  `;
  setGuide("Amazing! You understand equal parts and equal groups.");
  setFeedback("Press Reset Game to play again with new random questions.", "good");
  $("#checkButton").disabled = true;
  $("#nextButton").disabled = true;
}

function resetGame() {
  state.level = 1;
  state.score = 0;
  state.badges = 0;
  state.questionNumber = 1;
  makeQuestion();
}

$$(".level-card").forEach(card => {
  card.addEventListener("click", () => startLevel(Number(card.dataset.level)));
});

$("#hintButton").addEventListener("click", showHint);
$("#checkButton").addEventListener("click", checkAnswer);
$("#nextButton").addEventListener("click", nextQuestion);
$("#resetButton").addEventListener("click", resetGame);

makeQuestion();
