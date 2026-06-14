import { NextResponse } from 'next/server';
import { getSubjectDetails, updateSubject, deleteSubject } from '@/lib/subjects';

export async function GET(_req, { params }) {
  const subject = await getSubjectDetails(params.subjectId);

  if (!subject) {
    return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
  }

  return NextResponse.json(subject);
}

export async function PUT(request, { params }) {
  const payload = await request.json();
  const updated = await updateSubject({ subjectId: params.subjectId, ...payload });
  return NextResponse.json(updated);
}

export async function DELETE(_req, { params }) {
  await deleteSubject(params.subjectId);
  return NextResponse.json({ success: true });
}
