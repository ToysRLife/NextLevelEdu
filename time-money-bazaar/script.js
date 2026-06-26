"use strict";

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const DAY_MINUTES = 480;
const WRONG_PENALTY = 30;
const GRAND_PRIZE = 1000;

const state = {
  level: "easy",
  balance: 0,
  timeLeft: DAY_MINUTES,
  locked: false,
  current: null,
  challengeCount: 0
};

const moneyNames = {
  1000: "$10 bill",
  500: "$5 bill",
  100: "$1 bill",
  25: "quarter",
  10: "dime",
  5: "nickel",
  1: "penny"
};

const challenges = {
  easy: {
    work: [
      {
        kind: "choice",
        question: "You work for 2 hours. If you make $3 an hour, how much do you earn?",
        options: [300, 500, 600, 800],
        answer: 600,
        reward: 600,
        timeCost: 120,
        hint: "Count $3 two times: 3 + 3.",
        success: "Awesome! You earned $6.00 and it took 2 hours."
      },
      {
        kind: "choice",
        question: "You work for 1 hour. If you make $4 an hour, how much do you earn?",
        options: [100, 300, 400, 600],
        answer: 400,
        reward: 400,
        timeCost: 60,
        hint: "One hour of work gives one $4 payment.",
        success: "Great job! You earned $4.00 in 1 hour."
      },
      {
        kind: "choice",
        question: "You work for 3 hours. If you make $2 an hour, how much do you earn?",
        options: [200, 500, 600, 900],
        answer: 600,
        reward: 600,
        timeCost: 180,
        hint: "Count $2 three times: 2 + 2 + 2.",
        success: "Nice! Three hours at $2 each gives $6.00."
      }
    ],
    shop: [
      {
        kind: "choice",
        question: "An apple costs $1.00. You pay with a $5.00 bill. What change do you get back?",
        options: [100, 300, 400, 500],
        answer: 400,
        savings: 100,
        timeCost: 30,
        hint: "$5 minus $1 is $4.",
        success: "Correct! You get $4.00 change. Smart shopping saved $1.00 for your rocket fund."
      },
      {
        kind: "choice",
        question: "A pencil costs $2.00. You pay with a $5.00 bill. What change do you get back?",
        options: [100, 200, 300, 400],
        answer: 300,
        savings: 100,
        timeCost: 30,
        hint: "$5 minus $2 is $3.",
        success: "Yes! You get $3.00 back and add $1.00 to your savings."
      },
      {
        kind: "choice",
        question: "A cookie costs $3.00. You pay with a $10.00 bill. What change do you get back?",
        options: [500, 600, 700, 800],
        answer: 700,
        savings: 100,
        timeCost: 30,
        hint: "$10 minus $3 is $7.",
        success: "Yum! You found $7.00 change and saved $1.00."
      }
    ]
  },
  medium: {
    work: [
      {
        kind: "choice",
        question: "You start working at 1:30 PM and finish at 3:00 PM. How long did you work?",
        options: ["1 hour", "1 hour 30 minutes", "2 hours", "3 hours"],
        answer: "1 hour 30 minutes",
        reward: 450,
        timeCost: 90,
        hint: "From 1:30 to 2:30 is 1 hour. Then to 3:00 is 30 more minutes.",
        success: "Excellent! You worked 1 hour 30 minutes and earned $4.50."
      },
      {
        kind: "choice",
        question: "You work from 2:00 PM to 4:30 PM. How long is your shift?",
        options: ["1 hour", "2 hours", "2 hours 30 minutes", "3 hours 30 minutes"],
        answer: "2 hours 30 minutes",
        reward: 500,
        timeCost: 150,
        hint: "2:00 to 4:00 is 2 hours. Then add 30 minutes.",
        success: "Great! You worked 2 hours 30 minutes and earned $5.00."
      },
      {
        kind: "numeric",
        question: "You earn $1.50 every half hour. You work for 2 hours. How many dollars do you earn?",
        answer: "6",
        reward: 600,
        timeCost: 120,
        hint: "Two hours has four half-hours. 1.50 + 1.50 + 1.50 + 1.50 = 6.",
        success: "Wonderful! Four half-hours earned $6.00."
      }
    ],
    shop: [
      {
        kind: "choice",
        question: "A toy costs $4.50. You pay with a $5.00 bill. How many quarters do you get back?",
        options: ["1 quarter", "2 quarters", "3 quarters", "4 quarters"],
        answer: "2 quarters",
        savings: 50,
        timeCost: 45,
        hint: "$5.00 minus $4.50 is $0.50. Two quarters make $0.50.",
        success: "Correct! You get 2 quarters back. You saved $0.50."
      },
      {
        kind: "choice",
        question: "A snack costs $2.70. You pay $3.00. How many dimes make the change?",
        options: ["1 dime", "2 dimes", "3 dimes", "4 dimes"],
        answer: "3 dimes",
        savings: 30,
        timeCost: 45,
        hint: "$3.00 minus $2.70 is $0.30. Three dimes make $0.30.",
        success: "Nice! Your change is 3 dimes, or $0.30."
      },
      {
        kind: "numeric",
        question: "A book costs $6.25. You pay $10.00. How many dollars and cents are your change?",
        answer: "3.75",
        savings: 75,
        timeCost: 45,
        hint: "Count from $6.25 to $10.00. The change is $3.75.",
        success: "Yes! You found $3.75 change and added $0.75 to savings."
      }
    ]
  },
  hard: {
    work: [
      {
        kind: "numeric",
        question: "A job pays $0.10 per minute. You work from 4:15 PM to 4:45 PM. How many dollars do you make?",
        answer: "3",
        reward: 300,
        timeCost: 30,
        hint: "4:15 to 4:45 is 30 minutes. Ten cents 30 times is $3.00.",
        success: "Sharp thinking! You made $3.00 in 30 minutes."
      },
      {
        kind: "numeric",
        question: "You earn $0.25 every 5 minutes. You work for 35 minutes. How many dollars do you earn?",
        answer: "1.75",
        reward: 175,
        timeCost: 35,
        hint: "35 minutes has seven 5-minute groups. 7 quarters is $1.75.",
        success: "Fantastic! Seven quarters equals $1.75."
      },
      {
        kind: "numeric",
        question: "A helper job pays $0.08 per minute. You work for 75 minutes. How many dollars do you earn?",
        answer: "6",
        reward: 600,
        timeCost: 75,
        hint: "75 times 8 cents is 600 cents, which is $6.00.",
        success: "Brilliant! You earned $6.00."
      }
    ],
    shop: [
      {
        kind: "change",
        question: "You buy a game for $7.35. You hand the cashier a $10.00 bill. Pick the exact change: $2.65.",
        answer: { 100: 2, 25: 2, 10: 1, 5: 1, 1: 0 },
        savings: 65,
        timeCost: 60,
        hint: "$10.00 minus $7.35 is $2.65. Try $2 + 2 quarters + 1 dime + 1 nickel.",
        success: "Perfect change! $2.65 goes back to your wallet."
      },
      {
        kind: "numeric",
        question: "A notebook costs $3.68. You pay $5.00. How much change should you get?",
        answer: "1.32",
        savings: 32,
        timeCost: 60,
        hint: "Count from $3.68 to $5.00. The change is $1.32.",
        success: "Correct! Your change is $1.32."
      },
      {
        kind: "change",
        question: "A puzzle costs $8.40. You pay $10.00. Pick exact change: $1.60.",
        answer: { 100: 1, 25: 2, 10: 1, 5: 0, 1: 0 },
        savings: 60,
        timeCost: 60,
        hint: "$1 + 2 quarters + 1 dime makes $1.60.",
        success: "Excellent! You made exact $1.60 change."
      }
    ]
  }
};

