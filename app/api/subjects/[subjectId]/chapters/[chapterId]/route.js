import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getChapterDetails, completeChapter } from '@/lib/chapters';

export async function GET(_req, { params }) {
  const token = await getToken({ req: _req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const chapter = await getChapterDetails(params.subjectId, params.chapterId, token.id);
  if (!chapter) {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
  }

  return NextResponse.json(chapter);
}

export async function POST(_req, { params }) {
  const token = await getToken({ req: _req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const chapter = await completeChapter(params.chapterId, token.id);
  return NextResponse.json({
    chapterId: chapter.chapterId,
    completedAt: chapter.completedAt,
    status: chapter.status,
  });
}
