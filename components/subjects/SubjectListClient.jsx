'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SubjectListClient() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const res = await fetch('/api/subjects');
        if (!res.ok) {
          throw new Error('Unable to load subjects.');
        }
        const data = await res.json();
        setSubjects(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error.');
      } finally {
        setLoading(false);
      }
    }

    loadSubjects();
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-slate-200">
        <p>Loading subjects…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500 bg-rose-950/10 p-8 text-rose-200">
        <p className="font-semibold">Failed to load subjects</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!subjects.length) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-slate-200">
        <p>No subjects are available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {subjects.map((subject) => (
        <article
          key={subject.id}
          className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sky-300">
                Grade {subject.grade}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-100">{subject.name}</h2>
            </div>
            <Badge>{subject.order + 1}</Badge>
          </div>
          <p className="mt-4 text-slate-400">
            {subject.description ?? 'No description available.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild variant="secondary">
              <Link href={`/subjects/${subject.id}`}>View details</Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
