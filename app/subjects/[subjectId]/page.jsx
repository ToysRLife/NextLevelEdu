import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSubjectDetails } from '@/lib/subjects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ChapterCardsClient from '@/components/chapters/ChapterCardsClient';

export default async function SubjectDetailsPage({ params }) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'ADMIN';
  const subject = await getSubjectDetails(params.subjectId);

  if (!subject) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-sky-300">Subject details</p>
              <h1 className="mt-4 text-4xl font-semibold text-slate-100">{subject.name}</h1>
              <p className="mt-3 text-slate-400">Grade {subject.grade}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" asChild>
                <Link href="/subjects">Back to subjects</Link>
              </Button>
              {isAdmin ? (
                <Button asChild>
                  <Link href={`/subjects/${params.subjectId}/chapters/new`}>Create chapter</Link>
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-6 text-slate-300">
            {subject.description ?? 'No subject description available.'}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8">
            <h2 className="text-xl font-semibold text-slate-100">Chapters</h2>
            <ChapterCardsClient subjectId={params.subjectId} />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8">
            <h2 className="text-xl font-semibold text-slate-100">Linked games</h2>
            {subject.games.length ? (
              <ul className="mt-5 space-y-4">
                {subject.games.map((game) => (
                  <li
                    key={game.id}
                    className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-100">{game.name}</p>
                        <p className="text-sm text-slate-500">
                          {game.gameType} · Grade {game.grade}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-slate-400">No games are linked to this subject yet.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
