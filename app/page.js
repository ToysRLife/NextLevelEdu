import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-10 text-center">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-10 shadow-2xl shadow-slate-900/30 backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300">NextLevelEdu</p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Playful learning for young minds.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
            Launch the first gravity game experience, practice early math, and explore simple
            educational rewards in a next-generation app platform.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button className="w-full sm:w-auto">Start exploring</Button>
            <Button variant="secondary" className="w-full sm:w-auto">
              View features
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
