'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useGameEngine } from './useGameEngine';

export default function MCQGameEngine({
  questions,
  timePerQuestion = 30,
  pointsPerQuestion = 10,
  autoAdvance = true,
}) {
  const {
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
  } = useGameEngine({
    questions,
    timePerQuestion,
    basePoints: pointsPerQuestion,
    bonusPerSecond: 1,
    maxTimeBonus: 20,
    wrongPenalty: 5,
    autoAdvance,
  });

  if (!questions?.length) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-slate-200">
        <p>No questions available.</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-slate-200">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-sky-300">Game complete</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-100">Results</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Score</p>
            <p className="mt-3 text-4xl font-semibold text-white">{score}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Correct answers</p>
            <p className="mt-3 text-4xl font-semibold text-white">
              {completedCount} / {totalQuestions}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Wrong answers</p>
            <p className="mt-3 text-4xl font-semibold text-white">{wrongCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Time bonus</p>
            <p className="mt-3 text-4xl font-semibold text-white">{totalTimeBonus}</p>
          </div>
        </div>
        <Button onClick={restartGame}>Play again</Button>
      </div>
    );
  }

  const progressValue = (questionNumber / totalQuestions) * 100;

  return (
    <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-sky-300">
            Question {questionNumber} of {totalQuestions}
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-100">{currentQuestion.title}</h2>
        </div>
        <div className="space-y-2 text-right">
          <Badge>{currentQuestion.type === 'multiple' ? 'Multiple choice' : 'Single choice'}</Badge>
          <p className="text-sm text-slate-400">Time left: {timeLeft}s</p>
        </div>
      </div>

      <Progress value={progressValue} />

      <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
        <p className="text-base text-slate-200">{currentQuestion.prompt}</p>

        <div className="grid gap-3">
          {currentQuestion.choices.map((choice) => {
            const selected = selectedAnswers.includes(choice.id);
            const isDisabled = hasAnswered;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => toggleAnswer(choice.id)}
                disabled={isDisabled}
                className={`w-full rounded-3xl border p-4 text-left transition ${selected ? 'border-sky-400 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-200'} ${isDisabled ? 'cursor-not-allowed opacity-70' : 'hover:border-sky-300 hover:bg-slate-900'}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold">{choice.label}</span>
                  <span className="text-sm text-slate-400">{choice.value}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {hasAnswered ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-slate-200">
          <p className="font-semibold text-slate-100">Answer submitted</p>
          <p className="mt-2 text-slate-400">Move to the next question when you are ready.</p>
          <Button onClick={goToNextQuestion}>Next question</Button>
        </div>
      ) : (
        <Button onClick={submitAnswer} disabled={!selectedAnswers.length}>
          Submit answer
        </Button>
      )}
    </div>
  );
}
