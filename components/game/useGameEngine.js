import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildAnswerRecord, summarizeGameResults } from './scoringEngine';

export function useGameEngine({
  questions = [],
  timePerQuestion = 30,
  basePoints = 10,
  bonusPerSecond = 1,
  maxTimeBonus = 30,
  wrongPenalty = 0,
  autoAdvance = false,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [status, setStatus] = useState('active');
  const [timeLeft, setTimeLeft] = useState(timePerQuestion);
  const intervalRef = useRef(null);

  const currentQuestion = questions[currentIndex] || null;
  const totalQuestions = questions.length;

  const scoringConfig = useMemo(
    () => ({ basePoints, bonusPerSecond, maxTimeBonus, wrongPenalty }),
    [basePoints, bonusPerSecond, maxTimeBonus, wrongPenalty],
  );

  const summary = useMemo(() => summarizeGameResults(answers), [answers]);
  const score = summary.totalScore;
  const completedCount = summary.totalCorrect;
  const wrongCount = summary.totalWrong;
  const totalTimeBonus = summary.totalTimeBonus;

  const questionNumber = currentIndex + 1;

  useEffect(() => {
    if (!currentQuestion || status === 'finished') return undefined;

    if (status === 'active') {
      setTimeLeft(timePerQuestion);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentQuestion, status, timePerQuestion]);

  const recordAnswer = useCallback(
    (selected, question, timeRemaining) => {
      if (!question) return;

      const answerRecord = buildAnswerRecord({
        question,
        selectedAnswers: selected,
        timeLeft: timeRemaining,
        scoringConfig,
      });

      setAnswers((current) => [...current, answerRecord]);
    },
    [scoringConfig],
  );

  const hasAnswered = status === 'answered' || status === 'timedout';
  const isFinished = status === 'finished';

  const handleTimeout = useCallback(() => {
    if (!currentQuestion || hasAnswered) return;
    recordAnswer([], currentQuestion, timeLeft);
    setStatus('timedout');
  }, [currentQuestion, hasAnswered, recordAnswer, timeLeft]);

  useEffect(() => {
    if (status !== 'active' || !currentQuestion) return undefined;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          handleTimeout();
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, currentQuestion, hasAnswered, handleTimeout]);

  function toggleAnswer(choiceId) {
    if (!currentQuestion || hasAnswered) return;

    if (currentQuestion.type === 'single') {
      setSelectedAnswers([choiceId]);
      return;
    }

    setSelectedAnswers((current) => {
      if (current.includes(choiceId)) {
        return current.filter((id) => id !== choiceId);
      }
      return [...current, choiceId];
    });
  }

  function submitAnswer() {
    if (!currentQuestion || hasAnswered) return;

    recordAnswer(selectedAnswers, currentQuestion, timeLeft);
    setStatus('answered');

    if (autoAdvance) {
      setTimeout(() => {
        goToNextQuestion();
      }, 1200);
    }
  }

  function goToNextQuestion() {
    if (currentIndex + 1 >= totalQuestions) {
      setStatus('finished');
      return;
    }

    setCurrentIndex((current) => current + 1);
    setSelectedAnswers([]);
    setStatus('active');
    setTimeLeft(timePerQuestion);
  }

  function restartGame() {
    setCurrentIndex(0);
    setSelectedAnswers([]);
    setAnswers([]);
    setStatus('active');
    setTimeLeft(timePerQuestion);
  }

  return {
    currentQuestion,
    questionNumber,
    totalQuestions,
    selectedAnswers,
    toggleAnswer,
    submitAnswer,
    goToNextQuestion,
    restartGame,
    score,
    completedCount,
    wrongCount,
    totalTimeBonus,
    timeLeft,
    status,
    isFinished,
    hasAnswered,
    answers,
  };
}
