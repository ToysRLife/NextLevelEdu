'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SubjectForm({ action, initialData = {}, submitLabel = 'Save subject' }) {
  const [name, setName] = useState(initialData.name ?? '');
  const [grade, setGrade] = useState(initialData.grade ?? 1);
  const [description, setDescription] = useState(initialData.description ?? '');
  const [order, setOrder] = useState(initialData.order ?? 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = useMemo(() => name.trim().length > 0 && Number(grade) > 0, [name, grade]);

  return (
    <form
      action={action}
      className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950/80 p-6"
      onSubmit={() => setIsSubmitting(true)}
    >
      <input type="hidden" name="subjectId" value={initialData.id ?? ''} />
      <div>
        <label className="block text-sm font-medium text-slate-300">Subject name</label>
        <Input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Mathematics"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-300">Grade</label>
          <Input
            name="grade"
            value={grade}
            type="number"
            min={1}
            onChange={(event) => setGrade(Number(event.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Order</label>
          <Input
            name="order"
            value={order}
            type="number"
            min={0}
            onChange={(event) => setOrder(Number(event.target.value))}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">Description</label>
        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="w-full rounded-3xl border border-slate-800/70 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 transition placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
          placeholder="Short subject explanation"
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