const $levelInputs = $$('input[name="level"]');

function cents(value) {
  return `$${(value / 100).toFixed(2)}`;
}

function minutesText(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m left`;
}

function setGuide(text) {
  $("#guideText").textContent = text;
}

function updateDashboard() {
  $("#timeText").textContent = minutesText(Math.max(0, state.timeLeft));
  $("#balanceText").textContent = cents(state.balance);
  const percent = Math.max(0, state.timeLeft / DAY_MINUTES) * 100;
  $("#timeFill").style.width = `${percent}%`;
  $("#clockHand").style.transform = `rotate(${(1 - percent / 100) * 360}deg)`;
  const need = Math.max(0, GRAND_PRIZE - state.balance);
  $("#goalText").textContent = need ? `Need ${cents(need)} more.` : "You have enough money!";
  $("#buyPrizeButton").disabled = state.balance < GRAND_PRIZE || state.locked || state.timeLeft <= 0;
  renderWallet();
}

function renderWallet() {
  let remaining = state.balance;
  const denominations = [1000, 500, 100, 25, 10, 5, 1];
  const chips = [];
  denominations.forEach(denom => {
    const count = Math.floor(remaining / denom);
    remaining %= denom;
    if (count) {
      const shape = denom >= 100 ? "bill" : "coin";
      chips.push(`<span class="money-chip"><span class="${shape}">${denom >= 100 ? cents(denom).replace(".00", "") : `${denom}¢`}</span> × ${count}</span>`);
    }
  });
  $("#walletBreakdown").innerHTML = chips.length ? chips.join("") : `<span class="money-chip">Empty wallet</span>`;
}

function resetGame(level = state.level) {
  state.level = level;
  state.balance = 0;
  state.timeLeft = DAY_MINUTES;
  state.locked = false;
  state.current = null;
  state.challengeCount = 0;
  $("#resultOverlay").classList.remove("show");
  updateDashboard();
  setGuide(`Level set to ${level}. Choose work or shop.`);
  $("#challengeCard").innerHTML = `
    <div class="empty-state">
      <span>${level === "easy" ? "🙂" : level === "medium" ? "🧠" : "🚀"}</span>
      <h2>${titleCase(level)} Level Ready!</h2>
      <p>Work uses time and earns money. Shop challenges practice spending, change, and saving.</p>
    </div>
  `;
}

function titleCase(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function chooseChallenge(type) {
  if (state.locked) return;
  if (state.timeLeft <= 0) return endGame(false);
  const list = challenges[state.level][type];
  const challenge = list[state.challengeCount % list.length];
  state.challengeCount++;
  state.current = { ...challenge, type };
  renderChallenge(state.current);
}

function renderChallenge(challenge) {
  const mode = challenge.type === "work" ? "Work Shift" : "Market Challenge";
  const cost = challenge.timeCost ? `${challenge.timeCost} minutes` : "time";
  const prizeLine = challenge.type === "work"
    ? `Correct answer earns ${cents(challenge.reward)}.`
    : `Correct answer saves ${cents(challenge.savings)} for the rocket fund.`;
  setGuide(challenge.type === "work" ? "Solve the work problem to earn money." : "Solve the shop problem to protect your money.");

  let input = "";
  if (challenge.kind === "choice") {
    input = `
      <div class="answers">
        ${challenge.options.map(option => `<button class="answer-btn" data-value="${option}">${formatOption(option)}</button>`).join("")}
      </div>
    `;
  }
  if (challenge.kind === "numeric") {
    input = `
      <div class="numeric-row">
        <input id="numericAnswer" inputmode="decimal" autocomplete="off" placeholder="Type answer">
        <button id="submitNumeric" class="main-btn">Submit Answer</button>
      </div>
    `;
  }
  if (challenge.kind === "change") {
    input = `
      <div class="change-builder">
        ${[100, 25, 10, 5, 1].map(value => `
          <div class="denom" data-denom="${value}">
            <span>${moneyNames[value]}</span>
            <b id="count${value}">0</b>
            <button data-add="${value}">+</button>
            <button data-subtract="${value}">−</button>
          </div>
        `).join("")}
      </div>
      <p class="builder-total">Your change: <b id="builderTotal">$0.00</b></p>
      <div class="numeric-row">
        <button id="submitChange" class="main-btn">Submit Answer</button>
        <button id="clearChange" class="secondary-btn">Clear</button>
      </div>
    `;
  }

  $("#challengeCard").innerHTML = `
    <div class="challenge">
      <h2>${challenge.type === "work" ? "🧰" : "🏪"} ${mode}</h2>
      <div class="challenge-meta">
        <span class="tag">Level: ${titleCase(state.level)}</span>
        <span class="tag">Time cost: ${cost}</span>
        <span class="tag">${prizeLine}</span>
      </div>
      <p>${challenge.question}</p>
      ${input}
      <p id="feedback" class="feedback"></p>
    </div>
  `;

  if (challenge.kind === "choice") {
    $$(".answer-btn").forEach(button => button.addEventListener("click", () => submitAnswer(button.dataset.value, button)));
  }
  if (challenge.kind === "numeric") {
    $("#submitNumeric").addEventListener("click", () => submitAnswer($("#numericAnswer").value.trim(), $("#submitNumeric")));
    $("#numericAnswer").addEventListener("keydown", event => {
      if (event.key === "Enter") submitAnswer($("#numericAnswer").value.trim(), $("#submitNumeric"));
    });
    $("#numericAnswer").focus();
  }
  if (challenge.kind === "change") setupChangeBuilder();
}

function formatOption(option) {
  if (typeof option === "number") return cents(option);
  return option;
}

function normalizeNumber(text) {
  return String(text).replace("$", "").trim();
}

function submitAnswer(value, button) {
  if (state.locked || !state.current) return;
  const challenge = state.current;
  let correct = false;
  if (challenge.kind === "numeric") {
    correct = Number(normalizeNumber(value)).toFixed(2) === Number(challenge.answer).toFixed(2);
  } else {
    correct = String(value) === String(challenge.answer);
  }

  if (correct) {
    button.classList.add("correct");
    handleCorrect();
  } else {
    button.classList.add("wrong");
    handleWrong();
  }
}

function setupChangeBuilder() {
  const counts = { 100: 0, 25: 0, 10: 0, 5: 0, 1: 0 };
  const update = () => {
    let total = 0;
    Object.keys(counts).forEach(key => {
      $(`#count${key}`).textContent = counts[key];
      total += counts[key] * Number(key);
    });
    $("#builderTotal").textContent = cents(total);
  };

  $$("[data-add]").forEach(button => button.addEventListener("click", () => {
    counts[button.dataset.add]++;
    update();
  }));
  $$("[data-subtract]").forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.subtract;
    counts[key] = Math.max(0, counts[key] - 1);
    update();
  }));
  $("#clearChange").addEventListener("click", () => {
    Object.keys(counts).forEach(key => counts[key] = 0);
    update();
  });
  $("#submitChange").addEventListener("click", () => {
    if (state.locked) return;
    const answer = state.current.answer;
    const ok = Object.keys(answer).every(key => Number(answer[key] || 0) === Number(counts[key] || 0));
    if (ok) handleCorrect();
    else handleWrong();
  });
}

