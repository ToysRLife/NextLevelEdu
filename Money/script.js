const items = [
    { shop: "Fruit Shop", emoji: "🍎", name: "Apple" },
    { shop: "Fruit Shop", emoji: "🍌", name: "Banana" },
    { shop: "Bakery", emoji: "🧁", name: "Cupcake" },
    { shop: "Toy Shop", emoji: "🧸", name: "Teddy Bear" },
    { shop: "Book Shop", emoji: "📘", name: "Story Book" },
    { shop: "Ice Cream Cart", emoji: "🍦", name: "Ice Cream" },
    { shop: "Grocery Store", emoji: "🥛", name: "Milk Packet" },
    { shop: "Stationery Shop", emoji: "✏️", name: "Pencil" },
    { shop: "Snack Shop", emoji: "🍪", name: "Biscuit" },
    { shop: "Vegetable Shop", emoji: "🥕", name: "Carrot" }
  ];
  
  const levels = {
    easy: {
      name: "Easy",
      min: 1,
      max: 20,
      money: [1, 2, 5, 10, 20]
    },
    medium: {
      name: "Medium",
      min: 21,
      max: 75,
      money: [1, 2, 5, 10, 20, 50]
    },
    hard: {
      name: "Hard",
      min: 76,
      max: 150,
      money: [1, 2, 5, 10, 20, 50, 100]
    }
  };
  
  let currentLevel = "easy";
  let selectedAmount = 0;
  let score = 0;
  let questionCount = 0;
  let selectedCoins = [];
  let currentQuestion = {};
  
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const shopNameEl = document.getElementById("shopName");
  const questionTextEl = document.getElementById("questionText");
  const itemEmojiEl = document.getElementById("itemEmoji");
  const itemNameEl = document.getElementById("itemName");
  const priceEl = document.getElementById("price");
  const selectedAmountEl = document.getElementById("selectedAmount");
  const selectedCoinsEl = document.getElementById("selectedCoins");
  const feedbackEl = document.getElementById("feedback");
  const lessonTextEl = document.getElementById("lessonText");
  const moneyBox = document.querySelector(".money-box");
  
  const checkBtn = document.getElementById("checkBtn");
  const resetBtn = document.getElementById("resetBtn");
  const nextBtn = document.getElementById("nextBtn");
  
  function getRandomItem() {
    return items[Math.floor(Math.random() * items.length)];
  }
  
  function getRandomPrice(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  function createMoneyButtons() {
    moneyBox.innerHTML = "";
  
    levels[currentLevel].money.forEach(value => {
      const button = document.createElement("button");
      button.className = value >= 20 ? "money note" : "money";
      button.dataset.value = value;
      button.textContent = `₹${value}`;
  
      button.addEventListener("click", () => {
        selectedAmount += value;
        selectedCoins.push(value);
        updateSelectedMoney();
        feedbackEl.textContent = `You added ₹${value}. Total is ₹${selectedAmount}.`;
        feedbackEl.className = "";
      });
  
      moneyBox.appendChild(button);
    });
  }
  
  function generateQuestion() {
    const level = levels[currentLevel];
    const item = getRandomItem();
    const price = getRandomPrice(level.min, level.max);
  
    currentQuestion = {
      ...item,
      price
    };
  
    shopNameEl.textContent = item.shop;
    itemEmojiEl.textContent = item.emoji;
    itemNameEl.textContent = item.name;
    priceEl.textContent = price;
  
    questionTextEl.textContent =
      `Meera wants to buy ${item.name} for ₹${price}. Select coins or notes to make the exact amount.`;
  
    lessonTextEl.textContent = getLesson(price);
  
    selectedAmount = 0;
    selectedCoins = [];
    updateSelectedMoney();
  
    feedbackEl.textContent = "Select money to make the exact amount.";
    feedbackEl.className = "";
  
    nextBtn.disabled = true;
  }
  
  function getLesson(price) {
    if (price <= 20) {
      return "Small coins and notes help us buy daily things like pencils, fruits, and snacks.";
    }
  
    if (price <= 75) {
      return "Sometimes we need to add notes and coins together to make the correct amount.";
    }
  
    return "For bigger prices, first use bigger notes, then add smaller coins or notes.";
  }
  
  function updateSelectedMoney() {
    selectedAmountEl.textContent = selectedAmount;
    selectedCoinsEl.innerHTML = "";
  
    selectedCoins.forEach(value => {
      const span = document.createElement("span");
      span.textContent = `₹${value}`;
      selectedCoinsEl.appendChild(span);
    });
  }
  
  function updateLevel() {
    if (score >= 100) {
      currentLevel = "hard";
    } else if (score >= 50) {
      currentLevel = "medium";
    } else {
      currentLevel = "easy";
    }
  
    levelEl.textContent = levels[currentLevel].name;
    createMoneyButtons();
  }
  
  checkBtn.addEventListener("click", () => {
    const price = currentQuestion.price;
  
    if (selectedAmount === price) {
      feedbackEl.textContent = "🎉 Correct! You paid the exact money.";
      feedbackEl.className = "correct";
  
      score += currentLevel === "easy" ? 10 : currentLevel === "medium" ? 15 : 20;
      questionCount++;
  
      scoreEl.textContent = score;
      updateLevel();
  
      nextBtn.disabled = false;
    } else if (selectedAmount < price) {
      feedbackEl.textContent = `Almost! You need ₹${price - selectedAmount} more.`;
      feedbackEl.className = "wrong";
    } else {
      feedbackEl.textContent = `Oops! You paid ₹${selectedAmount - price} extra. Press Reset and try again.`;
      feedbackEl.className = "wrong";
    }
  });
  
  resetBtn.addEventListener("click", () => {
    selectedAmount = 0;
    selectedCoins = [];
    updateSelectedMoney();
  
    feedbackEl.textContent = "Money reset. Try again!";
    feedbackEl.className = "";
  });
  
  nextBtn.addEventListener("click", () => {
    generateQuestion();
  });
  
  updateLevel();
  generateQuestion();