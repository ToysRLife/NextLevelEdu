import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSubjectDetails } from '@/lib/subjects';
import ChapterDetailsClient from '@/components/chapters/ChapterDetailsClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function ChapterDetailPage({ params }) {
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
              <p className="text-sm uppercase tracking-[0.28em] text-sky-300">{subject.name}</p>
              <h1 className="mt-4 text-4xl font-semibold text-slate-100">Chapter details</h1>
            </div>
            <Button variant="secondary" asChild>
              <Link href={`/subjects/${params.subjectId}`}>Back to subject</Link>
            </Button>
          </div>
        </div>

        <ChapterDetailsClient
          subjectId={params.subjectId}
          chapterId={params.chapterId}
          subjectName={subject.name}
        />
      </section>
    </main>
  );
}
