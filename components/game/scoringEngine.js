function normalizeAnswer(answer) {
  return Array.isArray(answer) ? [...answer].sort() : [answer];
}

function equalAnswers(a = [], b = []) {
  const first = normalizeAnswer(a);
  const second = normalizeAnswer(b);
  if (first.length !== second.length) return false;
  return first.every((value, index) => value === second[index]);
}

export function calculateTimeBonus(timeLeft, { bonusPerSecond = 1, maxTimeBonus = 30 } = {}) {
  if (timeLeft <= 0) return 0;
  return Math.min(Math.max(timeLeft * bonusPerSecond, 0), maxTimeBonus);
}

export function calculateAnswerPoints({
  isCorrect,
  basePoints = 10,
  timeBonus = 0,
  wrongPenalty = 0,
}) {
  if (!isCorrect) {
    return -Math.abs(wrongPenalty);
  }

  return Math.max(basePoints + timeBonus, 0);
}

export function buildAnswerRecord({ question, selectedAnswers, timeLeft, scoringConfig = {} }) {
  const selected = normalizeAnswer(selectedAnswers);
  const correctAnswers = normalizeAnswer(question.correctAnswers);
  const isCorrect = equalAnswers(selected, correctAnswers);
  const timeBonus = isCorrect ? calculateTimeBonus(timeLeft, scoringConfig) : 0;
  const points = calculateAnswerPoints({
    isCorrect,
    basePoints: scoringConfig.basePoints ?? 10,
    timeBonus,
    wrongPenalty: scoringConfig.wrongPenalty ?? 0,
  });

  return {
    questionId: question.id,
    selected,
    isCorrect,
    correctAnswers,
    basePoints: scoringConfig.basePoints ?? 10,
    timeBonus,
    wrongPenalty: isCorrect ? 0 : Math.abs(scoringConfig.wrongPenalty ?? 0),
    points,
  };
}

export function summarizeGameResults(records) {
  return records.reduce(
    (acc, answer) => {
      acc.totalScore += answer.points;
      acc.totalCorrect += answer.isCorrect ? 1 : 0;
      acc.totalWrong += answer.isCorrect ? 0 : 1;
      acc.totalTimeBonus += answer.timeBonus;
      return acc;
    },
    {
      totalScore: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalTimeBonus: 0,
    },
  );
}
