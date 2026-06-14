'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ChapterDetailsClient({ subjectId, chapterId, subjectName }) {
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadChapter() {
      try {
        const response = await fetch(`/api/subjects/${subjectId}/chapters/${chapterId}`);
        if (!response.ok) {
          throw new Error('Unable to load chapter details.');
        }

        const data = await response.json();
        setChapter(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error.');
      } finally {
        setLoading(false);
      }
    }

    loadChapter();
  }, [subjectId, chapterId]);

  async function handleComplete() {
    setSaving(true);
    try {
      const response = await fetch(`/api/subjects/${subjectId}/chapters/${chapterId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Unable to mark chapter complete.');
      }

      const data = await response.json();
      setChapter((current) =>
        current ? { ...current, completed: true, completedAt: data.completedAt } : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-slate-200">
        <p>Loading chapter details…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500 bg-rose-950/10 p-8 text-rose-200">
        <p className="font-semibold">Unable to load chapter</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-slate-200">
        <p>Chapter not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-sky-300">{subjectName}</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-100">{chapter.title}</h1>
          </div>
          <Badge>{chapter.completed ? 'Completed' : 'Not completed'}</Badge>
        </div>
        <p className="mt-4 text-slate-400">
          {chapter.description || 'No chapter description has been provided.'}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-300">Chapter progress</p>
            <p className="mt-2 text-slate-200">
              {chapter.completed
                ? `Completed on ${new Date(chapter.completedAt).toLocaleDateString()}`
                : 'Mark this chapter complete once you finish it.'}
            </p>
          </div>
          <Button onClick={handleComplete} disabled={saving || chapter.completed}>
            {chapter.completed ? 'Already completed' : saving ? 'Saving…' : 'Mark as complete'}
          </Button>
        </div>
      </div>
    </div>
  );
}