function handleCorrect() {
  state.locked = true;
  const challenge = state.current;
  spendTime(challenge.timeCost);
  if (challenge.type === "work") state.balance += challenge.reward;
  else state.balance += challenge.savings;
  updateDashboard();
  $("#feedback").textContent = `🎉 ${challenge.success}`;
  toast(challenge.success);
  confetti(28);
  if (state.timeLeft <= 0) {
    setTimeout(() => endGame(false), 1300);
    return;
  }
  state.locked = false;
  state.current = null;
  if (state.balance >= GRAND_PRIZE) setGuide("You have enough money! Buy the Toy Rocket before time runs out.");
}

function handleWrong() {
  const challenge = state.current;
  spendTime(WRONG_PENALTY);
  updateDashboard();
  $("#feedback").textContent = `💡 Try again hint: ${challenge.hint} You lost 30 minutes.`;
  toast(`Try again! ${challenge.hint}`, "try");
  setGuide("Mistakes are part of learning. Try again or choose another action.");
  if (state.timeLeft <= 0) setTimeout(() => endGame(false), 900);
}

function spendTime(minutes) {
  state.timeLeft = Math.max(0, state.timeLeft - minutes);
}

function buyPrize() {
  if (state.balance < GRAND_PRIZE || state.timeLeft <= 0 || state.locked) return;
  state.balance -= GRAND_PRIZE;
  spendTime(15);
  updateDashboard();
  endGame(true);
}

