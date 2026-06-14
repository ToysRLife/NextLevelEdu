import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getChaptersForSubject } from '@/lib/chapters';

export async function GET(request, { params }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const chapters = await getChaptersForSubject(params.subjectId, token.id);
  return NextResponse.json(chapters);
}
