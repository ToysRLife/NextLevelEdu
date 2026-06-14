import MCQGameEngine from '@/components/game/MCQGameEngine';

const sampleQuestions = [
  {
    id: 'q1',
    title: 'Math fact',
    prompt: 'What is 6 × 7?',
    type: 'single',
    correctAnswers: 'b',
    choices: [
      { id: 'a', label: 'Option A', value: '36' },
      { id: 'b', label: 'Option B', value: '42' },
      { id: 'c', label: 'Option C', value: '48' },
      { id: 'd', label: 'Option D', value: '54' },
    ],
  },
  {
    id: 'q2',
    title: 'Language',
    prompt: 'Which of these are programming languages?',
    type: 'multiple',
    correctAnswers: ['a', 'c'],
    choices: [
      { id: 'a', label: 'Option A', value: 'JavaScript' },
      { id: 'b', label: 'Option B', value: 'HTML' },
      { id: 'c', label: 'Option C', value: 'Python' },
      { id: 'd', label: 'Option D', value: 'CSS' },
    ],
  },
  {
    id: 'q3',
    title: 'Science',
    prompt: 'Which planet is known as the Red Planet?',
    type: 'single',
    correctAnswers: 'c',
    choices: [
      { id: 'a', label: 'Option A', value: 'Earth' },
      { id: 'b', label: 'Option B', value: 'Venus' },
      { id: 'c', label: 'Option C', value: 'Mars' },
      { id: 'd', label: 'Option D', value: 'Jupiter' },
    ],
  },
];

export default function GamePage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-sky-300">MCQ game engine</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-100">Play a reusable quiz</h1>
          <p className="mt-3 text-slate-400">
            Practice single and multiple choice questions with a timer and score tracking.
          </p>
        </div>

        <MCQGameEngine
          questions={sampleQuestions}
          timePerQuestion={25}
          pointsPerQuestion={20}
          autoAdvance={false}
        />
      </section>
    </main>
  );
}