function endGame(victory) {
  state.locked = true;
  $("#resultOverlay").classList.add("show");
  if (victory) {
    $("#resultIcon").textContent = "🏆🚀";
    $("#resultTitle").textContent = "Victory!";
    $("#resultMessage").textContent = `Awesome! You bought the $10.00 Toy Rocket with ${minutesText(state.timeLeft)}. You learned that earning money takes time, and spending wisely helps you reach a goal.`;
    confetti(90);
  } else {
    $("#resultIcon").textContent = "⏰";
    $("#resultTitle").textContent = "Time's Up!";
    $("#resultMessage").textContent = `The 8-hour clock reached zero. You saved ${cents(state.balance)}. Try again and choose work shifts carefully!`;
  }
}

function toast(message, type = "good") {
  const toastBox = $("#toast");
  toastBox.textContent = message;
  toastBox.className = `toast show ${type === "try" ? "try" : ""}`;
  clearTimeout(toastBox.timer);
  toastBox.timer = setTimeout(() => toastBox.classList.remove("show"), 2200);
}

function confetti(amount) {
  const colors = ["#ff5d93", "#ffd84d", "#43bdf4", "#26b979", "#604fe8", "#ff944d"];
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

$levelInputs.forEach(input => {
  input.addEventListener("change", () => {
    if (input.checked) resetGame(input.value);
  });
});

$("#workButton").addEventListener("click", () => chooseChallenge("work"));
$("#shopButton").addEventListener("click", () => chooseChallenge("shop"));
$("#buyPrizeButton").addEventListener("click", buyPrize);
$("#resetButton").addEventListener("click", () => resetGame(state.level));
$("#playAgainButton").addEventListener("click", () => resetGame(state.level));

resetGame("easy");
