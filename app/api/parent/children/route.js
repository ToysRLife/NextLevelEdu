import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { getParentChildren } from '@/lib/parentDashboard';

export async function GET(request) {
  const session = await getServerSession(authOptions, request);
  if (!session || session.user?.role !== 'PARENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getParentChildren(session.user.id);
  return NextResponse.json(data.children);
}
