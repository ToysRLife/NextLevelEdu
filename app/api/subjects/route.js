import { NextResponse } from 'next/server';
import { getSubjects, createSubject } from '@/lib/subjects';

export async function GET(request) {
  const { search, page, pageSize } = Object.fromEntries(request.nextUrl.searchParams.entries());
  const data = await getSubjects({
    search: String(search || ''),
    page: Number(page || 1),
    pageSize: Number(pageSize || 10),
  });

  return NextResponse.json(data);
}

export async function POST(request) {
  const payload = await request.json();
  const subject = await createSubject(payload);
  return NextResponse.json(subject, { status: 201 });
}
