'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ChapterCardsClient({ subjectId }) {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchChapters() {
      try {
        const response = await fetch(`/api/subjects/${subjectId}/chapters`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Could not load chapter cards.');
        }

        const data = await response.json();
        setChapters(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error.');
      } finally {
        setLoading(false);
      }
    }

    fetchChapters();
  }, [subjectId]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-slate-200">
        <p>Loading chapters…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500 bg-rose-950/10 p-8 text-rose-200">
        <p className="font-semibold">Unable to load chapters</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!chapters.length) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-slate-200">
        <p>No chapters found for this subject.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {chapters.map((chapter) => (
        <article
          key={chapter.id}
          className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sky-300">
                Chapter {chapter.order + 1}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-slate-100">{chapter.title}</h3>
            </div>
            <Badge variant={chapter.completed ? 'default' : 'secondary'}>
              {chapter.completed ? 'Complete' : 'Pending'}
            </Badge>
          </div>
          <p className="mt-4 text-slate-400">
            {chapter.description ?? 'No chapter description available.'}
          </p>
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button asChild size="sm" variant="secondary">
              <Link href={`/subjects/${subjectId}/chapters/${chapter.id}`}>View chapter</Link>
            </Button>
            {chapter.completed && <span className="text-sm text-slate-400">Completed</span>}
          </div>
        </article>
      ))}
    </div>
  );
}
