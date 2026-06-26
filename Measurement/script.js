const distanceQuestions = [
  {
    place: "Bobo's Study Table",
    emoji: "✏️",
    item: "Pencil",
    question: "Bobo says a pencil is 5 kilometres long! 😂 What is the correct measurement?",
    options: ["15 cm", "15 km", "15 m", "15 L"],
    answer: "15 cm",
    lesson: "Small objects like pencils are measured in centimetres."
  },
  {
    place: "Bobo's Bathroom",
    emoji: "🚪",
    item: "Bathroom Distance",
    question: "Bobo wants to travel by airplane to his bathroom! What is the correct distance from bedroom to bathroom?",
    options: ["3 m", "3 km", "300 km", "3 L"],
    answer: "3 m",
    lesson: "Distance inside a house is usually measured in metres."
  },
  {
    place: "School Road",
    emoji: "🚌",
    item: "Home to School",
    question: "Bobo says school is 2 centimetres away! What sounds correct?",
    options: ["2 km", "2 cm", "2 ml", "2 mm"],
    answer: "2 km",
    lesson: "Long distances like home to school are measured in kilometres."
  },
  {
    place: "Toy Shop",
    emoji: "🧸",
    item: "Teddy Bear",
    question: "Which unit should we use to measure the height of a teddy bear?",
    options: ["cm", "km", "L", "ml"],
    answer: "cm",
    lesson: "Height of small toys is measured in centimetres."
  },
  {
    place: "Cricket Ground",
    emoji: "🏏",
    item: "Cricket Pitch",
    question: "Bobo wants to measure a cricket pitch. Which unit is best?",
    options: ["metres", "millilitres", "litres", "kilometres"],
    answer: "metres",
    lesson: "Medium distances like rooms, grounds, and halls are measured in metres."
  }
];

const liquidQuestions = [
  {
    place: "Juice Shop",
    emoji: "🧃",
    item: "Juice Glass",
    question: "Bobo filled a glass with 10 litres of juice! It overflowed! 😂 What is better?",
    options: ["250 ml", "250 km", "250 m", "250 L"],
    answer: "250 ml",
    lesson: "Small amounts of liquid are measured in millilitres."
  },
  {
    place: "Milk Delivery",
    emoji: "🥛",
    item: "Milk Packet",
    question: "What is a common quantity for one milk packet?",
    options: ["1 L", "1 km", "1 cm", "100 m"],
    answer: "1 L",
    lesson: "Milk packets are often measured in litres."
  },
  {
    place: "Garden",
    emoji: "🌳",
    item: "Watering Tree",
    question: "Bobo gives a tree 5 drops of water. Poor tree! What is better?",
    options: ["10 L", "10 cm", "10 km", "10 m"],
    answer: "10 L",
    lesson: "Plants and trees need water measured in litres."
  },
  {
    place: "Kitchen",
    emoji: "🍲",
    item: "Cooking Soup",
    question: "Grandma needs a little water for soup. Which unit is best?",
    options: ["ml", "km", "m", "cm"],
    answer: "ml",
    lesson: "Recipes often use millilitres for small liquid amounts."
  },
  {
    place: "Aquarium",
    emoji: "🐠",
    item: "Fish Tank",
    question: "A fish tank needs water. Which measurement sounds correct?",
    options: ["20 L", "20 km", "20 cm", "20 m"],
    answer: "20 L",
    lesson: "Large containers like buckets and fish tanks use litres."
  }
];

let currentTopic = "Distance";
let score = 0;
let level = "Easy";
let currentQuestion = null;
let answered = false;

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const topicEl = document.getElementById("topic");
const placeNameEl = document.getElementById("placeName");
const questionTextEl = document.getElementById("questionText");
const mainEmojiEl = document.getElementById("mainEmoji");
const itemNameEl = document.getElementById("itemName");
const optionsBox = document.getElementById("optionsBox");
const feedbackEl = document.getElementById("feedback");
const lessonTextEl = document.getElementById("lessonText");
const nextBtn = document.getElementById("nextBtn");
const switchBtn = document.getElementById("switchBtn");

function updateLevel() {
  if (score >= 120) {
    level = "Hard";
  } else if (score >= 60) {
    level = "Medium";
  } else {
    level = "Easy";
  }

  levelEl.textContent = level;
}

function getQuestionPool() {
  return currentTopic === "Distance" ? distanceQuestions : liquidQuestions;
}

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function generateQuestion() {
  answered = false;
  updateLevel();

  const pool = getQuestionPool();
  currentQuestion = pool[Math.floor(Math.random() * pool.length)];

  placeNameEl.textContent = currentQuestion.place;
  questionTextEl.textContent = currentQuestion.question;
  mainEmojiEl.textContent = currentQuestion.emoji;
  itemNameEl.textContent = currentQuestion.item;
  lessonTextEl.textContent = currentQuestion.lesson;
  topicEl.textContent = currentTopic;

  feedbackEl.textContent = "Choose the correct answer.";
  feedbackEl.className = "";

  optionsBox.innerHTML = "";

  const shuffledOptions = shuffleArray([...currentQuestion.options]);

  shuffledOptions.forEach(option => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;

    button.addEventListener("click", () => checkAnswer(button, option));

    optionsBox.appendChild(button);
  });
}

function checkAnswer(button, selectedOption) {
  if (answered) return;

  answered = true;

  if (selectedOption === currentQuestion.answer) {
    button.classList.add("correct-option");

    const points = level === "Easy" ? 10 : level === "Medium" ? 15 : 20;
    score += points;
    scoreEl.textContent = score;

    feedbackEl.textContent = `🎉 Correct! Bobo is getting smarter. +${points} points`;
    feedbackEl.className = "correct";
  } else {
    button.classList.add("wrong-option");
    feedbackEl.textContent = `😂 Oops! Bobo slipped on a banana peel. Correct answer is ${currentQuestion.answer}.`;
    feedbackEl.className = "wrong";

    showCorrectAnswer();
  }

  updateLevel();
}

function showCorrectAnswer() {
  const buttons = document.querySelectorAll(".option-btn");

  buttons.forEach(btn => {
    if (btn.textContent === currentQuestion.answer) {
      btn.classList.add("correct-option");
    }
  });
}

nextBtn.addEventListener("click", generateQuestion);

switchBtn.addEventListener("click", () => {
  currentTopic = currentTopic === "Distance" ? "Liquid" : "Distance";
  generateQuestion();
});

generateQuestion();